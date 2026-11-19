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
import { FavoriteButton } from './FavoriteButton';
import { addMonths, downloadIcs } from './calendar';
import { useFavorites } from './favorites';
import { WorldMap } from './map/WorldMap';
import { CATEGORY_LABELS, isPast, todayIso } from './format';

const MAX_COMPARE = 2;

type SortOrder = 'asc' | 'desc' | 'cost';
type Period = 'upcoming' | 'past12' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  upcoming: 'Aankomend',
  past12: 'Afgelopen 12 maanden',
  all: 'Alles',
};

/** 'YYYY-MM-DD' van 12 maanden geleden. */
function cutoff12(today: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}
type ViewMode = 'list' | 'cards' | 'agenda' | 'map';

const VIEW_LABELS: Record<ViewMode, string> = {
  list: '☰ Lijst',
  cards: '▦ Kaarten',
  agenda: '📅 Agenda',
  map: '🌍 Wereldkaart',
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
  const [period, setPeriod] = useState<Period>('upcoming');
  const [year, setYear] = useState('all');
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
  const favorites = useFavorites();
  const [onlyFavorites, setOnlyFavorites] = useState(false);

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

  function favoriteFor(c: Conference) {
    return (
      <FavoriteButton
        name={c.name}
        active={favorites.ids.has(c.id)}
        onToggle={() => favorites.toggle(c.id)}
      />
    );
  }

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
    // Alles in één keer (enkele honderden records); periode en jaar filteren we lokaal.
    fetch('/api/conferences?period=all', { signal: controller.signal })
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

  // Pas na het laden (in de browser): new Date() mag niet tijdens het voorrenderen.
  const today = items ? todayIso() : '';

  const years = useMemo(
    () =>
      [...new Set((items ?? []).map((c) => c.start_date.slice(0, 4)))].sort((a, b) =>
        b.localeCompare(a),
      ),
    [items],
  );

  /** Conferenties binnen de gekozen periode en het gekozen jaar (basis voor de overige filters). */
  const inPeriod = useMemo(() => {
    if (!items) return [];
    const since = cutoff12(today);
    return items.filter((c) => {
      if (year !== 'all' && !c.start_date.startsWith(year)) return false;
      if (period === 'upcoming') return !isPast(c, today);
      if (period === 'past12') return isPast(c, today) && c.start_date >= since;
      return true;
    });
  }, [items, period, year, today]);

  function choosePeriod(next: Period) {
    setPeriod(next);
    // Afgelopen conferenties: recentste eerst is logischer.
    if (sortOrder !== 'cost') setSortOrder(next === 'past12' ? 'desc' : 'asc');
  }

  /** Maandbereik voor de agenda, passend bij periode/jaar. */
  const agendaRange = useMemo(() => {
    const thisMonth = today.slice(0, 7);
    if (year !== 'all') return { start: `${year}-01`, months: 12 };
    if (period === 'upcoming') return { start: thisMonth, months: 12 };
    if (period === 'past12') return { start: addMonths(thisMonth, -11), months: 12 };
    const first = inPeriod
      .reduce((m, c) => (c.start_date < m ? c.start_date : m), today)
      .slice(0, 7);
    const last = inPeriod
      .reduce((m, c) => (c.start_date > m ? c.start_date : m), today)
      .slice(0, 7);
    const span =
      (Number(last.slice(0, 4)) - Number(first.slice(0, 4))) * 12 +
      (Number(last.slice(5, 7)) - Number(first.slice(5, 7))) +
      1;
    return { start: first, months: Math.min(24, Math.max(12, span)) };
  }, [period, year, inPeriod, today]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const max = Number(budget);
    const budgetActive = costs !== undefined && budget !== '' && Number.isFinite(max) && max >= 0;
    const totalOf = (c: Conference) => costs?.[c.id]?.total ?? null;

    const filtered = inPeriod.filter((c) => {
      if (onlyFavorites && !favorites.ids.has(c.id)) return false;
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
  }, [
    inPeriod,
    query,
    category,
    sortOrder,
    budget,
    hideUnknownCost,
    costs,
    onlyFavorites,
    favorites.ids,
  ]);

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
    (acc, cat) => ({ ...acc, [cat]: inPeriod.filter((c) => c.category === cat).length }),
    { development: 0, testing: 0, 'test-automation': 0 },
  );
  const favoriteCount = inPeriod.filter((c) => favorites.ids.has(c.id)).length;

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
            --periode
            <select
              value={period}
              onChange={(e) => choosePeriod(e.target.value as Period)}
              className={FIELD}
            >
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <option key={p} value={p}>
                  {PERIOD_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <label className={FIELD_LABEL}>
            --jaar
            <select value={year} onChange={(e) => setYear(e.target.value)} className={FIELD}>
              <option value="all">Alle jaren</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className={FIELD_LABEL}>
            --categorie
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category | 'all')}
              className={FIELD}
            >
              <option value="all">Alle ({inPeriod.length})</option>
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
                <option value="asc">Vroegste eerst</option>
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
            <span id="favorites-label">--favorieten</span>
            <button
              type="button"
              aria-labelledby="favorites-label"
              aria-pressed={onlyFavorites}
              onClick={() => setOnlyFavorites((on) => !on)}
              className={`focus:ring-signal rounded-md border px-3 py-2 font-sans text-sm transition-colors focus:ring-2 focus:outline-none ${
                onlyFavorites
                  ? 'border-assess bg-assess/15 text-ink font-semibold'
                  : 'border-hairline bg-surface text-ink-soft hover:text-ink'
              }`}
            >
              {onlyFavorites ? '★' : '☆'} Alleen favorieten ({favoriteCount})
            </button>
          </div>
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
          <span className="text-adopt">✓</span> {visible.length} van {inPeriod.length} conferenties
          · {PERIOD_LABELS[period].toLowerCase()}
          {year !== 'all' ? ` · ${year}` : ''}
          {onlyFavorites ? ' · alleen favorieten' : ''}
          {selected.length === 1 ? ' · selecteer nog 1 om te vergelijken' : ''}
          {onlyFavorites && visible.length > 0 ? (
            <>
              {' · '}
              <button
                type="button"
                onClick={() => downloadIcs(visible, 'favoriete-conferenties.ics')}
                className="text-signal hover:underline"
              >
                ⤓ zet deze {visible.length} in mijn agenda (.ics)
              </button>
            </>
          ) : null}
        </p>
        {costs && budget !== '' ? (
          <div
            id="budget-hint"
            className="text-ink-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs"
          >
            <span>
              budget = reis + hotel (schatting){' '}
              {Object.values(costs).some((e) => e?.ticket)
                ? '+ ticket waar bekend'
                : '· ticket nog onbekend'}
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
        <p>
          {inPeriod.length === 0
            ? 'Geen conferenties in deze periode. Kies een andere periode of een ander jaar.'
            : onlyFavorites && favoriteCount === 0
              ? 'Nog geen favorieten in deze periode. Klik op ☆ bij een conferentie om hem op je shortlist te zetten.'
              : 'Geen conferenties gevonden voor deze zoekopdracht.'}
        </p>
      ) : view === 'agenda' ? (
        <AgendaView conferences={visible} range={agendaRange} />
      ) : view === 'map' ? (
        <WorldMap conferences={visible} favorites={favorites.ids} />
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
                  favorite={favoriteFor(c)}
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
                  favorite={favoriteFor(c)}
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
