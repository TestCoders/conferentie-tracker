// Eigenaar: B. HTML-pagina's met schema.org Event-gegevens (JSON-LD): alleen wat de pagina declareert.
import type { FetchResult } from '@/lib/discovery/fetch-source';
import {
  categorize,
  countryName,
  decodeEntities,
  placeFromAddress,
  priceText,
  toIsoDate,
  type Origin,
} from '@/lib/discovery/formats/common';
import { normalizeUrl } from '@/lib/discovery/normalize-url';
import { readUrl } from '@/lib/discovery/validation';
import type { ConferenceInput } from '@/lib/types';

type Rec = Record<string, unknown>;
const isRecord = (value: unknown): value is Rec =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const MAX_EVENTS = 500;

function types(node: Rec): string[] {
  const value = node['@type'];
  const list = Array.isArray(value) ? value : [value];
  return list.filter((t): t is string => typeof t === 'string');
}

/** Event, BusinessEvent, EducationEvent, … (ook met prefix zoals 'schema:Event'). */
const isEvent = (node: Rec) => types(node).some((t) => /Event$/.test(t));

/** Alle schema.org Event-objecten uit de JSON-LD-blokken van een pagina. */
export function extractJsonLdEvents(html: string): Rec[] {
  const events: Rec[] = [];
  const visit = (value: unknown, depth: number) => {
    if (depth > 6 || events.length >= MAX_EVENTS) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (!isRecord(value)) return;
    if (isEvent(value)) {
      events.push(value);
      return;
    }
    if (value['@graph']) visit(value['@graph'], depth + 1);
    if (types(value).includes('ItemList')) {
      const elements = Array.isArray(value.itemListElement) ? value.itemListElement : [];
      for (const element of elements) {
        visit(isRecord(element) && element.item ? element.item : element, depth + 1);
      }
    }
  };
  const pattern =
    /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    const body = match[1].replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '').trim();
    try {
      visit(JSON.parse(body), 0);
    } catch {
      // Ongeldige JSON-LD overslaan; andere blokken kunnen wel kloppen.
    }
  }
  return events;
}

function text(value: unknown, max = 200): string | null {
  if (typeof value !== 'string') return null;
  const result = decodeEntities(value).replace(/\s+/g, ' ').trim();
  return result && result.length <= max ? result : null;
}

function placeOf(location: unknown): {
  city: string | null;
  country: string | null;
  virtual: boolean;
} {
  const locations = (Array.isArray(location) ? location : [location]).filter(isRecord);
  let virtual = typeof location === 'string' && /^online$/i.test(location);
  for (const loc of locations) {
    if (types(loc).includes('VirtualLocation')) {
      virtual = true;
      continue;
    }
    const address = loc.address;
    if (isRecord(address)) {
      const country = isRecord(address.addressCountry)
        ? address.addressCountry.name
        : address.addressCountry;
      const city = text(address.addressLocality, 100);
      if (city || text(country, 80)) return { city, country: text(country, 80), virtual };
    }
    if (typeof address === 'string') {
      const place = placeFromAddress(address);
      if (place.country) return { ...place, virtual };
    }
  }
  if (typeof location === 'string' && !virtual) {
    const place = placeFromAddress(location);
    return { ...place, virtual };
  }
  return { city: null, country: null, virtual };
}

function offerPrice(offers: unknown): string | null {
  for (const offer of (Array.isArray(offers) ? offers : [offers]).filter(isRecord)) {
    const price = priceText(offer.price ?? offer.lowPrice, offer.priceCurrency);
    if (price) return price;
  }
  return null;
}

export function parseJsonLdEvent(event: Rec, pageUrl: string, origin: Origin): ConferenceInput {
  const name = text(event.name);
  const ownUrl = typeof event.url === 'string' ? event.url : null;
  const idUrl =
    typeof event['@id'] === 'string' && /^https?:/i.test(event['@id']) ? event['@id'] : null;
  // Geen eigen URL: de pagina zelf is de bron (bijv. de homepage van de conferentie).
  const officialUrl = readUrl(
    ownUrl ? new URL(ownUrl, pageUrl).href : (idUrl?.split('#')[0] ?? pageUrl),
    'url',
  );
  if (!name || !officialUrl) throw new Error('Naam en URL zijn verplicht');
  const startDate = toIsoDate(event.startDate, 'startDate');
  if (!startDate) throw new Error('startDate ontbreekt');
  const endDate = toIsoDate(event.endDate ?? null, 'endDate');
  if (endDate && endDate < startDate) throw new Error('Einddatum ligt vóór begindatum');

  const place = placeOf(event.location);
  const mode = String(event.eventAttendanceMode ?? '');
  const online = /OnlineEventAttendanceMode/i.test(mode) || place.virtual;
  // Mixed (hybride) of een fysieke plaats: geen online-only.
  const onlineOnly =
    online && !/MixedEventAttendanceMode/i.test(mode) && !place.city && !place.country;

  return {
    name,
    official_url: officialUrl,
    canonical_url: normalizeUrl(officialUrl),
    source_name: origin.sourceName,
    source_url: origin.sourceUrl,
    start_date: startDate,
    end_date: endDate,
    city: onlineOnly ? null : place.city,
    country: onlineOnly ? null : countryName(place.country),
    online_only: onlineOnly,
    category: categorize(name, origin.defaultCategory),
    cfp_url: null,
    cfp_deadline: null,
    price_text: offerPrice(event.offers),
  };
}

export function parseJsonLd(html: string, pageUrl: string, origin: Origin): FetchResult {
  const events = extractJsonLdEvents(html);
  const items: ConferenceInput[] = [];
  const errors: string[] = [];
  for (const [index, event] of events.entries()) {
    try {
      items.push(parseJsonLdEvent(event, pageUrl, origin));
    } catch (error) {
      errors.push(
        `${origin.sourceUrl}, event ${index + 1}: ${error instanceof Error ? error.message : 'Ongeldig event'}`,
      );
    }
  }
  if (events.length === 0) errors.push(`${origin.sourceUrl}: geen schema.org-events op de pagina`);
  return { items, errors };
}
