/**
 * Veilig een officiële conferentiewebsite ophalen voor de AI-verrijking (server-only).
 * URL's komen uit de database (door discovery gevonden), niet uit gebruikersinvoer; toch
 * beschermen we tegen SSRF: alleen https, geen IP-adressen of interne hosts, DNS moet naar
 * publieke adressen wijzen, redirects worden per stap opnieuw gecontroleerd, met limieten.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_REDIRECTS = 3;
const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8_000;
const MAX_TEXT = 6_000;
const MAX_LINKS = 15;
const LINK_HINT =
  /ticket|price|pricing|prijs|register|registration|buy|tickets|cfp|call-for|speak/i;

export type PageSnapshot = {
  url: string;
  title: string | null;
  text: string;
  /** Relevante links (tickets, prijzen, registratie, CFP) op dezelfde site, https. */
  links: string[];
};

function privateIp(address: string): boolean {
  const v4 = address.startsWith('::ffff:') ? address.slice(7) : address;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = address.toLowerCase();
  return v6 === '::1' || v6 === '::' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6);
}

export async function assertPublicHttps(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('Alleen https-websites');
  if (url.username || url.password) throw new Error('URL met inloggegevens geweigerd');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) throw new Error('IP-adressen worden niet opgehaald');
  if (/^(localhost|.*\.(local|internal|localhost|lan|home))$/i.test(host) || !host.includes('.')) {
    throw new Error('Interne host geweigerd');
  }
  const addresses = await lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some((a) => privateIp(a.address))) {
    throw new Error('Host wijst naar een niet-publiek adres');
  }
  return url;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&euro;/g, '€')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
}

export function htmlToSnapshot(html: string, pageUrl: URL): PageSnapshot {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? null;
  const links = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = m[2].replace(/<[^>]+>/g, ' ');
    if (!LINK_HINT.test(m[1]) && !LINK_HINT.test(label)) continue;
    try {
      const abs = new URL(m[1], pageUrl);
      const base = pageUrl.hostname.replace(/^www\./, '');
      if (
        abs.protocol === 'https:' &&
        (abs.hostname === base || abs.hostname.endsWith(`.${base}`))
      ) {
        links.add(abs.toString());
      }
    } catch {
      // Ongeldige link overslaan.
    }
    if (links.size >= MAX_LINKS) break;
  }
  const text = decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<\/(p|div|li|h[1-6]|tr|section|br)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n\s*/g, '\n')
    .trim()
    .slice(0, MAX_TEXT);
  return {
    url: pageUrl.toString(),
    title: title ? decodeEntities(title) : null,
    text,
    links: [...links],
  };
}

export async function fetchPage(raw: string): Promise<PageSnapshot> {
  let url = await assertPublicHttps(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url, {
      redirect: 'manual',
      cache: 'no-store',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'ConferenceTrackerBot/1.0',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location');
      if (!next) throw new Error(`Redirect zonder doel (HTTP ${res.status})`);
      url = await assertPublicHttps(new URL(next, url).toString());
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml/i.test(type))
      throw new Error(`Geen HTML (${type || 'onbekend'})`);
    const length = Number(res.headers.get('content-length') ?? '0');
    if (length > MAX_BYTES) throw new Error('Pagina is te groot');
    const reader = res.body?.getReader();
    if (!reader) throw new Error('Lege pagina');
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const html = new TextDecoder().decode(Buffer.concat(chunks));
    return htmlToSnapshot(html, url);
  }
  throw new Error('Te veel redirects');
}
