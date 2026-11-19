// Eigenaar: D. DELETE /api/admin/sources/:id — verwijdert de bron, niet de geïmporteerde conferenties.
import { deleteCustomSource, isUuid } from '@/lib/discovery/custom-sources';
import { jsonError, requireAdmin } from '@/lib/http';

export async function DELETE(request: Request, ctx: RouteContext<'/api/admin/sources/[id]'>) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError('Ongeldig id', 400);
  try {
    const deleted = await deleteCustomSource(id);
    if (!deleted) return jsonError('Bron niet gevonden', 404);
    return new Response(null, { status: 204 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Bron verwijderen mislukt', 500);
  }
}
