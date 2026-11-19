// GET — kostenaannames per land (publiek leesbaar) voor de schatting in de explorer.
import { connection } from 'next/server';
import { COST_ASSUMPTION_COLUMNS } from '@/lib/costs';
import { jsonError } from '@/lib/http';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { CostAssumption, ListResponse } from '@/lib/types';

export async function GET() {
  await connection();
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('cost_assumptions')
      .select(COST_ASSUMPTION_COLUMNS)
      .order('country_label', { ascending: true })
      .limit(500);
    if (error) return jsonError(error.message, 500);
    return Response.json({
      items: (data ?? []) as CostAssumption[],
    } satisfies ListResponse<CostAssumption>);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}
