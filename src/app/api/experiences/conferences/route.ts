// GET — goedgekeurde conferenties die al begonnen zijn, om een ervaring aan te koppelen.
import { connection } from 'next/server';
import { jsonError } from '@/lib/http';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { ExperienceConference, ListResponse } from '@/lib/types';

export async function GET() {
  await connection();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await getSupabaseAdmin()
      .from('conferences')
      .select('id,name,start_date,end_date,city,country')
      .eq('status', 'approved')
      .lte('start_date', today)
      .order('start_date', { ascending: false })
      .limit(500);
    if (error) return jsonError(error.message, 500);
    return Response.json({
      items: (data ?? []) as ExperienceConference[],
    } satisfies ListResponse<ExperienceConference>);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}
