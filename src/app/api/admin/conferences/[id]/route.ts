// Eigenaar: D. PATCH /api/admin/conferences/:id — status + beperkte whitelist (ADMIN_EDITABLE_FIELDS).
import { jsonError, requireAdmin } from '@/lib/http';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  ADMIN_EDITABLE_FIELDS,
  CONFERENCE_COLUMNS,
  CONFERENCE_STATUSES,
  type Conference,
  type ConferencePatch,
} from '@/lib/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME_MAX = 200;
const PLACE_MAX = 100;
const TICKET_MAX_EUR = 20000;
const URL_MAX = 2000;

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Optionele tekst: string (getrimd) of null; lege string wordt null. */
function parseOptionalText(value: unknown, field: string, max: number): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error(`${field} moet een string of null zijn`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new Error(`${field} mag maximaal ${max} tekens zijn`);
  return trimmed === '' ? null : trimmed;
}

function parsePatch(body: unknown): ConferencePatch {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('Body moet een JSON-object zijn');
  }
  const input = body as Record<string, unknown>;
  const allowed: readonly string[] = ADMIN_EDITABLE_FIELDS;
  const unknownKeys = Object.keys(input).filter((k) => !allowed.includes(k));
  if (unknownKeys.length > 0) {
    throw new Error(`Niet toegestane velden: ${unknownKeys.join(', ')}`);
  }

  const patch: ConferencePatch = {};

  if ('status' in input) {
    const status = input.status;
    if (
      typeof status !== 'string' ||
      !(CONFERENCE_STATUSES as readonly string[]).includes(status)
    ) {
      throw new Error(`status moet één van ${CONFERENCE_STATUSES.join(', ')} zijn`);
    }
    patch.status = status as Conference['status'];
  }

  if ('name' in input) {
    const name = input.name;
    if (typeof name !== 'string' || name.trim() === '') throw new Error('name is verplicht');
    if (name.trim().length > NAME_MAX) {
      throw new Error(`name mag maximaal ${NAME_MAX} tekens zijn`);
    }
    patch.name = name.trim();
  }

  if ('city' in input) patch.city = parseOptionalText(input.city, 'city', PLACE_MAX);
  if ('country' in input) patch.country = parseOptionalText(input.country, 'country', PLACE_MAX);

  if ('cfp_deadline' in input) {
    const deadline = parseOptionalText(input.cfp_deadline, 'cfp_deadline', 10);
    if (deadline !== null && !isValidDate(deadline)) {
      throw new Error('cfp_deadline moet een geldige datum (YYYY-MM-DD) of null zijn');
    }
    patch.cfp_deadline = deadline;
  }

  if ('ticket_price_eur' in input) {
    const price = input.ticket_price_eur;
    if (
      price !== null &&
      (typeof price !== 'number' || !Number.isInteger(price) || price < 0 || price > TICKET_MAX_EUR)
    ) {
      throw new Error(
        `ticket_price_eur moet een geheel bedrag van 0 t/m ${TICKET_MAX_EUR} of null zijn`,
      );
    }
    patch.ticket_price_eur = price;
  }

  if ('ticket_price_url' in input) {
    let url = parseOptionalText(input.ticket_price_url, 'ticket_price_url', URL_MAX);
    if (url !== null) {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new Error('ticket_price_url moet een geldige URL zijn');
      }
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
        throw new Error('ticket_price_url moet een https-URL zonder inloggegevens zijn');
      }
      url = parsed.href;
    }
    patch.ticket_price_url = url;
  }

  if (Object.keys(patch).length === 0) throw new Error('Geen velden om bij te werken');
  return patch;
}

export async function PATCH(request: Request, ctx: RouteContext<'/api/admin/conferences/[id]'>) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return jsonError('Ongeldig id', 400);

  let patch: ConferencePatch;
  try {
    const body: unknown = await request.json();
    patch = parsePatch(body);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Ongeldige body', 400);
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('conferences')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(CONFERENCE_COLUMNS)
      .maybeSingle();

    if (error) return jsonError(error.message, 500);
    if (!data) return jsonError('Conferentie niet gevonden', 404);
    return Response.json(data as Conference);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}
