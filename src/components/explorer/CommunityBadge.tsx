'use client';
// Eigenaar: C. Compacte knop met interesse/bezoekers/rating; klapt het community-paneel open.
import type { CommunityStats } from '@/lib/types';

const EMPTY: CommunityStats = { interested: 0, attended: 0, reviews: 0, averageRating: null };

type Props = {
  stats: CommunityStats | undefined;
  expanded: boolean;
  controls: string;
  onToggle: () => void;
};

export function CommunityBadge({ stats = EMPTY, expanded, controls, onToggle }: Props) {
  const people = stats.interested + stats.attended;
  const label = `${stats.interested} geïnteresseerd, ${stats.attended} bijgewoond${
    stats.averageRating !== null ? `, gemiddeld ${stats.averageRating} sterren` : ''
  }. ${expanded ? 'Verberg' : 'Toon'} deelnemers en reviews`;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={label}
      title={label}
      className={`focus-visible:ring-signal flex min-w-[4.5rem] items-center justify-between gap-2 rounded-md border px-2 py-1 font-mono text-xs whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none ${
        expanded
          ? 'border-signal bg-signal-glow text-signal'
          : 'border-hairline bg-glass text-ink-soft hover:text-ink'
      }`}
    >
      <span>👥 {people}</span>
      {stats.averageRating !== null ? (
        <span className="text-assess">★ {stats.averageRating.toFixed(1)}</span>
      ) : null}
      <span aria-hidden="true">{expanded ? '▴' : '▾'}</span>
    </button>
  );
}
