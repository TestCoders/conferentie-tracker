// Eigenaar: C. Pure kalenderhelpers: datumrekenen, .ics inlezen (eigen agenda) en .ics exporteren.
// Alles werkt met 'YYYY-MM-DD'-strings in UTC, zodat tijdzones geen dag verschuiven.
import type { Conference } from '@/lib/types';

/** Afspraak uit de eigen agenda; start/end inclusief, 'YYYY-MM-DD'. */
export type CalendarEvent = { title: string; start: string; end: string };

const MAX_EVENTS = 5000;

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function lastDay(c: Pick<Conference, 'start_date' | 'end_date'>): string {
  return c.end_date && c.end_date > c.start_date ? c.end_date : c.start_date;
}

/** Overlappen twee inclusieve datumbereiken? */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function conflictsFor(c: Conference, own: CalendarEvent[]): CalendarEvent[] {
  return own.filter((e) => overlaps(c.start_date, lastDay(c), e.start, e.end));
}

/** 'YYYY-MM' → 'YYYY-MM' n maanden verder. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + n, 1));
  return date.toISOString().slice(0, 7);
}

/** Dagen van een maand plus aantal lege cellen vóór dag 1 (week start op maandag). */
export function monthGrid(month: string): { offset: number; days: string[] } {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const days = Array.from(
    { length: count },
    (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`,
  );
  return { offset, days };
}

function icsDate(value: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(value);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? null : iso;
}

function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, ch: string) => (ch === 'n' || ch === 'N' ? ' ' : ch));
}

/**
 * Minimale iCalendar-parser voor de eigen agenda (alleen in de browser).
 * Leest SUMMARY/DTSTART/DTEND; hele-dag-DTEND is exclusief. Herhalingen (RRULE) worden
 * alleen op hun eerste datum getoond.
 */
export function parseIcs(text: string): CalendarEvent[] {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const events: CalendarEvent[] = [];
  let current: { title: string; start: string | null; end: string | null; allDay: boolean } | null =
    null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = { title: '', start: null, end: null, allDay: false };
      continue;
    }
    if (!current) continue;
    if (line === 'END:VEVENT') {
      if (current.start) {
        let end = current.end ?? current.start;
        if (current.allDay && current.end && end > current.start) end = addDays(end, -1);
        if (end < current.start) end = current.start;
        events.push({ title: current.title || '(zonder titel)', start: current.start, end });
        if (events.length >= MAX_EVENTS) break;
      }
      current = null;
      continue;
    }
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const head = line.slice(0, colon).toUpperCase();
    const value = line.slice(colon + 1).trim();
    const name = head.split(';')[0];
    if (name === 'SUMMARY') current.title = unescapeText(value).slice(0, 200);
    if (name === 'DTSTART') {
      current.start = icsDate(value);
      current.allDay = head.includes('VALUE=DATE') || /^\d{8}$/.test(value);
    }
    if (name === 'DTEND') current.end = icsDate(value);
  }
  return events;
}

function escapeText(value: string): string {
  return value.replace(/[\\;,]/g, (ch) => `\\${ch}`).replace(/\r?\n/g, '\\n');
}

/** RFC 5545: regels max. 75 octets; vervolgregels beginnen met een spatie. */
function fold(line: string): string {
  const parts: string[] = [];
  for (let rest = line; rest.length > 0; rest = rest.slice(73)) parts.push(rest.slice(0, 73));
  return parts.join('\r\n ');
}

/** .ics met één hele-dag-afspraak voor de conferentie. */
export function buildIcs(c: Conference, now: Date): string {
  const compact = (iso: string) => iso.replaceAll('-', '');
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const location = [c.city, c.country].filter(Boolean).join(', ');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TestCoders//Conference Tracker//NL',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${c.id}@conference-tracker`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(c.start_date)}`,
    `DTEND;VALUE=DATE:${compact(addDays(lastDay(c), 1))}`,
    `SUMMARY:${escapeText(c.name)}`,
    ...(location ? [`LOCATION:${escapeText(location)}`] : []),
    `URL:${c.official_url}`,
    `DESCRIPTION:${escapeText(`Website: ${c.official_url}\nBron: ${c.source_name}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
