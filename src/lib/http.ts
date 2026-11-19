/**
 * Gedeelde helpers voor API-routes (eigenaar: A).
 */
import { timingSafeEqual } from 'node:crypto';
import type { ErrorResponse } from './types';

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message } satisfies ErrorResponse, { status });
}

/**
 * Controleert `Authorization: Bearer <ADMIN_TOKEN>`.
 * Geeft een 401-response terug als het token ontbreekt of fout is, anders null.
 *
 *   const denied = requireAdmin(request);
 *   if (denied) return denied;
 */
export function requireAdmin(request: Request): Response | null {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return jsonError('ADMIN_TOKEN is niet geconfigureerd', 500);

  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';

  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return jsonError('Unauthorized', 401);
  }
  return null;
}

export function notImplemented(what: string): Response {
  return jsonError(`Not implemented: ${what}`, 501);
}
