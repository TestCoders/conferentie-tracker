'use client';
// Eigenaar: C. Publiek overzicht: zoeken, filteren, sorteren en 2 conferenties vergelijken.
import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, type Category, type Conference, type ListResponse } from '@/lib/types';
import { CompareTable } from './CompareTable';
import { ConferenceCard } from './ConferenceCard';
import { CATEGORY_LABELS } from './format';

const MAX_COMPARE = 2;

type SortOrder = 'asc' | 'desc';

export function Explorer() {
  const [items, setItems] = useState<Conference[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
    const filtered = items.filter(
      (c) =>
        (category === 'all' || c.category === category) &&
        (q === '' || c.name.toLowerCase().includes(q)),
    );
    const direction = sortOrder === 'asc' ? 1 : -1;
    // 'YYYY-MM-DD' sorteert lexicografisch correct.
    return filtered.sort((a, b) => a.start_date.localeCompare(b.start_date) * direction);
  }, [items, query, category, sortOrder]);

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
      <p role="alert" className="text-red-600">
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
        <CompareTable conferences={[selected[0], selected[1]]} onClear={() => setSelectedIds([])} />
      ) : null}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          Zoek op naam
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Bijv. JSConf"
            className="rounded-md border border-black/15 bg-transparent px-3 py-2 font-normal dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Categorie
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category | 'all')}
            className="rounded-md border border-black/15 bg-transparent px-3 py-2 font-normal dark:border-white/20"
          >
            <option value="all">Alle ({items.length})</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]} ({counts[cat]})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Sorteer op begindatum
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="rounded-md border border-black/15 bg-transparent px-3 py-2 font-normal dark:border-white/20"
          >
            <option value="asc">Eerstvolgende eerst</option>
            <option value="desc">Laatste eerst</option>
          </select>
        </label>
      </div>

      <p className="mb-4 text-sm text-black/60 dark:text-white/60" aria-live="polite">
        {visible.length} van {items.length} conferenties
        {selected.length === 1 ? ' · selecteer nog 1 conferentie om te vergelijken' : ''}
      </p>

      {visible.length === 0 ? (
        <p>Geen conferenties gevonden voor deze zoekopdracht.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => {
            const isSelected = selectedIds.includes(c.id);
            return (
              <li key={c.id}>
                <ConferenceCard
                  conference={c}
                  selected={isSelected}
                  selectDisabled={!isSelected && selectedIds.length >= MAX_COMPARE}
                  onToggleSelect={toggleSelect}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
