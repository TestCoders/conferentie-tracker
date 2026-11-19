// Eigenaar: A. GET /api/conferences — alleen approved, oplopend op start_date.
// ?period=upcoming (standaard, aankomend of lopend) | past (afgelopen) | all (beide).
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { jsonError } from '@/lib/http';
import { CONFERENCE_COLUMNS, type Conference, type ListResponse } from '@/lib/types';

const PERIODS = ['upcoming', 'past', 'all'] as const;
type Period = (typeof PERIODS)[number];

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('period') ?? 'upcoming';
  if (!PERIODS.includes(raw as Period)) {
    return jsonError(`period moet ${PERIODS.join(', ')} zijn`, 400);
  }
  const period = raw as Period;

  try {
    const today = new Date().toISOString().slice(0, 10);
    let query = getSupabaseAdmin()
      .from('conferences')
      .select(CONFERENCE_COLUMNS)
      .eq('status', 'approved')
      .order('start_date', { ascending: true })
      .limit(2000);
    if (period === 'upcoming') {
      query = query.or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`);
    } else if (period === 'past') {
      query = query.or(`end_date.lt.${today},and(end_date.is.null,start_date.lt.${today})`);
    }

    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);
    return Response.json({
      items: (data ?? []) as Conference[],
    } satisfies ListResponse<Conference>);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}
