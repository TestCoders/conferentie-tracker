// POST — AI-verrijking starten: { target: 'costs' } of { target: 'conferences', limit?: 1–12 }.
// Entra-adminrol vereist. Elke run wordt gelogd in ingestion_runs (source_name 'ai-enrichment').
import { aiConfigured } from '@/lib/ai/openrouter';
import { enrichConferences, enrichCosts } from '@/lib/ai/enrich';
import { jsonError, requireAdmin } from '@/lib/http';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ENRICH_TARGETS, type EnrichResponse, type EnrichTarget } from '@/lib/types';

export const maxDuration = 60;

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 12;

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  if (!aiConfigured()) return jsonError('OPENROUTER_API_KEY is niet geconfigureerd', 501);

  let target: EnrichTarget;
  let limit = DEFAULT_LIMIT;
  try {
    const raw = await request.text();
    if (raw.length > 200) return jsonError('Requestbody is te groot', 400);
    const body = JSON.parse(raw || '{}') as Record<string, unknown>;
    if (typeof body !== 'object' || body === null || Array.isArray(body))
      throw new Error('Body moet een object zijn');
    if (Object.keys(body).some((k) => k !== 'target' && k !== 'limit')) {
      throw new Error('Alleen de velden target en limit zijn toegestaan');
    }
    if (!ENRICH_TARGETS.includes(body.target as EnrichTarget)) {
      throw new Error(`target moet ${ENRICH_TARGETS.join(' of ')} zijn`);
    }
    target = body.target as EnrichTarget;
    if (body.limit !== undefined) {
      if (
        typeof body.limit !== 'number' ||
        !Number.isInteger(body.limit) ||
        body.limit < 1 ||
        body.limit > MAX_LIMIT
      ) {
        throw new Error(`limit moet 1 t/m ${MAX_LIMIT} zijn`);
      }
      limit = body.limit;
    }
  } catch (err) {
    return jsonError(err instanceof SyntaxError ? 'Ongeldige JSON' : (err as Error).message, 400);
  }

  const db = getSupabaseAdmin();
  const run = await db
    .from('ingestion_runs')
    .insert({ source_name: 'ai-enrichment', status: 'running' })
    .select('id')
    .single();
  const runId = (run.data as { id: string } | null)?.id ?? null;

  let result: EnrichResponse | null = null;
  let failure: string | null = null;
  try {
    result = target === 'costs' ? await enrichCosts(db) : await enrichConferences(db, limit);
  } catch (err) {
    failure = err instanceof Error ? err.message : 'AI-verrijking mislukt';
  }

  if (runId) {
    await db
      .from('ingestion_runs')
      .update({
        status: failure ? 'failed' : 'success',
        found_count: result?.processed ?? 0,
        updated_count: result?.updated ?? 0,
        error_message: failure ?? (result?.errors.length ? result.errors.join('\n') : null),
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId);
  }

  if (failure || !result) return jsonError(failure ?? 'AI-verrijking mislukt', 502);
  return Response.json(result satisfies EnrichResponse);
}
