'use client';
// Eigenaar: C. Publiek overzicht: zoeken, filteren, sorteren, lijst/kaarten/agenda en 2 vergelijken.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { assumptionMap, estimateCosts, ticketFor, type CostEstimate } from '@/lib/costs';
import {
  CATEGORIES,
  type Category,
  type CommunityStats,
  type CommunitySummaryResponse,
  type Conference,
  type CostAssumption,
  type ListResponse,
} from '@/lib/types';
import { AgendaView } from './AgendaView';
import { CommunityBadge } from './CommunityBadge';
import { CompareTable } from './CompareTable';
import { ConferenceCard } from './ConferenceCard';
import { ConferenceCommunity } from './ConferenceCommunity';
import { ConferenceRow } from './ConferenceRow';
import { CATEGORY_LABELS } from './format';

const MAX_COMPARE = 2;

type SortOrder = 'asc' | 'desc' | 'cost';
type ViewMode = 'list' | 'cards' | 'agenda';

const VIEW_LABELS: Record<ViewMode, string> = {
  list: '☰ Lijst',
  cards: '▦ Kaarten',
  agenda: '📅 Agenda',
};

const FIELD =
  'rounded-md border border-hairline bg-surface px-3 py-2 font-sans text-sm text-ink focus:ring-2 focus:ring-signal focus:outline-none';
const FIELD_LABEL = 'flex flex-col gap-1 font-mono text-xs text-ink-muted';

