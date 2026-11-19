// Genereert de statische data voor de wereldkaart. Draaien na nieuwe bronnen of steden:
//
//   node --experimental-strip-types scripts/generate-geo-data.mjs <map-met-brondata>
//   npm run format   (places.json en world-land.ts in Prettier-stijl voor de CI-check)
//
// Dit script haalt zelf niets op. Zet in die map (handmatig downloaden):
//   ne_110m_land.geojson               Natural Earth 5.1.2 (publiek domein): het land op de kaart
//   ne_50m_admin_0_countries.geojson   Natural Earth 5.1.2 (publiek domein): midden van elk land
//   cities15000.txt                    GeoNames (CC BY 4.0): alleen om steden op te zoeken
//   confs*.json                        feeds van confs.tech (zoals in src/lib/discovery/confs-tech.ts)
//   *.yml                              current.yml / past.yml van TestingConferences
//
// Schrijft:
//   src/components/explorer/map/world-land.ts  SVG-pad van het land (x = lng + 180, y = 90 - lat)
//   src/lib/geo/places.json                    alleen de plaatsen van deze conferenties + landen
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { join } from 'node:path';

const root = new URL('..', import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      return nextResolve(new URL(`src/${specifier.slice(2)}.ts`, root).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const dir = process.argv[2];
if (!dir) {
  console.error(
    'Gebruik: node --experimental-strip-types scripts/generate-geo-data.mjs <map-met-brondata>',
  );
  process.exit(1);
}
const { countryKey } = await import('@/lib/costs');
const { placeKey } = await import('@/lib/geo/locate');
const { parseConfsTechRecord } = await import('@/lib/discovery/confs-tech');
const { parseTestingConferencesYaml } = await import('@/lib/discovery/testing-conferences');
const { locate, setGazetteer } = await import(new URL('scripts/geo/full-locate.ts', root).href);

const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
const readJson = (file) => JSON.parse(readFileSync(join(dir, file), 'utf8'));

// ---------- land als SVG-pad ----------
const rings = [];
for (const { geometry } of readJson('ne_110m_land.geojson').features) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const polygon of polygons) for (const ring of polygon) rings.push(ring);
}
const path = rings
  .map((ring) => {
    const points = [];
    for (const [lng, lat] of ring) {
      const point = `${round(lng + 180, 1)} ${round(90 - lat, 1)}`;
      if (points.at(-1) !== point) points.push(point);
    }
    return points.length > 2 ? `M${points.join('L')}Z` : '';
  })
  .join('');
writeFileSync(
  new URL('src/components/explorer/map/world-land.ts', root),
  `// GEGENEREERD door scripts/generate-geo-data.mjs — niet met de hand aanpassen.
// Bron: Natural Earth 1:110m land (publiek domein). Equirectangular: x = lng + 180, y = 90 - lat.
export const WORLD_LAND_PATH =
  '${path}';
`,
);

// ---------- volledige plaatsentabel (alleen in het geheugen) ----------
const countryRows = [];
for (const { properties: p } of readJson('ne_50m_admin_0_countries.geojson').features) {
  const iso2 = [p.ISO_A2_EH, p.ISO_A2].find((code) => /^[A-Z]{2}$/.test(code ?? ''));
  if (!iso2) continue;
  const names = [
    ...new Set([p.NAME, p.NAME_LONG, p.ADMIN, p.NAME_EN, p.FORMAL_EN].filter(Boolean)),
  ];
  countryRows.push([iso2, round(p.LABEL_Y, 2), round(p.LABEL_X, 2), ...names]);
}
const LATIN = /^[\p{Script=Latin}\p{M}\s'’.\-()]+$/u;
const cityRows = [];
for (const line of readFileSync(join(dir, 'cities15000.txt'), 'utf8').split('\n')) {
  const f = line.split('\t');
  if (f.length < 15) continue;
  const [, name, ascii, alternates, lat, lng] = f;
  const alt = (alternates ?? '').split(',').filter((n) => n && n.length <= 40 && LATIN.test(n));
  const names = [
    ...new Set(
      [name, ascii, ...alt].map((n) => n.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()),
    ),
  ];
  cityRows.push([
    f[8],
    round(Number(lat), 2),
    round(Number(lng), 2),
    Number(f[14]) / 1000,
    ...names,
  ]);
}
setGazetteer({ countries: countryRows, cities: cityRows });

// ---------- plaatsen van de bekende conferenties ----------
const pairs = new Map();
const addPair = ({ city, country, online_only }) => {
  if (!online_only && country) pairs.set(placeKey(city, country), { city, country });
};
for (const file of readdirSync(dir)) {
  if (/^confs.*\.json$/.test(file)) {
    for (const record of readJson(file)) {
      try {
        addPair(parseConfsTechRecord(record, file));
      } catch {
        // Ongeldig record: ook in de app overgeslagen.
      }
    }
  } else if (/\.ya?ml$/.test(file)) {
    const text = readFileSync(join(dir, file), 'utf8');
    for (const item of parseTestingConferencesYaml(text, { sourceUrl: file }).items) addPair(item);
  }
}
const places = [];
const missing = [];
for (const [key, { city, country }] of [...pairs].sort(([a], [b]) => a.localeCompare(b))) {
  const location = locate(city, country);
  if (!location) {
    missing.push(`${city ?? '—'} / ${country}`);
    continue;
  }
  places.push(
    location.precision === 'country'
      ? [key, location.lat, location.lng, 1]
      : [key, location.lat, location.lng],
  );
}

// Landen voor conferenties die (nog) niet in deze tabel staan, bijv. uit eigen bronnen.
const countries = new Map();
for (const [, lat, lng, ...names] of countryRows) {
  for (const name of names) {
    const key = countryKey(name);
    if (key && !countries.has(key)) countries.set(key, [key, lat, lng]);
  }
}

writeFileSync(
  new URL('src/lib/geo/places.json', root),
  `${JSON.stringify({
    attribution:
      'Kaart en landen: Natural Earth (publiek domein). Plaatsen opgezocht via GeoNames (CC BY 4.0).',
    places,
    countries: [...countries.values()],
  })}\n`,
);
console.log(`land: ${rings.length} ringen, ${path.length} tekens`);
console.log(`plaatsen: ${places.length} van ${pairs.size}, landen: ${countries.size}`);
if (missing.length) console.log(`zonder positie (${missing.length}): ${missing.join(' | ')}`);
