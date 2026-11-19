// Eigenaar: B. POST /api/discovery/run — beveiligd met ADMIN_TOKEN.
// Body: { "source": "<vaste bron>" } of { "sourceId": "<uuid van een eigen bron>" }.
import { runCustomDiscovery, runDiscovery, SourceNotFoundError } from '@/lib/discovery';
import { isUuid } from '@/lib/discovery/custom-sources';
import { refreshConferenceImages } from '@/lib/discovery/images';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { jsonError, requireAdmin } from '@/lib/http';
import { DISCOVERY_SOURCES, type DiscoveryRunResponse, type DiscoverySource } from '@/lib/types';

const ALLOWED_SOURCES: readonly string[] = DISCOVERY_SOURCES;
export const maxDuration = 60;

/** Best effort: een mislukte afbeeldingenstap mag de import zelf nooit laten falen. */
async function withImages(result: DiscoveryRunResponse): Promise<DiscoveryRunResponse> {
  try {
    result.images = await refreshConferenceImages(getSupabaseAdmin());
  } catch {
    // images blijft weg; de volgende run probeert het opnieuw.
  }
  return result;
}

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const raw = await request.text();
  if (raw.length > 1000) return jsonError('Requestbody is te groot', 400);
  let body: unknown = {};
  if (raw.trim()) {
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonError('Ongeldige JSON', 400);
    }
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return jsonError('Requestbody moet een object zijn', 400);
  }
  const fields = body as Record<string, unknown>;
  const keys = Object.keys(fields);
  if (keys.some((key) => key !== 'source' && key !== 'sourceId')) {
    return jsonError('Alleen het veld source of sourceId is toegestaan', 400);
  }
  if (keys.length > 1) return jsonError('Geef óf source óf sourceId op', 400);
  if ('sourceId' in fields) {
    if (!isUuid(fields.sourceId)) return jsonError('sourceId moet een UUID zijn', 400);
    try {
      const result = await withImages(await runCustomDiscovery(fields.sourceId));
      return Response.json(result satisfies DiscoveryRunResponse);
    } catch (error) {
      if (error instanceof SourceNotFoundError) return jsonError(error.message, 404);
      return jsonError(error instanceof Error ? error.message : 'Discovery mislukt', 500);
    }
  }
  const source = fields.source === undefined ? 'confs-tech' : fields.source;
  if (typeof source !== 'string' || !ALLOWED_SOURCES.includes(source)) {
    return jsonError('Onbekende discoverybron', 400);
  }
  try {
    const result = await withImages(await runDiscovery(source as DiscoverySource));
    return Response.json(result satisfies DiscoveryRunResponse);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Discovery mislukt', 500);
  }
}
