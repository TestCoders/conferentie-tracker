// Requires Node >=22.15. Run: node --experimental-strip-types --test src/lib/discovery/discovery.test.mjs
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { after, test } from 'node:test';

// Node's native TS runner does not read tsconfig's @/ alias.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const path = specifier === '@/lib/discovery' ? 'lib/discovery/index' : specifier.slice(2);
      return nextResolve(new URL(`../../${path}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { normalizeUrl } = await import('@/lib/discovery/normalize-url');
const { parseConfsTechRecord, fetchConfsTech, CONFS_TECH_SOURCES } =
  await import('@/lib/discovery/confs-tech');
const { deduplicateConferences, runDiscovery } = await import('@/lib/discovery');
const { POST } = await import('@/app/api/discovery/run/route');

// Actual source record; no test data is written to a real database.
const record = {
  name: 'Vuejs Amsterdam',
  url: 'https://www.vuejs.amsterdam',
  startDate: '2027-03-11',
  endDate: '2027-03-12',
  city: 'Amsterdam',
  country: 'Netherlands',
};
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

test('canonical identity removes tracking but preserves meaningful path and query values', () => {
  assert.equal(
    normalizeUrl('https://WWW.Example.com/Event///?utm_source=test&b=2&a=1#schedule'),
    'https://example.com/Event?a=1&b=2',
  );
  assert.equal(
    normalizeUrl('https://example.com/?next=/agenda/'),
    'https://example.com?next=%2Fagenda%2F',
  );
  assert.equal(normalizeUrl('https://example.com/'), 'https://example.com');
  assert.throws(() => normalizeUrl('javascript:alert(1)'));
  assert.throws(() => normalizeUrl('https://user:password@example.com'));
});

test('mapping validates real calendar dates and leaves absent fields null', () => {
  const item = parseConfsTechRecord(record, CONFS_TECH_SOURCES[0]);
  assert.equal(item.canonical_url, 'https://vuejs.amsterdam');
  assert.equal(item.category, 'development');
  assert.equal(item.price_text, null);
  assert.equal(item.cfp_deadline, null);
  assert.throws(() =>
    parseConfsTechRecord({ ...record, startDate: '2027-02-29' }, CONFS_TECH_SOURCES[0]),
  );
  assert.throws(() =>
    parseConfsTechRecord({ ...record, endDate: '2027-03-10' }, CONFS_TECH_SOURCES[0]),
  );
  assert.throws(() =>
    parseConfsTechRecord({ ...record, url: 'file:///etc/passwd' }, CONFS_TECH_SOURCES[0]),
  );
});

test('deduplication uses both canonical URL and start date', () => {
  const item = parseConfsTechRecord(record, CONFS_TECH_SOURCES[0]);
  assert.equal(
    deduplicateConferences([item, { ...item, source_url: CONFS_TECH_SOURCES[1] }]).length,
    1,
  );
  assert.equal(deduplicateConferences([item, { ...item, start_date: '2028-03-11' }]).length, 2);
});

test('adapter retains valid records and reports failed feeds and invalid records', async () => {
  globalThis.fetch = async (input) => {
    if (String(input) === CONFS_TECH_SOURCES[0]) return Response.json([record, null]);
    return new Response('unavailable', { status: 503 });
  };
  const result = await fetchConfsTech();
  assert.equal(result.items.length, 1);
  assert.equal(result.errors.length, 2);
  assert.match(result.errors.join('\n'), /record 2/);
  assert.match(result.errors.join('\n'), /HTTP 503/);
});

test('repeat imports update without duplicates, preserve moderation, and record failures', async () => {
  process.env.SUPABASE_URL = 'https://discovery-test.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-key';
  const conferences = new Map();
  const runs = [];
  let rejectUpdates = false;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (CONFS_TECH_SOURCES.includes(request.url)) {
      return Response.json([record]);
    }
    assert.equal(url.origin, 'https://discovery-test.invalid');
    const body = await request.json();
    if (url.pathname.endsWith('/ingestion_runs')) {
      assert.equal(typeof body, 'object');
      assert.ok(body && !Array.isArray(body));
      if (request.method === 'POST') {
        runs.push({ ...body, id: String(runs.length + 1) });
        return Response.json({ id: String(runs.length) });
      }
      Object.assign(runs[Number(url.searchParams.get('id')?.slice(3)) - 1], body);
      return new Response(null, { status: 204 });
    }
    assert.ok(url.pathname.endsWith('/conferences'));
    assert.equal(url.searchParams.get('on_conflict'), 'canonical_url,start_date');
    assert.ok(Array.isArray(body));
    const ignore = request.headers.get('prefer')?.includes('resolution=ignore-duplicates');
    if (!ignore && rejectUpdates)
      return Response.json({ message: 'database unavailable' }, { status: 503 });
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
  assert.deepEqual(await runDiscovery('confs-tech'), {
    source: 'confs-tech',
    found: 1,
    inserted: 1,
    updated: 0,
    errors: [],
  });
  const stored = [...conferences.values()][0];
  stored.status = 'rejected';
  assert.deepEqual(await runDiscovery('confs-tech'), {
    source: 'confs-tech',
    found: 1,
    inserted: 0,
    updated: 1,
    errors: [],
  });
  assert.equal(conferences.size, 1);
  assert.equal([...conferences.values()][0].status, 'rejected');
  assert.equal(typeof [...conferences.values()][0].last_checked_at, 'string');
  assert.equal(runs[1].status, 'success');
  rejectUpdates = true;
  await assert.rejects(runDiscovery('confs-tech'), /bijwerken mislukt/);
  assert.equal(runs[2].status, 'failed');
  assert.equal(runs[2].inserted_count, 0);
  assert.match(String(runs[2].error_message), /bijwerken mislukt/);
  rejectUpdates = false;
  conferences.clear();
  const concurrent = await Promise.all([runDiscovery('confs-tech'), runDiscovery('confs-tech')]);
  assert.equal(conferences.size, 1);
  assert.equal(
    concurrent.reduce((sum, result) => sum + result.inserted, 0),
    1,
  );
  assert.equal(
    concurrent.reduce((sum, result) => sum + result.updated, 0),
    1,
  );
  globalThis.fetch = async () => new Response(null, { status: 503 });
  const partial = await fetchConfsTech();
  assert.equal(partial.items.length, 0);
  assert.equal(partial.errors.length, 2);
});

test('endpoint checks auth before parsing and rejects invalid or unsupported input', async () => {
  process.env.ADMIN_TOKEN = 'test-only-admin';
  const request = (body, authorized = true) =>
    new Request('https://app.test/api/discovery/run', {
      method: 'POST',
      headers: authorized ? { authorization: 'Bearer test-only-admin' } : {},
      body,
    });
  assert.equal((await POST(request('{', false))).status, 401);
  for (const body of [
    '{',
    'null',
    '[]',
    '{"source":null}',
    '{"source":123}',
    '{"url":"https://example.com"}',
    '{"source":"unknown"}',
  ]) {
    assert.equal((await POST(request(body))).status, 400, body);
  }
  assert.equal((await POST(request('x'.repeat(1001)))).status, 400);
  assert.equal((await POST(request('{"source":"testing-conferences"}'))).status, 501);
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    if (request.url.includes('/ingestion_runs')) {
      if (request.method === 'POST') return Response.json({ id: 'test-run' });
      return new Response(null, { status: 204 });
    }
    return Response.json([]);
  };
  const response = await POST(request(''));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.source, 'confs-tech');
  assert.equal(result.inserted, 0);
  assert.equal(result.errors.length, 2);
});
