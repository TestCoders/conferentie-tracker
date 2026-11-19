/**
 * Kostenschatting per conferentie (roadmap #4). Pure functies, bruikbaar op server en client.
 *
 * Berekening (navolgbaar, geen verzonnen bedragen):
 *   reis    = aanname voor het land (retour vanuit NL, per persoon)
 *   hotel   = aanname per nacht × aantal nachten
 *   nachten = aantal conferentiedagen (aankomst de avond ervoor, vertrek na de laatste dag)
 *   ticket  = officiële prijs (door een beheerder ingevuld) als die bekend is, anders niet meegeteld
 * Geen aanname voor het land: de standaardaanname (country_key '*'), duidelijk als zodanig getoond.
 * Online-only: reis en hotel zijn € 0. Locatie onbekend (TBA): geen schatting (Onbekend).
 *
 * AANSLUITPUNT ROADMAP #1 (AI-koppeling): laat #1 `ticket_price_eur` en `ticket_price_url`
 * vullen; `ticketFor` en de UI nemen die dan vanzelf mee.
 */
import type { Conference, CostAssumption } from '@/lib/types';

export const COST_ASSUMPTION_COLUMNS =
  'country_key,country_label,travel_eur,hotel_per_night_eur,updated_at,source,note';

/** country_key van de standaardaanname voor landen zonder eigen aanname. */
export const DEFAULT_COST_COUNTRY_KEY = '*';
export const DEFAULT_COST_LABEL = 'standaard (overige landen)';

/** Varianten uit de bronnen die hetzelfde land bedoelen. */
const COUNTRY_ALIASES: Record<string, string> = {
  us: 'usa',
  'united states': 'usa',
  'united states of america': 'usa',
  'united kingdom': 'uk',
  'great britain': 'uk',
  england: 'uk',
  holland: 'netherlands',
  nederland: 'netherlands',
  deutschland: 'germany',
};

/** 'U.S.A.' → 'usa', 'the Netherlands' → 'netherlands', 'U.K.' → 'uk'. Leeg → null. */
export function countryKey(country: string | null | undefined): string | null {
  if (!country) return null;
  const key = country
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/^the\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!key) return null;
  return COUNTRY_ALIASES[key] ?? key;
}

export function conferenceDays(c: Pick<Conference, 'start_date' | 'end_date'>): number {
  const start = Date.parse(`${c.start_date}T00:00:00Z`);
  const end = c.end_date ? Date.parse(`${c.end_date}T00:00:00Z`) : start;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 1;
  return Math.round((end - start) / 86_400_000) + 1;
}

/** Officiële ticketprijs (per persoon, hele euro's) met bron; byAi = door de AI van de website gehaald. */
export type TicketPrice = { amount: number; sourceUrl: string | null; byAi?: boolean };

/** Officiële ticketprijs van een conferentie, of null als die (nog) onbekend is. */
export function ticketFor(
  c: Pick<Conference, 'ticket_price_eur' | 'ticket_price_url'> & {
    ai_fields?: Conference['ai_fields'];
  },
): TicketPrice | null {
  if (c.ticket_price_eur === null) return null;
  return {
    amount: c.ticket_price_eur,
    sourceUrl: c.ticket_price_url,
    byAi: c.ai_fields?.includes('ticket_price_eur') ?? false,
  };
}

/** Waar reis/hotel op gebaseerd zijn. */
export type CostBasis = 'country' | 'default' | 'online';

export type CostEstimate = {
  basis: CostBasis;
  /** Herkomst van de gebruikte aanname: beheerder of AI-schatting (null bij online). */
  assumptionSource: CostAssumption['source'] | null;
  /** Datum van de gebruikte aanname (YYYY-MM-DD), voor "AI-schatting · datum". */
  assumptionDate: string | null;
  countryLabel: string;
  travel: number;
  hotelPerNight: number;
  nights: number;
  hotel: number;
  ticket: TicketPrice | null;
  /** Reis + hotel (+ ticket als bekend). */
  total: number;
};

export function assumptionMap(items: CostAssumption[]): Map<string, CostAssumption> {
  return new Map(items.map((a) => [a.country_key, a]));
}

export function estimateCosts(
  c: Pick<Conference, 'country' | 'start_date' | 'end_date' | 'online_only'>,
  assumptions: Map<string, CostAssumption>,
  ticket: TicketPrice | null = null,
): CostEstimate | null {
  if (c.online_only) {
    return {
      basis: 'online',
      assumptionSource: null,
      assumptionDate: null,
      countryLabel: 'online',
      travel: 0,
      hotelPerNight: 0,
      nights: 0,
      hotel: 0,
      ticket,
      total: ticket?.amount ?? 0,
    };
  }
  const key = countryKey(c.country);
  if (!key || key === DEFAULT_COST_COUNTRY_KEY) return null;
  const own = assumptions.get(key);
  const a = own ?? assumptions.get(DEFAULT_COST_COUNTRY_KEY);
  if (!a) return null;
  const nights = conferenceDays(c);
  const hotel = a.hotel_per_night_eur * nights;
  return {
    basis: own ? 'country' : 'default',
    assumptionSource: a.source ?? 'admin',
    assumptionDate: a.updated_at ? a.updated_at.slice(0, 10) : null,
    countryLabel: own ? a.country_label : DEFAULT_COST_LABEL,
    travel: a.travel_eur,
    hotelPerNight: a.hotel_per_night_eur,
    nights,
    hotel,
    ticket,
    total: a.travel_eur + hotel + (ticket?.amount ?? 0),
  };
}

const euro = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export function formatEuro(amount: number): string {
  return euro.format(amount);
}
