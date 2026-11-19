// Eigenaar: B. Adapter voor de live JSON-feed van confs.tech.
import type { ConferenceInput } from '@/lib/types';
import { normalizeUrl } from '@/lib/discovery/normalize-url';

export const CONFS_TECH_SOURCES = [
  'https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/2027/javascript.json',
  'https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/2027/devops.json',
] as const;

function text(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2000) {
    throw new Error(`Ongeldig veld: ${field}`);
  }
  return value.trim() || null;
}

function date(value: unknown, field: string): string | null {
  const result = text(value, field);
  if (result === null) return null;
  const timestamp = Date.parse(`${result}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result) ||
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== result
  ) {
    throw new Error(`Ongeldige datum: ${field}`);
  }
  return result;
}

function url(value: unknown, field: string): string | null {
  const result = text(value, field);
  if (result === null) return null;
  normalizeUrl(result);
  return result;
}

export function parseConfsTechRecord(value: unknown, sourceUrl: string): ConferenceInput {
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
  return {
    name,
    official_url: officialUrl,
    canonical_url: normalizeUrl(officialUrl),
    source_name: 'confs-tech',
    source_url: sourceUrl,
    start_date: startDate,
    end_date: endDate,
    city: text(record.city, 'city'),
    country: text(record.country, 'country'),
    category: 'development',
    cfp_url: url(record.cfpUrl, 'cfpUrl'),
    cfp_deadline: date(record.cfpEndDate, 'cfpEndDate'),
    price_text: null,
  };
}

/** Alleen deze vaste bronnen ophalen; fouten per bron/record rapporteren. */
export async function fetchConfsTech(): Promise<{ items: ConferenceInput[]; errors: string[] }> {
  const results = await Promise.all(
    CONFS_TECH_SOURCES.map(async (sourceUrl) => {
      const items: ConferenceInput[] = [];
      const errors: string[] = [];
      try {
        const response = await fetch(sourceUrl, {
          cache: 'no-store',
          redirect: 'error',
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error('Bron bevat geen JSON-array');
        for (const [index, record] of data.entries()) {
          try {
            items.push(parseConfsTechRecord(record, sourceUrl));
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
