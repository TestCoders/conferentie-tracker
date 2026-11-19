/**
 * AI-verrijking (server-only): kostenaannames per land schatten en ontbrekende conferentiegegevens
 * van de officiële website halen. Productowner-keuze: ruwe AI-schattingen zijn prima als indicatie,
 * en elke run ververst alles (ook eerder handmatig ingevulde aannames en ticketprijzen).
 *
 * Regels:
 * - Kostenaannames: per land reis retour vanuit NL + hotel per nacht, ruwe indicatie, prijspeil nu.
 * - Conferenties: alleen wat op de officiële pagina staat; onbekend blijft null (geen verzinsels).
 *   Gegevens uit de bron (stad/land/CFP) worden alleen aangevuld als ze ontbreken, of ververst als
 *   de AI ze eerder vulde. Ticketprijs wordt altijd ververst als de AI hem vindt.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_COST_COUNTRY_KEY, DEFAULT_COST_LABEL, countryKey } from '@/lib/costs';
import type { AiField, Conference, CostAssumption, EnrichResponse } from '@/lib/types';
import { chatJson, type JsonSchema } from './openrouter';
import { fetchPage, type PageSnapshot } from './safe-fetch';

const BATCH_SIZE = 3;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const today = () => new Date().toISOString().slice(0, 10);

function int(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  return n >= min && n <= max ? n : null;
}

function str(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim().replace(/\s+/g, ' ');
  return s && s.length <= max && !/[\u0000-\u001f\u007f]/.test(s) ? s : null;
}

function date(value: unknown): string | null {
  const s = str(value, 10);
  if (!s || !DATE_RE.test(s)) return null;
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s ? s : null;
}

function httpsUrl(value: unknown, allowed: Set<string>): string | null {
  const s = str(value, 2000);
  if (!s) return null;
  try {
    const u = new URL(s).toString();
    return u.startsWith('https://') && allowed.has(u) ? u : null;
  } catch {
    return null;
  }
}

/* ---------- kostenaannames per land ---------- */

const COSTS_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'travel_eur', 'hotel_per_night_eur', 'note'],
        properties: {
          key: { type: 'string' },
          travel_eur: { type: 'integer' },
          hotel_per_night_eur: { type: 'integer' },
          note: { type: 'string' },
        },
      },
    },
  },
};

export async function enrichCosts(db: SupabaseClient): Promise<EnrichResponse> {
  const result: EnrichResponse = {
    target: 'costs',
    model: null,
    requests: 0,
    processed: 0,
    updated: 0,
    remaining: null,
    errors: [],
  };

  const { data, error } = await db
    .from('conferences')
    .select('country')
    .eq('status', 'approved')
    .eq('online_only', false)
    .not('country', 'is', null)
    .limit(5000);
  if (error) throw new Error(error.message);

  const countries = new Map<string, string>();
  for (const row of (data ?? []) as { country: string }[]) {
    const key = countryKey(row.country);
    if (key && key !== DEFAULT_COST_COUNTRY_KEY && !countries.has(key))
      countries.set(key, row.country);
  }
  countries.set(DEFAULT_COST_COUNTRY_KEY, 'gemiddelde overige landen (standaardaanname)');
  const list = [...countries].map(([key, label]) => ({ key, label }));

  const { data: ai, model } = await chatJson(
    [
      {
        role: 'system',
        content:
          "Je maakt ruwe kosteninschattingen voor zakenreizen naar conferenties. Antwoord uitsluitend met JSON volgens het schema. Bedragen in hele euro's per persoon, prijspeil van vandaag.",
      },
      {
        role: 'user',
        content: [
          `Datum: ${today()}. Vertrekpunt: Nederland (Amsterdam/Utrecht).`,
          'Geef per land een ruwe indicatie:',
          '- travel_eur: reis retour per persoon. Trein of auto als dat gebruikelijk is (< ca. 700 km), anders economy-vlucht inclusief bagage, ongeveer 6 weken vooruit geboekt. Voor Nederland zelf: binnenlandse reis.',
          '- hotel_per_night_eur: middenklasse (3-sterren) hotelkamer in een typische conferentiestad, per nacht.',
          '- note: korte toelichting (max. 120 tekens), bijv. "vlucht AMS–NYC, hotel Manhattan-niveau".',
          'Gebruik exact de opgegeven key. Key "*" is het gemiddelde voor overige landen.',
          `Landen: ${JSON.stringify(list)}`,
        ].join('\n'),
      },
    ],
    'cost_assumptions',
    COSTS_SCHEMA,
  );
  result.requests += 1;
  result.model = model;

  const items = (ai as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) throw new Error('AI-antwoord zonder items');
  const now = new Date().toISOString();
  const rows: CostAssumption[] = [];
  for (const raw of items) {
    const r = raw as Record<string, unknown>;
    const key = typeof r.key === 'string' ? r.key.trim().toLowerCase() : '';
    const label = countries.get(key);
    const travel = int(r.travel_eur, 0, 20000);
    const hotel = int(r.hotel_per_night_eur, 0, 5000);
    if (!label) continue;
    if (travel === null || hotel === null) {
      result.errors.push(`${label}: ongeldige bedragen van de AI, overgeslagen`);
      continue;
    }
    rows.push({
      country_key: key,
      country_label: key === DEFAULT_COST_COUNTRY_KEY ? DEFAULT_COST_LABEL : label,
      travel_eur: travel,
      hotel_per_night_eur: hotel,
      source: 'ai',
      note: str(r.note, 300),
      updated_at: now,
    });
  }
  result.processed = countries.size;
  const missing = list.filter((c) => !rows.some((r) => r.country_key === c.key));
  for (const m of missing) result.errors.push(`${m.label}: geen schatting van de AI`);

  if (rows.length) {
    const up = await db
      .from('cost_assumptions')
      .upsert(rows, { onConflict: 'country_key' })
      .select('country_key');
    if (up.error) throw new Error(up.error.message);
    result.updated = up.data?.length ?? 0;
  }
  return result;
}

