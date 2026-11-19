// GET ?conferenceId=<uuid> en POST — interesse/bijgewoond per persoon, server-side gevalideerd.
// Geen login: namen zijn zelf opgegeven en publiek zichtbaar (alleen voor een gecontroleerde demo).
import { jsonError } from '@/lib/http';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  ATTENDANCE_STATUSES,
  type Attendance,
  type AttendanceStatus,
  type AttendancesResponse,
  type CreateAttendanceRequest,
} from '@/lib/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME_MAX = 80;
const COMMENT_MAX = 1000;
const LIST_LIMIT = 500;
// Geen stuurtekens in namen.
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

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
        .select('id,conference_id,person_name,name_key,status,created_at')
        .eq('conference_id', conferenceId)
        .order('created_at', { ascending: true })
        .limit(LIST_LIMIT),
      db
        .from('reviews')
        .select('reviewer_name,rating,created_at')
        .eq('conference_id', conferenceId)
        .order('created_at', { ascending: true }),
    ]);
    if (people.error) return jsonError(people.error.message, 500);
    if (reviews.error) return jsonError(reviews.error.message, 500);

    // Laatste review per naam wint (oplopend gesorteerd, dus later overschrijft eerder).
    const ratingByName = new Map<string, number>();
    for (const r of (reviews.data ?? []) as { reviewer_name: string; rating: number }[]) {
      ratingByName.set(nameKey(r.reviewer_name), r.rating);
    }

    const items: Attendance[] = ((people.data ?? []) as AttendanceRow[]).map(
      ({ name_key, ...row }) => ({ ...row, rating: ratingByName.get(name_key) ?? null }),
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
  personName: string;
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
    'personName',
    'status',
    'rating',
    'comment',
  ];
  if (Object.keys(fields).some((k) => !allowed.includes(k as keyof CreateAttendanceRequest))) {
    throw new Error(`Alleen deze velden zijn toegestaan: ${allowed.join(', ')}`);
  }
  const { conferenceId, personName, status, rating, comment } = fields;

  if (typeof conferenceId !== 'string' || !UUID_RE.test(conferenceId)) {
    throw new Error('conferenceId moet een geldige UUID zijn');
  }
  if (typeof personName !== 'string' || personName.trim() === '') {
    throw new Error('Naam is verplicht');
  }
  const name = personName.trim().replace(/\s+/g, ' ');
  if (name.length > NAME_MAX) throw new Error(`Naam mag maximaal ${NAME_MAX} tekens zijn`);
  if (CONTROL_RE.test(name)) throw new Error('Naam bevat ongeldige tekens');
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
    personName: name,
    status: status as AttendanceStatus,
    rating: hasRating ? (rating as number) : null,
    comment: text || null,
  };
}

export async function POST(request: Request) {
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
    const db = getSupabaseAdmin();

    const conf = await db
      .from('conferences')
      .select('id,start_date')
      .eq('id', input.conferenceId)
      .eq('status', 'approved')
      .maybeSingle();
    if (conf.error) return jsonError(conf.error.message, 500);
    if (!conf.data) return jsonError('Conferentie niet gevonden', 404);

    const today = new Date().toISOString().slice(0, 10);
    if (input.status === 'attended' && (conf.data as { start_date: string }).start_date > today) {
      return jsonError('"Bijgewoond" kan pas als de conferentie is begonnen', 400);
    }

    // Eén regel per naam per conferentie: opnieuw aanmelden wijzigt de status.
    const { data, error } = await db
      .from('attendances')
      .upsert(
        {
          conference_id: input.conferenceId,
          person_name: input.personName,
          status: input.status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'conference_id,name_key' },
      )
      .select('id,conference_id,person_name,status,created_at')
      .single();
    if (error) return jsonError(error.message, 500);

    if (input.rating !== null) {
      const review = await db.from('reviews').insert({
        conference_id: input.conferenceId,
        reviewer_name: input.personName,
        rating: input.rating,
        comment: input.comment,
      });
      if (review.error) return jsonError(review.error.message, 500);
    }

    return Response.json(
      { ...(data as Omit<Attendance, 'rating'>), rating: input.rating },
      {
        status: 201,
      },
    );
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}
