// Eigenaar: B. Feeds ophalen: vaste bronnen direct, door beheerders ingevoerde URL's alleen
// na een SSRF-controle (https, publieke host, geen redirects, timeout, groottelimiet).
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import type { ConferenceInput } from '@/lib/types';

export type FetchResult = { items: ConferenceInput[]; errors: string[] };
/** Haalt de ruwe tekst van een feed op of gooit een Error met een korte uitleg. */
export type SourceLoader = (url: string) => Promise<string>;
export type HostResolver = (hostname: string) => Promise<string[]>;

const TIMEOUT_MS = 15_000;
export const EXTERNAL_MAX_BYTES = 2_000_000;

/** Alleen voor vaste, in de code vastgelegde bron-URL's. */
export async function loadFixedSource(url: string): Promise<string> {
  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

// IPv4-gemapte IPv6-adressen (::ffff:a.b.c.d) worden door BlockList tegen de IPv4-regels getoetst.
const blocked = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 127],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv6');
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  return !blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

async function resolveHost(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

/**
 * Controleert een door een beheerder ingevoerde feed-URL. Restrisico: DNS-rebinding tussen
 * deze controle en de fetch; acceptabel omdat alleen beheerders bronnen kunnen toevoegen.
 */
export async function assertSafeExternalUrl(
  raw: string,
  resolve: HostResolver = resolveHost,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Ongeldige URL');
  }
  if (url.protocol !== 'https:') throw new Error('Alleen https-URLs zijn toegestaan');
  if (url.username || url.password) throw new Error('URL mag geen inloggegevens bevatten');
  if (url.port && url.port !== '443')
    throw new Error('Alleen de standaard https-poort is toegestaan');
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host.includes('.') || /(^|\.)(localhost|local|internal|lan|home|corp)$/.test(host)) {
    throw new Error('Interne hostnamen zijn niet toegestaan');
  }
  let addresses: string[];
  if (isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = await resolve(host);
    } catch {
      throw new Error('Host kon niet worden gevonden');
    }
  }
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) {
    throw new Error('Host verwijst naar een niet-publiek adres');
  }
  return url;
}

export const MAX_REDIRECTS = 3;

/** Opgehaalde externe bron: tekst, content-type en de uiteindelijke URL na redirects. */
export type ExternalDocument = { text: string; contentType: string; url: string };

async function readLimited(response: Response): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > EXTERNAL_MAX_BYTES) {
    throw new Error('Bron is te groot');
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > EXTERNAL_MAX_BYTES) {
      await reader.cancel();
      throw new Error('Bron is te groot');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

/**
 * Voor door beheerders ingevoerde bron-URL's. Redirects worden zelf gevolgd (max. 3), en elke
 * stap gaat opnieuw door de SSRF-controle.
 */
export async function loadExternalDocument(
  raw: string,
  resolve: HostResolver = resolveHost,
): Promise<ExternalDocument> {
  let url = await assertSafeExternalUrl(raw, resolve);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Accept:
          'application/json, application/ld+json, text/calendar, application/yaml, text/yaml, text/html;q=0.9, */*;q=0.5',
        'User-Agent': 'Mozilla/5.0 (compatible; ConferenceTracker/1.0)',
      },
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel().catch(() => undefined);
      const location = response.headers.get('location');
      if (!location) throw new Error(`Redirect zonder doel (HTTP ${response.status})`);
      url = await assertSafeExternalUrl(new URL(location, url).href, resolve);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error(`HTTP ${response.status}`);
    }
    return {
      text: await readLimited(response),
      contentType: (response.headers.get('content-type') ?? '').toLowerCase(),
      url: url.href,
    };
  }
  throw new Error('Te veel redirects');
}

export async function loadExternalSource(
  raw: string,
  resolve: HostResolver = resolveHost,
): Promise<string> {
  return (await loadExternalDocument(raw, resolve)).text;
}
