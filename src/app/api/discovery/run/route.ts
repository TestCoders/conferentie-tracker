// Eigenaar: B. POST /api/discovery/run — beveiligd met ADMIN_TOKEN.
import { runDiscovery } from '@/lib/discovery';
import { jsonError, requireAdmin } from '@/lib/http';
import type { DiscoveryRunResponse, DiscoverySource } from '@/lib/types';

const ALLOWED_SOURCES: DiscoverySource[] = ['confs-tech', 'testing-conferences'];
export const maxDuration = 60;

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
  if (Object.keys(fields).some((key) => key !== 'source')) {
    return jsonError('Alleen het veld source is toegestaan', 400);
  }
  const source = fields.source === undefined ? 'confs-tech' : fields.source;
  if (typeof source !== 'string' || !ALLOWED_SOURCES.includes(source as DiscoverySource)) {
    return jsonError('Onbekende discoverybron', 400);
  }
  if (source === 'testing-conferences') {
    return jsonError('TestingConferences-adapter is nog niet gebouwd', 501);
  }

  try {
    const result = await runDiscovery('confs-tech');
    return Response.json(result satisfies DiscoveryRunResponse);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Discovery mislukt', 500);
  }
}
