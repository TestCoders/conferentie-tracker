// Eigenaar: B. Gedeelde regels voor automatisch herkende bronformaten (eigen bronnen).
import { classifyConference, mentionsTesting } from '@/lib/discovery/classify';
import { readDate } from '@/lib/discovery/validation';
import type { Category, ConferenceInput } from '@/lib/types';

/** Herkomst van records uit één bron. */
export type Origin = { sourceUrl: string; sourceName: string; defaultCategory: Category };

/**
 * Categorie alleen op bewijs in de naam; anders de standaardcategorie van de bron.
 * Zelfde regels als de vaste bronnen (`@/lib/discovery/classify`).
 */
export function categorize(name: string, fallback: Category): Category {
  return classifyConference(name, fallback);
}

/** Voorstel voor de standaardcategorie: 'testing' als de meeste namen over testen gaan. */
export function suggestCategory(names: string[]): Category {
  if (names.length === 0) return 'development';
  const testing = names.filter(mentionsTesting).length;
  return testing / names.length >= 0.5 ? 'testing' : 'development';
}

/** 'YYYY-MM-DD' of een ISO-datumtijd ('2027-03-11T09:00:00+01:00') → 'YYYY-MM-DD'; anders null. */
export function toIsoDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`Ongeldige datum: ${field}`);
  const match = /^(\d{4}-\d{2}-\d{2})(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(value.trim());
  if (!match) throw new Error(`Ongeldige datum: ${field}`);
  return readDate(match[1], field);
}

export function isIsoDateLike(value: unknown): boolean {
  try {
    return toIsoDate(value, 'datum') !== null;
  } catch {
    return false;
  }
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
  euro: '€',
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/**
 * Plaats uit een adres: land = laatste deel, stad = het deel ervoor zonder postcode.
 * "RAI, Europaplein 24, 1078 GZ Amsterdam, Netherlands" → Amsterdam, Netherlands.
 */
export function placeFromAddress(text: string): Pick<ConferenceInput, 'city' | 'country'> {
  const parts = text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2 || parts.some((part) => /\b(tba|tbd)\b/i.test(part))) {
    return { city: null, country: null };
  }
  const city = parts
    .at(-2)!
    .replace(/^\d{4,5}(\s?[A-Z]{2})?\s+/, '')
    .replace(/\s+\d{4,5}(\s?[A-Z]{2})?$/, '')
    .trim();
  return { city: city || null, country: parts.at(-1) ?? null };
}

const REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

/** ISO-landcode ('NL', 'BE') → Engelse landnaam, zodat kostenaannames per land passen. */
export function countryName(value: string | null): string | null {
  if (!value || !/^[A-Za-z]{2}$/.test(value)) return value;
  try {
    const name = REGION_NAMES.of(value.toUpperCase());
    return name && name !== value.toUpperCase() ? name : value;
  } catch {
    return value;
  }
}

/** Prijs zoals de bron hem geeft, als tekst (geen omrekening of gok). */
export function priceText(price: unknown, currency?: unknown): string | null {
  const amount =
    typeof price === 'number' && Number.isFinite(price)
      ? String(price)
      : typeof price === 'string' && price.trim()
        ? price.trim()
        : null;
  if (!amount || amount.length > 100) return null;
  if (/^0+([.,]0+)?$/.test(amount)) return 'gratis';
  const cur = typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? currency : null;
  return cur && /^[\d.,]+$/.test(amount) ? `${cur} ${amount}` : amount;
}
