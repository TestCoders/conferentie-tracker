// Eigenaar: B. Alleen de vaste, publieke YAML-bron van TestingConferences.org.
import { parseDocument } from 'yaml';
import { loadFixedSource, type FetchResult, type SourceLoader } from '@/lib/discovery/fetch-source';
import { classifyConference } from '@/lib/discovery/classify';
import { normalizeUrl } from '@/lib/discovery/normalize-url';
import { readDate, readText, readUrl } from '@/lib/discovery/validation';
import { mentionsYearSince, pastCutoff } from '@/lib/discovery/past-window';
import type { ConferenceInput } from '@/lib/types';

export const TESTING_CONFERENCES_SOURCE =
  'https://raw.githubusercontent.com/TestingConferences/testingconferences.github.io/main/_data/current.yml';

/** Historische lijst (bron 'testing-conferences-past'); alleen records vanaf 12 maanden geleden. */
export const TESTING_CONFERENCES_PAST_SOURCE =
  'https://raw.githubusercontent.com/TestingConferences/testingconferences.github.io/main/_data/past.yml';

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/** Alleen volledige datums; TBA of een los jaartal levert nooit een geraden datum op. */
export function parseTestingDates(
  value: unknown,
): Pick<ConferenceInput, 'start_date' | 'end_date'> {
  const text = readText(value, 'dates')?.replace(/[–—]/g, '-');
  const match = text?.match(/^([A-Za-z]+) (\d{1,2})(?:-(?:([A-Za-z]+) )?(\d{1,2}))?, (\d{4})$/);
  if (!match) throw new Error('Geen volledige, ondersteunde conferentiedatum');
  const [, month, day, endMonth, endDay, year] = match;
  const toDate = (monthName: string, dayNumber: string): string => {
    const monthNumber = MONTHS.indexOf(monthName.toLowerCase()) + 1;
    const iso = `${year}-${String(monthNumber).padStart(2, '0')}-${dayNumber.padStart(2, '0')}`;
    const parsed = readDate(iso, 'dates');
    if (!parsed) throw new Error('Conferentiedatum ontbreekt');
    return parsed;
  };
  const startDate = toDate(month, day);
  const endDate = endDay ? toDate(endMonth ?? month, endDay) : null;
  if (endDate && endDate < startDate) throw new Error('Einddatum ligt vóór begindatum');
  return { start_date: startDate, end_date: endDate };
}

/** "Stad, Land", "Online", "TBA" of "X and Online" (hybride). Ook gebruikt door eigen bronnen. */
export function parseLocation(
  value: unknown,
): Pick<ConferenceInput, 'city' | 'country' | 'online_only'> {
  const text = readText(value, 'location');
  // Alleen 'Online' is online-only; 'X and Online' is hybride en houdt zijn fysieke plaats.
  if (text && /^online$/i.test(text)) return { city: null, country: null, online_only: true };
  if (!text || /^(tba|tbd)$/i.test(text)) return { city: null, country: null, online_only: false };
  const parts = text
    .replace(/\s+and Online$/i, '')
    .split(',')
    .map((part) => part.trim());
  if (parts.at(-1)?.toLowerCase() === 'europe') parts.pop();
  if (parts.length < 2 || parts.some((part) => !part || /\b(tba|tbd|online)\b/i.test(part))) {
    return { city: null, country: null, online_only: false };
  }
  return {
    city: parts.slice(0, -1).join(', '),
    country: parts.at(-1) ?? null,
    online_only: false,
  };
}

export function parseTestingConferenceRecord(
  value: unknown,
  sourceUrl: string = TESTING_CONFERENCES_SOURCE,
  sourceName = 'testing-conferences',
): ConferenceInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Record moet een object zijn');
  }
  const record = value as Record<string, unknown>;
  const name = readText(record.name, 'name');
  const officialUrl = readUrl(record.url, 'url');
  if (!name || !officialUrl) throw new Error('Naam en officiële URL zijn verplicht');
  return {
    name,
    official_url: officialUrl,
    canonical_url: normalizeUrl(officialUrl),
    source_name: sourceName,
    source_url: sourceUrl,
    ...parseTestingDates(record.dates),
    ...parseLocation(record.location),
    category: classifyConference(name, 'testing'),
    // status bevat vrije tekst/HTML; geen prijs of CFP-deadline daaruit raden.
    cfp_url: null,
    cfp_deadline: null,
    price_text: null,
  };
}

type YamlOptions = {
  sourceUrl?: string;
  sourceName?: string;
  /** Alleen records met begindatum vanaf deze datum; oudere (ook ongeldige) worden overgeslagen. */
  since?: string;
};

export function parseTestingConferencesYaml(
  text: string,
  { sourceUrl = TESTING_CONFERENCES_SOURCE, sourceName, since }: YamlOptions = {},
): {
  items: ConferenceInput[];
  errors: string[];
} {
  const document = parseDocument(text, { schema: 'failsafe', uniqueKeys: true });
  if (document.errors.length || document.warnings.length) throw new Error('Ongeldige YAML-bron');
  const data: unknown = document.toJS({ maxAliasCount: 0 });
  if (!Array.isArray(data)) throw new Error('Bron bevat geen YAML-lijst');
  const items: ConferenceInput[] = [];
  const errors: string[] = [];
  for (const [index, record] of data.entries()) {
    try {
      const item = parseTestingConferenceRecord(record, sourceUrl, sourceName);
      if (since && item.start_date < since) continue;
      items.push(item);
    } catch (error) {
      // Historische bron: fouten in records van vóór het venster niet melden.
      const dates = (record as { dates?: unknown } | null)?.dates;
      if (since && !mentionsYearSince(dates, since)) continue;
      errors.push(
        `Record ${index + 1}: ${error instanceof Error ? error.message : 'Ongeldig record'}`,
      );
    }
  }
  if (data.length === 0) errors.push('Bron bevat geen conferenties');
  return { items, errors };
}

export async function fetchTestingConferences(): Promise<{
  items: ConferenceInput[];
  errors: string[];
}> {
  return fetchTestingYaml(TESTING_CONFERENCES_SOURCE);
}

/** Historische lijst: conferenties met begindatum vanaf 12 maanden geleden. */
export async function fetchTestingConferencesPast(now: Date = new Date()): Promise<{
  items: ConferenceInput[];
  errors: string[];
}> {
  return fetchTestingYaml(TESTING_CONFERENCES_PAST_SOURCE, pastCutoff(now));
}

/** Eén feed in TestingConferences-YAML-formaat, bijv. een door een beheerder toegevoegde bron. */
export function fetchTestingConferencesFeed(
  sourceUrl: string,
  sourceName: string,
  load: SourceLoader = loadFixedSource,
): Promise<FetchResult> {
  return fetchTestingYaml(sourceUrl, undefined, { sourceName, load });
}

async function fetchTestingYaml(
  sourceUrl: string,
  since?: string,
  { sourceName, load = loadFixedSource }: { sourceName?: string; load?: SourceLoader } = {},
): Promise<FetchResult> {
  try {
    const text = await load(sourceUrl);
    if (text.length > 1_000_000) throw new Error('YAML-bron is te groot');
    const result = parseTestingConferencesYaml(text, { sourceUrl, sourceName, since });
    return {
      items: result.items,
      errors: result.errors.map((error) => `${sourceUrl}: ${error}`),
    };
  } catch (error) {
    return {
      items: [],
      errors: [`${sourceUrl}: ${error instanceof Error ? error.message : 'Ophalen mislukt'}`],
    };
  }
}
