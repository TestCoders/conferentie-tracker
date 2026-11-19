'use client';
// Eigenaar: D. Token alleen in React state — niet in URL, localStorage of source code.
import { useState } from 'react';
import { ConferenceRow } from '@/components/admin/ConferenceRow';
import {
  CONFERENCE_STATUSES,
  type Conference,
  type ConferencePatch,
  type ConferenceStatus,
  type DiscoveryRunResponse,
  type DiscoverySource,
  type ErrorResponse,
  type ListResponse,
} from '@/lib/types';

type StatusFilter = ConferenceStatus | 'all';

const SOURCES: { value: DiscoverySource; label: string }[] = [
  { value: 'confs-tech', label: 'confs.tech' },
  { value: 'testing-conferences', label: 'TestingConferences.org' },
];

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as ErrorResponse | null;
  return body?.error ?? `HTTP ${res.status}`;
}

export function AdminPanel() {
  const [token, setToken] = useState('');
  const [source, setSource] = useState<DiscoverySource>('confs-tech');
  const [result, setResult] = useState<DiscoveryRunResponse | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const [items, setItems] = useState<Conference[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('all');

  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function loadConferences() {
    setLoading(true);
    setListError(null);
    try {
      const res = await fetch('/api/admin/conferences', { headers: authHeaders });
      if (!res.ok) {
        setListError(await readError(res));
        return;
      }
      setItems(((await res.json()) as ListResponse<Conference>).items);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Netwerkfout');
    } finally {
      setLoading(false);
    }
  }

  async function runDiscovery() {
    setRunning(true);
    setRunError(null);
    setResult(null);
    try {
      const res = await fetch('/api/discovery/run', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ source }),
      });
      if (!res.ok) {
        setRunError(await readError(res));
        return;
      }
      setResult((await res.json()) as DiscoveryRunResponse);
      await loadConferences();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Netwerkfout');
    } finally {
      setRunning(false);
    }
  }

  /** Geeft null terug bij succes, anders een foutmelding. */
  async function updateConference(id: string, patch: ConferencePatch): Promise<string | null> {
    try {
      const res = await fetch(`/api/admin/conferences/${id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify(patch),
      });
      if (!res.ok) return await readError(res);
      const updated = (await res.json()) as Conference;
      setItems((prev) => prev?.map((c) => (c.id === id ? updated : c)) ?? null);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Netwerkfout';
    }
  }

  const counts = Object.fromEntries(
    CONFERENCE_STATUSES.map((s) => [s, items?.filter((c) => c.status === s).length ?? 0]),
  ) as Record<ConferenceStatus, number>;
  const visible = items?.filter((c) => filter === 'all' || c.status === filter) ?? [];

  return (
    <div className="space-y-8">
      <section className="space-y-3 rounded-lg border border-black/10 p-4 dark:border-white/15">
        <label className="block">
          <span className="text-sm font-medium">Admin-token</span>
          <input
            type="password"
            className="mt-1 block w-full rounded border border-black/20 bg-transparent px-2 py-1 dark:border-white/25"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
          />
        </label>
        <p className="text-xs text-black/60 dark:text-white/60">
          Het token blijft alleen in deze pagina (React state) en verdwijnt bij herladen.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Discovery</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-sm">Bron</span>
            <select
              className="mt-1 block rounded border border-black/20 bg-transparent px-2 py-1 dark:border-white/25"
              value={source}
              onChange={(e) => setSource(e.target.value as DiscoverySource)}
            >
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
            onClick={runDiscovery}
            disabled={!token || running}
          >
            {running ? 'Bezig…' : 'Run discovery'}
          </button>
        </div>

        {runError && (
          <p role="alert" className="text-sm text-red-600">
            Discovery mislukt: {runError}
          </p>
        )}
        {result && (
          <div className="space-y-2">
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ['Gevonden', result.found],
                  ['Nieuw', result.inserted],
                  ['Bijgewerkt', result.updated],
                  ['Fouten', result.errors.length],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="rounded border border-black/10 p-3 dark:border-white/15"
                >
                  <dt className="text-xs text-black/60 dark:text-white/60">{label}</dt>
                  <dd className="text-2xl font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-black/60 dark:text-white/60">Bron: {result.source}</p>
            {result.errors.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-red-600">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Conferenties</h2>
          <button
            type="button"
            className="rounded border border-black/20 px-3 py-1 text-sm disabled:opacity-50 dark:border-white/25"
            onClick={loadConferences}
            disabled={!token || loading}
          >
            {loading ? 'Laden…' : items ? 'Vernieuwen' : 'Laden'}
          </button>
        </div>

        {listError && (
          <p role="alert" className="text-sm text-red-600">
            Laden mislukt: {listError}
          </p>
        )}

        {items && (
          <>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter op status">
              {(['all', ...CONFERENCE_STATUSES] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={filter === s}
                  onClick={() => setFilter(s)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    filter === s
                      ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                      : 'border-black/20 dark:border-white/25'
                  }`}
                >
                  {s === 'all' ? `Alle (${items.length})` : `${s} (${counts[s]})`}
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <p className="text-sm text-black/60 dark:text-white/60">Geen conferenties.</p>
            ) : (
              <ul className="divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/15 dark:border-white/15">
                {visible.map((c) => (
                  <ConferenceRow key={c.id} conference={c} onUpdate={updateConference} />
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
