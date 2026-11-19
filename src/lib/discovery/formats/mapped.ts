// Eigenaar: B. JSON/YAML-feeds met onbekende veldnamen: lijst vinden, velden herkennen, records lezen.
import type { FetchResult } from '@/lib/discovery/fetch-source';
import {
  categorize,
  countryName,
  decodeEntities,
  isIsoDateLike,
  priceText,
  toIsoDate,
  type Origin,
} from '@/lib/discovery/formats/common';
import { normalizeUrl } from '@/lib/discovery/normalize-url';
import { parseLocation, parseTestingDates } from '@/lib/discovery/testing-conferences';
import { readText, readUrl } from '@/lib/discovery/validation';
import {
  MAPPED_FIELDS,
  type ConferenceInput,
  type MappedField,
  type SourceParseConfig,
} from '@/lib/types';

type Rec = Record<string, unknown>;

const isRecord = (value: unknown): value is Rec =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Sleutelnamen genormaliseerd (kleine letters, zonder '_', '-', spaties). */
const SYNONYMS: Record<MappedField, string[]> = {
  name: ['name', 'title', 'conference', 'conferencename', 'event', 'eventname', 'summary', 'label'],
  url: ['url', 'website', 'link', 'homepage', 'href', 'site', 'websiteurl', 'officialurl', 'web'],
  startDate: [
    'startdate',
    'start',
    'datestart',
    'from',
    'begin',
    'begins',
    'startson',
    'startsat',
    'startat',
    'date',
    'eventdate',
  ],
  endDate: ['enddate', 'end', 'dateend', 'to', 'until', 'ends', 'endson', 'endsat', 'endat'],
  dates: ['dates', 'date', 'when', 'daterange'],
  city: ['city', 'town', 'locality'],
  country: ['country', 'countryname', 'nation'],
  location: ['location', 'place', 'venue', 'where', 'address'],
  online: ['online', 'isonline', 'virtual', 'remote', 'onlineonly'],
  cfpUrl: ['cfpurl', 'cfp', 'cfplink', 'callforpapers', 'callforpapersurl', 'cfpwebsite'],
  cfpDeadline: [
    'cfpenddate',
    'cfpdeadline',
    'cfpend',
    'cfpclose',
    'cfpcloses',
    'cfpcloseat',
    'callforpapersdeadline',
  ],
  price: ['price', 'ticketprice', 'cost', 'fee'],
};

const PREFERRED_LIST_KEYS = ['conferences', 'events', 'items', 'data', 'results', 'entries'];
const SAMPLE_SIZE = 50;
const MIN_SHARE = 0.5;

const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

