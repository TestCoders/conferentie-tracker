// Eigenaar: C. Compacte lijstweergave: één rij per conferentie, goed verticaal te scannen.
import type { ReactNode } from 'react';
import type { Conference } from '@/lib/types';
import { CATEGORY_LABELS, dateParts, formatDate, formatDateRange, formatLocation } from './format';
import { CATEGORY_STYLES } from './category-styles';
import { Value } from './Value';

type Props = {
  conference: Conference;
  selected: boolean;
  selectDisabled: boolean;
  onToggleSelect: (id: string) => void;
  /** Badge met deelnemers/rating (klapt het community-paneel open). */
  community?: ReactNode;
};

export function ConferenceRow({
  conference: c,
  selected,
  selectDisabled,
  onToggleSelect,
  community,
}: Props) {
  const checkboxId = `compare-row-${c.id}`;
  const { day, month, year } = dateParts(c.start_date);

  return (
    <div
      className={`grid grid-cols-[3.5rem_1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors sm:grid-cols-[3.5rem_minmax(0,1fr)_9rem_8rem_auto] ${
        selected ? 'bg-signal-glow/60' : 'hover:bg-glass/60'
      }`}
    >
      <div
        className="border-hairline bg-void flex flex-col items-center rounded-md border py-1 leading-none"
        aria-hidden="true"
      >
        <span className="text-ink-muted font-mono text-[10px] uppercase">{month}</span>
        <span className="font-display text-xl font-bold">{day}</span>
        <span className="text-ink-muted font-mono text-[10px]">{year}</span>
      </div>

      <div className="min-w-0">
        <a
          className="font-display hover:text-signal block truncate font-semibold hover:underline"
          href={c.official_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {c.name}
        </a>
        <p className="text-ink-soft truncate text-sm">
          <span className="sr-only">Datum: </span>
          {formatDateRange(c)} · <Value text={formatLocation(c)} />
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 sm:hidden">
          <span
            className={`rounded px-2 py-0.5 font-mono text-[11px] font-semibold ${CATEGORY_STYLES[c.category]}`}
          >
            {CATEGORY_LABELS[c.category]}
          </span>
          <span className="text-ink-muted font-mono text-xs">
            cfp: <Value text={formatDate(c.cfp_deadline)} />
          </span>
        </p>
      </div>

      <div className="hidden sm:block">
        <span
          className={`rounded px-2 py-0.5 font-mono text-[11px] font-semibold ${CATEGORY_STYLES[c.category]}`}
        >
          {CATEGORY_LABELS[c.category]}
        </span>
      </div>

      <div className="hidden text-sm sm:block">
        <span className="text-ink-muted block font-mono text-[10px] uppercase">cfp</span>
        {c.cfp_url ? (
          <a
            className="text-signal hover:underline"
            href={c.cfp_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {c.cfp_deadline ? formatDate(c.cfp_deadline) : 'Call for papers'}
          </a>
        ) : (
          <Value text={formatDate(c.cfp_deadline)} />
        )}
      </div>

      <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
        {community}
        <label
          htmlFor={checkboxId}
          className={`flex items-center gap-2 font-mono text-xs ${
            selectDisabled ? 'opacity-40' : 'cursor-pointer'
          }`}
        >
          <input
            id={checkboxId}
            type="checkbox"
            className="accent-signal size-4"
            checked={selected}
            disabled={selectDisabled}
            onChange={() => onToggleSelect(c.id)}
          />
          <span className="hidden md:inline">vergelijk</span>
          <span className="sr-only md:hidden">Vergelijk {c.name}</span>
        </label>
      </div>
    </div>
  );
}
