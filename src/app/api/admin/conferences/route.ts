// Eigenaar: D. GET /api/admin/conferences — alle statussen, admin-token vereist.
import { notImplemented, requireAdmin } from '@/lib/http';

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  // TODO(D): select CONFERENCE_COLUMNS uit conferences, order start_date → { items }.
  return notImplemented('GET /api/admin/conferences');
}
