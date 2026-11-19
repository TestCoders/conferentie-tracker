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

export function formatDateRange(c: Pick<Conference, 'start_date' | 'end_date'>): string {
  if (!c.end_date || c.end_date === c.start_date) return formatDate(c.start_date);
  return `${formatDate(c.start_date)} – ${formatDate(c.end_date)}`;
}

export function formatLocation(c: Pick<Conference, 'city' | 'country'>): string {
  return [c.city, c.country].filter(Boolean).join(', ') || UNKNOWN;
}

export function orUnknown(value: string | null): string {
  return value ?? UNKNOWN;
}
