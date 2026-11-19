import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { after, test } from 'node:test';

// Inject a session at the Auth.js boundary; no production bypass or fake login provider exists.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/auth')
      return {
        url: 'data:text/javascript,export async function auth(){return globalThis.testEntraSession ?? null}',
        shortCircuit: true,
      };
    if (specifier.startsWith('@/'))
      return nextResolve(
        new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url).href,
        context,
      );
    return nextResolve(specifier, context);
  },
});
const { requireUser } = await import('./auth-access.ts');
const { requireAdmin } = await import('./http.ts');
const { POST: postReview } = await import('../app/api/reviews/route.ts');
const { POST: postAttendance } = await import('../app/api/attendances/route.ts');
const { POST: postPhoto } = await import('../app/api/experiences/[id]/photos/route.ts');
const tenant = '11111111-1111-1111-1111-111111111111';
const env = { ...process.env };
const originalFetch = globalThis.fetch;
process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER = `https://login.microsoftonline.com/${tenant}/v2.0`;
process.env.SUPABASE_URL = 'https://auth-tests.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-key';
const user = {
  id: '22222222-2222-2222-2222-222222222222',
  name: 'TestCoders collega',
  tenantId: tenant,
  isAdmin: false,
  authorizedUntil: Date.now() / 1000 + 100,
};
const request = (origin = 'https://tracker.example') =>
  new Request('https://tracker.example/api/admin/conferences', {
    method: 'POST',
    headers: { origin, authorization: 'Bearer old-shared-token' },
  });
after(() => {
  globalThis.fetch = originalFetch;
  delete globalThis.testEntraSession;
  for (const key of [
    'AUTH_MICROSOFT_ENTRA_ID_ISSUER',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
});

test('old bearer token cannot authenticate; expired sessions and foreign tenants are rejected before DB access', async () => {
  globalThis.fetch = () => assert.fail('must not query DB');
  globalThis.testEntraSession = null;
  assert.equal((await requireAdmin(request())).status, 401);
  globalThis.testEntraSession = { user: { ...user, authorizedUntil: 0 } };
  assert.equal((await requireUser(request())).response.status, 401);
  globalThis.testEntraSession = { user: { ...user, tenantId: 'wrong' } };
  assert.equal((await requireUser(request())).response.status, 403);
  globalThis.testEntraSession = { user };
  assert.equal((await requireUser(request('https://attacker.example'))).response.status, 403);
});
test('ordinary user is forbidden, admin is allowed, disabled account is forbidden', async () => {
  let disabled = false;
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    assert.equal(new URL(req.url).pathname, '/rest/v1/app_users');
    const body = await req.json();
    assert.equal(body.entra_object_id, user.id);
    assert.equal('is_admin' in body, false);
    return Response.json({
      id: '33333333-3333-3333-3333-333333333333',
      display_name: user.name,
      disabled_at: disabled ? new Date().toISOString() : null,
    });
  };
  globalThis.testEntraSession = { user };
  assert.equal((await requireAdmin(request())).status, 403);
  globalThis.testEntraSession = { user: { ...user, isAdmin: true } };
  assert.equal(await requireAdmin(request()), null);
  disabled = true;
  assert.equal((await requireAdmin(request())).status, 403);
});

test('review and attendance APIs reject forged authors and bind writes to the authenticated application user', async () => {
  globalThis.testEntraSession = { user };
  const localId = '33333333-3333-3333-3333-333333333333';
  const conferenceId = '44444444-4444-4444-4444-444444444444';
  let rpcCalls = 0;
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    const path = new URL(req.url).pathname;
    if (path.endsWith('/app_users'))
      return Response.json({ id: localId, display_name: user.name, disabled_at: null });
    assert.equal(path, '/rest/v1/rpc/record_conference_contribution');
    const body = await req.json();
    assert.equal(body.p_user_id, localId);
    assert.equal(body.p_display_name, user.name);
    rpcCalls++;
    return Response.json({
      attendance: null,
      review: { id: 'stored-review', user_id: localId, rating: body.p_rating },
    });
  };
  const jsonRequest = (path, body) =>
    new Request(`https://tracker.example/api/${path}`, {
      method: 'POST',
      headers: { origin: 'https://tracker.example', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await postReview(
        jsonRequest('reviews', { conferenceId, rating: 4, reviewerName: 'Impersonated colleague' }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await postAttendance(
        jsonRequest('attendances', { conferenceId, status: 'interested', user_id: 'someone-else' }),
      )
    ).status,
    400,
  );
  assert.equal(rpcCalls, 0);
  const saved = await postReview(jsonRequest('reviews', { conferenceId, rating: 4 }));
  assert.equal(saved.status, 201);
  assert.equal((await saved.json()).user_id, localId);
  assert.equal(rpcCalls, 1);
});

test('knowing a photo edit token does not allow uploading to another user’s experience', async () => {
  globalThis.testEntraSession = { user };
  const id = '44444444-4444-4444-4444-444444444444';
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    const path = new URL(req.url).pathname;
    if (path.endsWith('/app_users'))
      return Response.json({
        id: '33333333-3333-3333-3333-333333333333',
        display_name: user.name,
        disabled_at: null,
      });
    assert.equal(path, '/rest/v1/experiences');
    return Response.json({
      id,
      user_id: '55555555-5555-5555-5555-555555555555',
      edit_token_hash: 'not-reached',
    });
  };
  const body = new FormData();
  body.set(
    'file',
    new File([new Uint8Array([0xff, 0xd8, 0xff])], 'test.jpg', { type: 'image/jpeg' }),
  );
  body.set('consent', 'yes');
  const req = new Request(`https://tracker.example/api/experiences/${id}/photos`, {
    method: 'POST',
    headers: { origin: 'https://tracker.example', 'x-edit-token': 'known-token' },
    body,
  });
  assert.equal((await postPhoto(req, { params: Promise.resolve({ id }) })).status, 403);
});
