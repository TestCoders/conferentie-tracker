// Eigenaar: A. GET /api/conferences — alleen approved, aankomend, oplopend op start_date.
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { jsonError } from '@/lib/http';
import { CONFERENCE_COLUMNS, type Conference, type ListResponse } from '@/lib/types';

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await getSupabaseAdmin()
      .from('conferences')
      .select(CONFERENCE_COLUMNS)
      .eq('status', 'approved')
      .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`)
      .order('start_date', { ascending: true });

    if (error) return jsonError(error.message, 500);
    return Response.json({
      items: (data ?? []) as Conference[],
    } satisfies ListResponse<Conference>);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}
