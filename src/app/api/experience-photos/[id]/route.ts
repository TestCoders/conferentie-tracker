import { requireUser } from '@/lib/auth-access';
import { PHOTO_BUCKET } from '@/lib/experiences-server';
import { jsonError } from '@/lib/http';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request, ctx: RouteContext<'/api/experience-photos/[id]'>) {
  const access = await requireUser(request);
  if (access.response) return access.response;
  const { id } = await ctx.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return jsonError('Ongeldige foto-ID', 400);
  }
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('experience_photos')
      .select('storage_path')
      .eq('id', id)
      .maybeSingle();
    if (error) return jsonError('Foto ophalen mislukt', 500);
    if (!data) return jsonError('Foto niet gevonden', 404);
    const file = await db.storage.from(PHOTO_BUCKET).download(data.storage_path);
    if (file.error || !file.data) return jsonError('Foto niet beschikbaar', 404);
    return new Response(file.data, {
      headers: {
        'Content-Type': file.data.type || 'application/octet-stream',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return jsonError('Foto ophalen mislukt', 500);
  }
}
