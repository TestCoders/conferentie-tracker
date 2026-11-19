// Requires Node >=22.15. Run: node --experimental-strip-types --test src/lib/discovery/formats/formats.test.mjs
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { after, test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const path = specifier === '@/lib/discovery' ? 'lib/discovery/index' : specifier.slice(2);
      return nextResolve(new URL(`../../../${path}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { detectFormat, parseWithFormat } = await import('@/lib/discovery/formats/detect');
const { analyzeSource } = await import('@/lib/discovery/custom-sources');
const { toConferences, pageContent } = await import('@/lib/discovery/formats/ai-extract');
const { runCustomDiscovery } = await import('@/lib/discovery');

const URL_ = 'https://93.184.215.14/events';
const origin = { sourceUrl: URL_, sourceName: 'Eigen bron', defaultCategory: 'development' };
const doc = (text, contentType = '') => ({ text, contentType, url: URL_ });
const detectAndParse = async (d) => parseWithFormat(d, detectFormat(d), origin);

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
after(() => {
  globalThis.fetch = originalFetch;
  process.env = originalEnv;
});

test('known feed shapes keep the exact parsers of the fixed sources', () => {
  const confs = doc(
    JSON.stringify([
      { name: 'Vuejs Amsterdam', url: 'https://vuejs.amsterdam', startDate: '2027-03-11' },
    ]),
  );
  assert.equal(detectFormat(confs).format, 'confs-tech-json');
  const testing = doc(`- name: Test Automation Days 2027
  location: Hilversum, the Netherlands
  dates: "March 3-4, 2027"
  url: https://www.testautomationdays.com/
`);
  assert.equal(detectFormat(testing).format, 'testing-conferences-yaml');
});

test('JSON with other field names and a nested list is mapped automatically', async () => {
  const d = doc(
    JSON.stringify({
      meta: { count: 2 },
      data: {
        events: [
          {
            title: 'Agile Testing Days',
            website: 'https://agiletestingdays.com/?utm_source=list',
            start_date: '2027-11-15T09:00:00+01:00',
            end_date: '2027-11-18',
            venue: { city: 'Potsdam', country: 'Germany' },
            ticket_price: 1290,
          },
          {
            title: 'Online QA Summit',
            website: 'https://example.org/qa-summit',
            start_date: '2027-05-01',
            is_online: true,
          },
          { title: 'Zonder datum', website: 'https://example.org/x' },
        ],
      },
    }),
    'application/json',
  );
  const detected = detectFormat(d);
  assert.equal(detected.format, 'json');
  assert.deepEqual(detected.config.recordsPath, ['data', 'events']);
  assert.deepEqual(detected.config.fields, {
    name: 'title',
    url: 'website',
    startDate: 'start_date',
    endDate: 'end_date',
    location: 'venue',
    online: 'is_online',
    price: 'ticket_price',
  });
  const { items, errors } = await parseWithFormat(d, detected, origin);
  assert.equal(items.length, 2);
  assert.equal(errors.length, 1);
  assert.deepEqual(
    [items[0].start_date, items[0].end_date, items[0].city, items[0].country],
    ['2027-11-15', '2027-11-18', 'Potsdam', 'Germany'],
  );
  assert.equal(items[0].canonical_url, 'https://agiletestingdays.com');
  assert.equal(items[0].category, 'testing');
  assert.equal(items[0].price_text, '1290');
  assert.equal(items[1].online_only, true);
  assert.equal(items[1].source_name, 'Eigen bron');
});

test('YAML with free-text dates and a location string is mapped automatically', async () => {
  const d = doc(`conferences:
  - event: EuroSTAR 2027
    when: "June 8-10, 2027"
    where: Oslo, Norway
    link: https://conference.eurostarsoftwaretesting.com/
  - event: Online TestFest
    when: "May 25, 2027"
    where: Online
    link: https://example.org/testfest
`);
  const detected = detectFormat(d);
  assert.equal(detected.format, 'yaml');
  assert.equal(detected.config.fields.dates, 'when');
  const { items } = await parseWithFormat(d, detected, { ...origin, defaultCategory: 'testing' });
  assert.deepEqual(
    items.map((i) => [i.start_date, i.end_date, i.city, i.country, i.online_only, i.category]),
    [
      ['2027-06-08', '2027-06-10', 'Oslo', 'Norway', false, 'testing'],
      ['2027-05-25', null, null, null, true, 'testing'],
    ],
  );
});

test('iCalendar: folded lines, all-day exclusive end date, address and online', async () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'SUMMARY:Test Automation Days 2027',
    'DTSTART;VALUE=DATE:20270303',
    'DTEND;VALUE=DATE:20270305',
    'LOCATION:Hotel Lapershoek\\, Utrechtseweg 16\\, 1213 TS Hilversum\\, Netherlands',
    'URL:https://www.testautomationdays.com/',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'SUMMARY:Een heel lange naam die over meerdere regels',
    '  doorloopt',
    'DTSTART:20270601T090000Z',
    'LOCATION:Online',
    'URL:https://example.org/online',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'SUMMARY:Zonder URL',
    'DTSTART:20270701',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const d = doc(ics, 'text/calendar');
  assert.equal(detectFormat(d).format, 'ical');
  const { items, errors } = await detectAndParse(d);
  assert.equal(errors.length, 1);
  assert.deepEqual(
    [items[0].start_date, items[0].end_date, items[0].city, items[0].country],
    ['2027-03-03', '2027-03-04', 'Hilversum', 'Netherlands'],
  );
  assert.equal(items[0].category, 'test-automation');
  assert.equal(items[1].name, 'Een heel lange naam die over meerdere regels doorloopt');
  assert.equal(items[1].online_only, true);
});

test('HTML with schema.org events (JSON-LD): list page, hybrid, online and offers', async () => {
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', name: 'Organisator' },
      {
        '@type': 'ItemList',
        itemListElement: [
          {
            '@type': 'ListItem',
            item: {
              '@type': 'BusinessEvent',
              name: 'Devoxx Belgium 2027',
              url: 'https://devoxx.be/',
              startDate: '2027-10-04',
              endDate: '2027-10-08',
              eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
              location: {
                '@type': 'Place',
                name: 'Kinepolis',
                address: {
                  '@type': 'PostalAddress',
                  addressLocality: 'Antwerp',
                  addressCountry: 'BE',
                },
              },
              offers: { '@type': 'Offer', price: '895', priceCurrency: 'EUR' },
            },
          },
          {
            '@type': 'ListItem',
            item: {
              '@type': 'Event',
              name: 'Remote QA Day',
              url: '/remote-qa-day',
              startDate: '2027-04-20T10:00:00Z',
              eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
              location: { '@type': 'VirtualLocation', url: 'https://example.org/stream' },
            },
          },
        ],
      },
    ],
  };
  const html = `<!doctype html><html><head><title>Events</title>
<script type="application/ld+json">${JSON.stringify(ld)}</script></head><body>…</body></html>`;
  const d = doc(html, 'text/html; charset=utf-8');
  assert.equal(detectFormat(d).format, 'jsonld');
  const { items, errors } = await detectAndParse(d);
  assert.deepEqual(errors, []);
  assert.deepEqual(
    [items[0].city, items[0].country, items[0].online_only, items[0].price_text],
    ['Antwerp', 'Belgium', false, 'EUR 895'],
  );
  assert.equal(items[1].official_url, 'https://93.184.215.14/remote-qa-day');
  assert.equal(items[1].online_only, true);
  assert.equal(items[1].category, 'testing');
});

test('plain HTML without structured data needs the AI; without a key it is refused', () => {
  delete process.env.OPENROUTER_API_KEY;
  const d = doc('<html><body><h1>Conferenties 2027</h1></body></html>', 'text/html');
  assert.throws(() => detectFormat(d), /AI-extractie is niet geconfigureerd/);
  process.env.OPENROUTER_API_KEY = 'test-only-key';
  assert.equal(detectFormat(d).format, 'ai');
  for (const text of ['hello world', '{"total": 3}', '<?xml version="1.0"?><rss/>']) {
    assert.throws(() => detectFormat(doc(text)), text);
  }
});

test('AI output is validated: only links from the page, full dates, nothing invented', () => {
  const html = `<html><body><h1>Testconferenties</h1>
<p>Amsterdam Testing Conference, 12-13 mei 2027, Amsterdam</p><a href="https://testcon.example.com/">TestCon</a>
<p>Iets in 2027</p><a href="/cfp">Call for papers</a></body></html>`;
  const content = pageContent(html, URL_);
  assert.deepEqual(
    content.links.map((l) => l.url),
    ['https://testcon.example.com/', 'https://93.184.215.14/cfp'],
  );
  const { items, errors } = toConferences(
    {
      items: [
        {
          name: 'Amsterdam Testing Conference',
          url: 'https://testcon.example.com/',
          start_date: '2027-05-12',
          end_date: '2027-05-13',
          city: 'Amsterdam',
          country: 'Netherlands',
          online_only: false,
          cfp_url: 'https://93.184.215.14/cfp',
          cfp_deadline: null,
        },
        // Verzonnen link en geen volledige datum: allebei overgeslagen.
        { name: 'Verzonnen', url: 'https://not-on-page.example/', start_date: '2027-06-01' },
        { name: 'Iets', url: 'https://testcon.example.com/', start_date: '2027' },
      ],
    },
    URL_,
    content,
    origin,
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].cfp_url, 'https://93.184.215.14/cfp');
  assert.equal(items[0].category, 'testing');
  assert.equal(errors.length, 2);
  assert.match(errors[0], /geen URL van de pagina/);
});

test('analysis suggests a category and shows a sample; AI sources are marked pending', async () => {
  process.env.OPENROUTER_API_KEY = 'test-only-key';
  globalThis.fetch = async (input) => {
    assert.equal(String(input), 'https://openrouter.ai/api/v1/chat/completions');
    const answer = {
      items: [
        {
          name: 'Amsterdam Testing Conference',
          url: 'https://testcon.example.com/',
          start_date: '2027-05-12',
          end_date: null,
          city: 'Amsterdam',
          country: 'Netherlands',
          online_only: false,
          cfp_url: null,
          cfp_deadline: null,
        },
      ],
    };
    return Response.json({
      model: 'test-model',
      choices: [{ message: { content: JSON.stringify(answer) } }],
    });
  };
  const html =
    '<html><body><p>Amsterdam Testing Conference 12 mei 2027</p><a href="https://testcon.example.com/">x</a></body></html>';
  const analysis = await analyzeSource(URL_, async () => doc(html, 'text/html'));
  assert.equal(analysis.format, 'ai');
  assert.equal(analysis.pending, true);
  assert.equal(analysis.found, 1);
  assert.equal(analysis.defaultCategory, 'testing');
  assert.equal(analysis.sample[0].source_url, URL_);

  await assert.rejects(
    analyzeSource(URL_, async () => doc(JSON.stringify([{ title: 'x' }]))),
    /zonder herkenbare conferentielijst/,
  );
});

test('AI-extracted conferences are inserted as pending; existing ones keep their status', async () => {
  process.env.SUPABASE_URL = 'https://discovery-test.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-key';
  process.env.OPENROUTER_API_KEY = 'test-only-key';
  const SOURCE_ID = '33333333-3333-4333-8333-333333333333';
  const page =
    '<html><body><p>Amsterdam Testing Conference 12 mei 2027</p><a href="https://testcon.example.com/">x</a></body></html>';
  const inserts = [];
  const updates = [];
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (request.url === URL_)
      return new Response(page, { headers: { 'content-type': 'text/html' } });
    if (url.hostname === 'openrouter.ai') {
      const item = {
        name: 'Amsterdam Testing Conference',
        url: 'https://testcon.example.com/',
        start_date: '2027-05-12',
        end_date: null,
        city: 'Amsterdam',
        country: 'Netherlands',
        online_only: false,
        cfp_url: null,
        cfp_deadline: null,
      };
      return Response.json({
        choices: [{ message: { content: JSON.stringify({ items: [item] }) } }],
      });
    }
    if (url.pathname.endsWith('/discovery_sources')) {
      return Response.json([
        {
          id: SOURCE_ID,
          name: 'Testpagina',
          url: URL_,
          format: 'ai',
          config: null,
          default_category: 'testing',
          created_at: '2026-11-19T00:00:00Z',
        },
      ]);
    }
    if (url.pathname.endsWith('/cost_assumptions')) return Response.json([]);
    if (url.pathname.endsWith('/ingestion_runs')) {
      return request.method === 'POST'
        ? Response.json({ id: 'run' })
        : new Response(null, { status: 204 });
    }
    // Huidige categorie van bestaande records (herimport verlaagt die nooit).
    if (request.method === 'GET' && url.pathname.endsWith('/conferences')) return Response.json([]);
    const body = await request.json();
    const ignore = request.headers.get('prefer')?.includes('resolution=ignore-duplicates');
    (ignore ? inserts : updates).push(...body);
    return Response.json(
      ignore ? [] : body.map((r) => ({ canonical_url: r.canonical_url, start_date: r.start_date })),
    );
  };
  const result = await runCustomDiscovery(SOURCE_ID);
  assert.equal(result.found, 1);
  assert.equal(inserts[0].status, 'pending');
  assert.equal(inserts[0].category, 'testing');
  // Bestaat al (insert genegeerd) → bijwerken zonder status: moderatie blijft behouden.
  assert.equal('status' in updates[0], false);
});
