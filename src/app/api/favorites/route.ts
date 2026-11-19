// GET / POST / DELETE — favorieten van de ingelogde gebruiker (roadmap R5).
// Eigenaar komt uitsluitend uit de geverifieerde Microsoft-sessie, nooit uit de request.
import { requireUser } from '@/lib/auth-access';
import { jsonError } from '@/lib/http';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { FavoritesResponse } from '@/lib/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FAVORITES = 500;
const BODY_MAX = 20_000;

/** Tabel ontbreekt (migratie nog niet gedraaid): client valt terug op opslag per browser. */
function unavailable(error: { code?: string } | null): Response | null {
  if (error?.code === 'PGRST205' || error?.code === '42P01') {
    return jsonError('Favorieten in je account zijn nog niet beschikbaar', 503);
  }
  return null;
}

export async function GET(request: Request) {
  const access = await requireUser(request);
  if (access.response) return access.response;
  const { data, error } = await getSupabaseAdmin()
    .from('favorites')
    .select('conference_id')
    .eq('user_id', access.user.id)
    .order('created_at', { ascending: true })
    .limit(MAX_FAVORITES);
  if (error || !data) return unavailable(error) ?? jsonError('Favorieten ophalen mislukt', 500);
  const body: FavoritesResponse = {
    items: (data as { conference_id: string }[]).map((row) => row.conference_id),
  };
  return Response.json(body);
}

/** Body: `{ "conferenceIds": ["<uuid>", …] }` — bestaande favorieten blijven staan. */
export async function POST(request: Request) {
  const access = await requireUser(request);
  if (access.response) return access.response;

  const text = await request.text();
  if (text.length > BODY_MAX) return jsonError('Verzoek is te groot', 400);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return jsonError('Ongeldige JSON', 400);
  }
  const ids =
    typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>).conferenceIds
      : undefined;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > MAX_FAVORITES ||
    !ids.every((id): id is string => typeof id === 'string' && UUID_RE.test(id))
  ) {
    return jsonError(`conferenceIds moet 1–${MAX_FAVORITES} UUIDs bevatten`, 400);
  }
  const unique = [...new Set(ids.map((id) => id.toLowerCase()))];

  const db = getSupabaseAdmin();
  // Alleen bestaande, goedgekeurde conferenties; onbekende IDs worden stil overgeslagen.
  // In blokken van 100, zodat de query-URL kort blijft.
  const known: string[] = [];
  for (let i = 0; i < unique.length; i += 100) {
    const { data, error } = await db
      .from('conferences')
      .select('id')
      .eq('status', 'approved')
      .in('id', unique.slice(i, i + 100));
    if (error || !data) return jsonError('Conferenties controleren mislukt', 500);
    known.push(...(data as { id: string }[]).map((c) => c.id));
  }

  const rows = known.map((id) => ({ user_id: access.user.id, conference_id: id }));
  if (rows.length > 0) {
    const { error } = await db
      .from('favorites')
      .upsert(rows, { onConflict: 'user_id,conference_id', ignoreDuplicates: true });
    if (error) return unavailable(error) ?? jsonError('Favorieten opslaan mislukt', 500);
  }
  return Response.json({ added: rows.length, skipped: unique.length - rows.length });
}

/** `DELETE /api/favorites?conferenceId=<uuid>` */
export async function DELETE(request: Request) {
  const access = await requireUser(request);
  if (access.response) return access.response;
  const conferenceId = new URL(request.url).searchParams.get('conferenceId') ?? '';
  if (!UUID_RE.test(conferenceId)) return jsonError('conferenceId (UUID) is verplicht', 400);
  const { error } = await getSupabaseAdmin()
    .from('favorites')
    .delete()
    .eq('user_id', access.user.id)
    .eq('conference_id', conferenceId.toLowerCase());
  if (error) return unavailable(error) ?? jsonError('Favoriet verwijderen mislukt', 500);
  return new Response(null, { status: 204 });
}
