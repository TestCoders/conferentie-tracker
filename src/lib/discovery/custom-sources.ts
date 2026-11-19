// Eigenaar: B. Door beheerders toegevoegde bronnen: validatie, formaatherkenning en opslag.
import {
  assertSafeExternalUrl,
  loadExternalDocument,
  type ExternalDocument,
  type FetchResult,
  type HostResolver,
} from '@/lib/discovery/fetch-source';
import {
  detectFormat,
  parseWithFormat,
  recategorize,
  suggestCategory,
  type Detected,
} from '@/lib/discovery/formats/detect';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  CATEGORIES,
  DISCOVERY_SOURCES,
  type Category,
  type CreateCustomSourceRequest,
  type CustomDiscoverySource,
  type SourceAnalysis,
} from '@/lib/types';

export const CUSTOM_SOURCE_COLUMNS = 'id,name,url,format,config,default_category,created_at';
export const NAME_MAX = 60;
export const URL_MAX = 2000;
const SAMPLE_SIZE = 5;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

function isRecord(body: unknown): body is Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body);
}

/** Publieke https-URL, genormaliseerd; gooit bij ongeldige invoer. */
export async function parseSourceUrl(value: unknown, resolve?: HostResolver): Promise<string> {
  if (typeof value !== 'string') throw new Error('url is verplicht');
  const rawUrl = value.trim();
  if (!rawUrl || rawUrl.length > URL_MAX) throw new Error(`url moet 1–${URL_MAX} tekens zijn`);
  return (await assertSafeExternalUrl(rawUrl, resolve)).href;
}

/** POST /api/admin/sources/analyze — alleen het veld url. */
export async function parseAnalyzeRequest(body: unknown, resolve?: HostResolver): Promise<string> {
  if (!isRecord(body)) throw new Error('Requestbody moet een object zijn');
  if (Object.keys(body).some((key) => key !== 'url'))
    throw new Error('Alleen het veld url is toegestaan');
  return parseSourceUrl(body.url, resolve);
}

/** Valideert de request-body strikt (whitelist, types, lengtes, publieke https-URL). */
export async function parseCreateCustomSource(
  body: unknown,
  resolve?: HostResolver,
): Promise<CreateCustomSourceRequest> {
  if (!isRecord(body)) throw new Error('Requestbody moet een object zijn');
  const allowed = ['name', 'url', 'defaultCategory'];
  const unknownKeys = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknownKeys.length) throw new Error(`Niet toegestane velden: ${unknownKeys.join(', ')}`);

  if (typeof body.name !== 'string') throw new Error('name is verplicht');
  const name = body.name.trim().replace(/\s+/g, ' ');
  if (!name || name.length > NAME_MAX) throw new Error(`name moet 1–${NAME_MAX} tekens zijn`);
  if ((DISCOVERY_SOURCES as readonly string[]).includes(name.toLowerCase())) {
    throw new Error('name is gereserveerd voor een vaste bron');
  }
  const url = await parseSourceUrl(body.url, resolve);

  if (body.defaultCategory === undefined) return { name, url };
  if (!(CATEGORIES as readonly unknown[]).includes(body.defaultCategory)) {
    throw new Error(`defaultCategory moet een van ${CATEGORIES.join(', ')} zijn`);
  }
  return { name, url, defaultCategory: body.defaultCategory as Category };
}

/** Vaste bronformaten houden exact hun eigen categorieregels. */
const OWN_CATEGORY_RULES = new Set(['confs-tech-json', 'testing-conferences-yaml']);

export type DetectedSource = Detected & { doc: ExternalDocument };

/** Ophalen en formaat herkennen, zonder records te lezen (dus ook zonder AI-verzoek). */
export async function detectSource(
  url: string,
  load: (url: string) => Promise<ExternalDocument> = loadExternalDocument,
): Promise<DetectedSource> {
  const doc = await load(url);
  return { ...detectFormat(doc), doc };
}

/** Volledige analyse met voorbeeldrecords; slaat niets op. Bij formaat 'ai' kost dit één AI-verzoek. */
export async function analyzeSource(
  url: string,
  load?: (url: string) => Promise<ExternalDocument>,
): Promise<SourceAnalysis> {
  const detected = await detectSource(url, load);
  const parsed = await parseWithFormat(detected.doc, detected, {
    sourceUrl: url,
    sourceName: 'voorbeeld',
    defaultCategory: 'development',
  });
  const defaultCategory = OWN_CATEGORY_RULES.has(detected.format)
    ? 'development'
    : suggestCategory(parsed.items.map((item) => item.name));
  const items = OWN_CATEGORY_RULES.has(detected.format)
    ? parsed.items
    : recategorize(parsed.items, defaultCategory);
  if (items.length === 0) {
    const reasons = parsed.errors.slice(0, 3).join('; ');
    throw new Error(`Geen geldige conferenties gevonden${reasons ? `: ${reasons}` : ''}`);
  }
  return {
    url,
    format: detected.format,
    config: detected.config,
    defaultCategory,
    found: items.length,
    sample: items.slice(0, SAMPLE_SIZE),
    errors: parsed.errors.slice(0, SAMPLE_SIZE),
    pending: detected.format === 'ai',
  };
}

/** Bij een run: bron opnieuw ophalen en lezen met het opgeslagen formaat. */
export async function fetchCustomSource(
  source: Pick<CustomDiscoverySource, 'name' | 'url' | 'format' | 'config' | 'default_category'>,
  load: (url: string) => Promise<ExternalDocument> = loadExternalDocument,
): Promise<FetchResult> {
  try {
    const doc = await load(source.url);
    return await parseWithFormat(
      doc,
      { format: source.format, config: source.config },
      {
        sourceUrl: source.url,
        sourceName: source.name,
        defaultCategory: source.default_category ?? 'development',
      },
    );
  } catch (error) {
    return {
      items: [],
      errors: [`${source.url}: ${error instanceof Error ? error.message : 'Ophalen mislukt'}`],
    };
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

/** Slaat de bron op met het door de server herkende formaat (nooit een formaat van de client). */
export async function createCustomSource(
  input: CreateCustomSourceRequest,
  detected: Detected,
): Promise<CustomDiscoverySource> {
  const { data, error } = await getSupabaseAdmin()
    .from('discovery_sources')
    .insert({
      name: input.name,
      url: input.url,
      format: detected.format,
      config: detected.config,
      default_category: input.defaultCategory ?? 'development',
    })
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
