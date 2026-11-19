// Eigenaar: B. Herkent per URL welk formaat een bron heeft, en leest hem met de passende parser.
import { parseDocument } from 'yaml';
import { aiConfigured } from '@/lib/ai/openrouter';
import { parseConfsTechRecord } from '@/lib/discovery/confs-tech';
import type { ExternalDocument, FetchResult } from '@/lib/discovery/fetch-source';
import { extractWithAi } from '@/lib/discovery/formats/ai-extract';
import { categorize, suggestCategory, type Origin } from '@/lib/discovery/formats/common';
import { looksLikeICal, parseICal } from '@/lib/discovery/formats/ical';
import { extractJsonLdEvents, parseJsonLd } from '@/lib/discovery/formats/jsonld';
import { detectConfig, parseMappedData } from '@/lib/discovery/formats/mapped';
import { parseTestingConferencesYaml } from '@/lib/discovery/testing-conferences';
import type { Category, ConferenceInput, CustomSourceFormat, SourceParseConfig } from '@/lib/types';

export type Detected = { format: CustomSourceFormat; config: SourceParseConfig | null };

/** Sleutels van het confs.tech-schema; een feed met alleen deze sleutels krijgt die parser. */
const CONFS_TECH_KEYS = new Set([
  'name',
  'url',
  'startDate',
  'endDate',
  'city',
  'country',
  'online',
  'locales',
  'cocUrl',
  'cfpUrl',
  'cfpEndDate',
  'twitter',
  'mastodon',
  'bluesky',
  'github',
  'offersSignLanguageOrCC',
]);
const TESTING_KEYS = new Set(['name', 'location', 'dates', 'url', 'status', 'twitter']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function hasOnlyKeys(data: unknown, allowed: Set<string>, required: string[]): boolean {
  if (!Array.isArray(data) || data.length === 0 || !data.every(isRecord)) return false;
  return data.every(
    (record) =>
      Object.keys(record).every((key) => allowed.has(key)) &&
      required.every((key) => key in record),
  );
}

function looksLikeHtml(doc: ExternalDocument): boolean {
  const head = doc.text.trimStart().slice(0, 2000);
  return (
    /html|xhtml/.test(doc.contentType) ||
    /^<(!doctype\s+html|html|head|body)\b/i.test(head) ||
    /<html[\s>]/i.test(head)
  );
}

function parseYaml(text: string): unknown {
  const document = parseDocument(text, { schema: 'failsafe', uniqueKeys: true });
  if (document.errors.length) throw new Error('Ongeldige YAML');
  return document.toJS({ maxAliasCount: 0 });
}

/** Ruwe data (JSON of YAML) van een niet-HTML-bron, of null. */
function structuredData(doc: ExternalDocument): { kind: 'json' | 'yaml'; data: unknown } | null {
  const text = doc.text.replace(/^﻿/, '');
  try {
    return { kind: 'json', data: JSON.parse(text) };
  } catch {
    // Geen JSON; misschien YAML.
  }
  try {
    const data = parseYaml(text);
    return typeof data === 'object' && data !== null ? { kind: 'yaml', data } : null;
  } catch {
    return null;
  }
}

/** Herkent het formaat; gooit een Error met uitleg als er niets bruikbaars is. */
export function detectFormat(doc: ExternalDocument): Detected {
  if (looksLikeHtml(doc)) {
    if (extractJsonLdEvents(doc.text).length > 0) return { format: 'jsonld', config: null };
    if (aiConfigured()) return { format: 'ai', config: null };
    throw new Error(
      'Webpagina zonder gestructureerde conferentiegegevens (schema.org); AI-extractie is niet geconfigureerd (OPENROUTER_API_KEY)',
    );
  }
  if (looksLikeICal(doc.text)) return { format: 'ical', config: null };
  const structured = structuredData(doc);
  if (!structured) throw new Error('Onbekend formaat: geen JSON, YAML, iCalendar of HTML');
  const { kind, data } = structured;
  if (kind === 'json' && hasOnlyKeys(data, CONFS_TECH_KEYS, ['name', 'url', 'startDate'])) {
    return { format: 'confs-tech-json', config: null };
  }
  if (kind === 'yaml' && hasOnlyKeys(data, TESTING_KEYS, ['name', 'url', 'dates'])) {
    return { format: 'testing-conferences-yaml', config: null };
  }
  const config = detectConfig(data);
  if (!config) {
    throw new Error(
      `${kind.toUpperCase()} zonder herkenbare conferentielijst: geen velden voor naam, URL en datum gevonden`,
    );
  }
  return { format: kind, config };
}

function parseConfsTechData(data: unknown, origin: Origin): FetchResult {
  if (!Array.isArray(data)) throw new Error('Bron bevat geen JSON-array');
  const items: ConferenceInput[] = [];
  const errors: string[] = [];
  for (const [index, record] of data.entries()) {
    try {
      items.push(parseConfsTechRecord(record, origin.sourceUrl, origin.sourceName));
    } catch (error) {
      errors.push(
        `${origin.sourceUrl}, record ${index + 1}: ${error instanceof Error ? error.message : 'Ongeldig record'}`,
      );
    }
  }
  return { items, errors };
}

/** Leest een opgehaalde bron met het (eerder herkende) formaat. */
export async function parseWithFormat(
  doc: ExternalDocument,
  detected: Detected,
  origin: Origin,
): Promise<FetchResult> {
  switch (detected.format) {
    case 'confs-tech-json':
      return parseConfsTechData(JSON.parse(doc.text.replace(/^﻿/, '')), origin);
    case 'testing-conferences-yaml': {
      const result = parseTestingConferencesYaml(doc.text, {
        sourceUrl: origin.sourceUrl,
        sourceName: origin.sourceName,
      });
      return { items: result.items, errors: result.errors.map((e) => `${origin.sourceUrl}: ${e}`) };
    }
    case 'json':
    case 'yaml': {
      if (!detected.config) throw new Error('Veldinstelling ontbreekt; analyseer de bron opnieuw');
      const structured = structuredData(doc);
      if (!structured)
        throw new Error(`Bron is geen geldige ${detected.format.toUpperCase()} meer`);
      return parseMappedData(structured.data, detected.config, origin);
    }
    case 'ical':
      return parseICal(doc.text, origin);
    case 'jsonld':
      return parseJsonLd(doc.text, doc.url, origin);
    case 'ai':
      return extractWithAi(doc.text, doc.url, origin);
  }
}

/** Past de categorie aan op een (gekozen of voorgestelde) standaardcategorie. */
export function recategorize(items: ConferenceInput[], fallback: Category): ConferenceInput[] {
  return items.map((item) => ({ ...item, category: categorize(item.name, fallback) }));
}

export { suggestCategory };
