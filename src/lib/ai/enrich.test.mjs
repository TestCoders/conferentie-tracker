// Requires Node >=22.15. Run: node --experimental-strip-types --test src/lib/ai/enrich.test.mjs
// Geen netwerk of database: alleen de pure regels van de AI-verrijking.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      return nextResolve(new URL(`../../${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    if (
      specifier.startsWith('./') &&
      !specifier.endsWith('.ts') &&
      context.parentURL?.endsWith('.ts')
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const { planConferenceUpdate } = await import('@/lib/ai/enrich');
const { extractJson } = await import('@/lib/ai/openrouter');
const { assertPublicHttps, htmlToSnapshot } = await import('@/lib/ai/safe-fetch');

const row = {
  id: 'c1',
  name: 'Voorbeeldconf',
  official_url: 'https://conf.example/',
  start_date: '2027-03-11',
  end_date: '2027-03-12',
  city: 'Amsterdam',
  country: 'Netherlands',
  online_only: false,
  cfp_url: null,
  cfp_deadline: null,
  ticket_price_eur: null,
  ticket_price_url: null,
  ai_fields: [],
};
const allowed = new Set(['https://conf.example/', 'https://conf.example/tickets']);

test('AI fills missing fields but never overwrites source data it did not set', () => {
  const { patch, fields } = planConferenceUpdate(
    row,
    {
      city: 'Rotterdam',
      country: 'Belgium',
      online_only: false,
      ticket_price_eur: 499,
      ticket_price_url: 'https://conf.example/tickets',
      cfp_deadline: '2026-12-01',
      cfp_url: 'https://conf.example/tickets',
    },
    allowed,
  );
  assert.equal(patch.city, undefined);
  assert.equal(patch.country, undefined);
  assert.equal(patch.ticket_price_eur, 499);
  assert.equal(patch.ticket_price_url, 'https://conf.example/tickets');
  assert.equal(patch.cfp_deadline, '2026-12-01');
  assert.deepEqual(fields.sort(), [
    'cfp_deadline',
    'cfp_url',
    'ticket_price_eur',
    'ticket_price_url',
  ]);
});

test('AI refreshes fields it filled earlier, and ticket price always', () => {
  const owned = {
    ...row,
    city: null,
    country: 'Germany',
    ai_fields: ['country'],
    ticket_price_eur: 300,
  };
  const { patch } = planConferenceUpdate(
    owned,
    {
      city: 'Berlin',
      country: 'Austria',
      online_only: null,
      ticket_price_eur: 350,
      ticket_price_url: null,
      cfp_deadline: null,
      cfp_url: null,
    },
    allowed,
  );
  assert.equal(patch.city, 'Berlin');
  assert.equal(patch.country, 'Austria');
  assert.equal(patch.ticket_price_eur, 350);
  // Zonder geldige prijs-URL valt de bron terug op de officiële website.
  assert.equal(patch.ticket_price_url, 'https://conf.example/');
});

test('AI output is validated: bad dates, foreign URLs and absurd prices are ignored; null keeps data', () => {
  const known = { ...row, ticket_price_eur: 400, ticket_price_url: 'https://conf.example/tickets' };
  const { patch } = planConferenceUpdate(
    known,
    {
      city: null,
      country: null,
      online_only: null,
      ticket_price_eur: 999999,
      ticket_price_url: 'https://evil.example/',
      cfp_deadline: '2026-02-30',
      cfp_url: 'http://conf.example/cfp',
    },
    allowed,
  );
  assert.deepEqual(patch, {});
});

test('online-only is only set when no physical location is known', () => {
  const noPlace = { ...row, city: null, country: null };
  assert.equal(
    planConferenceUpdate(noPlace, { online_only: true }, allowed).patch.online_only,
    true,
  );
  assert.equal(
    planConferenceUpdate(row, { online_only: true }, allowed).patch.online_only,
    undefined,
  );
});

test('extractJson handles plain, fenced and wrapped JSON', () => {
  assert.deepEqual(extractJson('{"items":[]}'), { items: [] });
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('Hier is het: {"a":2} klaar'), { a: 2 });
  assert.throws(() => extractJson('geen json'), /geen geldige JSON/);
});

test('page fetching rejects non-https, IP addresses, credentials and internal hosts', async () => {
  for (const url of [
    'http://conf.example/',
    'https://127.0.0.1/',
    'https://[::1]/',
    'https://169.254.169.254/latest/meta-data',
    'https://user:pw@conf.example/',
    'https://localhost/',
    'https://intranet/',
    'https://printer.local/',
  ]) {
    await assert.rejects(assertPublicHttps(url), undefined, url);
  }
});

test('HTML snapshot strips scripts, keeps text and only same-site https ticket/CFP links', () => {
  const html = `<html><head><title>Conf &amp; Co</title><script>alert(1)</script></head>
    <body><h1>Welkom</h1><p>Ticket: &euro;499</p>
    <a href="/tickets">Buy tickets</a> <a href="https://evilconf.example/tickets">x</a>
    <a href="https://sub.conf.example/cfp">Call for papers</a> <a href="/about">About</a></body></html>`;
  const snap = htmlToSnapshot(html, new URL('https://conf.example/'));
  assert.equal(snap.title, 'Conf & Co');
  assert.match(snap.text, /Ticket: €499/);
  assert.doesNotMatch(snap.text, /alert/);
  assert.deepEqual(snap.links, ['https://conf.example/tickets', 'https://sub.conf.example/cfp']);
});
