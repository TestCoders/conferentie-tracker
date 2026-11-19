import { normalizeUrl } from '@/lib/discovery/normalize-url';

export function readText(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2000) {
    throw new Error(`Ongeldig veld: ${field}`);
  }
  return value.trim() || null;
}

export function readDate(value: unknown, field: string): string | null {
  const result = readText(value, field);
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

export function readUrl(value: unknown, field: string): string | null {
  const result = readText(value, field);
  if (result === null) return null;
  normalizeUrl(result);
  return result;
}
