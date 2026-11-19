// Eigenaar: D. GET /api/admin/conferences — alle statussen, admin-token vereist.
import { jsonError, requireAdmin } from '@/lib/http';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { CONFERENCE_COLUMNS, type Conference, type ListResponse } from '@/lib/types';

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('conferences')
      .select(CONFERENCE_COLUMNS)
      .order('start_date', { ascending: true });

    if (error) return jsonError(error.message, 500);
    return Response.json({
      items: (data ?? []) as Conference[],
    } satisfies ListResponse<Conference>);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}
