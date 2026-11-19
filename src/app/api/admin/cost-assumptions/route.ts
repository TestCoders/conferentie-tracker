// PUT (upsert) en DELETE ?country=… — kostenaannames per land beheren. Entra-adminrol vereist.
import { jsonError, requireAdmin } from '@/lib/http';
import {
  COST_ASSUMPTION_COLUMNS,
  countryKey,
  DEFAULT_COST_COUNTRY_KEY,
  DEFAULT_COST_LABEL,
} from '@/lib/costs';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { CostAssumption, UpsertCostAssumptionRequest } from '@/lib/types';

const LABEL_MAX = 80;
const TRAVEL_MAX = 20000;
const HOTEL_MAX = 5000;
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

function parseAmount(value: unknown, field: string, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) {
    throw new Error(`${field} moet een geheel bedrag van 0 t/m ${max} euro zijn`);
  }
  return value;
}

function parseUpsert(body: unknown): { key: string; label: string; travel: number; hotel: number } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('Body moet een JSON-object zijn');
  }
  const fields = body as Record<string, unknown>;
  const allowed: (keyof UpsertCostAssumptionRequest)[] = [
    'country',
    'travelEur',
    'hotelPerNightEur',
  ];
  if (Object.keys(fields).some((k) => !allowed.includes(k as keyof UpsertCostAssumptionRequest))) {
    throw new Error(`Alleen deze velden zijn toegestaan: ${allowed.join(', ')}`);
  }
  if (typeof fields.country !== 'string') throw new Error('country is verplicht');
  const label = fields.country.trim().replace(/\s+/g, ' ');
  if (!label || label.length > LABEL_MAX || CONTROL_RE.test(label)) {
    throw new Error(`country moet 1 t/m ${LABEL_MAX} tekens zijn`);
  }
  // '*' = standaardaanname voor landen zonder eigen aanname.
  const isDefault = label === DEFAULT_COST_COUNTRY_KEY;
  const key = isDefault ? DEFAULT_COST_COUNTRY_KEY : countryKey(label);
  if (!key) throw new Error('country is ongeldig');
  return {
    key,
    label: isDefault ? DEFAULT_COST_LABEL : label,
    travel: parseAmount(fields.travelEur, 'travelEur', TRAVEL_MAX),
    hotel: parseAmount(fields.hotelPerNightEur, 'hotelPerNightEur', HOTEL_MAX),
  };
}

export async function PUT(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  let input: ReturnType<typeof parseUpsert>;
  try {
    const raw = await request.text();
    if (raw.length > 1000) return jsonError('Requestbody is te groot', 400);
    input = parseUpsert(JSON.parse(raw) as unknown);
  } catch (err) {
    return jsonError(err instanceof SyntaxError ? 'Ongeldige JSON' : (err as Error).message, 400);
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('cost_assumptions')
      .upsert(
        {
          country_key: input.key,
          country_label: input.label,
          travel_eur: input.travel,
          hotel_per_night_eur: input.hotel,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'country_key' },
      )
      .select(COST_ASSUMPTION_COLUMNS)
      .single();
    if (error) return jsonError(error.message, 500);
    return Response.json(data as CostAssumption);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const country = new URL(request.url).searchParams.get('country');
  const key = country === DEFAULT_COST_COUNTRY_KEY ? DEFAULT_COST_COUNTRY_KEY : countryKey(country);
  if (!key) return jsonError('country is verplicht', 400);

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('cost_assumptions')
      .delete()
      .eq('country_key', key)
      .select('country_key');
    if (error) return jsonError(error.message, 500);
    if (!data || data.length === 0) return jsonError('Geen aanname voor dit land', 404);
    return new Response(null, { status: 204 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}
