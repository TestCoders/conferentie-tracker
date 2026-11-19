// Eigenaar: B. Orchestratie: bron ophalen → upsert op (canonical_url, start_date) → ingestion_runs.
import type { DiscoveryRunResponse, DiscoverySource } from '@/lib/types';

/**
 * TODO(B):
 * 1. insert ingestion_runs (status 'running')
 * 2. adapter aanroepen
 * 3. upsert met onConflict: 'canonical_url,start_date' (geen blinde insert); tel inserted/updated
 * 4. last_checked_at bijwerken; run afsluiten met 'success' / 'failed'
 */
export async function runDiscovery(source: DiscoverySource): Promise<DiscoveryRunResponse> {
  return {
    source,
    found: 0,
    inserted: 0,
    updated: 0,
    errors: ['runDiscovery is nog niet geïmplementeerd'],
  };
}
