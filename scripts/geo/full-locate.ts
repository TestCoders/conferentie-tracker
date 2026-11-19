/**
 * Volledige plaatsbepaling, alleen gebruikt door scripts/generate-geo-data.mjs (niet in de app).
 * Stad + land → coördinaten met de grote plaatsentabel (GeoNames cities15000, CC BY 4.0) en
 * landen (Natural Earth, publiek domein). Stad niet gevonden → midden van het land; twijfel → null.
 */
import { countryKey } from '@/lib/costs';
import { normalizePlace, type MapLocation } from '@/lib/geo/locate';

export type CountryRow = [string, number, number, ...string[]];
export type CityRow = [string, number, number, number, ...string[]];
export type Gazetteer = { countries: CountryRow[]; cities: CityRow[] };

/** Bronnen zetten soms een deelstaat of landsdeel op de plek van het land ("Bellevue, WA"). */
const REGION_COUNTRY: Record<string, string> = {
  ...Object.fromEntries(
    (
      'al ak az ar ca co ct de fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy dc ' +
      'alabama alaska arizona arkansas california colorado connecticut delaware florida georgia hawaii idaho illinois indiana iowa kansas kentucky louisiana maine maryland massachusetts michigan minnesota mississippi missouri montana nebraska nevada ohio oklahoma oregon pennsylvania tennessee texas utah vermont virginia washington wisconsin wyoming'
    )
      .split(' ')
      .map((region) => [region, 'US']),
  ),
  'new hampshire': 'US',
  'new jersey': 'US',
  'new mexico': 'US',
  'new york': 'US',
  'north carolina': 'US',
  'north dakota': 'US',
  'rhode island': 'US',
  'south carolina': 'US',
  'south dakota': 'US',
  'west virginia': 'US',
  'd c': 'US',
  'washington dc': 'US',
  'sf bay area': 'US',
  on: 'CA',
  qc: 'CA',
  bc: 'CA',
  ab: 'CA',
  ontario: 'CA',
  quebec: 'CA',
  'british columbia': 'CA',
  alberta: 'CA',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  'northern ireland': 'GB',
  uae: 'AE',
  aus: 'AU',
  'western australia': 'AU',
  victoria: 'AU',
  nsw: 'AU',
};

type CountryEntry = { iso2: string; lat: number; lng: number };
type Index = {
  countries: Map<string, CountryEntry>;
  cities: Map<string, { lat: number; lng: number; pop: number }>;
};
let index: Index | null = null;
let data: Gazetteer = { countries: [], cities: [] };

export function setGazetteer(gazetteer: Gazetteer) {
  data = gazetteer;
  index = null;
}

function getIndex(): Index {
  if (index) return index;
  const countries: Index['countries'] = new Map();
  for (const [iso2, lat, lng, ...names] of data.countries) {
    const entry = { iso2, lat, lng };
    for (const key of [iso2.toLowerCase(), ...names.map((n) => countryKey(n))]) {
      if (key && !countries.has(key)) countries.set(key, entry);
    }
  }
  const cities: Index['cities'] = new Map();
  const add = (key: string, value: { lat: number; lng: number; pop: number }) => {
    const existing = cities.get(key);
    // Zelfde naam in hetzelfde land: de grootste plaats wint.
    if (!existing || existing.pop < value.pop) cities.set(key, value);
  };
  for (const [cc, lat, lng, pop, ...names] of data.cities) {
    for (const name of names) {
      add(`${cc}|${name}`, { lat, lng, pop });
      // "New York City" → "new york", "Frankfurt am Main" → "frankfurt" (alleen grotere plaatsen).
      if (pop >= 100) {
        const short = name.replace(/ city$/, '').replace(/ (am|an der|upon|on|sur|im) .+$/, '');
        if (short !== name && short.length >= 3) add(`${cc}|${short}`, { lat, lng, pop });
      }
    }
  }
  index = { countries, cities };
  return index;
}

const NOISE = /\b(online|hybrid|virtual)\b|[&+]|\band\b/g;
const SUFFIX = /[\s-]+(city|cbd|county|area|bay area|metro|downtown|centre|center|airport)$/;

/** "Maarssen (Utrecht)", "Frankfurt am Main - Airport", "San Diego, CA" → zoekkandidaten. */
export function cityCandidates(city: string): string[] {
  const raw = normalizePlace(city);
  const inParens = [...raw.matchAll(/\(([^)]+)\)/g)].map((m) => m[1]);
  const parts = [raw.replace(/\([^)]*\)/g, ' '), ...inParens]
    .flatMap((part) => part.split(/,|\s[-–]\s|\//))
    .map((part) => part.replace(NOISE, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    for (const variant of [
      part,
      part.replace(SUFFIX, ''),
      part.replace(/^the /, ''),
      part.replace(/-/g, ' '),
      part.replace(/^st\.? /, 'saint '),
      part.replace(/^st\.? /, 'sankt '),
    ]) {
      const v = variant.trim();
      if (v && !out.includes(v)) out.push(v);
    }
  }
  return out;
}

type CountryCandidate = { entry: CountryEntry; exact: boolean };

/**
 * Mogelijke landen uit een (soms rommelige) bronwaarde: "U.S.A.", "FL USA", "ON Canada", "WA",
 * "Spain (October 27) and Online". Een losse code van twee letters is niet `exact`: "CA" kan
 * Canada of Californië zijn. Probeert eerst de hele waarde, daarna steeds minder.
 */
export function countryCandidates(country: string): CountryCandidate[] {
  const { countries } = getIndex();
  const out: CountryCandidate[] = [];
  const push = (entry: CountryEntry | undefined, exact: boolean) => {
    if (entry && !out.some((c) => c.entry.iso2 === entry.iso2)) out.push({ entry, exact });
  };
  const lookup = (value: string) => {
    const key = normalizePlace(value).replace(/\./g, '').trim();
    if (!key) return;
    const exact = !/^[a-z]{2}$/.test(key);
    push(countries.get(countryKey(value) ?? '') ?? countries.get(key), exact);
    const region = REGION_COUNTRY[key];
    if (region) push(countries.get(region.toLowerCase()), exact);
  };
  const cleaned = country
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+(and|&)\s+.*$/i, '')
    .replace(/[^\p{L}\p{M}\s.'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ');
  for (const candidate of [country, cleaned, words.slice(-2).join(' '), words.at(-1), words[0]]) {
    if (candidate) lookup(candidate);
    if (out.some((c) => c.exact)) break;
  }
  return out;
}

export function locate(
  city: string | null,
  country: string | null,
  onlineOnly = false,
): MapLocation | null {
  if (onlineOnly || !country) return null;
  const { cities } = getIndex();
  const candidates = countryCandidates(country);
  if (city) {
    const names = cityCandidates(city);
    for (const { entry } of candidates) {
      for (const name of names) {
        const hit = cities.get(`${entry.iso2}|${name}`);
        if (hit) return { lat: hit.lat, lng: hit.lng, precision: 'city' };
      }
    }
  }
  // Alleen terugvallen op het land als dat ondubbelzinnig is; liever geen punt dan een verkeerd land.
  const fallback =
    candidates.find((c) => c.exact) ?? (candidates.length === 1 && !city ? candidates[0] : null);
  return fallback
    ? { lat: fallback.entry.lat, lng: fallback.entry.lng, precision: 'country' }
    : null;
}
