'use client';
// Eigenaar: D. Eén beheerregel: status wijzigen en beperkte correcties (ADMIN_EDITABLE_FIELDS).
import { useState, type FormEvent } from 'react';
import { BTN_PRIMARY, BTN_SECONDARY, FIELD, FIELD_LABEL } from '@/components/admin/styles';
import { formatEuro } from '@/lib/costs';
import type { Conference, ConferencePatch, ConferenceStatus } from '@/lib/types';

type Props = {
  conference: Conference;
  onUpdate: (id: string, patch: ConferencePatch) => Promise<string | null>;
};

const STATUS_STYLES: Record<ConferenceStatus, string> = {
  approved: 'bg-glass text-adopt',
  pending: 'bg-glass text-assess',
  rejected: 'bg-glass text-alert',
};

const BADGE = 'rounded px-2 py-0.5 font-mono text-[11px] font-semibold';
const BTN_ACTION =
  'rounded-md px-3 py-1.5 font-mono text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40';

function Unknown({ value }: { value: string | null }) {
  return value ? <>{value}</> : <span className="text-ink-muted italic">Onbekend</span>;
}

export function ConferenceRow({ conference: c, onUpdate }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    city: '',
    country: '',
    cfp_deadline: '',
    ticket_price_eur: '',
    ticket_price_url: '',
  });

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
      ticket_price_eur: c.ticket_price_eur === null ? '' : String(c.ticket_price_eur),
      ticket_price_url: c.ticket_price_url ?? '',
    });
    setError(null);
    setEditing(true);
  }

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const price = draft.ticket_price_eur.trim();
    if (price !== '' && !/^\d+$/.test(price)) {
      setError('Ticketprijs: gebruik hele euro’s, zonder komma of valuta-teken.');
      return;
    }
    const ok = await apply({
      name: draft.name,
      city: draft.city.trim() || null,
      country: draft.country.trim() || null,
      cfp_deadline: draft.cfp_deadline || null,
      ticket_price_eur: price === '' ? null : Number(price),
      ticket_price_url: draft.ticket_price_url.trim() || null,
    });
    if (ok) setEditing(false);
  }

  const location = [c.city, c.country].filter(Boolean).join(', ') || null;
  const dates =
    c.end_date && c.end_date !== c.start_date ? `${c.start_date} – ${c.end_date}` : c.start_date;

  return (
    <li
      className={`space-y-3 px-4 py-3 transition-colors ${
        c.status === 'rejected' ? 'opacity-60' : 'hover:bg-glass/60'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={c.official_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-display hover:text-signal font-semibold hover:underline"
            >
              {c.name}
            </a>
            <span className={`${BADGE} ${STATUS_STYLES[c.status]}`}>{c.status}</span>
            <span className={`${BADGE} bg-signal-glow text-signal`}>{c.category}</span>
          </div>
          <p className="text-ink-soft text-sm">
            {dates} · <Unknown value={location} /> ·{' '}
            <span className="text-ink-muted font-mono text-xs">cfp:</span>{' '}
            <Unknown value={c.cfp_deadline} /> ·{' '}
            <span className="text-ink-muted font-mono text-xs">ticket:</span>{' '}
            {c.online_only ? (
              <span className="text-ink-muted font-mono text-xs">[online] </span>
            ) : null}
            {c.ticket_price_eur === null ? (
              <Unknown value={null} />
            ) : c.ticket_price_url ? (
              <a
                href={c.ticket_price_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {formatEuro(c.ticket_price_eur)} ↗
              </a>
            ) : (
              formatEuro(c.ticket_price_eur)
            )}
          </p>
          <p className="text-ink-muted font-mono text-xs">
            <a
              href={c.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              bron: {c.source_name}
            </a>{' '}
            · gecontroleerd {c.last_checked_at.slice(0, 16).replace('T', ' ')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {c.status !== 'approved' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => apply({ status: 'approved' })}
              className={`${BTN_ACTION} bg-adopt`}
            >
              ✓ Goedkeuren
            </button>
          )}
          {c.status !== 'rejected' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => apply({ status: 'rejected' })}
              className={`${BTN_ACTION} bg-alert`}
            >
              ✗ Afwijzen
            </button>
          )}
          {!editing && (
            <button type="button" disabled={busy} onClick={startEdit} className={BTN_SECONDARY}>
              ✎ Corrigeren
            </button>
          )}
        </div>
      </div>

      {editing && (
        <form
          onSubmit={saveEdit}
          className="border-hairline bg-void grid gap-3 rounded-md border p-3 sm:grid-cols-2"
        >
          <label className={`${FIELD_LABEL} sm:col-span-2`}>
            --naam
            <input
              className={FIELD}
              required
              maxLength={200}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className={FIELD_LABEL}>
            --stad
            <input
              className={FIELD}
              maxLength={100}
              value={draft.city}
              onChange={(e) => setDraft({ ...draft, city: e.target.value })}
            />
          </label>
          <label className={FIELD_LABEL}>
            --land
            <input
              className={FIELD}
              maxLength={100}
              value={draft.country}
              onChange={(e) => setDraft({ ...draft, country: e.target.value })}
            />
          </label>
          <label className={FIELD_LABEL}>
            --cfp-deadline (leeg = onbekend)
            <input
              type="date"
              className={FIELD}
              value={draft.cfp_deadline}
              onChange={(e) => setDraft({ ...draft, cfp_deadline: e.target.value })}
            />
          </label>
          <label className={FIELD_LABEL}>
            --ticketprijs-eur (officieel, per persoon; leeg = onbekend)
            <input
              inputMode="numeric"
              className={FIELD}
              maxLength={5}
              value={draft.ticket_price_eur}
              onChange={(e) => setDraft({ ...draft, ticket_price_eur: e.target.value })}
            />
          </label>
          <label className={FIELD_LABEL}>
            --ticket-bron (https-link naar de prijs op de officiële site)
            <input
              type="url"
              className={FIELD}
              maxLength={2000}
              pattern="https://.*"
              placeholder="https://…/tickets"
              value={draft.ticket_price_url}
              onChange={(e) => setDraft({ ...draft, ticket_price_url: e.target.value })}
            />
          </label>
          <div className="flex items-end gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className={BTN_PRIMARY}>
              Opslaan
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(false)}
              className={BTN_SECONDARY}
            >
              Annuleren
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="text-alert font-mono text-xs">
          ✗ {error}
        </p>
      )}
    </li>
  );
}