/* ---------- conferenties ---------- */

const CONFERENCE_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'city',
          'country',
          'online_only',
          'ticket_price_eur',
          'ticket_price_url',
          'cfp_deadline',
          'cfp_url',
        ],
        properties: {
          id: { type: 'string' },
          city: { type: ['string', 'null'] },
          country: { type: ['string', 'null'] },
          online_only: { type: ['boolean', 'null'] },
          ticket_price_eur: { type: ['integer', 'null'] },
          ticket_price_url: { type: ['string', 'null'] },
          cfp_deadline: { type: ['string', 'null'] },
          cfp_url: { type: ['string', 'null'] },
        },
      },
    },
  },
};

type Row = Pick<
  Conference,
  | 'id'
  | 'name'
  | 'official_url'
  | 'start_date'
  | 'end_date'
  | 'city'
  | 'country'
  | 'online_only'
  | 'cfp_url'
  | 'cfp_deadline'
  | 'ticket_price_eur'
  | 'ticket_price_url'
  | 'ai_fields'
>;

type Candidate = { row: Row; page: PageSnapshot };

/** Welke updates passen we toe op basis van het AI-antwoord? Puur, daardoor testbaar. */
export function planConferenceUpdate(
  row: Row,
  ai: Record<string, unknown>,
  allowedUrls: Set<string>,
): { patch: Partial<Row>; fields: AiField[] } {
  const owned = new Set(row.ai_fields ?? []);
  const patch: Partial<Row> = {};
  const fields = new Set<AiField>(row.ai_fields ?? []);
  // Bronwaarde alleen aanvullen als die ontbreekt, of verversen als de AI hem eerder vulde.
  const mayFill = (field: AiField, current: unknown) => current === null || owned.has(field);

  const city = str(ai.city, 100);
  const country = str(ai.country, 80);
  if (ai.online_only === true && row.city === null && row.country === null && !row.online_only) {
    patch.online_only = true;
    fields.add('online_only');
  } else if (!row.online_only) {
    if (city && mayFill('city', row.city) && city !== row.city) {
      patch.city = city;
      fields.add('city');
    }
    if (country && mayFill('country', row.country) && country !== row.country) {
      patch.country = country;
      fields.add('country');
    }
  }

  // Ticketprijs: altijd verversen als de AI hem op de officiële site vindt (prijzen veranderen).
  const price = int(ai.ticket_price_eur, 0, 20000);
  if (price !== null) {
    const priceUrl = httpsUrl(ai.ticket_price_url, allowedUrls) ?? row.official_url;
    if (price !== row.ticket_price_eur || priceUrl !== row.ticket_price_url) {
      patch.ticket_price_eur = price;
      patch.ticket_price_url = priceUrl;
    }
    fields.add('ticket_price_eur');
    fields.add('ticket_price_url');
  }

  const cfpDeadline = date(ai.cfp_deadline);
  if (
    cfpDeadline &&
    mayFill('cfp_deadline', row.cfp_deadline) &&
    cfpDeadline !== row.cfp_deadline
  ) {
    patch.cfp_deadline = cfpDeadline;
    fields.add('cfp_deadline');
  }
  const cfpUrl = httpsUrl(ai.cfp_url, allowedUrls);
  if (cfpUrl && mayFill('cfp_url', row.cfp_url) && cfpUrl !== row.cfp_url) {
    patch.cfp_url = cfpUrl;
    fields.add('cfp_url');
  }

  return { patch, fields: [...fields] };
}

