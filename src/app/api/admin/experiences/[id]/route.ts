// DELETE — ervaring inclusief foto's verwijderen (moderatie). Entra-adminrol vereist.
import { PHOTO_BUCKET } from '@/lib/experiences-server';
import { jsonError, requireAdmin } from '@/lib/http';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(request: Request, ctx: RouteContext<'/api/admin/experiences/[id]'>) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return jsonError('Ongeldige id', 400);

  try {
    const db = getSupabaseAdmin();
    const photos = await db
      .from('experience_photos')
      .select('storage_path')
      .eq('experience_id', id);
    if (photos.error) return jsonError(photos.error.message, 500);
    const paths = ((photos.data ?? []) as { storage_path: string }[]).map((p) => p.storage_path);
    if (paths.length) {
      const removed = await db.storage.from(PHOTO_BUCKET).remove(paths);
      if (removed.error)
        return jsonError(`Foto's verwijderen mislukt: ${removed.error.message}`, 500);
    }
    const { data, error } = await db.from('experiences').delete().eq('id', id).select('id');
    if (error) return jsonError(error.message, 500);
    if (!data || data.length === 0) return jsonError('Ervaring niet gevonden', 404);
    return new Response(null, { status: 204 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}
