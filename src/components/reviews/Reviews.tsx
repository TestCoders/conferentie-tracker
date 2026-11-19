'use client';
// Eigenaar: D. Compacte review-component; C importeert deze later in de explorer:
//   import { Reviews } from '@/components/reviews/Reviews';
//   <Reviews conferenceId={conference.id} />
import { useEffect, useState, type FormEvent } from 'react';
import { BTN_PRIMARY, BTN_SECONDARY, FIELD, FIELD_LABEL } from '@/components/admin/styles';
import type { Conference, ErrorResponse, Review, ReviewsResponse } from '@/lib/types';

const NAME_MAX = 80;
const COMMENT_MAX = 1000;

function Stars({ value, label }: { value: number; label: string }) {
  const rounded = Math.round(value);
  return (
    <span role="img" aria-label={label} title={label} className="text-assess tracking-tight">
      {'★'.repeat(rounded)}
      <span className="text-hairline">{'★'.repeat(5 - rounded)}</span>
    </span>
  );
}

export function Reviews({ conferenceId }: { conferenceId: Conference['id'] }) {
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reviews?conferenceId=${encodeURIComponent(conferenceId)}`)
      .then(async (res) => {
        const body = (await res.json()) as ReviewsResponse | ErrorResponse;
        if (cancelled) return;
        if (!res.ok || 'error' in body) {
          setLoadError('error' in body ? body.error : `HTTP ${res.status}`);
          return;
        }
        setLoadError(null);
        setData(body);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Netwerkfout');
      });
    return () => {
      cancelled = true;
    };
  }, [conferenceId]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (rating < 1) {
      setSubmitError('Kies een rating van 1 t/m 5 sterren.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conferenceId,
          reviewerName: name,
          rating,
          comment: comment || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ErrorResponse | null;
        setSubmitError(body?.error ?? `HTTP ${res.status}`);
        return;
      }
      const created = (await res.json()) as Review;
      setName('');
      setRating(0);
      setComment('');
      setOpen(false);
      setData((prev) => {
        const items = [created, ...(prev?.items ?? [])];
        const total = (prev?.averageRating ?? 0) * (prev?.count ?? 0) + created.rating;
        const count = (prev?.count ?? 0) + 1;
        return { items, count, averageRating: Math.round((total / count) * 10) / 10 };
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Netwerkfout');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {data && data.averageRating !== null ? (
          <>
            <Stars value={data.averageRating} label={`Gemiddeld ${data.averageRating} van 5`} />
            <span className="font-display font-semibold">{data.averageRating.toFixed(1)}</span>
            <span className="text-ink-muted font-mono text-xs">
              ({data.count} {data.count === 1 ? 'review' : 'reviews'})
            </span>
          </>
        ) : (
          <span className="text-ink-muted font-mono text-xs">
            {loadError
              ? `✗ reviews niet beschikbaar: ${loadError}`
              : data
                ? 'nog geen reviews'
                : 'laden…'}
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`${BTN_SECONDARY} ml-auto`}
        >
          {open ? '✕ Sluiten' : '✎ Review schrijven'}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="border-hairline bg-void space-y-3 rounded-md border p-3">
          <fieldset className={FIELD_LABEL}>
            <legend className="mb-1">--rating</legend>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} ${n === 1 ? 'ster' : 'sterren'}`}
                  aria-pressed={rating === n}
                  onClick={() => setRating(n)}
                  className={`focus-visible:ring-signal rounded text-2xl leading-none transition-colors focus-visible:ring-2 focus-visible:outline-none ${n <= rating ? 'text-assess' : 'text-ink-muted/40 hover:text-assess/60'}`}
                >
                  ★
                </button>
              ))}
            </div>
          </fieldset>
          <label className={FIELD_LABEL}>
            --naam
            <input
              required
              maxLength={NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={FIELD}
            />
          </label>
          <label className={FIELD_LABEL}>
            <span>
              --review (optioneel) · {comment.length}/{COMMENT_MAX}
            </span>
            <textarea
              maxLength={COMMENT_MAX}
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className={FIELD}
            />
          </label>
          {submitError && (
            <p role="alert" className="text-alert font-mono text-xs">
              ✗ {submitError}
            </p>
          )}
          <button type="submit" disabled={submitting} className={BTN_PRIMARY}>
            {submitting ? 'Opslaan…' : 'Review opslaan'}
          </button>
        </form>
      )}

      {data && data.items.length > 0 && (
        <ul className="divide-hairline border-hairline divide-y rounded-md border">
          {data.items.map((r) => (
            <li key={r.id} className="px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Stars value={r.rating} label={`${r.rating} van 5`} />
                <span className="font-semibold">{r.reviewer_name}</span>
                <span className="text-ink-muted font-mono text-xs">
                  {r.created_at.slice(0, 10)}
                </span>
              </div>
              {r.comment && <p className="text-ink-soft mt-1 whitespace-pre-line">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}

      <p className="text-ink-muted font-mono text-[11px]">
        # Reviews zijn door gebruikers ingevoerde demo-input, geen geverifieerde of onafhankelijke
        beoordelingen.
      </p>
    </div>
  );
}
