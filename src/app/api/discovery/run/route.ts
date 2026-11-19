// Eigenaar: B. POST /api/discovery/run — beveiligd met ADMIN_TOKEN.
import { runDiscovery } from '@/lib/discovery';
import { jsonError, requireAdmin } from '@/lib/http';
import type { DiscoveryRunResponse, DiscoverySource } from '@/lib/types';

const ALLOWED_SOURCES: DiscoverySource[] = ['confs-tech', 'testing-conferences'];

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { source?: unknown };
  const source = (body.source ?? 'confs-tech') as DiscoverySource;
  if (!ALLOWED_SOURCES.includes(source))
    return jsonError(`Onbekende bron: ${String(body.source)}`, 400);

  const result = await runDiscovery(source);
  return Response.json(result satisfies DiscoveryRunResponse);
}
