// Eigenaar: D. PATCH /api/admin/conferences/:id — status + beperkte whitelist (ADMIN_EDITABLE_FIELDS).
import { notImplemented, requireAdmin } from '@/lib/http';

export async function PATCH(request: Request, ctx: RouteContext<'/api/admin/conferences/[id]'>) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  // TODO(D): body valideren tegen ADMIN_EDITABLE_FIELDS, update + updated_at, return Conference.
  return notImplemented(`PATCH /api/admin/conferences/${id}`);
}
