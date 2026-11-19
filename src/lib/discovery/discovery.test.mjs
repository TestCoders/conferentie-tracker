// Requires Node >=22.15. Run: node --experimental-strip-types --test src/lib/discovery/discovery.test.mjs
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { after, test } from 'node:test';

// Node's native TS runner does not read tsconfig's @/ alias.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/lib/auth-access')
      return {
        url: 'data:text/javascript,export async function requireUser(request){if(request.headers.get("x-test-role")!=="admin") return {response:Response.json({error:"Unauthorized"},{status:401})}; return {user:{id:"test-user"},isAdmin:true}}',
        shortCircuit: true,
      };
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
const {
  TESTING_CONFERENCES_SOURCE,
  parseTestingDates,
  parseTestingConferencesYaml,
  fetchTestingConferences,
} = await import('@/lib/discovery/testing-conferences');
const { deduplicateConferences, runDiscovery } = await import('@/lib/discovery');
const { POST } = await import('@/app/api/discovery/run/route');
const { extractImages, fetchConferenceImages, isPublicHostname } =
  await import('@/lib/discovery/images');

// Actual source record; no test data is written to a real database.
const record = {
  name: 'Vuejs Amsterdam',
  url: 'https://www.vuejs.amsterdam',
  startDate: '2027-03-11',
  endDate: '2027-03-12',
  city: 'Amsterdam',
  country: 'Netherlands',
};
// Actual TestingConferences source record, including its quoted English date range.
const testingYaml = `- name: Test Automation Days 2027
  location: Hilversum, the Netherlands
  dates: "March 3-4, 2027"
  url: https://www.testautomationdays.com/?utm_source=testingconferences
`;
const originalFetch = globalThis.fetch;
const originalEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
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

test('YAML mapping handles quoted strings, date ranges and conservative classification', () => {
  const result = parseTestingConferencesYaml(testingYaml);
  assert.deepEqual(result.errors, []);
  const item = result.items[0];
  assert.equal(item.category, 'test-automation');
  assert.equal(item.start_date, '2027-03-03');
  assert.equal(item.end_date, '2027-03-04');
  assert.equal(item.city, 'Hilversum');
  assert.equal(item.country, 'the Netherlands');
  assert.equal(item.canonical_url, 'https://testautomationdays.com');
  assert.equal(item.source_url, TESTING_CONFERENCES_SOURCE);
  assert.equal(item.cfp_deadline, null);
  assert.equal(item.price_text, null);
  const quoted = parseTestingConferencesYaml(`- name: "expo:QA 27"
  location: Online
  dates: "May 25, 2027"
  url: https://expoqa.com/
`);
  assert.equal(quoted.items[0].name, 'expo:QA 27');
  assert.equal(quoted.items[0].category, 'testing');
  assert.equal(quoted.items[0].city, null);
  assert.equal(quoted.items[0].country, null);
  assert.equal(quoted.items[0].end_date, null);
  assert.deepEqual(parseTestingDates('September 30–October 2, 2027'), {
    start_date: '2027-09-30',
    end_date: '2027-10-02',
  });
  for (const dates of ['2027 TBA', 'February 29, 2027', 'March 5-3, 2027', 'NotAMonth 1, 2027']) {
    assert.throws(() => parseTestingDates(dates), dates);
  }
  assert.deepEqual(parseTestingDates('February 29, 2028'), {
    start_date: '2028-02-29',
    end_date: null,
  });
});

test('YAML rejects malformed documents, duplicate keys, aliases and unknown dates without losing valid rows', () => {
  for (const text of [
    '- name: [',
    '- name: A\n  name: B',
    'name: not-a-list',
    '- &record { name: A }\n- *record',
    '- name: !!js/function value',
  ]) {
    assert.throws(() => parseTestingConferencesYaml(text), text);
  }
  const mixed = parseTestingConferencesYaml(`${testingYaml}\n- name: TestGuild IRL New York 2027
  location: New York, NY, USA
  dates: "2027 TBA"
  url: https://testguild.com/irl
`);
  assert.equal(mixed.items.length, 1);
  assert.equal(mixed.errors.length, 1);
  assert.match(mixed.errors[0], /Record 2/);
});

