/**
 * Serverhelpers voor ervaringen (roadmap #3). ALLEEN in API-routes gebruiken (service role).
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Experience, ExperiencePhoto } from '@/lib/types';

export const PHOTO_BUCKET = 'experience-photos';
export const MAX_PHOTOS_PER_EXPERIENCE = 8;
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

export const EXPERIENCE_COLUMNS =
  'id,conference_id,conference_name,conference_date,conference_city,author_name,title,summary,report,rating,would_return,recommended_for,highlights,tips,links,created_at';
const PHOTO_COLUMNS = 'id,experience_id,storage_path,caption,width,height,created_at';

type PhotoRow = Omit<ExperiencePhoto, 'url'> & { storage_path: string };
type ExperienceRow = Omit<Experience, 'photos'>;

export function newEditToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function tokenMatches(token: string, expectedHash: string): boolean {
  const a = Buffer.from(hashToken(token), 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function photoUrl(db: SupabaseClient, path: string): string {
  return db.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

function toPhoto(db: SupabaseClient, row: PhotoRow): ExperiencePhoto {
  const { storage_path, ...rest } = row;
  return { ...rest, url: photoUrl(db, storage_path) };
}

/** Ervaringen ophalen met hun foto's (nieuwste eerst). */
export async function loadExperiences(
  db: SupabaseClient,
  filter: { conferenceId?: string; id?: string; limit: number },
): Promise<Experience[]> {
  let query = db
    .from('experiences')
    .select(EXPERIENCE_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(filter.limit);
  if (filter.conferenceId) query = query.eq('conference_id', filter.conferenceId);
  if (filter.id) query = query.eq('id', filter.id);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ExperienceRow[];
  if (rows.length === 0) return [];

  const photos = await db
    .from('experience_photos')
    .select(PHOTO_COLUMNS)
    .in(
      'experience_id',
      rows.map((r) => r.id),
    )
    .order('created_at', { ascending: true });
  if (photos.error) throw new Error(photos.error.message);

  const byExperience = new Map<string, ExperiencePhoto[]>();
  for (const p of (photos.data ?? []) as PhotoRow[]) {
    const list = byExperience.get(p.experience_id) ?? [];
    list.push(toPhoto(db, p));
    byExperience.set(p.experience_id, list);
  }
  return rows.map((r) => ({ ...r, photos: byExperience.get(r.id) ?? [] }));
}

/** Controleert de eerste bytes: alleen echte JPEG, PNG of WebP. */
export function detectImageType(bytes: Uint8Array): 'jpg' | 'png' | 'webp' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)
  ) {
    return 'png';
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  return null;
}

export const CONTENT_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;
