// Eigenaar: C. Twee conferenties naast elkaar; ontbrekende velden tonen 'Onbekend'.
import type { Conference } from '@/lib/types';
import { CATEGORY_LABELS, formatDate, formatDateRange, formatLocation, orUnknown } from './format';

type Row = { label: string; value: (c: Conference) => string };

const ROWS: Row[] = [
  { label: 'Datum', value: formatDateRange },
  { label: 'Locatie', value: formatLocation },
  { label: 'Categorie', value: (c) => CATEGORY_LABELS[c.category] },
  { label: 'CFP-deadline', value: (c) => formatDate(c.cfp_deadline) },
  { label: 'Prijs', value: (c) => orUnknown(c.price_text) },
  { label: 'Bron', value: (c) => c.source_name },
];

type Props = {
  conferences: [Conference, Conference];
  onClear: () => void;
};

export function CompareTable({ conferences, onClear }: Props) {
  return (
    <section
      aria-labelledby="compare-heading"
      className="mb-8 rounded-xl border border-indigo-500/40 bg-indigo-50/50 p-4 dark:bg-indigo-950/20"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="compare-heading" className="text-lg font-semibold">
          Vergelijking
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md border border-black/15 px-3 py-1 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Wis selectie
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/15">
              <th
                scope="col"
                className="w-32 py-2 pr-3 font-medium text-black/60 dark:text-white/60"
              >
                <span className="sr-only">Kenmerk</span>
              </th>
              {conferences.map((c) => (
                <th key={c.id} scope="col" className="py-2 pr-3 font-semibold">
                  <a
                    className="underline"
                    href={c.official_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {c.name}
                  </a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr
                key={row.label}
                className="border-b border-black/5 last:border-0 dark:border-white/10"
              >
                <th scope="row" className="py-2 pr-3 font-medium text-black/60 dark:text-white/60">
                  {row.label}
                </th>
                {conferences.map((c) => (
                  <td key={c.id} className="py-2 pr-3">
                    {row.value(c)}
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
