// Eigenaar: B. Meldt na een import op een eigen bron voor welke records de kostenschatting werkt.
// Gebruikt exact dezelfde berekening als de explorer (estimateCosts); verzint geen bedragen.
import { assumptionMap, COST_ASSUMPTION_COLUMNS, countryKey, estimateCosts } from '@/lib/costs';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { ConferenceInput, CostAssumption, CostCoverage } from '@/lib/types';

type Item = Pick<ConferenceInput, 'country' | 'start_date' | 'end_date' | 'online_only'>;

function sortedLabels(byKey: Map<string, string>): string[] {
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'nl'));
}

export function summarizeCostCoverage(items: Item[], assumptions: CostAssumption[]): CostCoverage {
  const map = assumptionMap(assumptions);
  const onDefault = new Map<string, string>();
  const missing = new Map<string, string>();
  let withEstimate = 0;
  let online = 0;
  let withoutLocation = 0;
  for (const item of items) {
    const estimate = estimateCosts(item, map);
    const key = countryKey(item.country);
    if (estimate) {
      withEstimate += 1;
      if (estimate.basis === 'online') online += 1;
      if (estimate.basis === 'default' && key && item.country && !onDefault.has(key)) {
        onDefault.set(key, item.country);
      }
    } else if (!key || !item.country) {
      withoutLocation += 1;
    } else if (!missing.has(key)) {
      missing.set(key, item.country);
    }
  }
  return {
    withEstimate,
    online,
    onDefault: sortedLabels(onDefault),
    missingCountries: sortedLabels(missing),
    withoutLocation,
  };
}

/** Null als de aannames niet te laden zijn; de import zelf mag daar niet op falen. */
export async function loadCostCoverage(items: Item[]): Promise<CostCoverage | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('cost_assumptions')
    .select(COST_ASSUMPTION_COLUMNS)
    .limit(1000);
  if (error || !data) return null;
  return summarizeCostCoverage(items, data as CostAssumption[]);
}
