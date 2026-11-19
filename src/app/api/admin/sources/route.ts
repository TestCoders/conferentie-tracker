// Eigenaar: D. GET/POST /api/admin/sources — door beheerders toegevoegde discoverybronnen.
import {
  createCustomSource,
  detectSource,
  DuplicateSourceError,
  listCustomSources,
  parseCreateCustomSource,
} from '@/lib/discovery/custom-sources';
import { jsonError, requireAdmin } from '@/lib/http';
import type { CustomDiscoverySource, ListResponse } from '@/lib/types';

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const items = await listCustomSources();
    return Response.json({ items } satisfies ListResponse<CustomDiscoverySource>);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Bronnen ophalen mislukt', 500);
  }
}

export const maxDuration = 30;

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const raw = await request.text();
  if (raw.length > 4000) return jsonError('Requestbody is te groot', 400);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonError('Ongeldige JSON', 400);
  }
  let input;
  try {
    input = await parseCreateCustomSource(body);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Ongeldige bron', 400);
  }
  // Het formaat bepaalt de server zelf, opnieuw bij het opslaan (geen formaat van de client).
  let detected;
  try {
    detected = await detectSource(input.url);
  } catch (error) {
    return jsonError(
      `Bron niet bruikbaar: ${error instanceof Error ? error.message : 'analyse mislukt'}`,
      400,
    );
  }
  try {
    const created = await createCustomSource(input, {
      format: detected.format,
      config: detected.config,
    });
    return Response.json(created satisfies CustomDiscoverySource, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateSourceError) return jsonError(error.message, 409);
    return jsonError(error instanceof Error ? error.message : 'Bron opslaan mislukt', 500);
  }
}
