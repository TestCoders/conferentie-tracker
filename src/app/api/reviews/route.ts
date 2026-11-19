// Eigenaar: D. GET ?conferenceId=<uuid> en POST — server-side validatie, geen directe DB-schrijfrechten.
import { jsonError } from '@/lib/http';
import { requireUser } from '@/lib/auth-access';
import { saveContribution } from '@/lib/contributions';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { CreateReviewRequest, Review, ReviewsResponse } from '@/lib/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVIEW_COLUMNS = 'id,user_id,conference_id,reviewer_name,rating,comment,created_at';
const COMMENT_MAX = 1000;
const LIST_LIMIT = 100;

export async function GET(request: Request) {
  const access = await requireUser(request);
  if (access.response) return access.response;
  const conferenceId = new URL(request.url).searchParams.get('conferenceId') ?? '';
  if (!UUID_RE.test(conferenceId)) return jsonError('conferenceId (UUID) is verplicht', 400);

  try {
    const db = getSupabaseAdmin();
    const [list, ratings] = await Promise.all([
      db
        .from('reviews')
        .select(REVIEW_COLUMNS)
        .eq('conference_id', conferenceId)
        .order('created_at', { ascending: false })
        .limit(LIST_LIMIT),
      db.from('reviews').select('rating').eq('conference_id', conferenceId),
    ]);

    if (list.error) return jsonError(list.error.message, 500);
    if (ratings.error) return jsonError(ratings.error.message, 500);

    const values = (ratings.data ?? []).map((r: { rating: number }) => r.rating);
    const count = values.length;
    const averageRating =
      count === 0 ? null : Math.round((values.reduce((a, b) => a + b, 0) / count) * 10) / 10;

    return Response.json(
      {
        items: (list.data ?? []) as Review[],
        averageRating,
        count,
      } satisfies ReviewsResponse,
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}

function parseReview(body: unknown): Required<CreateReviewRequest> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('Body moet een JSON-object zijn');
  }
  const fields = body as Record<string, unknown>;
  if (Object.keys(fields).some((key) => !['conferenceId', 'rating', 'comment'].includes(key))) {
    throw new Error('Alleen conferenceId, rating en comment zijn toegestaan');
  }
  const { conferenceId, rating, comment } = fields;

  if (typeof conferenceId !== 'string' || !UUID_RE.test(conferenceId)) {
    throw new Error('conferenceId moet een geldige UUID zijn');
  }
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('rating moet een geheel getal van 1 t/m 5 zijn');
  }
  if (comment !== undefined && comment !== null && typeof comment !== 'string') {
    throw new Error('comment moet een string of null zijn');
  }
  const trimmedComment = typeof comment === 'string' ? comment.trim() : '';
  if (trimmedComment.length > COMMENT_MAX) {
    throw new Error(`comment mag maximaal ${COMMENT_MAX} tekens zijn`);
  }

  return {
    conferenceId,
    rating,
    comment: trimmedComment === '' ? null : trimmedComment,
  };
}

export async function POST(request: Request) {
  const access = await requireUser(request);
  if (access.response) return access.response;
  let input: Required<CreateReviewRequest>;
  try {
    const raw = await request.text();
    if (raw.length > 4000) return jsonError('Requestbody is te groot', 400);
    const body: unknown = JSON.parse(raw);
    input = parseReview(body);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Ongeldige body', 400);
  }

  try {
    const saved = await saveContribution(access.user, input);
    if (saved.response) return saved.response;
    return Response.json(saved.data.review, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}
