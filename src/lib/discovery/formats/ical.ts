// Eigenaar: B. iCalendar-feeds (.ics): elke VEVENT met naam, datum en URL wordt een conferentie.
import type { FetchResult } from '@/lib/discovery/fetch-source';
import { categorize, placeFromAddress, type Origin } from '@/lib/discovery/formats/common';
import { normalizeUrl } from '@/lib/discovery/normalize-url';
import { readDate, readText, readUrl } from '@/lib/discovery/validation';
import type { ConferenceInput } from '@/lib/types';

type Property = { params: string; value: string };
type VEvent = Record<string, Property>;

export function looksLikeICal(text: string): boolean {
  return /^﻿?\s*BEGIN:VCALENDAR/i.test(text);
}

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, ' ')
    .replace(/\\([,;\\])/g, '$1')
    .trim();
}

/** Regels ontvouwen (RFC 5545: vervolgregel begint met spatie of tab) en VEVENTs verzamelen. */
export function readVEvents(text: string): VEvent[] {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const events: VEvent[] = [];
  let current: VEvent | null = null;
  for (const line of lines) {
    if (/^BEGIN:VEVENT$/i.test(line.trim())) current = {};
    else if (/^END:VEVENT$/i.test(line.trim())) {
      if (current) events.push(current);
      current = null;
    } else if (current) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const [name, ...params] = line.slice(0, colon).split(';');
      const key = name.toUpperCase();
      if (!(key in current))
        current[key] = { params: params.join(';'), value: line.slice(colon + 1) };
    }
  }
  return events;
}

/** DTSTART/DTEND → 'YYYY-MM-DD'. Bij een hele-dag-DTEND is de einddag exclusief. */
function icalDate(property: Property | undefined, field: string, exclusiveEnd = false) {
  if (!property) return null;
  const match = /^(\d{4})(\d{2})(\d{2})(T\d{6}Z?)?$/.exec(property.value.trim());
  if (!match) throw new Error(`Ongeldige datum: ${field}`);
  let iso = readDate(`${match[1]}-${match[2]}-${match[3]}`, field);
  const allDay = !match[4] || /VALUE=DATE(?!-)/i.test(property.params);
  if (iso && exclusiveEnd && allDay) {
    iso = new Date(Date.parse(`${iso}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  }
  return iso;
}

export function parseICalEvent(event: VEvent, origin: Origin): ConferenceInput {
  const name = readText(event.SUMMARY ? unescapeText(event.SUMMARY.value) : null, 'SUMMARY');
  const officialUrl = readUrl(event.URL?.value.trim() ?? null, 'URL');
  if (!name || !officialUrl) throw new Error('SUMMARY en URL zijn verplicht');
  const startDate = icalDate(event.DTSTART, 'DTSTART');
  if (!startDate) throw new Error('DTSTART ontbreekt');
  let endDate = icalDate(event.DTEND, 'DTEND', true);
  if (endDate && endDate < startDate) endDate = startDate;
  const location = event.LOCATION ? unescapeText(event.LOCATION.value) : '';
  const onlineOnly = /^(online|virtual)$/i.test(location);
  const place =
    onlineOnly || !location ? { city: null, country: null } : placeFromAddress(location);
  return {
    name,
    official_url: officialUrl,
    canonical_url: normalizeUrl(officialUrl),
    source_name: origin.sourceName,
    source_url: origin.sourceUrl,
    start_date: startDate,
    end_date: endDate,
    ...place,
    online_only: onlineOnly,
    category: categorize(name, origin.defaultCategory),
    cfp_url: null,
    cfp_deadline: null,
    price_text: null,
  };
}

export function parseICal(text: string, origin: Origin): FetchResult {
  if (!looksLikeICal(text)) throw new Error('Geen iCalendar-bron');
  const events = readVEvents(text);
  const items: ConferenceInput[] = [];
  const errors: string[] = [];
  for (const [index, event] of events.entries()) {
    try {
      items.push(parseICalEvent(event, origin));
    } catch (error) {
      errors.push(
        `${origin.sourceUrl}, event ${index + 1}: ${error instanceof Error ? error.message : 'Ongeldig event'}`,
      );
    }
  }
  if (events.length === 0) errors.push(`${origin.sourceUrl}: bron bevat geen events`);
  return { items, errors };
}
