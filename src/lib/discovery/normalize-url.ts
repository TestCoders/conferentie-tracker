// Eigenaar: B. Normaliseert een officiële URL tot canonical_url voor ontdubbelen.

/** Behoud betekenisvolle queryparameters en pad-hoofdletters. */
export function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('Alleen HTTP(S)-URLs zonder inloggegevens zijn toegestaan');
  }
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  parsed.hash = '';
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^(utm_.*|ref|fbclid|gclid)$/i.test(key)) parsed.searchParams.delete(key);
  }
  parsed.searchParams.sort();
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}${parsed.search}`;
}
