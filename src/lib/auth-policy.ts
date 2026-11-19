export const ENTRA_USER_ROLE = 'ConferenceTracker.User';
export const ENTRA_ADMIN_ROLE = 'ConferenceTracker.Admin';
export const AUTHORIZATION_MAX_AGE = 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function entraTenant(issuer: string | undefined): string | null {
  const match = issuer?.match(/^https:\/\/login\.microsoftonline\.com\/([^/]+)\/v2\.0\/?$/i);
  return match && UUID.test(match[1]) ? match[1].toLowerCase() : null;
}

/** Only call with claims from the ID token already validated by Auth.js. */
export function entraIdentity(claims: unknown, tenant: string | null) {
  if (!tenant || !claims || typeof claims !== 'object' || Array.isArray(claims)) return null;
  const p = claims as Record<string, unknown>;
  if (
    typeof p.tid !== 'string' ||
    p.tid.toLowerCase() !== tenant ||
    typeof p.oid !== 'string' ||
    !UUID.test(p.oid) ||
    !Array.isArray(p.roles)
  )
    return null;
  const isAdmin = p.roles.includes(ENTRA_ADMIN_ROLE);
  if (!isAdmin && !p.roles.includes(ENTRA_USER_ROLE)) return null;
  const name =
    typeof p.name === 'string'
      ? p.name
          .replace(/[\u0000-\u001f\u007f]/g, '')
          .trim()
          .slice(0, 80)
      : '';
  if (!name) return null;
  return { objectId: p.oid.toLowerCase(), tenantId: tenant, name, isAdmin };
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return Boolean(origin && origin === new URL(request.url).origin);
}
