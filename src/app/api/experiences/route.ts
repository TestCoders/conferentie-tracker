// GET ?conferenceId=<uuid>&id=<uuid> en POST — ervaringen (verslagen) delen, server-side gevalideerd.
// Nieuwe auteurs en eigendom worden uitsluitend uit de Microsoft-sessie bepaald.
import { requireUser } from '@/lib/auth-access';
import { connection } from 'next/server';
import { loadExperiences, newEditToken } from '@/lib/experiences-server';
import { jsonError } from '@/lib/http';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  CATEGORIES,
  WOULD_RETURN,
  type Category,
  type CreateExperienceRequest,
  type CreateExperienceResponse,
  type ListResponse,
  type Experience,
  type WouldReturn,
} from '@/lib/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Stuurtekens behalve tab/regeleinde (die mogen in lange tekst).
const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const LIST_LIMIT = 100;
const BODY_MAX = 20000;

export async function GET(request: Request) {
  await connection();
  const params = new URL(request.url).searchParams;
  const conferenceId = params.get('conferenceId') ?? undefined;
  const id = params.get('id') ?? undefined;
  if (conferenceId && !UUID_RE.test(conferenceId)) return jsonError('Ongeldige conferenceId', 400);
  if (id && !UUID_RE.test(id)) return jsonError('Ongeldige id', 400);

  try {
    const items = await loadExperiences(getSupabaseAdmin(), {
      conferenceId,
      id,
      limit: LIST_LIMIT,
    });
    return Response.json({ items } satisfies ListResponse<Experience>);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}

/* ---------- validatie ---------- */

function text(value: unknown, field: string, max: number, required: true): string;
function text(value: unknown, field: string, max: number, required?: false): string | null;
function text(value: unknown, field: string, max: number, required = false): string | null {
  if (value === undefined || value === null || value === '') {
    if (required) throw new Error(`${field} is verplicht`);
    return null;
  }
  if (typeof value !== 'string') throw new Error(`${field} moet tekst zijn`);
  const trimmed = value.trim().replace(/\r\n/g, '\n');
  if (!trimmed) {
    if (required) throw new Error(`${field} is verplicht`);
    return null;
  }
  if (trimmed.length > max) throw new Error(`${field} mag maximaal ${max} tekens zijn`);
  if (CONTROL_RE.test(trimmed)) throw new Error(`${field} bevat ongeldige tekens`);
  return trimmed;
}

function oneLine(value: unknown, field: string, max: number, required: true): string;
function oneLine(value: unknown, field: string, max: number, required?: false): string | null;
function oneLine(value: unknown, field: string, max: number, required = false): string | null {
  const t = required ? text(value, field, max, true) : text(value, field, max);
  return t === null ? null : t.replace(/\s+/g, ' ');
}

function stringList(value: unknown, field: string, maxItems: number, maxLen: number): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${field} moet een lijst zijn`);
  const items = value
    .map((v, i) => oneLine(v, `${field}[${i + 1}]`, maxLen))
    .filter((v): v is string => v !== null);
  if (items.length > maxItems) throw new Error(`${field}: maximaal ${maxItems} items`);
  return items;
}

function validDate(value: string | null, field: string): string | null {
  if (value === null) return null;
  const ts = Date.parse(`${value}T00:00:00Z`);
  if (
    !DATE_RE.test(value) ||
    !Number.isFinite(ts) ||
    new Date(ts).toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${field} moet een geldige datum (YYYY-MM-DD) zijn`);
  }
  if (value > new Date().toISOString().slice(0, 10)) {
    throw new Error('Een ervaring kan alleen over een conferentie die al is begonnen');
  }
  return value;
}

function httpsUrl(value: string, field: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${field} is geen geldige URL`);
  }
  if (url.protocol !== 'https:') throw new Error(`${field} moet met https:// beginnen`);
  return url.toString();
}

type Parsed = {
  conferenceId: string | null;
  conferenceName: string | null;
  conferenceDate: string | null;
  conferenceCity: string | null;
  title: string;
  summary: string;
  report: string | null;
  rating: number;
  wouldReturn: WouldReturn;
  recommendedFor: Category[];
  highlights: string[];
  tips: string | null;
  links: string[];
};

const ALLOWED: (keyof CreateExperienceRequest)[] = [
  'conferenceId',
  'conferenceName',
  'conferenceDate',
  'conferenceCity',
  'title',
  'summary',
  'report',
  'rating',
  'wouldReturn',
  'recommendedFor',
  'highlights',
  'tips',
  'links',
];