function isUrlLike(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isFreeTextDate(value: unknown): boolean {
  try {
    parseTestingDates(value);
    return true;
  } catch {
    return false;
  }
}

const isBooleanLike = (value: unknown) =>
  typeof value === 'boolean' || (typeof value === 'string' && /^(true|false|yes|no)$/i.test(value));

/** Welke waarden passen bij een veld; zo kiest 'date' vanzelf startDate (ISO) of dates (tekst). */
const VALID: Record<MappedField, (value: unknown) => boolean> = {
  name: (v) => typeof v === 'string' && v.trim().length > 0,
  url: isUrlLike,
  startDate: isIsoDateLike,
  endDate: isIsoDateLike,
  dates: isFreeTextDate,
  city: (v) => typeof v === 'string',
  country: (v) => typeof v === 'string' || (isRecord(v) && typeof v.name === 'string'),
  location: (v) => typeof v === 'string' || isRecord(v),
  online: isBooleanLike,
  cfpUrl: isUrlLike,
  cfpDeadline: isIsoDateLike,
  price: (v) => typeof v === 'number' || (typeof v === 'string' && v.trim().length > 0),
};

/** Zoekt de lijst met records: de feed zelf, of een lijst onder een sleutel (max. 3 diep). */
export function findRecords(data: unknown): { path: string[]; records: Rec[] } | null {
  const candidates: { path: string[]; records: Rec[] }[] = [];
  const visit = (value: unknown, path: string[]) => {
    if (Array.isArray(value)) {
      const records = value.filter(isRecord);
      if (records.length > 0 && records.length >= value.length / 2) {
        candidates.push({ path, records });
      }
      return;
    }
    if (!isRecord(value) || path.length >= 3) return;
    for (const [key, child] of Object.entries(value)) visit(child, [...path, key]);
  };
  visit(data, []);
  if (candidates.length === 0) return null;
  const preferred = (path: string[]) =>
    PREFERRED_LIST_KEYS.includes(normalizeKey(path.at(-1) ?? '')) ? 1 : 0;
  candidates.sort(
    (a, b) =>
      b.records.length - a.records.length ||
      preferred(b.path) - preferred(a.path) ||
      a.path.length - b.path.length,
  );
  return candidates[0];
}

/** Kiest per veld de sleutel die in de meeste records voorkomt én passende waarden heeft. */
export function detectFields(records: Rec[]): SourceParseConfig['fields'] | null {
  const sample = records.slice(0, SAMPLE_SIZE);
  const keys = [...new Set(sample.flatMap((record) => Object.keys(record)))];
  const fields: SourceParseConfig['fields'] = {};
  const used = new Set<string>();
  for (const field of MAPPED_FIELDS) {
    let best: { key: string; share: number; rank: number } | null = null;
    for (const key of keys) {
      if (used.has(key)) continue;
      const rank = SYNONYMS[field].indexOf(normalizeKey(key));
      if (rank < 0) continue;
      const present = sample.filter(
        (r) => r[key] !== undefined && r[key] !== null && r[key] !== '',
      );
      const valid = present.filter((r) => VALID[field](r[key])).length;
      // Optionele velden mogen vaak leeg zijn; de aanwezige waarden moeten wel kloppen.
      const required = field === 'name' || field === 'url';
      const share = required ? valid / sample.length : present.length ? valid / present.length : 0;
      if (share < MIN_SHARE) continue;
      if (!best || share > best.share || (share === best.share && rank < best.rank)) {
        best = { key, share, rank };
      }
    }
    if (best) {
      fields[field] = best.key;
      used.add(best.key);
    }
  }
  if (!fields.name || !fields.url || (!fields.startDate && !fields.dates)) return null;
  return fields;
}

export function detectConfig(data: unknown): SourceParseConfig | null {
  const found = findRecords(data);
  if (!found) return null;
  const fields = detectFields(found.records);
  return fields ? { recordsPath: found.path, fields } : null;
}

function recordsAt(data: unknown, path: string[]): unknown[] {
  let current = data;
  for (const key of path) current = isRecord(current) ? current[key] : undefined;
  if (!Array.isArray(current)) throw new Error('Lijst met conferenties niet (meer) gevonden');
  return current;
}

function textOf(value: unknown, field: string): string | null {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const text = readText(value, field);
  return text ? decodeEntities(text) : null;
}

const isOnlinePlace = (place: string | null) => place === null || /^online$/i.test(place);

function placeFromObject(value: Rec): Pick<ConferenceInput, 'city' | 'country'> {
  const country = isRecord(value.country) ? value.country.name : value.country;
  return {
    city: textOf(value.city ?? value.town ?? value.locality ?? null, 'location.city'),
    country: textOf(country ?? null, 'location.country'),
  };
}

export function parseMappedRecord(
  value: unknown,
  config: SourceParseConfig,
  origin: Origin,
): ConferenceInput {
  if (!isRecord(value)) throw new Error('Record moet een object zijn');
  const f = config.fields;
  const get = (field: MappedField) => (f[field] ? value[f[field]] : undefined);

  const name = textOf(get('name'), 'name');
  const officialUrl = readUrl(get('url'), 'url');
  if (!name || !officialUrl) throw new Error('Naam en officiële URL zijn verplicht');

  let startDate: string | null;
  let endDate: string | null = null;
  if (f.startDate) {
    startDate = toIsoDate(get('startDate'), 'startDate');
    endDate = toIsoDate(get('endDate'), 'endDate');
  } else {
    ({ start_date: startDate, end_date: endDate } = parseTestingDates(get('dates')));
  }
  if (!startDate) throw new Error('Begindatum ontbreekt');
  if (endDate && endDate < startDate) throw new Error('Einddatum ligt vóór begindatum');

  let city: string | null = null;
  let country: string | null = null;
  let onlineByLocation = false;
  if (f.city || f.country) {
    city = textOf(get('city') ?? null, 'city');
    const rawCountry = get('country');
    country = textOf((isRecord(rawCountry) ? rawCountry.name : rawCountry) ?? null, 'country');
  } else if (f.location) {
    const location = get('location');
    if (isRecord(location)) ({ city, country } = placeFromObject(location));
    else {
      const parsed = parseLocation(location ?? null);
      ({ city, country } = parsed);
      onlineByLocation = parsed.online_only;
    }
  }
  const onlineValue = get('online');
  const onlineFlag = onlineValue === true || /^(true|yes)$/i.test(String(onlineValue ?? ''));
  // Zoals bij confs.tech: online-vlag met fysieke plaats = hybride.
  const onlineOnly =
    onlineByLocation || (onlineFlag && isOnlinePlace(city) && isOnlinePlace(country));

  return {
    name,
    official_url: officialUrl,
    canonical_url: normalizeUrl(officialUrl),
    source_name: origin.sourceName,
    source_url: origin.sourceUrl,
    start_date: startDate,
    end_date: endDate,
    city: onlineOnly || city === null || /^online$/i.test(city) ? null : city,
    country:
      onlineOnly || country === null || /^online$/i.test(country) ? null : countryName(country),
    online_only: onlineOnly,
    category: categorize(name, origin.defaultCategory),
    cfp_url: readUrl(get('cfpUrl'), 'cfpUrl'),
    cfp_deadline: toIsoDate(get('cfpDeadline'), 'cfpDeadline'),
    price_text: priceText(get('price')),
  };
}

export function parseMappedData(
  data: unknown,
  config: SourceParseConfig,
  origin: Origin,
): FetchResult {
  const records = recordsAt(data, config.recordsPath);
  const items: ConferenceInput[] = [];
  const errors: string[] = [];
  for (const [index, record] of records.entries()) {
    try {
      items.push(parseMappedRecord(record, config, origin));
    } catch (error) {
      errors.push(
        `${origin.sourceUrl}, record ${index + 1}: ${error instanceof Error ? error.message : 'Ongeldig record'}`,
      );
    }
  }
  if (records.length === 0) errors.push(`${origin.sourceUrl}: bron bevat geen conferenties`);
  return { items, errors };
}
