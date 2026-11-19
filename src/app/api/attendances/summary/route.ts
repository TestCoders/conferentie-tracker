// GET — tellingen per conferentie (interesse, bijgewoond, reviews, gemiddelde) voor lijst en vergelijking.
import { connection } from 'next/server';
import { jsonError } from '@/lib/http';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { CommunityStats, CommunitySummaryResponse } from '@/lib/types';

const ROW_LIMIT = 10000;

export async function GET() {
  // Altijd per request: tellingen veranderen zodra iemand zich aanmeldt.
  await connection();
  try {
    const db = getSupabaseAdmin();
    const [people, reviews] = await Promise.all([
      db.from('attendances').select('conference_id,status').limit(ROW_LIMIT),
      db.from('reviews').select('conference_id,rating').limit(ROW_LIMIT),
    ]);
    if (people.error) return jsonError(people.error.message, 500);
    if (reviews.error) return jsonError(reviews.error.message, 500);

    const items: Record<string, CommunityStats> = {};
    const sums: Record<string, number> = {};
    const stats = (id: string) =>
      (items[id] ??= { interested: 0, attended: 0, reviews: 0, averageRating: null });

    for (const p of (people.data ?? []) as { conference_id: string; status: string }[]) {
      if (p.status === 'attended') stats(p.conference_id).attended += 1;
      else stats(p.conference_id).interested += 1;
    }
    for (const r of (reviews.data ?? []) as { conference_id: string; rating: number }[]) {
      stats(r.conference_id).reviews += 1;
      sums[r.conference_id] = (sums[r.conference_id] ?? 0) + r.rating;
    }
    for (const [id, s] of Object.entries(items)) {
      if (s.reviews > 0) s.averageRating = Math.round((sums[id] / s.reviews) * 10) / 10;
    }

    return Response.json({ items } satisfies CommunitySummaryResponse);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}
