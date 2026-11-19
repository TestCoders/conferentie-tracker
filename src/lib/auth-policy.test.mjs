import assert from 'node:assert/strict';
import { test } from 'node:test';
import { entraIdentity, entraTenant, sameOrigin } from './auth-policy.ts';

const tenant = '11111111-1111-1111-1111-111111111111';
const claims = {
  tid: tenant,
  oid: '22222222-2222-2222-2222-222222222222',
  name: 'TestCoders collega',
  roles: ['ConferenceTracker.User'],
};

test('only a tenant-specific Microsoft issuer is accepted', () => {
  assert.equal(entraTenant(`https://login.microsoftonline.com/${tenant}/v2.0`), tenant);
  for (const issuer of [
    undefined,
    'https://login.microsoftonline.com/common/v2.0',
    'https://login.microsoftonline.com/organizations/v2.0',
    `https://attacker.example/${tenant}/v2.0`,
  ])
    assert.equal(entraTenant(issuer), null);
});
test('requires validated tenant, immutable object ID, name and exact assigned role', () => {
  assert.equal(entraIdentity(claims, tenant)?.isAdmin, false);
  assert.equal(
    entraIdentity({ ...claims, roles: ['ConferenceTracker.Admin'] }, tenant)?.isAdmin,
    true,
  );
  for (const invalid of [
    null,
    [],
    { ...claims, roles: [] },
    { ...claims, roles: ['admin'] },
    { ...claims, oid: 'not-a-uuid' },
    { ...claims, tid: 'another-tenant' },
    { ...claims, name: '' },
  ])
    assert.equal(entraIdentity(invalid, tenant), null);
  // Matching email text never grants access to a foreign tenant or an unassigned account.
  assert.equal(entraIdentity({ ...claims, roles: [], email: 'admin@testcoders.nl' }, tenant), null);
});
test('display names and matching emails never determine identity or admin rights', () => {
  const first = entraIdentity(claims, tenant);
  const second = entraIdentity(
    { ...claims, name: 'Andere naam', email: 'different@testcoders.nl' },
    tenant,
  );
  assert.equal(first.objectId, second.objectId);
  assert.equal(second.isAdmin, false);
});
test('cookie-authenticated mutations require the exact same origin', () => {
  const request = (origin) =>
    new Request('https://tracker.example/api/reviews', {
      method: 'POST',
      headers: origin ? { origin } : {},
    });
  assert.equal(sameOrigin(request('https://tracker.example')), true);
  assert.equal(sameOrigin(request('https://tracker.example.attacker.example')), false);
  assert.equal(sameOrigin(request('null')), false);
  assert.equal(sameOrigin(request()), false);
});