function parse(body: unknown): Parsed {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('Body moet een JSON-object zijn');
  }
  const f = body as Record<string, unknown>;
  const unknown = Object.keys(f).filter(
    (k) => !ALLOWED.includes(k as keyof CreateExperienceRequest),
  );
  if (unknown.length) throw new Error(`Onbekende velden: ${unknown.join(', ')}`);

  const conferenceId =
    f.conferenceId === undefined || f.conferenceId === null ? null : f.conferenceId;
  if (conferenceId !== null && (typeof conferenceId !== 'string' || !UUID_RE.test(conferenceId))) {
    throw new Error('conferenceId moet een geldige UUID zijn');
  }
  const conferenceName = oneLine(f.conferenceName, 'Conferentienaam', 200);
  if (!conferenceId && !conferenceName) {
    throw new Error('Kies een conferentie uit de lijst of vul de naam in');
  }

  const rating = f.rating;
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('rating moet een geheel getal van 1 t/m 5 zijn');
  }
  if (typeof f.wouldReturn !== 'string' || !WOULD_RETURN.includes(f.wouldReturn as WouldReturn)) {
    throw new Error(`wouldReturn moet ${WOULD_RETURN.join(', ')} zijn`);
  }

  const recommendedFor = f.recommendedFor ?? [];
  if (
    !Array.isArray(recommendedFor) ||
    recommendedFor.some((c) => !CATEGORIES.includes(c as Category))
  ) {
    throw new Error(`recommendedFor mag alleen ${CATEGORIES.join(', ')} bevatten`);
  }

  return {
    conferenceId: conferenceId as string | null,
    conferenceName,
    conferenceDate: validDate(oneLine(f.conferenceDate, 'Datum', 10), 'Datum'),
    conferenceCity: oneLine(f.conferenceCity, 'Stad', 100),
    title: oneLine(f.title, 'Titel', 120, true),
    summary: text(f.summary, 'Samenvatting', 500, true),
    report: text(f.report, 'Verslag', 8000),
    rating,
    wouldReturn: f.wouldReturn as WouldReturn,
    recommendedFor: [...new Set(recommendedFor as Category[])],
    highlights: stringList(f.highlights, 'Highlights', 10, 200),
    tips: text(f.tips, 'Tips', 2000),
    links: stringList(f.links, 'Links', 5, 500).map((l, i) => httpsUrl(l, `Link ${i + 1}`)),
  };
}

export async function POST(request: Request) {
  const access = await requireUser(request);
  if (access.response) return access.response;
  let input: Parsed;
  try {
    const raw = await request.text();
    if (raw.length > BODY_MAX) return jsonError('Requestbody is te groot', 400);
    input = parse(JSON.parse(raw) as unknown);
  } catch (err) {
    return jsonError(err instanceof SyntaxError ? 'Ongeldige JSON' : (err as Error).message, 400);
  }

  try {
    const db = getSupabaseAdmin();
    let conferenceName = input.conferenceName;
    let conferenceDate = input.conferenceDate;
    let conferenceCity = input.conferenceCity;

    if (input.conferenceId) {
      const conf = await db
        .from('conferences')
        .select('id,name,start_date,city')
        .eq('id', input.conferenceId)
        .eq('status', 'approved')
        .maybeSingle();
      if (conf.error) return jsonError(conf.error.message, 500);
      if (!conf.data) return jsonError('Conferentie niet gevonden', 404);
      const c = conf.data as { name: string; start_date: string; city: string | null };
      if (c.start_date > new Date().toISOString().slice(0, 10)) {
        return jsonError('Een ervaring kan pas als de conferentie is begonnen', 400);
      }
      conferenceName = c.name;
      conferenceDate = conferenceDate ?? c.start_date;
      conferenceCity = conferenceCity ?? c.city;
    }

    const { token, hash } = newEditToken();
    const { data, error } = await db
      .from('experiences')
      .insert({
        conference_id: input.conferenceId,
        conference_name: conferenceName,
        conference_date: conferenceDate,
        conference_city: conferenceCity,
        author_name: access.user.display_name,
        user_id: access.user.id,
        title: input.title,
        summary: input.summary,
        report: input.report,
        rating: input.rating,
        would_return: input.wouldReturn,
        recommended_for: input.recommendedFor,
        highlights: input.highlights,
        tips: input.tips,
        links: input.links,
        edit_token_hash: hash,
      })
      .select('id')
      .single();
    if (error) return jsonError(error.message, 500);

    const [experience] = await loadExperiences(db, { id: (data as { id: string }).id, limit: 1 });
    return Response.json({ experience, editToken: token } satisfies CreateExperienceResponse, {
      status: 201,
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}
