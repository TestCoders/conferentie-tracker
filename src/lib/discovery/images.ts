// Eigenaar: B. Logo/afbeelding van de officiële website: alleen wat de pagina zelf declareert
// (og:image, twitter:image, apple-touch-icon, icon). Niets gegokt: geen tag = null.
import type { SupabaseClient } from '@supabase/supabase-js';
import { pastCutoff } from '@/lib/discovery/past-window';

export type ConferenceImages = { image_url: string | null; icon_url: string | null };

const MAX_HTML_BYTES = 1_500_000;
const MAX_URL_LENGTH = 2000;
const MAX_REDIRECTS = 5;
const PAGE_TIMEOUT_MS = 8_000;
const CONCURRENCY = 6;
const RECHECK_AFTER_DAYS = 30;
/** Per discovery-run; houdt de route ruim binnen maxDuration (60 s). */
export const IMAGE_BATCH_SIZE = 24;
const USER_AGENT = 'Mozilla/5.0 (compatible; ConferenceTracker/1.0)';

/** Volgorde = voorkeur. */
const IMAGE_META_KEYS = [
  'og:image:secure_url',
  'og:image',
  'og:image:url',
  'twitter:image',
  'twitter:image:src',
];

const ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  // Tagnaam overslaan.
  const body = tag.replace(/^<\s*[a-z]+/i, '').replace(/\/?>$/, '');
  for (const match of body.matchAll(pattern)) {
    const name = match[1].toLowerCase();
    if (name in attributes) continue;
    attributes[name] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '').trim();
  }
  return attributes;
}

/** Geen IP-literals, localhost of interne namen: alleen gewone publieke hostnamen. */
export function isPublicHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') || host.startsWith('[')) return false;
  if (/^[\d.]+$/.test(host) || /^0x/i.test(host)) return false;
  return !/(^|\.)(localhost|local|internal|intranet|lan|home|corp)$/.test(host);
}

