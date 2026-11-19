'use client';
// Eigenaar: D. Eén beheerregel: status wijzigen en beperkte correcties (ADMIN_EDITABLE_FIELDS).
import { useState, type FormEvent } from 'react';
import type { Conference, ConferencePatch, ConferenceStatus } from '@/lib/types';

type Props = {
  conference: Conference;
  onUpdate: (id: string, patch: ConferencePatch) => Promise<string | null>;
};

const STATUS_STYLES: Record<ConferenceStatus, string> = {
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
};

const inputClass =
  'mt-1 block w-full rounded border border-black/20 bg-transparent px-2 py-1 text-sm dark:border-white/25';

function unknown(value: string | null): string {
  return value ?? 'Onbekend';
}

export function ConferenceRow({ conference: c, onUpdate }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: '', city: '', country: '', cfp_deadline: '' });

  async function apply(patch: ConferencePatch): Promise<boolean> {
    setBusy(true);
    setError(null);
    const err = await onUpdate(c.id, patch);
    setBusy(false);
    if (err) setError(err);
    return err === null;
  }

  function startEdit() {
    setDraft({
      name: c.name,
      city: c.city ?? '',
      country: c.country ?? '',
      cfp_deadline: c.cfp_deadline ?? '',
    });
    setError(null);
    setEditing(true);
  }

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ok = await apply({
      name: draft.name,
      city: draft.city.trim() || null,
      country: draft.country.trim() || null,
      cfp_deadline: draft.cfp_deadline || null,
    });
    if (ok) setEditing(false);
  }

  const location = [c.city, c.country].filter(Boolean).join(', ') || 'Onbekend';
  const dates =
    c.end_date && c.end_date !== c.start_date ? `${c.start_date} – ${c.end_date}` : c.start_date;

  return (
    <li className="space-y-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={c.official_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline-offset-2 hover:underline"
            >
              {c.name}
            </a>
            <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLES[c.status]}`}>
              {c.status}
            </span>
          </div>
          <p className="text-sm text-black/70 dark:text-white/70">
            {dates} · {location} · {c.category} · CFP: {unknown(c.cfp_deadline)}
          </p>
          <p className="text-xs text-black/50 dark:text-white/50">
            Bron:{' '}
            <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="underline">
              {c.source_name}
            </a>{' '}
            · laatst gecontroleerd {c.last_checked_at.slice(0, 16).replace('T', ' ')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {c.status !== 'approved' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => apply({ status: 'approved' })}
              className="rounded bg-green-700 px-3 py-1 text-sm text-white disabled:opacity-50"
            >
              Goedkeuren
            </button>
          )}
          {c.status !== 'rejected' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => apply({ status: 'rejected' })}
              className="rounded bg-red-700 px-3 py-1 text-sm text-white disabled:opacity-50"
            >
              Afwijzen
            </button>
          )}
          {!editing && (
            <button
              type="button"
              disabled={busy}
              onClick={startEdit}
              className="rounded border border-black/20 px-3 py-1 text-sm disabled:opacity-50 dark:border-white/25"
            >
              Corrigeren
            </button>
          )}
        </div>
      </div>

      {editing && (
        <form onSubmit={saveEdit} className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs">Naam</span>
            <input
              className={inputClass}
              required
              maxLength={200}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-xs">Stad</span>
            <input
              className={inputClass}
              maxLength={100}
              value={draft.city}
              onChange={(e) => setDraft({ ...draft, city: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-xs">Land</span>
            <input
              className={inputClass}
              maxLength={100}
              value={draft.country}
              onChange={(e) => setDraft({ ...draft, country: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-xs">CFP-deadline (leeg = onbekend)</span>
            <input
              type="date"
              className={inputClass}
              value={draft.cfp_deadline}
              onChange={(e) => setDraft({ ...draft, cfp_deadline: e.target.value })}
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              Opslaan
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(false)}
              className="rounded border border-black/20 px-3 py-1 text-sm dark:border-white/25"
            >
              Annuleren
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </li>
  );
}
