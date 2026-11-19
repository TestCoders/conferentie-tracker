// Eigenaar: C.
import type { Conference } from '@/lib/types';
import { CATEGORY_LABELS, formatDate, formatDateRange, formatLocation } from './format';

type Props = {
  conference: Conference;
  selected: boolean;
  selectDisabled: boolean;
  onToggleSelect: (id: string) => void;
};

const CATEGORY_STYLES: Record<Conference['category'], string> = {
  development: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  testing: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  'test-automation': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
};

export function ConferenceCard({ conference: c, selected, selectDisabled, onToggleSelect }: Props) {
  const checkboxId = `compare-${c.id}`;

  return (
    <article
      className={`flex h-full flex-col rounded-xl border p-4 transition-shadow hover:shadow-md ${
        selected
          ? 'border-indigo-500 ring-2 ring-indigo-500/30'
          : 'border-black/10 dark:border-white/15'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg leading-snug font-semibold">{c.name}</h2>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[c.category]}`}
        >
          {CATEGORY_LABELS[c.category]}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-black/60 dark:text-white/60">Datum</dt>
        <dd>{formatDateRange(c)}</dd>
        <dt className="text-black/60 dark:text-white/60">Locatie</dt>
        <dd>{formatLocation(c)}</dd>
        <dt className="text-black/60 dark:text-white/60">CFP</dt>
        <dd>
          {c.cfp_url ? (
            <a className="underline" href={c.cfp_url} target="_blank" rel="noopener noreferrer">
              {formatDate(c.cfp_deadline)}
            </a>
          ) : (
            formatDate(c.cfp_deadline)
          )}
        </dd>
      </dl>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4 text-sm">
        <div className="flex gap-3">
          <a
            className="font-medium text-indigo-700 underline dark:text-indigo-300"
            href={c.official_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Website
          </a>
          <a
            className="text-black/60 underline dark:text-white/60"
            href={c.source_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Bron: {c.source_name}
          </a>
        </div>
        <label htmlFor={checkboxId} className="flex cursor-pointer items-center gap-2">
          <input
            id={checkboxId}
            type="checkbox"
            className="size-4 accent-indigo-600"
            checked={selected}
            disabled={selectDisabled}
            onChange={() => onToggleSelect(c.id)}
          />
          Vergelijk
        </label>
      </div>
    </article>
  );
}
