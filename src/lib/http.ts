/**
 * Gedeelde helpers voor API-routes (eigenaar: A).
 */
import { requireUser } from '@/lib/auth-access';
import type { ErrorResponse } from '@/lib/types';

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message } satisfies ErrorResponse, { status });
}

/**
 * Controleert de server-side Microsoft-sessie en de toegewezen Entra-adminrol.
 * Geen terugval op een gedeeld ADMIN_TOKEN.
 *
 *   const denied = await requireAdmin(request);
 *   if (denied) return denied;
 */
export async function requireAdmin(request: Request): Promise<Response | null> {
  const access = await requireUser(request);
  if (access.response) return access.response;
  return access.isAdmin ? null : jsonError('Beheerrechten vereist', 403);
}

export function notImplemented(what: string): Response {
  return jsonError(`Not implemented: ${what}`, 501);
}
