'use client';
// Eigenaar: D. Compacte review-component; C importeert deze later in de explorer:
//   import { Reviews } from '@/components/reviews/Reviews';
//   <Reviews conferenceId={conference.id} />
import { useEffect, useState, type FormEvent } from 'react';
import type { Conference, ErrorResponse, Review, ReviewsResponse } from '@/lib/types';

const NAME_MAX = 80;
const COMMENT_MAX = 1000;

function Stars({ value, label }: { value: number; label: string }) {
  const rounded = Math.round(value);
  return (
    <span aria-label={label} title={label} className="text-amber-500">
      {'★'.repeat(rounded)}
      <span className="text-black/20 dark:text-white/20">{'★'.repeat(5 - rounded)}</span>
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
            <span>
              {data.averageRating.toFixed(1)} · {data.count}{' '}
              {data.count === 1 ? 'review' : 'reviews'}
            </span>
          </>
        ) : (
          <span className="text-black/60 dark:text-white/60">
            {loadError
              ? `Reviews niet beschikbaar: ${loadError}`
              : data
                ? 'Nog geen reviews'
                : 'Laden…'}
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="ml-auto rounded border border-black/20 px-2 py-0.5 text-xs dark:border-white/25"
        >
          {open ? 'Sluiten' : 'Review schrijven'}
        </button>
      </div>

      {open && (
        <form
          onSubmit={submit}
          className="space-y-2 rounded border border-black/10 p-3 dark:border-white/15"
        >
          <fieldset>
            <legend className="text-xs">Rating</legend>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} ${n === 1 ? 'ster' : 'sterren'}`}
                  aria-pressed={rating === n}
                  onClick={() => setRating(n)}
                  className={`text-xl ${n <= rating ? 'text-amber-500' : 'text-black/20 dark:text-white/20'}`}
                >
                  ★
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="text-xs">Naam</span>
            <input
              required
              maxLength={NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded border border-black/20 bg-transparent px-2 py-1 dark:border-white/25"
            />
          </label>
          <label className="block">
            <span className="text-xs">
              Review (optioneel, max. {COMMENT_MAX} tekens) — {comment.length}/{COMMENT_MAX}
            </span>
            <textarea
              maxLength={COMMENT_MAX}
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mt-1 block w-full rounded border border-black/20 bg-transparent px-2 py-1 dark:border-white/25"
            />
          </label>
          {submitError && (
            <p role="alert" className="text-red-600">
              {submitError}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-black px-3 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {submitting ? 'Opslaan…' : 'Review opslaan'}
          </button>
        </form>
      )}

      {data && data.items.length > 0 && (
        <ul className="space-y-2">
          {data.items.map((r) => (
            <li key={r.id} className="rounded border border-black/10 p-2 dark:border-white/15">
              <div className="flex flex-wrap items-center gap-2">
                <Stars value={r.rating} label={`${r.rating} van 5`} />
                <span className="font-medium">{r.reviewer_name}</span>
                <span className="text-xs text-black/50 dark:text-white/50">
                  {r.created_at.slice(0, 10)}
                </span>
              </div>
              {r.comment && <p className="mt-1 whitespace-pre-line">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-black/50 dark:text-white/50">
        Reviews zijn door gebruikers ingevoerde demo-input, geen geverifieerde of onafhankelijke
        beoordelingen.
      </p>
    </div>
  );
}
