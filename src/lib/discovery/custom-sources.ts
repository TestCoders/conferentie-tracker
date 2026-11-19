// Eigenaar: B. Door beheerders toegevoegde bronnen: validatie, opslag en de juiste parser kiezen.
import { fetchConfsTechFeed } from '@/lib/discovery/confs-tech';
import {
  assertSafeExternalUrl,
  loadExternalSource,
  type FetchResult,
  type HostResolver,
  type SourceLoader,
} from '@/lib/discovery/fetch-source';
import { fetchTestingConferencesFeed } from '@/lib/discovery/testing-conferences';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  CUSTOM_SOURCE_FORMATS,
  DISCOVERY_SOURCES,
  type CreateCustomSourceRequest,
  type CustomDiscoverySource,
  type CustomSourceFormat,
} from '@/lib/types';

export const CUSTOM_SOURCE_COLUMNS = 'id,name,url,format,created_at';
export const NAME_MAX = 60;
export const URL_MAX = 2000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Valideert de request-body strikt (whitelist, types, lengtes, publieke https-URL). */
export async function parseCreateCustomSource(
  body: unknown,
  resolve?: HostResolver,
): Promise<CreateCustomSourceRequest> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('Requestbody moet een object zijn');
  }
  const input = body as Record<string, unknown>;
  const unknownKeys = Object.keys(input).filter((key) => !['name', 'url', 'format'].includes(key));
  if (unknownKeys.length) throw new Error(`Niet toegestane velden: ${unknownKeys.join(', ')}`);

  if (typeof input.name !== 'string') throw new Error('name is verplicht');
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (!name || name.length > NAME_MAX) throw new Error(`name moet 1–${NAME_MAX} tekens zijn`);
  if ((DISCOVERY_SOURCES as readonly string[]).includes(name.toLowerCase())) {
    throw new Error('name is gereserveerd voor een vaste bron');
  }

  if (typeof input.url !== 'string') throw new Error('url is verplicht');
  const rawUrl = input.url.trim();
  if (!rawUrl || rawUrl.length > URL_MAX) throw new Error(`url moet 1–${URL_MAX} tekens zijn`);
  const url = (await assertSafeExternalUrl(rawUrl, resolve)).href;

  if (
    typeof input.format !== 'string' ||
    !(CUSTOM_SOURCE_FORMATS as readonly string[]).includes(input.format)
  ) {
    throw new Error(`format moet een van ${CUSTOM_SOURCE_FORMATS.join(', ')} zijn`);
  }
  return { name, url, format: input.format as CustomSourceFormat };
}

/** Exact dezelfde parsers als de vaste bronnen, alleen met een andere feed-URL en bronnaam. */
export function fetchCustomSource(
  source: Pick<CustomDiscoverySource, 'name' | 'url' | 'format'>,
  load: SourceLoader = loadExternalSource,
): Promise<FetchResult> {
  switch (source.format) {
    case 'confs-tech-json':
      return fetchConfsTechFeed(source.url, source.name, load);
    case 'testing-conferences-yaml':
      return fetchTestingConferencesFeed(source.url, source.name, load);
  }
}

export async function listCustomSources(): Promise<CustomDiscoverySource[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('discovery_sources')
    .select(CUSTOM_SOURCE_COLUMNS)
    .order('created_at', { ascending: true });
  if (error) throw new Error('Bronnen ophalen mislukt');
  return (data ?? []) as CustomDiscoverySource[];
}

export async function getCustomSource(id: string): Promise<CustomDiscoverySource | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('discovery_sources')
    .select(CUSTOM_SOURCE_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error('Bron ophalen mislukt');
  return (data as CustomDiscoverySource | null) ?? null;
}

export class DuplicateSourceError extends Error {}

export async function createCustomSource(
  input: CreateCustomSourceRequest,
): Promise<CustomDiscoverySource> {
  const { data, error } = await getSupabaseAdmin()
    .from('discovery_sources')
    .insert(input)
    .select(CUSTOM_SOURCE_COLUMNS)
    .single();
  if (error?.code === '23505') {
    throw new DuplicateSourceError('Er bestaat al een bron met deze naam of URL');
  }
  if (error || !data) throw new Error('Bron opslaan mislukt');
  return data as CustomDiscoverySource;
}

/** Verwijdert alleen de bron; eerder geïmporteerde conferenties blijven bestaan. */
export async function deleteCustomSource(id: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from('discovery_sources')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) throw new Error('Bron verwijderen mislukt');
  return (data ?? []).length > 0;
}
