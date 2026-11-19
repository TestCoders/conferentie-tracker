// GET ?conferenceId=<uuid> en POST — interesse/bijgewoond per persoon, server-side gevalideerd.
// Auteurs en eigendom komen uitsluitend uit de geverifieerde Microsoft-sessie.
import { jsonError } from '@/lib/http';
import { requireUser } from '@/lib/auth-access';
import { saveContribution } from '@/lib/contributions';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  ATTENDANCE_STATUSES,
  type Attendance,
  type AttendanceStatus,
  type AttendancesResponse,
  type CreateAttendanceRequest,
} from '@/lib/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMMENT_MAX = 1000;
const LIST_LIMIT = 500;

type AttendanceRow = Omit<Attendance, 'rating'> & { name_key: string };

const nameKey = (name: string) => name.trim().toLowerCase();

export async function GET(request: Request) {
  const conferenceId = new URL(request.url).searchParams.get('conferenceId') ?? '';
  if (!UUID_RE.test(conferenceId)) return jsonError('conferenceId (UUID) is verplicht', 400);

  try {
    const db = getSupabaseAdmin();
    const [people, reviews] = await Promise.all([
      db
        .from('attendances')
        .select('id,user_id,conference_id,person_name,name_key,status,created_at')
        .eq('conference_id', conferenceId)
        .order('created_at', { ascending: true })
        .limit(LIST_LIMIT),
      db
        .from('reviews')
        .select('user_id,reviewer_name,rating,created_at')
        .eq('conference_id', conferenceId)
        .order('created_at', { ascending: true }),
    ]);
    if (people.error) return jsonError(people.error.message, 500);
    if (reviews.error) return jsonError(reviews.error.message, 500);

    // Accounts matchen op UUID. Alleen legacyrecords worden nog onderling op naam gekoppeld.
    const ratingByName = new Map<string, number>();
    for (const r of (reviews.data ?? []) as {
      user_id: string | null;
      reviewer_name: string;
      rating: number;
    }[]) {
      ratingByName.set(
        r.user_id ? `user:${r.user_id}` : `legacy:${nameKey(r.reviewer_name)}`,
        r.rating,
      );
    }

    const items: Attendance[] = ((people.data ?? []) as AttendanceRow[]).map(
      ({ name_key, ...row }) => ({
        ...row,
        rating:
          ratingByName.get(row.user_id ? `user:${row.user_id}` : `legacy:${name_key}`) ?? null,
      }),
    );
    // Eerst wie het heeft bijgewoond, daarna geïnteresseerden.
    items.sort((a, b) => (a.status === b.status ? 0 : a.status === 'attended' ? -1 : 1));

    return Response.json({
      items,
      interested: items.filter((a) => a.status === 'interested').length,
      attended: items.filter((a) => a.status === 'attended').length,
    } satisfies AttendancesResponse);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}

type ParsedAttendance = {
  conferenceId: string;
  status: AttendanceStatus;
  rating: number | null;
  comment: string | null;
};

function parseAttendance(body: unknown): ParsedAttendance {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('Body moet een JSON-object zijn');
  }
  const fields = body as Record<string, unknown>;
  const allowed: (keyof CreateAttendanceRequest)[] = [
    'conferenceId',
    'status',
    'rating',
    'comment',
  ];
  if (Object.keys(fields).some((k) => !allowed.includes(k as keyof CreateAttendanceRequest))) {
    throw new Error(`Alleen deze velden zijn toegestaan: ${allowed.join(', ')}`);
  }
  const { conferenceId, status, rating, comment } = fields;

  if (typeof conferenceId !== 'string' || !UUID_RE.test(conferenceId)) {
    throw new Error('conferenceId moet een geldige UUID zijn');
  }
  if (typeof status !== 'string' || !ATTENDANCE_STATUSES.includes(status as AttendanceStatus)) {
    throw new Error(`status moet ${ATTENDANCE_STATUSES.join(' of ')} zijn`);
  }

  const hasRating = rating !== undefined && rating !== null;
  if (hasRating) {
    if (status !== 'attended') throw new Error('Een rating kan alleen bij "bijgewoond"');
    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error('rating moet een geheel getal van 1 t/m 5 zijn');
    }
  }
  if (comment !== undefined && comment !== null && typeof comment !== 'string') {
    throw new Error('comment moet een string of null zijn');
  }
  const text = typeof comment === 'string' ? comment.trim() : '';
  if (text && !hasRating) throw new Error('Een reviewtekst kan alleen samen met een rating');
  if (text.length > COMMENT_MAX) throw new Error(`Review mag maximaal ${COMMENT_MAX} tekens zijn`);

  return {
    conferenceId,
    status: status as AttendanceStatus,
    rating: hasRating ? (rating as number) : null,
    comment: text || null,
  };
}

export async function POST(request: Request) {
  const access = await requireUser(request);
  if (access.response) return access.response;
  let input: ParsedAttendance;
  try {
    const raw = await request.text();
    if (raw.length > 4000) return jsonError('Requestbody is te groot', 400);
    input = parseAttendance(JSON.parse(raw) as unknown);
  } catch (err) {
    const message = err instanceof SyntaxError ? 'Ongeldige JSON' : (err as Error).message;
    return jsonError(message, 400);
  }

  try {
    const saved = await saveContribution(access.user, input);
    if (saved.response) return saved.response;
    return Response.json(
      { ...saved.data.attendance, rating: saved.data.review?.rating ?? null },
      { status: 201 },
    );
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}
