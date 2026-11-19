// Eigenaar: B. Tijdvenster voor historische bronnen: conferenties vanaf 12 maanden geleden.
// Zo kunnen bezoekers ook afgelopen edities als "bijgewoond" markeren en er ervaringen over delen.

export const PAST_WINDOW_DAYS = 365;

/** 'YYYY-MM-DD' van precies PAST_WINDOW_DAYS dagen geleden (UTC). */
export function pastCutoff(now: Date = new Date()): string {
  return new Date(now.getTime() - PAST_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
}

/** Bevat de vrije datumtekst een jaartal binnen (of na) het venster? Voor het melden van fouten. */
export function mentionsYearSince(text: unknown, cutoff: string): boolean {
  if (typeof text !== 'string') return false;
  const from = Number(cutoff.slice(0, 4));
  return (text.match(/\b(19|20)\d{2}\b/g) ?? []).some((y) => Number(y) >= from);
}
