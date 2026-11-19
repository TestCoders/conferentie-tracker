// Requires Node >=22.15. Run: node --experimental-strip-types --test src/lib/costs.test.mjs
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      return nextResolve(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { assumptionMap, estimateCosts, ticketFor, DEFAULT_COST_COUNTRY_KEY } =
  await import('@/lib/costs');
const { parseConfsTechRecord } = await import('@/lib/discovery/confs-tech');
const { parseTestingConferencesYaml } = await import('@/lib/discovery/testing-conferences');

const assumption = (country_key, country_label, travel_eur, hotel_per_night_eur) => ({
  country_key,
  country_label,
  travel_eur,
  hotel_per_night_eur,
  updated_at: '2026-11-19T00:00:00Z',
});
const map = assumptionMap([
  assumption('netherlands', 'Netherlands', 50, 150),
  assumption(DEFAULT_COST_COUNTRY_KEY, 'standaard (overige landen)', 600, 180),
]);
const conference = {
  country: 'the Netherlands',
  start_date: '2027-03-03',
  end_date: '2027-03-04',
  online_only: false,
};

test('own country assumption is used first', () => {
  const e = estimateCosts(conference, map);
  assert.equal(e.basis, 'country');
  assert.equal(e.travel, 50);
  assert.equal(e.nights, 2);
  assert.equal(e.hotel, 300);
  assert.equal(e.total, 350);
});

test('countries without an assumption fall back to the labelled default', () => {
  const e = estimateCosts({ ...conference, country: 'Portugal' }, map);
  assert.equal(e.basis, 'default');
  assert.equal(e.countryLabel, 'standaard (overige landen)');
  assert.equal(e.total, 600 + 2 * 180);
  // Zonder standaardaanname blijft het Onbekend.
  const withoutDefault = assumptionMap([assumption('netherlands', 'Netherlands', 50, 150)]);
  assert.equal(estimateCosts({ ...conference, country: 'Portugal' }, withoutDefault), null);
});

test('online-only costs nothing for travel and hotel; unknown location stays unknown', () => {
  const e = estimateCosts({ ...conference, country: null, online_only: true }, map);
  assert.equal(e.basis, 'online');
  assert.equal(e.total, 0);
  assert.equal(
    estimateCosts({ ...conference, country: null, online_only: true }, map, {
      amount: 99,
      sourceUrl: null,
    }).total,
    99,
  );
  assert.equal(estimateCosts({ ...conference, country: null }, map), null);
  assert.equal(estimateCosts({ ...conference, country: '*' }, map), null);
});

test('official ticket price is added to the total only when known', () => {
  assert.equal(ticketFor({ ticket_price_eur: null, ticket_price_url: null }), null);
  const ticket = ticketFor({ ticket_price_eur: 499, ticket_price_url: 'https://example.com/t' });
  assert.deepEqual(ticket, { amount: 499, sourceUrl: 'https://example.com/t' });
  assert.equal(estimateCosts(conference, map, ticket).total, 350 + 499);
});

test('discovery marks only conferences without a physical place as online-only', () => {
  const base = { name: 'X', url: 'https://x.example', startDate: '2027-05-01' };
  const hybrid = parseConfsTechRecord(
    { ...base, city: 'Amsterdam', country: 'Netherlands', online: true },
    'https://feed.example',
  );
  assert.equal(hybrid.online_only, false);
  assert.equal(hybrid.country, 'Netherlands');
  const online = parseConfsTechRecord(
    { ...base, city: 'Online', country: 'Online', online: true },
    'https://feed.example',
  );
  assert.equal(online.online_only, true);
  assert.equal(online.city, null);
  assert.equal(online.country, null);
  assert.equal(parseConfsTechRecord(base, 'https://feed.example').online_only, false);

  const yaml = parseTestingConferencesYaml(`- name: A
  location: Online
  dates: "May 25, 2027"
  url: https://a.example/
- name: B
  location: Potsdam, Germany and Online
  dates: "May 26, 2027"
  url: https://b.example/
- name: C
  location: TBA
  dates: "May 27, 2027"
  url: https://c.example/
`);
  assert.deepEqual(
    yaml.items.map((i) => [i.online_only, i.country]),
    [
      [true, null],
      [false, 'Germany'],
      [false, null],
    ],
  );
});
