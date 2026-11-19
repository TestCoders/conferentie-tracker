// Eigenaar: B. Orchestratie: bron ophalen → upsert op (canonical_url, start_date) → ingestion_runs.
import { fetchConfsTech, fetchConfsTechPast } from '@/lib/discovery/confs-tech';
import {
  fetchTestingConferences,
  fetchTestingConferencesPast,
} from '@/lib/discovery/testing-conferences';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { ConferenceInput, DiscoveryRunResponse, DiscoverySource } from '@/lib/types';

function conferenceKey(item: Pick<ConferenceInput, 'canonical_url' | 'start_date'>): string {
  return JSON.stringify([item.canonical_url, item.start_date]);
}

/** Een bron kan dezelfde conferentie in meerdere categoriefeeds opnemen. */
export function deduplicateConferences(items: ConferenceInput[]): ConferenceInput[] {
  const unique = new Map<string, ConferenceInput>();
  for (const item of items) {
    const key = conferenceKey(item);
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()];
}

const ADAPTERS: Record<
  DiscoverySource,
  () => Promise<{ items: ConferenceInput[]; errors: string[] }>
> = {
  'confs-tech': fetchConfsTech,
  'testing-conferences': fetchTestingConferences,
  // Historie: afgelopen 12 maanden, zodat bezoekers die als "bijgewoond" kunnen markeren.
  'confs-tech-past': () => fetchConfsTechPast(),
  'testing-conferences-past': () => fetchTestingConferencesPast(),
};

export async function runDiscovery(source: DiscoverySource): Promise<DiscoveryRunResponse> {
  const adapter = ADAPTERS[source];
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
      const existing = rows.filter((item) => !insertedKeys.has(conferenceKey(item)));
      if (existing.length > 0) {
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
