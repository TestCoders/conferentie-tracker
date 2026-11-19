'use client';
// Kostenaannames per land beheren (roadmap #4). Gebruikt het admin-token uit AdminPanel (React state).
import { useEffect, useMemo, useState } from 'react';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD,
  FIELD,
  FIELD_LABEL,
  PROMPT,
} from '@/components/admin/styles';
import { countryKey, formatEuro } from '@/lib/costs';
import type {
  Conference,
  CostAssumption,
  ErrorResponse,
  ListResponse,
  UpsertCostAssumptionRequest,
} from '@/lib/types';

type Row = {
  key: string;
  label: string;
  conferences: number;
  assumption: CostAssumption | null;
};

type Draft = { travel: string; hotel: string };

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as ErrorResponse | null;
  return body?.error ?? `HTTP ${res.status}`;
}

const AMOUNT_FIELD = `${FIELD} w-28 text-right`;

export function CostAssumptionsPanel({ token }: { token: string }) {
  const [assumptions, setAssumptions] = useState<CostAssumption[] | null>(null);
  const [conferences, setConferences] = useState<Conference[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [newCountry, setNewCountry] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadAssumptions() {
    const res = await fetch('/api/cost-assumptions');
    if (!res.ok) throw new Error(await readError(res));
    setAssumptions(((await res.json()) as ListResponse<CostAssumption>).items);
  }

  useEffect(() => {
    let cancelled = false;
    fetch('/api/cost-assumptions')
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res));
        const items = ((await res.json()) as ListResponse<CostAssumption>).items;
        if (!cancelled) setAssumptions(items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Laden mislukt');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadCountries() {
    setError(null);
    const res = await fetch('/api/admin/conferences', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setError(await readError(res));
      return;
    }
    setConferences(((await res.json()) as ListResponse<Conference>).items);
  }

  const rows = useMemo<Row[]>(() => {
    const byKey = new Map<string, Row>();
    for (const c of conferences ?? []) {
      const key = countryKey(c.country);
      if (!key || !c.country) continue;
      const row = byKey.get(key) ?? { key, label: c.country, conferences: 0, assumption: null };
      row.conferences += 1;
      byKey.set(key, row);
    }
    for (const a of assumptions ?? []) {
      const row = byKey.get(a.country_key) ?? {
        key: a.country_key,
        label: a.country_label,
        conferences: 0,
        assumption: null,
      };
      row.assumption = a;
      row.label = a.country_label;
      byKey.set(a.country_key, row);
    }
    return [...byKey.values()].sort(
      (a, b) => b.conferences - a.conferences || a.label.localeCompare(b.label),
    );
  }, [conferences, assumptions]);

  const withoutCountry = (conferences ?? []).filter((c) => !countryKey(c.country)).length;

  function draftFor(row: Row): Draft {
    return (
      drafts[row.key] ?? {
        travel: row.assumption ? String(row.assumption.travel_eur) : '',
        hotel: row.assumption ? String(row.assumption.hotel_per_night_eur) : '',
      }
    );
  }

  function setDraft(key: string, patch: Partial<Draft>, base: Draft) {
    setDrafts((prev) => ({ ...prev, [key]: { ...base, ...prev[key], ...patch } }));
  }

  async function save(label: string, key: string, draft: Draft) {
    setError(null);
    setNotice(null);
    const travelEur = Number(draft.travel);
    const hotelPerNightEur = Number(draft.hotel);
    if (draft.travel === '' || draft.hotel === '') {
      setError(`Vul reis en hotel in voor ${label}.`);
      return;
    }
    if (!Number.isInteger(travelEur) || !Number.isInteger(hotelPerNightEur)) {
      setError('Gebruik hele euro’s, zonder komma.');
      return;
    }
    setBusyKey(key);
    try {
      const res = await fetch('/api/admin/cost-assumptions', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: label,
          travelEur,
          hotelPerNightEur,
        } satisfies UpsertCostAssumptionRequest),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      await loadAssumptions();
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setNotice(`✓ Aanname voor ${label} opgeslagen.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan mislukt');
    } finally {
      setBusyKey(null);
    }
  }

  async function remove(row: Row) {
    setError(null);
    setNotice(null);
    setBusyKey(row.key);
    try {
      const res = await fetch(
        `/api/admin/cost-assumptions?country=${encodeURIComponent(row.label)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      await loadAssumptions();
      setNotice(`✓ Aanname voor ${row.label} verwijderd.`);
    } finally {
      setBusyKey(null);
    }
  }

  const newKey = countryKey(newCountry);
  const newDraft = drafts['__new__'] ?? { travel: '', hotel: '' };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={PROMPT}>$ vi ./kosten/aannames.csv</p>
          <h2 className="font-display mt-1 text-xl font-semibold">Kostenaannames per land</h2>
          <p className="text-ink-soft mt-1 max-w-2xl text-sm">
            Reis retour vanuit Nederland en hotel per nacht, per persoon in hele euro’s. De explorer
            schat daarmee: reis + hotel × aantal conferentiedagen. Zonder aanname blijft het{' '}
            <em>Onbekend</em>; de ticketprijs komt later via de AI-koppeling (roadmap #1).
          </p>
        </div>
        <button type="button" className={BTN_SECONDARY} onClick={loadCountries} disabled={!token}>
          ↻ Landen uit conferenties laden
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-alert font-mono text-sm">
          ✗ {error}
        </p>
      ) : null}
      {notice ? (
        <p aria-live="polite" className="text-adopt font-mono text-sm">
          {notice}
        </p>
      ) : null}

      {!conferences && !token ? (
        <p className="text-ink-muted font-mono text-xs">
          Vul eerst het admin-token in om landen te laden en aannames te bewerken.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div className={`${CARD} overflow-x-auto p-0`}>
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-hairline text-ink-muted border-b font-mono text-xs">
                <th scope="col" className="px-4 py-2 font-normal">
                  land
                </th>
                <th scope="col" className="px-2 py-2 text-right font-normal">
                  conferenties
                </th>
                <th scope="col" className="px-2 py-2 text-right font-normal">
                  reis retour (€)
                </th>
                <th scope="col" className="px-2 py-2 text-right font-normal">
                  hotel / nacht (€)
                </th>
                <th scope="col" className="px-4 py-2">
                  <span className="sr-only">Acties</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const draft = draftFor(row);
                const dirty =
                  !row.assumption ||
                  draft.travel !== String(row.assumption.travel_eur) ||
                  draft.hotel !== String(row.assumption.hotel_per_night_eur);
                return (
                  <tr key={row.key} className="border-hairline border-b last:border-0">
                    <th scope="row" className="px-4 py-2 font-semibold">
                      {row.label}
                      {row.assumption ? null : (
                        <span className="text-ink-muted ml-2 font-mono text-[11px] font-normal">
                          geen aanname
                        </span>
                      )}
                    </th>
                    <td className="text-ink-soft px-2 py-2 text-right font-mono text-xs">
                      {row.conferences}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        inputMode="numeric"
                        aria-label={`Reis retour naar ${row.label} in euro`}
                        value={draft.travel}
                        onChange={(e) => setDraft(row.key, { travel: e.target.value }, draft)}
                        className={AMOUNT_FIELD}
                        disabled={!token}
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        inputMode="numeric"
                        aria-label={`Hotel per nacht in ${row.label} in euro`}
                        value={draft.hotel}
                        onChange={(e) => setDraft(row.key, { hotel: e.target.value }, draft)}
                        className={AMOUNT_FIELD}
                        disabled={!token}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className={BTN_SECONDARY}
                          disabled={!token || !dirty || busyKey === row.key}
                          onClick={() => save(row.label, row.key, draft)}
                        >
                          {busyKey === row.key ? '…' : 'opslaan'}
                        </button>
                        {row.assumption ? (
                          <button
                            type="button"
                            className={BTN_SECONDARY}
                            disabled={!token || busyKey === row.key}
                            onClick={() => remove(row)}
                            aria-label={`Aanname voor ${row.label} verwijderen`}
                          >
                            ✕
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {conferences && withoutCountry > 0 ? (
        <p className="text-ink-muted font-mono text-xs">
          {withoutCountry} {withoutCountry === 1 ? 'conferentie heeft' : 'conferenties hebben'} geen
          land; die krijgen geen schatting tot het land bekend is (bijv. via de AI-koppeling).
        </p>
      ) : null}

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (newKey) void save(newCountry.trim(), newKey, newDraft);
        }}
      >
        <label className={FIELD_LABEL}>
          --ander-land
          <input
            value={newCountry}
            onChange={(e) => setNewCountry(e.target.value)}
            maxLength={80}
            placeholder="Bijv. Portugal"
            className={FIELD}
            disabled={!token}
          />
        </label>
        <label className={FIELD_LABEL}>
          --reis
          <input
            inputMode="numeric"
            value={newDraft.travel}
            onChange={(e) => setDraft('__new__', { travel: e.target.value }, newDraft)}
            className={AMOUNT_FIELD}
            disabled={!token}
          />
        </label>
        <label className={FIELD_LABEL}>
          --hotel
          <input
            inputMode="numeric"
            value={newDraft.hotel}
            onChange={(e) => setDraft('__new__', { hotel: e.target.value }, newDraft)}
            className={AMOUNT_FIELD}
            disabled={!token}
          />
        </label>
        <button type="submit" className={BTN_PRIMARY} disabled={!token || !newKey}>
          + Toevoegen
        </button>
        {newKey && newDraft.travel && newDraft.hotel ? (
          <span className="text-ink-muted font-mono text-xs">
            voorbeeld 3 dagen: {formatEuro(Number(newDraft.travel) + Number(newDraft.hotel) * 3)}
          </span>
        ) : null}
      </form>
    </section>
  );
}
