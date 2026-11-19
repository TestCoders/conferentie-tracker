// Kaart in het overzicht: cover-foto, titel, conferentie, rating en samenvatting.
import { Stars } from '@/components/explorer/Stars';
import type { Experience } from '@/lib/types';
import { WOULD_RETURN_LABELS, WOULD_RETURN_STYLES, formatLongDate } from './labels';

export function ExperienceCard({
  experience: e,
  onOpen,
}: {
  experience: Experience;
  onOpen: () => void;
}) {
  const cover = e.photos[0];
  const when = formatLongDate(e.conference_date);
  return (
    <article className="border-hairline bg-surface flex h-full flex-col overflow-hidden rounded-md border transition hover:-translate-y-0.5 hover:shadow-md">
      <button
        type="button"
        onClick={onOpen}
        className="focus-visible:ring-signal flex h-full flex-col text-left focus-visible:ring-2 focus-visible:outline-none"
        aria-label={`Lees "${e.title}" over ${e.conference_name}`}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- door gebruikers geüploade foto uit Supabase Storage
          <img
            src={cover.url}
            alt={cover.caption ?? ''}
            loading="lazy"
            className="aspect-[16/9] w-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="bg-glass text-ink-muted flex aspect-[16/9] w-full items-center justify-center font-mono text-xs"
          >
            $ cat verslag.md
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <p className="text-ink-muted font-mono text-[11px]">
            {e.conference_name}
            {when ? ` · ${when}` : ''}
            {e.conference_city ? ` · ${e.conference_city}` : ''}
          </p>
          <h2 className="font-display text-lg leading-snug font-semibold">{e.title}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Stars value={e.rating} />
            <span
              className={`rounded px-2 py-0.5 font-mono text-[11px] font-semibold ${WOULD_RETURN_STYLES[e.would_return]}`}
            >
              {WOULD_RETURN_LABELS[e.would_return]}
            </span>
          </div>
          <p className="text-ink-soft line-clamp-3 text-sm">{e.summary}</p>
          <p className="text-ink-muted mt-auto flex justify-between pt-2 font-mono text-[11px]">
            <span>door {e.author_name}</span>
            {e.photos.length ? <span>📷 {e.photos.length}</span> : null}
          </p>
        </div>
      </button>
    </article>
  );
}
