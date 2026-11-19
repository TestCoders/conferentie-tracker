// Eigenaar: B. Orchestratie: bron ophalen → upsert op (canonical_url, start_date) → ingestion_runs.
import { fetchConfsTech, fetchConfsTechPast } from '@/lib/discovery/confs-tech';
import {
  fetchTestingConferences,
  fetchTestingConferencesPast,
} from '@/lib/discovery/testing-conferences';
import { strongerCategory } from '@/lib/discovery/classify';
import { loadCostCoverage } from '@/lib/discovery/cost-coverage';
import { fetchCustomSource, getCustomSource } from '@/lib/discovery/custom-sources';
import type { FetchResult } from '@/lib/discovery/fetch-source';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { Category, ConferenceInput, DiscoveryRunResponse, DiscoverySource } from '@/lib/types';

export class SourceNotFoundError extends Error {}

function conferenceKey(item: Pick<ConferenceInput, 'canonical_url' | 'start_date'>): string {
  return JSON.stringify([item.canonical_url, item.start_date]);
}

/**
 * Een bron kan dezelfde conferentie in meerdere categoriefeeds opnemen (bijv. devops én testing).
 * Het eerste record blijft, met de sterkste categorie van alle dubbelen.
 */
export function deduplicateConferences(items: ConferenceInput[]): ConferenceInput[] {
  const unique = new Map<string, ConferenceInput>();
  for (const item of items) {
    const key = conferenceKey(item);
    const seen = unique.get(key);
    if (!seen) unique.set(key, item);
    else unique.set(key, { ...seen, category: strongerCategory(seen.category, item.category) });
  }
  return [...unique.values()];
}

type CategoryRow = Pick<ConferenceInput, 'canonical_url' | 'start_date' | 'category'>;

/** Huidige categorie per conferentie, zodat een herimport die niet verlaagt. */
async function existingCategories(
  db: ReturnType<typeof getSupabaseAdmin>,
  urls: string[],
): Promise<Map<string, Category>> {
  const categories = new Map<string, Category>();
  const unique = [...new Set(urls)];
  for (let i = 0; i < unique.length; i += 100) {
    const { data, error } = await db
      .from('conferences')
      .select('canonical_url,start_date,category')
      .in('canonical_url', unique.slice(i, i + 100));
    if (error || !data) throw new Error('Bestaande categorieën ophalen mislukt');
    for (const row of data as CategoryRow[]) categories.set(conferenceKey(row), row.category);
  }
  return categories;
}

const ADAPTERS: Record<DiscoverySource, () => Promise<FetchResult>> = {
  'confs-tech': fetchConfsTech,
  'testing-conferences': fetchTestingConferences,
  // Historie: afgelopen 12 maanden, zodat bezoekers die als "bijgewoond" kunnen markeren.
  'confs-tech-past': () => fetchConfsTechPast(),
  'testing-conferences-past': () => fetchTestingConferencesPast(),
};

export function runDiscovery(source: DiscoverySource): Promise<DiscoveryRunResponse> {
  return runIngestion(source, ADAPTERS[source]);
}

/** Een door een beheerder toegevoegde bron; dezelfde pipeline als de vaste bronnen. */
export async function runCustomDiscovery(sourceId: string): Promise<DiscoveryRunResponse> {
  const source = await getCustomSource(sourceId);
  if (!source) throw new SourceNotFoundError('Bron niet gevonden');
  let fetched: ConferenceInput[] = [];
  const result = await runIngestion(source.name, async () => {
    const response = await fetchCustomSource(source);
    fetched = response.items;
    return response;
  });
  const coverage = await loadCostCoverage(deduplicateConferences(fetched));
  if (coverage) result.costCoverage = coverage;
  return result;
}

/** Ophalen → ontdubbelen → upsert op (canonical_url, start_date) → ingestion_runs. */
async function runIngestion(
  source: string,
  adapter: () => Promise<FetchResult>,
): Promise<DiscoveryRunResponse> {
  const db = getSupabaseAdmin();
  const { data: run, error: startError } = await db
    .from('ingestion_runs')
    .insert({ source_name: source, status: 'running' })
    .select('id')
    .single();
  if (startError || !run) throw new Error('Importregistratie starten mislukt');

  const result: DiscoveryRunResponse = {
    source,
    found: 0,
    inserted: 0,
    updated: 0,
    errors: [],
  };
  let failure: Error | null = null;
  try {
    const fetched = await adapter();
    const items = deduplicateConferences(fetched.items);
    result.found = items.length;
    result.errors.push(...fetched.errors);
    if (items.length > 0) {
      const checkedAt = new Date().toISOString();
      // Geen status meesturen: nieuwe records gebruiken de DB-default; moderatie blijft behouden.
      const rows = items.map((item) => {
        const { status, ...fields } = item;
        void status;
        return { ...fields, last_checked_at: checkedAt, updated_at: checkedAt };
      });
      // DO NOTHING + RETURNING telt echt ingevoegde rijen, ook bij gelijktijdige imports.
      const { data: inserted, error: insertError } = await db
        .from('conferences')
        .upsert(rows, { onConflict: 'canonical_url,start_date', ignoreDuplicates: true })
        .select('canonical_url,start_date');
      if (insertError || !inserted) throw new Error('Conferenties invoegen mislukt');
      result.inserted = inserted.length;
      const insertedKeys = new Set(inserted.map(conferenceKey));
      const existingRows = rows.filter((item) => !insertedKeys.has(conferenceKey(item)));
      if (existingRows.length > 0) {
        // Een categorie mag stijgen (betere classificatie), nooit dalen (bijv. door een andere bron).
        const current = await existingCategories(
          db,
          existingRows.map((item) => item.canonical_url),
        );
        const existing = existingRows.map((item) => {
          const stored = current.get(conferenceKey(item));
          return stored ? { ...item, category: strongerCategory(stored, item.category) } : item;
        });
        const { data: updated, error: updateError } = await db
          .from('conferences')
          .upsert(existing, { onConflict: 'canonical_url,start_date' })
          .select('canonical_url,start_date');
        if (updateError || !updated) throw new Error('Conferenties bijwerken mislukt');
        result.updated = updated.length;
      }
    }
  } catch (error) {
    failure = error instanceof Error ? error : new Error('Discovery mislukt');
    result.errors.push(failure.message);
  }
  const { error: finishError } = await db
    .from('ingestion_runs')
    .update({
      status: result.errors.length ? 'failed' : 'success',
      found_count: result.found,
      inserted_count: result.inserted,
      updated_count: result.updated,
      error_message: result.errors.length ? result.errors.join('\n') : null,
      finished_at: new Date().toISOString(),
    })
    .eq('id', run.id);
  if (finishError) throw new Error('Importregistratie afsluiten mislukt');
  if (failure) throw failure;
  return result;
}
