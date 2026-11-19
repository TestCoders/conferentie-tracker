// Eigenaar: C.
import type { ReactNode } from 'react';
import type { CostEstimate } from '@/lib/costs';
import type { Conference } from '@/lib/types';
import { CATEGORY_LABELS, formatDate, formatDateRange, formatLocation, isPast } from './format';
import { PastBadge } from './PastBadge';
import { CATEGORY_STYLES } from './category-styles';
import { CostBreakdown, CostValue } from './CostValue';
import { Value } from './Value';

type Props = {
  conference: Conference;
  selected: boolean;
  selectDisabled: boolean;
  onToggleSelect: (id: string) => void;
  /** Badge met deelnemers/rating (klapt het community-paneel open). */
  community?: ReactNode;
  /** Community-paneel, onderaan in de kaart. */
  children?: ReactNode;
  /** Kostenschatting; undefined = aannames niet beschikbaar (dan niet tonen). */
  cost?: CostEstimate | null;
};

const LABEL = 'font-mono text-xs leading-5 text-ink-muted';

export function ConferenceCard({
  conference: c,
  selected,
  selectDisabled,
  onToggleSelect,
  community,
  children,
  cost,
}: Props) {
  const checkboxId = `compare-${c.id}`;

  return (
    <article
      className={`bg-surface flex h-full flex-col rounded-md border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
        selected ? 'border-signal ring-signal/30 ring-2' : 'border-hairline'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-lg leading-snug font-semibold">{c.name}</h2>
        <span
          className={`shrink-0 rounded px-2 py-0.5 font-mono text-[11px] font-semibold ${CATEGORY_STYLES[c.category]}`}
        >
          {CATEGORY_LABELS[c.category]}
        </span>
      </div>

      <dl className="mt-3 mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className={LABEL}>datum</dt>
        <dd>
          {isPast(c) ? <PastBadge /> : null}
          {formatDateRange(c)}
        </dd>
        <dt className={LABEL}>locatie</dt>
        <dd>
          <Value text={formatLocation(c)} />
        </dd>
        <dt className={LABEL}>cfp</dt>
        <dd>
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
        </dd>
        {cost !== undefined ? (
          <>
            <dt className={LABEL}>kosten</dt>
            <dd>
              <CostValue estimate={cost} />
              {cost ? (
                <div className="mt-1">
                  <CostBreakdown estimate={cost} />
                </div>
              ) : null}
            </dd>
          </>
        ) : null}
      </dl>

      <div className="border-hairline mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
        <div className="flex gap-3">
          <a
            className="text-signal font-semibold hover:underline"
            href={c.official_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Website →
          </a>
          <a
            className={`${LABEL} hover:underline`}
            href={c.source_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            bron: {c.source_name}
          </a>
        </div>
        <div className="flex items-center gap-3">
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
            vergelijk
          </label>
        </div>
      </div>
      {children ? <div className="-mx-4 mt-4 -mb-4">{children}</div> : null}
    </article>
  );
}
