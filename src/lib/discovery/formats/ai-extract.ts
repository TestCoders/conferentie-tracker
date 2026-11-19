// Eigenaar: B. Gewone HTML-pagina zonder gestructureerde data: de AI leest de conferenties uit.
// Regels tegen verzinsels: alleen wat in de paginatekst staat, URL's alleen uit de links van de
// pagina, volledige datums verplicht. Records uit deze bron krijgen status 'pending'.
import { chatJson, type JsonSchema } from '@/lib/ai/openrouter';
import type { FetchResult } from '@/lib/discovery/fetch-source';
import { categorize, decodeEntities, toIsoDate, type Origin } from '@/lib/discovery/formats/common';
import { normalizeUrl } from '@/lib/discovery/normalize-url';
import type { ConferenceInput } from '@/lib/types';

const MAX_TEXT = 15_000;
const MAX_LINKS = 200;

export type PageContent = {
  title: string | null;
  text: string;
  links: { label: string; url: string }[];
};

/** Tekst en alle http(s)-links van een pagina, zonder scripts/styles. */
export function pageContent(html: string, pageUrl: string): PageContent {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? null;
  const links = new Map<string, string>();
  for (const m of html.matchAll(
    /<a\b[^>]*href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    try {
      const url = new URL(decodeEntities(m[1]), pageUrl);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) continue;
      url.hash = '';
      const label = decodeEntities(m[2].replace(/<[^>]+>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim();
      if (!links.has(url.href)) links.set(url.href, label.slice(0, 80));
    } catch {
      // Ongeldige link overslaan.
    }
    if (links.size >= MAX_LINKS) break;
  }
  const text = decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template|head)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n\s*/g, '\n')
    .trim()
    .slice(0, MAX_TEXT);
  return {
    title: title ? decodeEntities(title) : null,
    text,
    links: [...links].map(([url, label]) => ({ url, label })),
  };
}

const SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'name',
          'url',
          'start_date',
          'end_date',
          'city',
          'country',
          'online_only',
          'cfp_url',
          'cfp_deadline',
        ],
        properties: {
          name: { type: 'string' },
          url: { type: ['string', 'null'] },
          start_date: { type: ['string', 'null'] },
          end_date: { type: ['string', 'null'] },
          city: { type: ['string', 'null'] },
          country: { type: ['string', 'null'] },
          online_only: { type: ['boolean', 'null'] },
          cfp_url: { type: ['string', 'null'] },
          cfp_deadline: { type: ['string', 'null'] },
        },
      },
    },
  },
};

function str(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const s = value.replace(/\s+/g, ' ').trim();
  return s && s.length <= max && !/[\u0000-\u001f\u007f]/.test(s) ? s : null;
}

function date(value: unknown): string | null {
  try {
    return toIsoDate(value, 'datum');
  } catch {
    return null;
  }
}

/** Alleen URL's die echt als link op de pagina staan (of de pagina zelf). */
function allowedUrl(value: unknown, allowed: Set<string>): string | null {
  const s = str(value, 2000);
  if (!s) return null;
  try {
    const url = new URL(s);
    url.hash = '';
    return allowed.has(url.href) ? url.href : null;
  } catch {
    return null;
  }
}

/** Puur en testbaar: AI-antwoord → gevalideerde records. */
export function toConferences(
  data: unknown,
  pageUrl: string,
  content: PageContent,
  origin: Origin,
): FetchResult {
  const items: ConferenceInput[] = [];
  const errors: string[] = [];
  const raw = (data as { items?: unknown } | null)?.items;
  if (!Array.isArray(raw)) throw new Error('AI-antwoord zonder items');
  const page = new URL(pageUrl);
  page.hash = '';
  const allowed = new Set([page.href, ...content.links.map((l) => l.url)]);
  for (const [index, value] of raw.entries()) {
    const r = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
    const name = str(r.name, 200);
    const label = name ?? `record ${index + 1}`;
    const url = allowedUrl(r.url, allowed);
    const start = date(r.start_date);
    let end = date(r.end_date);
    if (!name || !url || !start) {
      errors.push(
        `${origin.sourceUrl}, ${label}: ${!url ? 'geen URL van de pagina' : 'naam of volledige begindatum ontbreekt'}`,
      );
      continue;
    }
    if (end && end < start) end = null;
    const onlineOnly = r.online_only === true && !str(r.city, 100) && !str(r.country, 80);
    items.push({
      name,
      official_url: url,
      canonical_url: normalizeUrl(url),
      source_name: origin.sourceName,
      source_url: origin.sourceUrl,
      start_date: start,
      end_date: end,
      city: onlineOnly ? null : str(r.city, 100),
      country: onlineOnly ? null : str(r.country, 80),
      online_only: onlineOnly,
      category: categorize(name, origin.defaultCategory),
      cfp_url: allowedUrl(r.cfp_url, allowed),
      cfp_deadline: date(r.cfp_deadline),
      price_text: null,
    });
  }
  return { items, errors };
}

export async function extractWithAi(
  html: string,
  pageUrl: string,
  origin: Origin,
): Promise<FetchResult> {
  const content = pageContent(html, pageUrl);
  if (!content.text) throw new Error('Pagina bevat geen leesbare tekst');
  const { data } = await chatJson(
    [
      {
        role: 'system',
        content:
          'Je haalt conferenties uit de tekst van een webpagina. Gebruik alleen wat letterlijk op de pagina staat; verzin niets. Onbekend = null. Antwoord uitsluitend met JSON volgens het schema.',
      },
      {
        role: 'user',
        content: [
          'Geef elke conferentie (of elk vergelijkbaar vakevent) die op deze pagina staat:',
          '- name: naam zoals op de pagina.',
          '- url: de link (exact uit "links") naar de website of detailpagina van die conferentie. Gaat de hele pagina over één conferentie, gebruik dan de pagina-URL. Geen passende link: null.',
          '- start_date, end_date: YYYY-MM-DD, alleen als dag, maand én jaar op de pagina staan; anders null.',
          '- city, country: plaats van de fysieke editie (land in het Engels); null als onbekend of alleen online.',
          '- online_only: true alleen als het uitsluitend online is; anders false of null.',
          '- cfp_url: link (exact uit "links") naar de call for papers; anders null.',
          '- cfp_deadline: sluitingsdatum call for papers als YYYY-MM-DD; anders null.',
          'Geen webinars, meetups of trainingen tenzij ze duidelijk als conferentie worden gepresenteerd.',
          JSON.stringify({
            url: pageUrl,
            title: content.title,
            links: content.links,
            text: content.text,
          }),
        ].join('\n'),
      },
    ],
    'page_conferences',
    SCHEMA,
  );
  return toConferences(data, pageUrl, content, origin);
}
