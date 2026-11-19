// Eigenaar: B. Adapter voor de live JSON-feed van confs.tech.
import type { ConferenceInput } from '@/lib/types';
import { loadFixedSource, type FetchResult, type SourceLoader } from '@/lib/discovery/fetch-source';
import { normalizeUrl } from '@/lib/discovery/normalize-url';
import { readText as text, readDate as date, readUrl as url } from '@/lib/discovery/validation';
import { pastCutoff } from '@/lib/discovery/past-window';

export const CONFS_TECH_SOURCES = [
  'https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/2027/javascript.json',
  'https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/2027/devops.json',
] as const;

/** Historische feeds (bron 'confs-tech-past'); alleen records vanaf 12 maanden geleden. */
export const CONFS_TECH_PAST_SOURCES = [
  'https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/2026/javascript.json',
  'https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/2026/devops.json',
  'https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/2025/javascript.json',
  'https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/2025/devops.json',
] as const;

export function parseConfsTechRecord(
  value: unknown,
  sourceUrl: string,
  sourceName = 'confs-tech',
): ConferenceInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Record moet een object zijn');
  }
  const record = value as Record<string, unknown>;
  const name = text(record.name, 'name');
  const officialUrl = url(record.url, 'url');
  const startDate = date(record.startDate, 'startDate');
  if (!name || !officialUrl || !startDate) {
    throw new Error('Naam, officiële URL en begindatum zijn verplicht');
  }
  const endDate = date(record.endDate, 'endDate');
  if (endDate && endDate < startDate) throw new Error('Einddatum ligt vóór begindatum');
  const city = text(record.city, 'city');
  const country = text(record.country, 'country');
  // `online: true` betekent bij confs.tech ook hybride; alleen zonder fysieke plaats is het online-only.
  const isOnlinePlace = (place: string | null) => place === null || /^online$/i.test(place);
  const onlineOnly = record.online === true && isOnlinePlace(city) && isOnlinePlace(country);
  return {
    name,
    official_url: officialUrl,
    canonical_url: normalizeUrl(officialUrl),
    source_name: sourceName,
    source_url: sourceUrl,
    start_date: startDate,
    end_date: endDate,
    city: onlineOnly ? null : city,
    country: onlineOnly ? null : country,
    online_only: onlineOnly,
    category: 'development',
    cfp_url: url(record.cfpUrl, 'cfpUrl'),
    cfp_deadline: date(record.cfpEndDate, 'cfpEndDate'),
    price_text: null,
  };
}

type FeedOptions = { sourceName?: string; load?: SourceLoader };

/** Alleen deze vaste bronnen ophalen; fouten per bron/record rapporteren. */
export async function fetchConfsTech(): Promise<{ items: ConferenceInput[]; errors: string[] }> {
  return fetchConfsTechFeeds(CONFS_TECH_SOURCES);
}

/**
 * Historische feeds: conferenties met een begindatum vanaf 12 maanden geleden (inclusief
 * de rest van het lopende jaar). Oudere records worden overgeslagen, ook als ze ongeldig zijn.
 */
export async function fetchConfsTechPast(
  now: Date = new Date(),
): Promise<{ items: ConferenceInput[]; errors: string[] }> {
  const cutoff = pastCutoff(now);
  return fetchConfsTechFeeds(CONFS_TECH_PAST_SOURCES, (record) => {
    const start = (record as { startDate?: unknown } | null)?.startDate;
    return typeof start !== 'string' || start >= cutoff;
  });
}

/** Eén feed in confs.tech-formaat, bijv. een door een beheerder toegevoegde bron. */
export function fetchConfsTechFeed(
  sourceUrl: string,
  sourceName: string,
  load: SourceLoader = loadFixedSource,
): Promise<FetchResult> {
  return fetchConfsTechFeeds([sourceUrl], undefined, { sourceName, load });
}

async function fetchConfsTechFeeds(
  sources: readonly string[],
  keep: (record: unknown) => boolean = () => true,
  { sourceName = 'confs-tech', load = loadFixedSource }: FeedOptions = {},
): Promise<FetchResult> {
  const results = await Promise.all(
    sources.map(async (sourceUrl) => {
      const items: ConferenceInput[] = [];
      const errors: string[] = [];
      try {
        const data: unknown = JSON.parse(await load(sourceUrl));
        if (!Array.isArray(data)) throw new Error('Bron bevat geen JSON-array');
        for (const [index, record] of data.entries()) {
          if (!keep(record)) continue;
          try {
            items.push(parseConfsTechRecord(record, sourceUrl, sourceName));
          } catch (error) {
            errors.push(
              `${sourceUrl}, record ${index + 1}: ${error instanceof Error ? error.message : 'Ongeldig record'}`,
            );
          }
        }
        if (data.length === 0) errors.push(`${sourceUrl}: bron bevat geen conferenties`);
      } catch (error) {
        errors.push(`${sourceUrl}: ${error instanceof Error ? error.message : 'Ophalen mislukt'}`);
      }
      return { items, errors };
    }),
  );
  return {
    items: results.flatMap((result) => result.items),
    errors: results.flatMap((result) => result.errors),
  };
}