function toUrl(value: string, base: string | URL, protocols: string[]): URL | null {
  if (!value || value.length > MAX_URL_LENGTH) return null;
  try {
    const url = new URL(value, base);
    if (!protocols.includes(url.protocol) || !isPublicHostname(url.hostname)) return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

/** Afbeeldingen alleen via https: anders mixed content op de site. */
function toImageUrl(value: string | undefined, base: string | URL): string | null {
  const url = toUrl(value ?? '', base, ['https:']);
  return url && url.href.length <= MAX_URL_LENGTH ? url.href : null;
}

function iconScore(attributes: Record<string, string>, rel: string[]): number {
  const href = attributes.href ?? '';
  const isSvg = attributes.type === 'image/svg+xml' || /\.svg(\?|#|$)/i.test(href);
  if (isSvg) return 512;
  const sizes = (attributes.sizes ?? '').toLowerCase();
  if (sizes === 'any') return 512;
  const largest = Math.max(0, ...[...sizes.matchAll(/(\d+)x(\d+)/g)].map((m) => Number(m[1])));
  if (largest > 0) return largest;
  if (rel.some((token) => token.startsWith('apple-touch-icon'))) return 180;
  return 16;
}

/** Puur: haalt image/icon uit HTML. `pageUrl` is de uiteindelijke URL na redirects. */
export function extractImages(html: string, pageUrl: string): ConferenceImages {
  const head = html.slice(0, MAX_HTML_BYTES);
  let base: string | URL = pageUrl;
  const metaImages = new Map<string, string>();
  let bestIcon: { href: string; score: number } | null = null;

  for (const [tag] of head.matchAll(/<(?:meta|link|base)\b[^>]*>/gi)) {
    const name = tag.slice(1, 5).toLowerCase();
    const attributes = parseAttributes(tag);
    if (name === 'base') {
      const resolved = attributes.href
        ? toUrl(attributes.href, pageUrl, ['https:', 'http:'])
        : null;
      if (resolved) base = resolved;
    } else if (name === 'meta') {
      const key = (
        attributes.property ??
        attributes.name ??
        attributes.itemprop ??
        ''
      ).toLowerCase();
      const image = IMAGE_META_KEYS.includes(key) ? toImageUrl(attributes.content, base) : null;
      if (image && !metaImages.has(key)) metaImages.set(key, image);
    } else {
      const rel = (attributes.rel ?? '').toLowerCase().split(/\s+/);
      if (!rel.some((token) => token === 'icon' || token.startsWith('apple-touch-icon'))) continue;
      const href = toImageUrl(attributes.href, base);
      const score = iconScore(attributes, rel);
      if (href && (!bestIcon || score > bestIcon.score)) bestIcon = { href, score };
    }
  }

  const image = IMAGE_META_KEYS.map((key) => metaImages.get(key)).find(Boolean) ?? null;
  return { image_url: image, icon_url: bestIcon?.href ?? null };
}

async function readHead(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = '';
  let bytes = 0;
  try {
    while (bytes < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      const searchFrom = Math.max(0, html.length - 16);
      html += decoder.decode(value, { stream: true });
      if (/<\/head\s*>/i.test(html.slice(searchFrom))) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return html;
}

/** Haalt de officiële pagina op; volgt redirects zelf, zodat iedere hop gecontroleerd wordt. */
export async function fetchConferenceImages(officialUrl: string): Promise<ConferenceImages> {
  const signal = AbortSignal.timeout(PAGE_TIMEOUT_MS);
  let current = toUrl(officialUrl, officialUrl, ['https:', 'http:']);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!current) throw new Error('Geen publieke http(s)-URL');
    const response = await fetch(current, {
      cache: 'no-store',
      redirect: 'manual',
      signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel().catch(() => undefined);
      const location = response.headers.get('location');
      current = location ? toUrl(location, current, ['https:', 'http:']) : null;
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error(`HTTP ${response.status}`);
    }
    if (!/html/i.test(response.headers.get('content-type') ?? '')) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error('Geen HTML');
    }
    return extractImages(await readHead(response), current.href);
  }
  throw new Error('Te veel redirects');
}

/**
 * Bekijkt een beperkte batch websites die nog niet (of lang niet) bekeken zijn.
 * Mislukt een website, dan blijven eerder gevonden afbeeldingen staan.
 */
export async function refreshConferenceImages(
  db: SupabaseClient,
): Promise<{ checked: number; found: number }> {
  const now = new Date();
  const recheckBefore = new Date(now.getTime() - RECHECK_AFTER_DAYS * 86_400_000).toISOString();
  const today = now.toISOString().slice(0, 10);
  // Eerst aankomende conferenties (explorer), daarna afgelopen edities binnen het historievenster
  // (ervaringen); beide binnen één batch.
  const candidates = (from: string, until: string | null, limit: number) => {
    let query = db
      .from('conferences')
      .select('id,official_url')
      .neq('status', 'rejected')
      .gte('start_date', from)
      .or(`images_checked_at.is.null,images_checked_at.lt."${recheckBefore}"`);
    if (until) query = query.lt('start_date', until);
    return query
      .order('images_checked_at', { ascending: true, nullsFirst: true })
      .order('start_date', { ascending: from === today })
      .limit(limit);
  };
  const upcoming = await candidates(today, null, IMAGE_BATCH_SIZE);
  if (upcoming.error || !upcoming.data) {
    throw new Error('Conferenties voor afbeeldingen ophalen mislukt');
  }
  const queue = upcoming.data as { id: string; official_url: string }[];
  if (queue.length < IMAGE_BATCH_SIZE) {
    const past = await candidates(pastCutoff(now), today, IMAGE_BATCH_SIZE - queue.length);
    if (past.error || !past.data) throw new Error('Conferenties voor afbeeldingen ophalen mislukt');
    queue.push(...(past.data as { id: string; official_url: string }[]));
  }

  let checked = 0;
  let found = 0;
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const checkedAt = new Date().toISOString();
      let update: Partial<ConferenceImages> & { images_checked_at: string } = {
        images_checked_at: checkedAt,
      };
      try {
        update = { ...update, ...(await fetchConferenceImages(item.official_url)) };
      } catch {
        // Onbereikbaar/geblokkeerd: alleen tijdstip bijwerken, na RECHECK_AFTER_DAYS opnieuw.
      }
      const { error: updateError } = await db.from('conferences').update(update).eq('id', item.id);
      if (updateError) continue;
      checked++;
      if (update.image_url || update.icon_url) found++;
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { checked, found };
}
