// Eigenaar: C. Pure weergavehelpers; onbekend (null) wordt altijd 'Onbekend'.
import type { Category, Conference } from '@/lib/types';

export const UNKNOWN = 'Onbekend';

export const CATEGORY_LABELS: Record<Category, string> = {
  development: 'Development',
  testing: 'Testing',
  'test-automation': 'Testautomatisering',
};

const dateFormatter = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** 'YYYY-MM-DD' → '12 mrt 2027'. Ongeldige of lege invoer → 'Onbekend'. */
export function formatDate(value: string | null): string {
  if (!value) return UNKNOWN;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

/** 'YYYY-MM-DD' → { day: '12', month: 'mrt', year: '2027' } voor een compact datumblok. */
export function dateParts(value: string): { day: string; month: string; year: string } {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return { day: '?', month: '', year: '' };
  return {
    day: String(date.getUTCDate()),
    month: date.toLocaleDateString('nl-NL', { month: 'short', timeZone: 'UTC' }).replace('.', ''),
    year: String(date.getUTCFullYear()),
  };
}

export function formatDateRange(c: Pick<Conference, 'start_date' | 'end_date'>): string {
  if (!c.end_date || c.end_date === c.start_date) return formatDate(c.start_date);
  return `${formatDate(c.start_date)} – ${formatDate(c.end_date)}`;
}

export function formatLocation(c: Pick<Conference, 'city' | 'country'>): string {
  return [c.city, c.country].filter(Boolean).join(', ') || UNKNOWN;
}

/** Is de conferentie al voorbij (laatste dag vóór vandaag)? */
export function isPast(
  c: Pick<Conference, 'start_date' | 'end_date'>,
  today = todayIso(),
): boolean {
  return (c.end_date ?? c.start_date) < today;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function orUnknown(value: string | null): string {
  return value ?? UNKNOWN;
}