async function askConferences(batch: Candidate[]) {
  return chatJson(
    [
      {
        role: 'system',
        content:
          'Je haalt feitelijke gegevens uit de tekst van officiële conferentiewebsites. Gebruik alleen wat in de paginatekst staat; verzin niets. Onbekend = null. Antwoord uitsluitend met JSON volgens het schema.',
      },
      {
        role: 'user',
        content: [
          'Geef per conferentie (zelfde id):',
          '- city, country: plaats van de fysieke editie (land in het Engels, bijv. "Germany"); null als online of onbekend.',
          '- online_only: true alleen als de conferentie uitsluitend online is; false als er een fysieke editie is; null als onduidelijk.',
          "- ticket_price_eur: prijs van een regulier volledig conferentieticket (alle dagen) per persoon in hele euro's; omrekenen uit andere valuta mag (ruw). Kies het standaard-/regular-tarief, niet early bird, studenten of workshops. null als er geen prijs staat.",
          '- ticket_price_url: de URL uit "links" (of de pagina-URL) waar de prijs staat; anders null.',
          '- cfp_deadline: sluitingsdatum call for papers als YYYY-MM-DD; null als onbekend of verlopen onduidelijk.',
          '- cfp_url: URL uit "links" van de call for papers; anders null.',
          JSON.stringify(
            batch.map(({ row, page }) => ({
              id: row.id,
              name: row.name,
              dates: [row.start_date, row.end_date].filter(Boolean).join(' – '),
              known: { city: row.city, country: row.country, online_only: row.online_only },
              url: page.url,
              title: page.title,
              links: page.links,
              text: page.text,
            })),
          ),
        ].join('\n'),
      },
    ],
    'conference_details',
    CONFERENCE_SCHEMA,
  );
}

export async function enrichConferences(
  db: SupabaseClient,
  limit: number,
): Promise<EnrichResponse> {
  const result: EnrichResponse = {
    target: 'conferences',
    model: null,
    requests: 0,
    processed: 0,
    updated: 0,
    remaining: null,
    errors: [],
  };

  // Eerst nooit gecontroleerd, daarna het langst geleden; aankomende conferenties eerst.
  const { data, error } = await db
    .from('conferences')
    .select(
      'id,name,official_url,start_date,end_date,city,country,online_only,cfp_url,cfp_deadline,ticket_price_eur,ticket_price_url,ai_fields',
    )
    .eq('status', 'approved')
    .order('ai_checked_at', { ascending: true, nullsFirst: true })
    .order('start_date', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  const checkedAt = new Date().toISOString();

  // Pagina's parallel ophalen; mislukte pagina's wel als gecontroleerd markeren (rotatie).
  const pages = await Promise.all(
    rows.map(async (row) => {
      try {
        return { row, page: await fetchPage(row.official_url) };
      } catch (err) {
        result.errors.push(`${row.name}: website niet op te halen (${(err as Error).message})`);
        return { row, page: null };
      }
    }),
  );
  const failed = pages.filter((p) => !p.page).map((p) => p.row.id);
  if (failed.length) {
    await db.from('conferences').update({ ai_checked_at: checkedAt }).in('id', failed);
    result.processed += failed.length;
  }

  const candidates = pages.filter((p): p is Candidate => p.page !== null);
  const batches: Candidate[][] = [];
  for (let i = 0; i < candidates.length; i += BATCH_SIZE)
    batches.push(candidates.slice(i, i + BATCH_SIZE));

  const answers = await Promise.all(
    batches.map(async (batch) => {
      try {
        const res = await askConferences(batch);
        return { batch, res };
      } catch (err) {
        result.errors.push(
          `AI-verzoek mislukt voor ${batch.map((b) => b.row.name).join(', ')}: ${(err as Error).message}`,
        );
        return { batch, res: null };
      }
    }),
  );
  result.requests += batches.length;

  for (const { batch, res } of answers) {
    if (!res) continue; // Niet markeren: volgende run opnieuw proberen.
    result.model = res.model ?? result.model;
    const items = (res.data as { items?: unknown[] } | null)?.items ?? [];
    const byId = new Map(
      items
        .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null)
        .map((i) => [String(i.id), i]),
    );
    for (const { row, page } of batch) {
      const ai = byId.get(row.id);
      result.processed += 1;
      if (!ai) {
        result.errors.push(`${row.name}: geen antwoord van de AI`);
        await db.from('conferences').update({ ai_checked_at: checkedAt }).eq('id', row.id);
        continue;
      }
      const allowed = new Set([page.url, row.official_url, ...page.links]);
      const { patch, fields } = planConferenceUpdate(row, ai, allowed);
      const changed = Object.keys(patch).length > 0;
      const up = await db
        .from('conferences')
        .update({ ...patch, ai_fields: fields, ai_checked_at: checkedAt })
        .eq('id', row.id);
      if (up.error) result.errors.push(`${row.name}: opslaan mislukt (${up.error.message})`);
      else if (changed) result.updated += 1;
    }
  }

  const never = await db
    .from('conferences')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'approved')
    .is('ai_checked_at', null);
  result.remaining = never.count ?? null;
  return result;
}
