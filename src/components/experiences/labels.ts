// Weergaveteksten voor ervaringen.
import type { WouldReturn } from '@/lib/types';

export const WOULD_RETURN_LABELS: Record<WouldReturn, string> = {
  yes: 'Zou weer gaan',
  maybe: 'Misschien weer',
  no: 'Niet weer',
};

export const WOULD_RETURN_STYLES: Record<WouldReturn, string> = {
  yes: 'bg-signal-glow text-adopt',
  maybe: 'bg-glass text-assess',
  no: 'bg-glass text-alert',
};

const longDate = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatLongDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(d.getTime()) ? null : longDate.format(d);
}
