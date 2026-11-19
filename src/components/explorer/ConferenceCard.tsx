// Eigenaar: C.
import type { Conference } from '@/lib/types';

const UNKNOWN = 'Onbekend';

export function ConferenceCard({ conference: c }: { conference: Conference }) {
  const location = [c.city, c.country].filter(Boolean).join(', ') || UNKNOWN;
  const dates =
    c.end_date && c.end_date !== c.start_date ? `${c.start_date} – ${c.end_date}` : c.start_date;

  return (
    <article className="rounded-lg border border-black/10 p-4 dark:border-white/15">
      <h2 className="font-semibold">{c.name}</h2>
      <p className="text-sm">{dates}</p>
      <p className="text-sm">{location}</p>
      <p className="text-sm">Categorie: {c.category}</p>
      <p className="text-sm">CFP: {c.cfp_deadline ?? UNKNOWN}</p>
      <p className="mt-2 flex gap-3 text-sm">
        <a className="underline" href={c.official_url} target="_blank" rel="noopener noreferrer">
          Website
        </a>
        <a className="underline" href={c.source_url} target="_blank" rel="noopener noreferrer">
          Bron: {c.source_name}
        </a>
      </p>
    </article>
  );
}
