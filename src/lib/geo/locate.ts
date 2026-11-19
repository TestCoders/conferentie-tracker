/**
 * Positie van een conferentie op de statische wereldkaart: uit stad + land, geen GPS en geen
 * externe dienst. places.json bevat alleen de plaatsen van de bekende conferenties (gegenereerd
 * door scripts/generate-geo-data.mjs). Onbekende stad → midden van het land; onbekend land → null.
 */
import { countryKey } from '@/lib/costs';
import data from './places.json' with { type: 'json' };

export type MapLocation = {
  lat: number;
  lng: number;
  /** 'city' = plaats gevonden; 'country' = alleen het land, punt in het midden van het land. */
  precision: 'city' | 'country';
};

export const GEO_ATTRIBUTION: string = data.attribution;

/** Zonder accenten, kleine letters, enkele spaties. Ook gebruikt door het generatorscript. */
export function normalizePlace(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[’`]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Sleutel van een stad/land-combinatie; "U.S.A." en "USA" geven dezelfde sleutel. */
export function placeKey(city: string | null, country: string | null): string {
  const land = country ? (countryKey(country) ?? normalizePlace(country)) : '';
  return `${normalizePlace(city ?? '')}|${normalizePlace(land)}`;
}

/** places: [sleutel, lat, lng, 1 = alleen land bekend]; countries: [countryKey, lat, lng]. */
type Places = {
  places: [string, number, number, number?][];
  countries: [string, number, number][];
};
let index: { places: Map<string, MapLocation>; countries: Map<string, MapLocation> } | null = null;

function getIndex() {
  if (index) return index;
  const { places, countries } = data as unknown as Places;
  index = {
    places: new Map(
      places.map(([key, lat, lng, countryOnly]) => [
        key,
        { lat, lng, precision: countryOnly ? 'country' : 'city' },
      ]),
    ),
    countries: new Map(
      countries.map(([key, lat, lng]) => [key, { lat, lng, precision: 'country' }]),
    ),
  };
  return index;
}

export function locate(
  city: string | null,
  country: string | null,
  onlineOnly = false,
): MapLocation | null {
  if (onlineOnly || !country) return null;
  const { places, countries } = getIndex();
  return places.get(placeKey(city, country)) ?? countries.get(countryKey(country) ?? '') ?? null;
}
