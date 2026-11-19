// Requires Node >=22.15. Run: node --experimental-strip-types --test src/app/api/favorites/favorites.test.mjs
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { after, test } from 'node:test';

// Entra-sessie injecteren op de Auth.js-grens (zelfde patroon als custom-sources.test.mjs).
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/auth')
      return {
        url: 'data:text/javascript,export async function auth(){return globalThis.testEntraSession ?? null}',
        shortCircuit: true,
      };
    if (specifier.startsWith('@/')) {
      return nextResolve(
        new URL(`../../../${specifier.slice(2)}.ts`, import.meta.url).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
});

const { GET, POST, DELETE } = await import('@/app/api/favorites/route');

const TENANT = '22222222-2222-4222-8222-222222222222';
const USER = '44444444-4444-4444-8444-444444444444';
const APPROVED = '55555555-5555-4555-8555-555555555555';
const REJECTED = '66666666-6666-4666-8666-666666666666';
const UNKNOWN = '77777777-7777-4777-8777-777777777777';

const originalFetch = globalThis.fetch;
const originalEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  AUTH_MICROSOFT_ENTRA_ID_ISSUER: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
};
after(() => {
  globalThis.fetch = originalFetch;
  delete globalThis.testEntraSession;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

/** In-memory Supabase REST voor app_users, conferences en favorites. */
function mockDb({ tableMissing = false } = {}) {
  const favorites = [];
  const conferences = [
    { id: APPROVED, status: 'approved' },
    { id: REJECTED, status: 'rejected' },
  ];
  const eq = (url, key) => url.searchParams.get(key)?.replace(/^eq\./, '');
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    assert.equal(url.origin, 'https://favorites-test.invalid');
    if (url.pathname.endsWith('/app_users')) {
      return Response.json({ id: 'app-user-1', display_name: 'Test', disabled_at: null });
    }
    if (url.pathname.endsWith('/conferences')) {
      const ids = (url.searchParams.get('id') ?? '').replace(/^in\.\(|\)$/g, '').split(',');
      const status = eq(url, 'status');
      return Response.json(conferences.filter((c) => ids.includes(c.id) && c.status === status));
    }
    assert.ok(url.pathname.endsWith('/favorites'));
    if (tableMissing) {
      return Response.json(
        { code: 'PGRST205', message: "Could not find the table 'public.favorites'" },
        { status: 404 },
      );
    }
    if (request.method === 'GET') {
      return Response.json(favorites.filter((f) => f.user_id === eq(url, 'user_id')));
    }
    if (request.method === 'POST') {
      for (const row of await request.json()) {
        const exists = favorites.some(
          (f) => f.user_id === row.user_id && f.conference_id === row.conference_id,
        );
        if (!exists) favorites.push(row);
      }
      return new Response(null, { status: 201 });
    }
    if (request.method === 'DELETE') {
      const userId = eq(url, 'user_id');
      const conferenceId = eq(url, 'conference_id');
      const index = favorites.findIndex(
        (f) => f.user_id === userId && f.conference_id === conferenceId,
      );
      if (index >= 0) favorites.splice(index, 1);
      return new Response(null, { status: 204 });
    }
    throw new Error(`Onverwacht verzoek ${request.method} ${url}`);
  };
  return favorites;
}

function signIn() {
  process.env.SUPABASE_URL = 'https://favorites-test.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-key';
  process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER = `https://login.microsoftonline.com/${TENANT}/v2.0`;
  globalThis.testEntraSession = {
    user: {
      id: USER,
      name: 'Test Gebruiker',
      tenantId: TENANT,
      isAdmin: false,
      authorizedUntil: Date.now() / 1000 + 100,
    },
  };
}

const request = (method, { body, query = '', origin = 'https://app.test' } = {}) =>
  new Request(`https://app.test/api/favorites${query}`, {
    method,
    headers: { origin, 'content-type': 'application/json' },
    body,
  });

test('favorites require a signed-in user and a same-origin write', async () => {
  signIn();
  mockDb();
  globalThis.testEntraSession = null;
  assert.equal((await GET(request('GET'))).status, 401);
  signIn();
  const crossSite = request('POST', {
    body: JSON.stringify({ conferenceIds: [APPROVED] }),
    origin: 'https://evil.example',
  });
  assert.equal((await POST(crossSite)).status, 403);
});

test('add, list and remove favorites; only approved conferences are stored', async () => {
  signIn();
  const stored = mockDb();
  const add = await POST(
    request('POST', { body: JSON.stringify({ conferenceIds: [APPROVED, REJECTED, UNKNOWN] }) }),
  );
  assert.equal(add.status, 200);
  assert.deepEqual(await add.json(), { added: 1, skipped: 2 });
  assert.deepEqual(stored, [{ user_id: 'app-user-1', conference_id: APPROVED }]);

  // Dubbel toevoegen maakt geen tweede rij.
  await POST(request('POST', { body: JSON.stringify({ conferenceIds: [APPROVED] }) }));
  assert.equal(stored.length, 1);

  const list = await GET(request('GET'));
  assert.deepEqual(await list.json(), { items: [APPROVED] });

  const removed = await DELETE(request('DELETE', { query: `?conferenceId=${APPROVED}` }));
  assert.equal(removed.status, 204);
  assert.equal(stored.length, 0);
});

test('invalid input is rejected before touching the database', async () => {
  signIn();
  mockDb();
  for (const body of [
    '{',
    'null',
    '[]',
    '{"conferenceIds":[]}',
    '{"conferenceIds":"x"}',
    '{"conferenceIds":["not-a-uuid"]}',
    JSON.stringify({ conferenceIds: Array(501).fill(APPROVED) }),
    'x'.repeat(20_001),
  ]) {
    assert.equal((await POST(request('POST', { body }))).status, 400, body.slice(0, 40));
  }
  assert.equal((await DELETE(request('DELETE', { query: '?conferenceId=x' }))).status, 400);
});

test('missing favorites table answers 503 so the client keeps browser favorites', async () => {
  signIn();
  mockDb({ tableMissing: true });
  assert.equal((await GET(request('GET'))).status, 503);
  const add = await POST(request('POST', { body: JSON.stringify({ conferenceIds: [APPROVED] }) }));
  assert.equal(add.status, 503);
});
