// Requires Node >=22.15. Run: node --experimental-strip-types --test src/lib/geo/locate.test.mjs
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      return nextResolve(new URL(`../../${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { locate, placeKey } = await import('@/lib/geo/locate');

test('known conference places resolve to their city, as written in the sources', () => {
  for (const [city, country, lat, lng] of [
    ['Amsterdam', 'Netherlands', 52.37, 4.89],
    ['Hilversum', 'the Netherlands', 52.22, 5.18],
    ['San Diego, CA', 'U.S.A.', 32.72, -117.16],
  ]) {
    const location = locate(city, country);
    assert.equal(location?.precision, 'city', `${city}, ${country}`);
    assert.ok(Math.abs(location.lat - lat) < 0.1 && Math.abs(location.lng - lng) < 0.1);
  }
  // Hoofdletters en accenten maken niet uit.
  assert.equal(placeKey('AMSTERDAM ', 'Netherlands'), placeKey('amsterdam', 'netherlands'));
});

test('unknown city falls back to the country; online and unknown country get no point', () => {
  assert.equal(locate('Een dorp dat niet in de tabel staat', 'Germany')?.precision, 'country');
  assert.equal(locate(null, 'U.S.A.')?.precision, 'country');
  assert.equal(locate('Amsterdam', 'Netherlands', true), null);
  assert.equal(locate('Amsterdam', null), null);
  assert.equal(locate('Somewhere', 'Atlantis'), null);
});