test('YAML fetch uses only the fixed URL and reports network and parse failures', async () => {
  globalThis.fetch = async (input, init) => {
    assert.equal(input, TESTING_CONFERENCES_SOURCE);
    assert.equal(init.redirect, 'error');
    assert.equal(init.cache, 'no-store');
    return new Response(testingYaml);
  };
  assert.equal((await fetchTestingConferences()).items.length, 1);
  globalThis.fetch = async () => new Response(null, { status: 503 });
  assert.match((await fetchTestingConferences()).errors[0], /HTTP 503/);
  globalThis.fetch = async () => new Response('- name: [');
  const invalid = await fetchTestingConferences();
  assert.equal(invalid.items.length, 0);
  assert.match(invalid.errors[0], /Ongeldige YAML/);
});

for (const source of ['confs-tech', 'testing-conferences']) {
  test(`${source}: repeat imports update without duplicates, preserve moderation, and record failures`, async () => {
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
      if (request.url === TESTING_CONFERENCES_SOURCE) return new Response(testingYaml);
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
    assert.deepEqual(await runDiscovery(source), {
      source,
      found: 1,
      inserted: 1,
      updated: 0,
      errors: [],
    });
    const stored = [...conferences.values()][0];
    stored.status = 'rejected';
    assert.deepEqual(await runDiscovery(source), {
      source,
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
    await assert.rejects(runDiscovery(source), /bijwerken mislukt/);
    assert.equal(runs[2].status, 'failed');
    assert.equal(runs[2].inserted_count, 0);
    assert.match(String(runs[2].error_message), /bijwerken mislukt/);
    rejectUpdates = false;
    conferences.clear();
    const concurrent = await Promise.all([runDiscovery(source), runDiscovery(source)]);
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
}

test('endpoint checks auth before parsing and rejects invalid or unsupported input', async () => {
  const request = (body, authorized = true) =>
    new Request('https://app.test/api/discovery/run', {
      method: 'POST',
      headers: authorized ? { 'x-test-role': 'admin' } : {},
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
  const yamlResponse = await POST(request('{"source":"testing-conferences"}'));
  assert.equal(yamlResponse.status, 200);
  const yamlResult = await yamlResponse.json();
  assert.equal(yamlResult.source, 'testing-conferences');
  assert.equal(yamlResult.errors.length, 1);
});

// ---------- Historische bronnen (afgelopen 12 maanden) ----------

const { fetchConfsTechPast, CONFS_TECH_PAST_SOURCES } = await import('@/lib/discovery/confs-tech');
const { fetchTestingConferencesPast, TESTING_CONFERENCES_PAST_SOURCE } =
  await import('@/lib/discovery/testing-conferences');
const { pastCutoff, mentionsYearSince } = await import('@/lib/discovery/past-window');

test('past window: cutoff is 365 days back and year detection for error reporting', () => {
  assert.equal(pastCutoff(new Date('2026-11-19T12:00:00Z')), '2025-11-19');
  assert.equal(mentionsYearSince('November 12-13, 2026', '2025-11-19'), true);
  assert.equal(mentionsYearSince('TBA 2019', '2025-11-19'), false);
  assert.equal(mentionsYearSince(undefined, '2025-11-19'), false);
});

test('confs-tech-past keeps records from the last 12 months and skips older ones silently', async () => {
  const now = new Date('2026-11-19T12:00:00Z');
  const fetched = [];
  globalThis.fetch = async (input, init) => {
    fetched.push(String(input));
    assert.equal(init.redirect, 'error');
    if (String(input) !== CONFS_TECH_PAST_SOURCES[0]) return Response.json([]);
    return Response.json([
      { ...record, startDate: '2026-03-11', endDate: '2026-03-12' },
      { ...record, name: 'Te oud', startDate: '2025-06-01', endDate: '2025-06-02' },
      { name: 'Te oud en ongeldig', startDate: '2025-01-01' },
      { ...record, name: 'Rest van het jaar', startDate: '2026-12-03', endDate: '2026-12-03' },
    ]);
  };
  const result = await fetchConfsTechPast(now);
  assert.deepEqual(fetched.sort(), [...CONFS_TECH_PAST_SOURCES].sort());
  assert.deepEqual(
    result.items.map((i) => i.start_date),
    ['2026-03-11', '2026-12-03'],
  );
  // Lege feeds melden zichzelf; het ongeldige oude record niet.
  assert.ok(result.errors.every((e) => /bevat geen conferenties/.test(e)));
});

test('testing-conferences-past uses past.yml, filters to the window and tags its source', async () => {
  const now = new Date('2026-11-19T12:00:00Z');
  globalThis.fetch = async (input) => {
    assert.equal(input, TESTING_CONFERENCES_PAST_SOURCE);
    return new Response(`- name: Tokyo Test Fest 2026
  location: Tokyo, Japan
  dates: "November 12-13, 2026"
  url: https://tokyotestfest.com/en/?utm_source=testingconferences
- name: Old Conf 2019
  location: Paris, France
  dates: "May 2-3, 2019"
  url: https://old.example/
- name: Broken Old 2018
  location: Nowhere
  dates: "TBA 2018"
  url: https://broken.example/
- name: Broken Recent 2026
  location: Somewhere
  dates: "TBA 2026"
  url: https://recent.example/
`);
  };
  const result = await fetchTestingConferencesPast(now);
  assert.deepEqual(
    result.items.map((i) => [i.name, i.start_date, i.source_url]),
    [['Tokyo Test Fest 2026', '2026-11-12', TESTING_CONFERENCES_PAST_SOURCE]],
  );
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /Record 4/);
});

test('images: takes only declared https og:image and the best icon, resolved against the page', () => {
  const html = `<html><head>
    <meta content="/img/og.png?a=1&amp;b=2" property="og:image">
    <meta name='twitter:image' content='https://cdn.example.com/tw.png'>
    <link rel="mask-icon" href="/pinned.svg">
    <link rel="shortcut icon" href="favicon.ico">
    <link rel="icon" sizes="32x32" href="/icon-32.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple.png">
  </head><body><meta property="og:image" content="/late.png"></body></html>`;
  assert.deepEqual(extractImages(html, 'https://conf.example.com/2027/'), {
    image_url: 'https://conf.example.com/img/og.png?a=1&b=2',
    icon_url: 'https://conf.example.com/apple.png',
  });
  // Geen tags: niets verzinnen (ook geen /favicon.ico raden).
  assert.deepEqual(extractImages('<html><head></head></html>', 'https://conf.example.com'), {
    image_url: null,
    icon_url: null,
  });
  // http-, data- en interne URL's worden genegeerd; twitter:image is de terugval.
  const unsafe = `<meta property="og:image" content="http://conf.example.com/og.png">
    <meta name="twitter:image" content="https://cdn.example.com/tw.png">
    <link rel="icon" href="data:image/png;base64,AAAA">
    <link rel="icon" href="https://127.0.0.1/x.png">`;
  assert.deepEqual(extractImages(unsafe, 'https://conf.example.com'), {
    image_url: 'https://cdn.example.com/tw.png',
    icon_url: null,
  });
  for (const host of ['localhost', '127.0.0.1', '10.0.0.1', '[::1]', 'metadata', 'db.internal']) {
    assert.equal(isPublicHostname(host), false, host);
  }
  assert.equal(isPublicHostname('www.vuejs.amsterdam'), true);
});

test('images: fetch checks every redirect hop and reports blocked pages', async () => {
  const seen = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    seen.push(url);
    assert.equal(init.redirect, 'manual');
    if (url === 'http://conf.example.com/') {
      return new Response(null, {
        status: 301,
        headers: { location: 'https://conf.example.com/' },
      });
    }
    if (url === 'https://conf.example.com/') {
      return new Response('<head><link rel="icon" href="/i.svg"></head>', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    if (url === 'https://evil.example.com/') {
      return new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } });
    }
    return new Response(null, { status: 403 });
  };
  assert.deepEqual(await fetchConferenceImages('http://conf.example.com'), {
    image_url: null,
    icon_url: 'https://conf.example.com/i.svg',
  });
  await assert.rejects(fetchConferenceImages('https://evil.example.com'), /publieke/);
  assert.ok(!seen.some((url) => url.includes('169.254')));
  await assert.rejects(fetchConferenceImages('https://blocked.example.com'), /HTTP 403/);
});
