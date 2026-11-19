'use client';
// Eigenaar: D. Token alleen in React state — niet in URL, localStorage of source code.
import { useState } from 'react';
import { ConferenceRow } from '@/components/admin/ConferenceRow';
import { AiEnrichmentPanel } from '@/components/admin/AiEnrichmentPanel';
import { CostAssumptionsPanel } from '@/components/admin/CostAssumptionsPanel';
import { ExperiencesModerationPanel } from '@/components/admin/ExperiencesModerationPanel';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD,
  FIELD,
  FIELD_LABEL,
  PROMPT,
} from '@/components/admin/styles';
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
  { value: 'confs-tech-past', label: 'confs.tech — afgelopen 12 maanden' },
  { value: 'testing-conferences-past', label: 'TestingConferences.org — afgelopen 12 maanden' },
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
    <div className="space-y-10">
      <section className={`${CARD} space-y-2`}>
        <label className={FIELD_LABEL}>
          --admin-token
          <input
            type="password"
            className={FIELD}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            placeholder="Plak hier het ADMIN_TOKEN"
          />
        </label>
        <p className="text-ink-muted text-xs">
          Het token blijft alleen in deze pagina (React state) en verdwijnt bij herladen.
        </p>
      </section>

      <section className="space-y-4">
        <div>
          <p className={PROMPT}>$ ./discovery --run</p>
          <h2 className="font-display mt-1 text-xl font-semibold">Discovery</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className={FIELD_LABEL}>
            --bron
            <select
              className={FIELD}
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
            className={BTN_PRIMARY}
            onClick={runDiscovery}
            disabled={!token || running}
          >
            {running ? 'Bezig…' : '▶ Run discovery'}
          </button>
        </div>

        {runError && (
          <p role="alert" className="text-alert font-mono text-sm">
            ✗ Discovery mislukt: {runError}
          </p>
        )}
        {result && (
          <div className="space-y-3" aria-live="polite">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ['found', result.found, 'text-ink'],
                  ['inserted', result.inserted, 'text-adopt'],
                  ['updated', result.updated, 'text-signal'],
                  [
                    'errors',
                    result.errors.length,
                    result.errors.length ? 'text-alert' : 'text-ink',
                  ],
                ] as const
              ).map(([label, value, color]) => (
                <div key={label} className={CARD}>
                  <dt className="text-ink-muted font-mono text-xs">{label}</dt>
                  <dd className={`font-display mt-1 text-3xl font-bold ${color}`}>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-ink-muted font-mono text-xs">
              <span className="text-adopt">✓</span> bron: {result.source}
            </p>
            {result.errors.length > 0 && (
              <ul className="text-alert list-disc space-y-1 pl-5 font-mono text-xs">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className={PROMPT}>$ ls ./conferenties --all</p>
            <h2 className="font-display mt-1 text-xl font-semibold">Conferenties</h2>
          </div>
          <button
            type="button"
            className={BTN_SECONDARY}
            onClick={loadConferences}
            disabled={!token || loading}
          >
            {loading ? 'Laden…' : items ? '↻ Vernieuwen' : '↓ Laden'}
          </button>
        </div>

        {listError && (
          <p role="alert" className="text-alert font-mono text-sm">
            ✗ Laden mislukt: {listError}
          </p>
        )}

        {items && (
          <>
            <div
              className="border-hairline bg-surface flex w-fit flex-wrap rounded-md border p-0.5"
              role="group"
              aria-label="Filter op status"
            >
              {(['all', ...CONFERENCE_STATUSES] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={filter === s}
                  onClick={() => setFilter(s)}
                  className={`rounded px-3 py-1.5 font-mono text-xs transition-colors ${
                    filter === s ? 'bg-signal text-white' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {s === 'all' ? `alle (${items.length})` : `${s} (${counts[s]})`}
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <p className="text-ink-muted">Geen conferenties.</p>
            ) : (
              <ul className="divide-hairline border-hairline bg-surface divide-y overflow-hidden rounded-md border">
                {visible.map((c) => (
                  <ConferenceRow key={c.id} conference={c} onUpdate={updateConference} />
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <AiEnrichmentPanel token={token} />

      <CostAssumptionsPanel token={token} />

      <ExperiencesModerationPanel token={token} />
    </div>
  );
}
