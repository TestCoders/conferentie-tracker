// Eigenaar: C. Twee conferenties naast elkaar; ontbrekende velden tonen 'Onbekend'.
import { formatEuro, type CostEstimate } from '@/lib/costs';
import type { CommunityStats, Conference } from '@/lib/types';
import {
  CATEGORY_LABELS,
  UNKNOWN,
  formatDate,
  formatDateRange,
  formatLocation,
  orUnknown,
} from './format';
import { basisNote } from './CostValue';
import { ConferenceLogo } from './ConferenceImages';
import { Value } from './Value';

/** Vervangt de rij 'prijs' door ticket, reis, hotel en totaal (schatting). */
function costRows(costs: Record<string, CostEstimate | null>): Row[] {
  const get = (c: Conference) => costs[c.id] ?? null;
  return [
    {
      label: 'ticket',
      value: (c) => {
        const t = get(c)?.ticket;
        return t
          ? `${formatEuro(t.amount)} (${t.byAi ? 'door AI van de website' : 'officieel'})`
          : UNKNOWN;
      },
    },
    {
      label: 'reis',
      value: (c) => {
        const e = get(c);
        return e ? `${formatEuro(e.travel)} (${basisNote(e)})` : UNKNOWN;
      },
    },
    {
      label: 'hotel',
      value: (c) => {
        const e = get(c);
        if (!e) return UNKNOWN;
        if (e.basis === 'online') return `${formatEuro(0)} (online, geen hotel)`;
        return `${formatEuro(e.hotel)} (${e.nights} × ${formatEuro(e.hotelPerNight)})`;
      },
    },
    {
      label: 'totaal (schatting)',
      value: (c) => {
        const e = get(c);
        if (!e) return UNKNOWN;
        return `~${formatEuro(e.total)}${e.ticket ? '' : ' excl. ticket'}`;
      },
    },
  ];
}

function communityRows(stats: Record<string, CommunityStats>): Row[] {
  const get = (c: Conference) => stats[c.id];
  return [
    { label: 'interesse', value: (c) => String(get(c)?.interested ?? 0) },
    { label: 'bijgewoond', value: (c) => String(get(c)?.attended ?? 0) },
    {
      label: 'rating',
      value: (c) => {
        const s = get(c);
        return s?.averageRating != null
          ? `★ ${s.averageRating.toFixed(1)} (${s.reviews} ${s.reviews === 1 ? 'review' : 'reviews'})`
          : 'Nog geen reviews';
      },
    },
  ];
}

type Row = { label: string; value: (c: Conference) => string };

const ROWS: Row[] = [
  { label: 'datum', value: formatDateRange },
  { label: 'locatie', value: formatLocation },
  { label: 'categorie', value: (c) => CATEGORY_LABELS[c.category] },
  { label: 'cfp-deadline', value: (c) => formatDate(c.cfp_deadline) },
  { label: 'prijs', value: (c) => orUnknown(c.price_text) },
  { label: 'bron', value: (c) => c.source_name },
];

type Props = {
  conferences: [Conference, Conference];
  onClear: () => void;
  /** Community-tellingen per conference_id; ontbreekt bij laadfout. */
  stats?: Record<string, CommunityStats>;
  /** Kostenschattingen per conference_id; ontbreekt als aannames niet beschikbaar zijn. */
  costs?: Record<string, CostEstimate | null>;
};

export function CompareTable({ conferences, onClear, stats, costs }: Props) {
  const base = costs ? ROWS.flatMap((r) => (r.label === 'prijs' ? costRows(costs) : [r])) : ROWS;
  const rows = stats ? [...base, ...communityRows(stats)] : base;
  return (
    <section
      aria-labelledby="compare-heading"
      className="border-hairline bg-surface mb-8 overflow-hidden rounded-md border shadow-sm"
    >
      <div className="bg-titlebar flex items-center justify-between gap-3 px-4 py-2">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="bg-alert size-3 rounded-full" />
          <span aria-hidden="true" className="bg-assess size-3 rounded-full" />
          <span aria-hidden="true" className="bg-adopt size-3 rounded-full" />
          <h2 id="compare-heading" className="text-ink-soft ml-2 font-mono text-sm">
            <span className="sr-only">Vergelijking: </span>$ diff conferentie-a conferentie-b
          </h2>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-ink-soft hover:bg-glass hover:text-ink rounded-md px-2 py-0.5 font-mono text-xs"
        >
          wis selectie ✕
        </button>
      </div>
      <div className="overflow-x-auto p-4">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead>
            <tr className="border-hairline border-b">
              <th scope="col" className="w-32 py-2 pr-3">
                <span className="sr-only">Kenmerk</span>
              </th>
              {conferences.map((c) => (
                <th key={c.id} scope="col" className="font-display py-2 pr-3 font-semibold">
                  <span className="flex items-center gap-2">
                    <ConferenceLogo conference={c} size="sm" />
                    <a
                      className="text-signal hover:underline"
                      href={c.official_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {c.name}
                    </a>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-hairline border-b last:border-0">
                <th scope="row" className="text-ink-muted py-2 pr-3 font-mono text-xs font-normal">
                  {row.label}
                </th>
                {conferences.map((c) => (
                  <td key={c.id} className="py-2 pr-3">
                    <Value text={row.value(c)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
