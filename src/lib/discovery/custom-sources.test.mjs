// Requires Node >=22.15. Run: node --experimental-strip-types --test src/lib/discovery/custom-sources.test.mjs
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { after, test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const path = specifier === '@/lib/discovery' ? 'lib/discovery/index' : specifier.slice(2);
      return nextResolve(new URL(`../../${path}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { assertSafeExternalUrl, isPublicAddress, loadExternalSource, EXTERNAL_MAX_BYTES } =
  await import('@/lib/discovery/fetch-source');
const { parseCreateCustomSource, fetchCustomSource } =
  await import('@/lib/discovery/custom-sources');
const { runCustomDiscovery } = await import('@/lib/discovery');
const { summarizeCostCoverage } = await import('@/lib/discovery/cost-coverage');
const { POST } = await import('@/app/api/discovery/run/route');

const publicResolver = async () => ['93.184.215.14'];
// Public IP literal: no DNS lookup needed in tests.
const FEED_URL = 'https://93.184.215.14/conferences/2027/python.json';
const SOURCE_ID = '11111111-1111-4111-8111-111111111111';
const record = {
  name: 'Vuejs Amsterdam',
  url: 'https://www.vuejs.amsterdam',
  startDate: '2027-03-11',
  endDate: '2027-03-12',
  city: 'Amsterdam',
  country: 'Netherlands',
};
const testingYaml = `- name: Test Automation Days 2027
  location: Hilversum, the Netherlands
  dates: "March 3-4, 2027"
  url: https://www.testautomationdays.com/
`;

const originalFetch = globalThis.fetch;
const originalEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_TOKEN: process.env.ADMIN_TOKEN,
};
after(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('SSRF guard allows only public https hosts on the default port', async () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254']) {
    assert.equal(isPublicAddress(address), false, address);
  }
  for (const address of ['::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress('93.184.215.14'), true);
  assert.equal(isPublicAddress('2606:4700::1111'), true);

  for (const url of [
    'http://example.com/feed.json',
    'https://user:pw@example.com/feed.json',
    'https://example.com:8443/feed.json',
    'https://localhost/feed.json',
    'https://intranet/feed.json',
    'https://printer.local/feed.json',
    'https://127.0.0.1/feed.json',
    'https://[::1]/feed.json',
    'file:///etc/passwd',
    'not a url',
  ]) {
    await assert.rejects(assertSafeExternalUrl(url, publicResolver), url);
  }
  await assert.rejects(
    assertSafeExternalUrl('https://rebind.example.com/x', async () => [
      '93.184.215.14',
      '10.0.0.1',
    ]),
    /niet-publiek/,
  );
  await assert.rejects(
    assertSafeExternalUrl('https://missing.example.com/x', async () => {
      throw new Error('ENOTFOUND');
    }),
    /niet worden gevonden/,
  );
  assert.equal(
    (await assertSafeExternalUrl('https://example.com/feed.json', publicResolver)).href,
    'https://example.com/feed.json',
  );
});

test('external loader refuses redirects and oversized bodies', async () => {
  globalThis.fetch = async (_input, init) => {
    assert.equal(init.redirect, 'error');
    assert.equal(init.cache, 'no-store');
    return new Response('x'.repeat(EXTERNAL_MAX_BYTES + 1));
  };
  await assert.rejects(loadExternalSource(FEED_URL), /te groot/);
  globalThis.fetch = async () => new Response(null, { status: 404 });
  await assert.rejects(loadExternalSource(FEED_URL), /HTTP 404/);
  globalThis.fetch = async () => new Response('[]');
  assert.equal(await loadExternalSource(FEED_URL), '[]');
});

test('create-request validation whitelists fields, trims, and rejects reserved names', async () => {
  const valid = { name: '  confs.tech   python ', url: FEED_URL, format: 'confs-tech-json' };
  assert.deepEqual(await parseCreateCustomSource(valid, publicResolver), {
    name: 'confs.tech python',
    url: FEED_URL,
    format: 'confs-tech-json',
  });
  for (const body of [
    null,
    [],
    { ...valid, extra: 1 },
    { ...valid, name: '' },
    { ...valid, name: 'x'.repeat(61) },
    { ...valid, name: 'Confs-Tech' },
    { ...valid, url: 'http://example.com/feed.json' },
    { ...valid, url: 'https://10.0.0.1/feed.json' },
    { ...valid, format: 'html' },
    { name: 'a', url: FEED_URL },
  ]) {
    await assert.rejects(parseCreateCustomSource(body, publicResolver), JSON.stringify(body));
  }
});

test('custom sources run through the existing parsers with their own name and URL', async () => {
  const load = async () => JSON.stringify([record, null]);
  const json = await fetchCustomSource(
    { name: 'Python 2027', url: FEED_URL, format: 'confs-tech-json' },
    load,
  );
  assert.equal(json.items.length, 1);
  assert.equal(json.items[0].source_name, 'Python 2027');
  assert.equal(json.items[0].source_url, FEED_URL);
  assert.equal(json.items[0].canonical_url, 'https://vuejs.amsterdam');
  assert.equal(json.items[0].category, 'development');
  assert.match(json.errors[0], /record 2/);

  const yaml = await fetchCustomSource(
    { name: 'Testing mirror', url: FEED_URL, format: 'testing-conferences-yaml' },
    async () => testingYaml,
  );
  assert.deepEqual(yaml.errors, []);
  assert.equal(yaml.items[0].source_name, 'Testing mirror');
  assert.equal(yaml.items[0].source_url, FEED_URL);
  assert.equal(yaml.items[0].category, 'test-automation');

  const failed = await fetchCustomSource(
    { name: 'Down', url: FEED_URL, format: 'confs-tech-json' },
    async () => {
      throw new Error('HTTP 503');
    },
  );
  assert.equal(failed.items.length, 0);
  assert.match(failed.errors[0], /HTTP 503/);
});

test('custom discovery run upserts idempotently and endpoint validates sourceId', async () => {
  process.env.SUPABASE_URL = 'https://discovery-test.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-key';
  process.env.ADMIN_TOKEN = 'test-only-admin';
  const source = {
    id: SOURCE_ID,
    name: 'Python 2027',
    url: FEED_URL,
    format: 'confs-tech-json',
    created_at: '2026-11-19T10:00:00Z',
  };
  const conferences = new Map();
  const runs = [];
  let costKeys = [];
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (request.url === FEED_URL) return Response.json([record]);
    assert.equal(url.origin, 'https://discovery-test.invalid');
    if (url.pathname.endsWith('/discovery_sources')) {
      const found = url.searchParams.get('id') === `eq.${SOURCE_ID}` ? [source] : [];
      if (request.headers.get('accept')?.includes('vnd.pgrst.object')) {
        return found.length
          ? Response.json(found[0])
          : Response.json({ code: 'PGRST116', message: 'no rows' }, { status: 406 });
      }
      return Response.json(found);
    }
    if (url.pathname.endsWith('/cost_assumptions')) {
      return Response.json(
        costKeys.map((country_key) => ({
          country_key,
          country_label: country_key,
          travel_eur: 100,
          hotel_per_night_eur: 150,
          updated_at: '2026-11-19T00:00:00Z',
        })),
      );
    }
    if (request.method === 'GET' && url.pathname.endsWith('/conferences')) {
      return Response.json([...conferences.values()]);
    }
    const body = await request.json();
    if (url.pathname.endsWith('/ingestion_runs')) {
      if (request.method === 'POST') {
        runs.push({ ...body, id: String(runs.length + 1) });
        return Response.json({ id: String(runs.length) });
      }
      Object.assign(runs[Number(url.searchParams.get('id')?.slice(3)) - 1], body);
      return new Response(null, { status: 204 });
    }
    assert.ok(url.pathname.endsWith('/conferences'));
    assert.equal(url.searchParams.get('on_conflict'), 'canonical_url,start_date');
    const ignore = request.headers.get('prefer')?.includes('resolution=ignore-duplicates');
    const returned = [];
    for (const row of body) {
      const key = JSON.stringify([row.canonical_url, row.start_date]);
      assert.equal('status' in row, false);
      if (conferences.has(key) && ignore) continue;
      conferences.set(key, { status: 'approved', ...conferences.get(key), ...row });
      returned.push({ canonical_url: row.canonical_url, start_date: row.start_date });
    }
    return Response.json(returned);
  };

  assert.deepEqual(await runCustomDiscovery(SOURCE_ID), {
    source: 'Python 2027',
    found: 1,
    inserted: 1,
    updated: 0,
    errors: [],
    costCoverage: {
      withEstimate: 0,
      online: 0,
      onDefault: [],
      missingCountries: ['Netherlands'],
      withoutLocation: 0,
    },
  });
  costKeys = ['*'];
  assert.deepEqual(await runCustomDiscovery(SOURCE_ID), {
    source: 'Python 2027',
    found: 1,
    inserted: 0,
    updated: 1,
    errors: [],
    costCoverage: {
      withEstimate: 1,
      online: 0,
      onDefault: ['Netherlands'],
      missingCountries: [],
      withoutLocation: 0,
    },
  });
  assert.equal(conferences.size, 1);
  assert.equal([...conferences.values()][0].source_name, 'Python 2027');
  assert.equal(runs[0].source_name, 'Python 2027');
  assert.equal(runs[1].status, 'success');

  const request = (body) =>
    new Request('https://app.test/api/discovery/run', {
      method: 'POST',
      headers: { authorization: 'Bearer test-only-admin' },
      body,
    });
  for (const body of [
    '{"sourceId":"not-a-uuid"}',
    '{"sourceId":123}',
    `{"sourceId":"${SOURCE_ID}","source":"confs-tech"}`,
  ]) {
    assert.equal((await POST(request(body))).status, 400, body);
  }
  const missing = await POST(request('{"sourceId":"22222222-2222-4222-8222-222222222222"}'));
  assert.equal(missing.status, 404);
  const ok = await POST(request(`{"sourceId":"${SOURCE_ID}"}`));
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).source, 'Python 2027');
});

test('cost coverage uses the explorer estimate: own country, default, online, unknown', () => {
  const a = (country_key, travel_eur = 100) => ({
    country_key,
    country_label: country_key,
    travel_eur,
    hotel_per_night_eur: 150,
    updated_at: '2026-11-19T00:00:00Z',
  });
  const item = (country, online_only = false) => ({
    country,
    online_only,
    start_date: '2027-05-01',
    end_date: null,
  });
  const items = [
    item('U.S.A.'),
    item('the Netherlands'),
    item('Belgium'),
    item('belgium'),
    item('Austria'),
    item(null),
    item(null, true),
  ];
  // Zonder standaardaanname: landen zonder eigen aanname blijven Onbekend.
  assert.deepEqual(summarizeCostCoverage(items, [a('usa'), a('netherlands')]), {
    withEstimate: 3,
    online: 1,
    onDefault: [],
    missingCountries: ['Austria', 'Belgium'],
    withoutLocation: 1,
  });
  // Met standaardaanname: alles met een land krijgt een schatting.
  assert.deepEqual(summarizeCostCoverage(items, [a('usa'), a('netherlands'), a('*', 600)]), {
    withEstimate: 6,
    online: 1,
    onDefault: ['Austria', 'Belgium'],
    missingCountries: [],
    withoutLocation: 1,
  });
});
