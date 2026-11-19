// POST multipart (file, caption, consent) — foto toevoegen aan een ervaring.
// Alleen met het bewerktoken dat bij het aanmaken is teruggegeven (header X-Edit-Token).
import { randomUUID } from 'node:crypto';
import {
  CONTENT_TYPES,
  MAX_PHOTOS_PER_EXPERIENCE,
  MAX_PHOTO_BYTES,
  PHOTO_BUCKET,
  detectImageType,
  photoUrl,
  tokenMatches,
} from '@/lib/experiences-server';
import { jsonError } from '@/lib/http';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { ExperiencePhoto } from '@/lib/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

function dimension(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 10000 ? n : null;
}

export async function POST(request: Request, ctx: RouteContext<'/api/experiences/[id]/photos'>) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return jsonError('Ongeldige id', 400);

  const token = request.headers.get('x-edit-token') ?? '';
  if (!token) return jsonError('Bewerktoken ontbreekt', 401);

  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > MAX_PHOTO_BYTES + 64 * 1024) return jsonError('Foto is groter dan 4 MB', 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError('Verwacht multipart/form-data', 400);
  }
  const file = form.get('file');
  if (!(file instanceof File)) return jsonError('file ontbreekt', 400);
  if (file.size === 0) return jsonError('Leeg bestand', 400);
  if (file.size > MAX_PHOTO_BYTES) return jsonError('Foto is groter dan 4 MB', 413);
  if (form.get('consent') !== 'yes') {
    return jsonError('Bevestig dat herkenbare personen toestemming hebben gegeven', 400);
  }
  const captionRaw = form.get('caption');
  const caption =
    typeof captionRaw === 'string' && captionRaw.trim()
      ? captionRaw.trim().replace(/\s+/g, ' ')
      : null;
  if (caption && (caption.length > 200 || CONTROL_RE.test(caption))) {
    return jsonError('Bijschrift mag maximaal 200 tekens zijn', 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) return jsonError('Alleen JPEG, PNG of WebP', 415);

  try {
    const db = getSupabaseAdmin();
    const exp = await db
      .from('experiences')
      .select('id,edit_token_hash')
      .eq('id', id)
      .maybeSingle();
    if (exp.error) return jsonError(exp.error.message, 500);
    if (!exp.data) return jsonError('Ervaring niet gevonden', 404);
    if (!tokenMatches(token, (exp.data as { edit_token_hash: string }).edit_token_hash)) {
      return jsonError('Ongeldig bewerktoken', 403);
    }

    const count = await db
      .from('experience_photos')
      .select('id', { count: 'exact', head: true })
      .eq('experience_id', id);
    if (count.error) return jsonError(count.error.message, 500);
    if ((count.count ?? 0) >= MAX_PHOTOS_PER_EXPERIENCE) {
      return jsonError(`Maximaal ${MAX_PHOTOS_PER_EXPERIENCE} foto's per ervaring`, 400);
    }

    const path = `${id}/${randomUUID()}.${type}`;
    const upload = await db.storage
      .from(PHOTO_BUCKET)
      .upload(path, bytes, { contentType: CONTENT_TYPES[type], upsert: false });
    if (upload.error) return jsonError(`Upload mislukt: ${upload.error.message}`, 500);

    const { data, error } = await db
      .from('experience_photos')
      .insert({
        experience_id: id,
        storage_path: path,
        caption,
        width: dimension(form.get('width')),
        height: dimension(form.get('height')),
      })
      .select('id,experience_id,caption,width,height,created_at')
      .single();
    if (error) {
      await db.storage.from(PHOTO_BUCKET).remove([path]);
      return jsonError(error.message, 500);
    }

    return Response.json(
      {
        ...(data as Omit<ExperiencePhoto, 'url'>),
        url: photoUrl(db, path),
      } satisfies ExperiencePhoto,
      { status: 201 },
    );
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}
