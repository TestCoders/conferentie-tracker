import { auth } from '@/auth';
import { entraTenant, sameOrigin } from '@/lib/auth-policy';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { AppUser } from '@/lib/types';

/** Session authentication and CSRF checking precede all database writes. */
export async function requireUser(
  request: Request,
): Promise<
  | { user: AppUser; isAdmin: boolean; response?: never }
  | { response: Response; user?: never; isAdmin?: never }
> {
  const session = await auth();
  if (!session?.user || session.user.authorizedUntil <= Date.now() / 1000) {
    return {
      response: Response.json(
        { error: 'Log in met je TestCoders Microsoft-account' },
        { status: 401 },
      ),
    };
  }
  if (session.user.tenantId !== entraTenant(process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER)) {
    return {
      response: Response.json({ error: 'Geen toegang tot deze organisatie' }, { status: 403 }),
    };
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !sameOrigin(request)) {
    return { response: Response.json({ error: 'Ongeldige aanvraagorigin' }, { status: 403 }) };
  }
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('app_users')
      .upsert(
        {
          tenant_id: session.user.tenantId,
          entra_object_id: session.user.id,
          display_name: session.user.name,
        },
        { onConflict: 'tenant_id,entra_object_id' },
      )
      .select('id,display_name,disabled_at')
      .single();
    if (error || !data) {
      return {
        response: Response.json(
          { error: 'Gebruikersdatabase niet beschikbaar. Controleer de Entra-migratie.' },
          { status: 503 },
        ),
      };
    }
    const user = data as AppUser;
    if (user.disabled_at)
      return { response: Response.json({ error: 'Account is geblokkeerd' }, { status: 403 }) };
    return { user, isAdmin: session.user.isAdmin };
  } catch {
    return {
      response: Response.json({ error: 'Gebruikersdatabase niet beschikbaar' }, { status: 503 }),
    };
  }
}