export function Explorer() {
  const [items, setItems] = useState<Conference[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [view, setView] = useState<ViewMode>('list');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // undefined = (nog) niet beschikbaar; de lijst werkt dan gewoon zonder tellingen.
  const [stats, setStats] = useState<Record<string, CommunityStats> | undefined>(undefined);
  const [statsVersion, setStatsVersion] = useState(0);
  // undefined = aannames niet beschikbaar; kosten worden dan niet getoond.
  const [assumptions, setAssumptions] = useState<CostAssumption[] | undefined>(undefined);
  const [budget, setBudget] = useState('');
  const [hideUnknownCost, setHideUnknownCost] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/cost-assumptions', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setAssumptions(((await res.json()) as ListResponse<CostAssumption>).items);
      })
      .catch(() => {
        // Kosten zijn optioneel; de lijst blokkeert er niet op.
      });
    return () => controller.abort();
  }, []);

  const costs = useMemo<Record<string, CostEstimate | null> | undefined>(() => {
    // Nog geen aannames ingevuld: kosten nog niet tonen (anders overal 'Onbekend').
    if (!items || !assumptions || assumptions.length === 0) return undefined;
    const map = assumptionMap(assumptions);
    return Object.fromEntries(items.map((c) => [c.id, estimateCosts(c, map, ticketFor(c))]));
  }, [items, assumptions]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/attendances/summary', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setStats(((await res.json()) as CommunitySummaryResponse).items);
      })
      .catch(() => {
        // Community-tellingen zijn optioneel; de lijst blokkeert er niet op.
      });
    return () => controller.abort();
  }, [statsVersion]);

  const refreshStats = useCallback(() => setStatsVersion((n) => n + 1), []);

  function communityFor(c: Conference, stacked: boolean) {
    const panelId = `community-${c.id}`;
    const expanded = expandedId === c.id;
    return {
      badge: (
        <CommunityBadge
          stats={stats?.[c.id]}
          expanded={expanded}
          controls={panelId}
          onToggle={() => setExpandedId(expanded ? null : c.id)}
        />
      ),
      panel: expanded ? (
        <div id={panelId}>
          <ConferenceCommunity conference={c} onChanged={refreshStats} stacked={stacked} />
        </div>
      ) : null,
    };
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/conferences', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ListResponse<Conference>;
        setItems(data.items);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Onbekende fout');
      });
    return () => controller.abort();
  }, []);

  const visible = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    const max = Number(budget);
    const budgetActive = costs !== undefined && budget !== '' && Number.isFinite(max) && max >= 0;
    const totalOf = (c: Conference) => costs?.[c.id]?.total ?? null;

    const filtered = items.filter((c) => {
      if (category !== 'all' && c.category !== category) return false;
      if (q !== '' && !c.name.toLowerCase().includes(q)) return false;
      if (!budgetActive) return true;
      const total = totalOf(c);
      // Onbekende kosten blijven zichtbaar (onderaan), tenzij expliciet verborgen.
      return total === null ? !hideUnknownCost : total <= max;
    });

    const byCost = sortOrder === 'cost' && costs !== undefined;
    const direction = sortOrder === 'desc' ? -1 : 1;
    return filtered.sort((a, b) => {
      if (budgetActive || byCost) {
        const ta = totalOf(a);
        const tb = totalOf(b);
        if ((ta === null) !== (tb === null)) return ta === null ? 1 : -1;
        if (byCost && ta !== null && tb !== null && ta !== tb) return ta - tb;
      }
      // 'YYYY-MM-DD' sorteert lexicografisch correct.
      return a.start_date.localeCompare(b.start_date) * direction;
    });
  }, [items, query, category, sortOrder, budget, hideUnknownCost, costs]);

  const unknownCostVisible =
    costs !== undefined && budget !== '' ? visible.filter((c) => !costs[c.id]).length : 0;

  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => items?.find((c) => c.id === id))
        .filter((c): c is Conference => c !== undefined),
    [items, selectedIds],
  );

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < MAX_COMPARE
          ? [...prev, id]
          : prev,
    );
  }

  if (error) {
    return (
      <p role="alert" className="text-alert">
        Kon conferenties niet laden: {error}
      </p>
    );
  }
  if (!items) return <p aria-live="polite">Laden…</p>;
  if (items.length === 0) return <p>Nog geen conferenties. Start een import via /admin.</p>;

  const counts = CATEGORIES.reduce<Record<Category, number>>(
    (acc, cat) => ({ ...acc, [cat]: items.filter((c) => c.category === cat).length }),
    { development: 0, testing: 0, 'test-automation': 0 },
  );

  return (
    <div>
      {selected.length === MAX_COMPARE ? (
        <CompareTable
          conferences={[selected[0], selected[1]]}
          onClear={() => setSelectedIds([])}
          stats={stats}
          costs={costs}
        />
      ) : null}

      <div className="border-hairline bg-void/90 sticky top-[61px] z-[5] -mx-4 mb-4 border-b px-4 py-3 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className={`${FIELD_LABEL} min-w-48 flex-1`}>
            --zoek
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Bijv. JSConf"
              className={FIELD}
            />
          </label>
          <label className={FIELD_LABEL}>
            --categorie
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category | 'all')}
              className={FIELD}
            >
              <option value="all">Alle ({items.length})</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]} ({counts[cat]})
                </option>
              ))}
            </select>
          </label>
          {view !== 'agenda' ? (
            <label className={FIELD_LABEL}>
              --sort
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className={FIELD}
              >
                <option value="asc">Eerstvolgende eerst</option>
                <option value="desc">Laatste eerst</option>
                {costs ? <option value="cost">Goedkoopste eerst</option> : null}
              </select>
            </label>
          ) : null}
          {costs ? (
            <div className="flex flex-col gap-1">
              <label className={FIELD_LABEL}>
                --max-budget
                <span className="relative">
                  <span className="text-ink-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                    €
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={100}
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="geen"
                    aria-describedby="budget-hint"
                    className={`${FIELD} w-32 pl-7`}
                  />
                </span>
              </label>
            </div>
          ) : null}
          <div className={FIELD_LABEL}>
            <span id="view-label">--weergave</span>
            <div
              role="group"
              aria-labelledby="view-label"
              className="border-hairline bg-surface flex rounded-md border p-0.5"
            >
              {(Object.keys(VIEW_LABELS) as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={view === mode}
                  onClick={() => setView(mode)}
                  className={`rounded px-3 py-1.5 font-sans text-sm transition-colors ${
                    view === mode ? 'bg-signal text-white' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {VIEW_LABELS[mode]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-ink-muted mt-2 font-mono text-xs" aria-live="polite">
          <span className="text-adopt">✓</span> {visible.length} van {items.length} conferenties
          {selected.length === 1 ? ' · selecteer nog 1 om te vergelijken' : ''}
        </p>
        {costs && budget !== '' ? (
          <div
            id="budget-hint"
            className="text-ink-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs"
          >
            <span>
              budget = reis + hotel (schatting){' '}
              {Object.values(costs).some((e) => e?.ticket) ? '+ ticket' : '· ticket nog onbekend'}
            </span>
            {unknownCostVisible > 0 || hideUnknownCost ? (
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  className="accent-signal size-3.5"
                  checked={hideUnknownCost}
                  onChange={(e) => setHideUnknownCost(e.target.checked)}
                />
                verberg {hideUnknownCost ? '' : `${unknownCostVisible} `}zonder kostenschatting
              </label>
            ) : null}
          </div>
        ) : (
          <span id="budget-hint" className="sr-only">
            Maximaal budget in euro voor reis en hotel (schatting).
          </span>
        )}
      </div>

      {visible.length === 0 ? (
        <p>Geen conferenties gevonden voor deze zoekopdracht.</p>
      ) : view === 'agenda' ? (
        <AgendaView conferences={visible} />
      ) : view === 'list' ? (
        <ul className="divide-hairline border-hairline bg-surface divide-y overflow-hidden rounded-md border">
          {visible.map((c) => {
            const isSelected = selectedIds.includes(c.id);
            const community = communityFor(c, false);
            return (
              <li key={c.id}>
                <ConferenceRow
                  conference={c}
                  selected={isSelected}
                  selectDisabled={!isSelected && selectedIds.length >= MAX_COMPARE}
                  onToggleSelect={toggleSelect}
                  community={community.badge}
                  cost={costs ? (costs[c.id] ?? null) : undefined}
                />
                {community.panel}
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => {
            const isSelected = selectedIds.includes(c.id);
            const community = communityFor(c, true);
            return (
              <li key={c.id}>
                <ConferenceCard
                  conference={c}
                  selected={isSelected}
                  selectDisabled={!isSelected && selectedIds.length >= MAX_COMPARE}
                  onToggleSelect={toggleSelect}
                  community={community.badge}
                  cost={costs ? (costs[c.id] ?? null) : undefined}
                >
                  {community.panel}
                </ConferenceCard>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
