'use client';
// Eigenaar: C. Wie heeft interesse / heeft het bijgewoond, met hun sterren, plus reviews (component van D).
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ContributionGate } from '@/components/auth/ContributionGate';
import { useEffect, useState, type FormEvent } from 'react';
import { Reviews } from '@/components/reviews/Reviews';
import type {
  AttendanceStatus,
  AttendancesResponse,
  Conference,
  CreateAttendanceRequest,
  ErrorResponse,
} from '@/lib/types';
import { formatDate } from './format';
import { StarInput, Stars } from './Stars';

const COMMENT_MAX = 1000;

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  interested: 'Geïnteresseerd',
  attended: 'Bijgewoond',
};

const FIELD =
  'border-hairline bg-surface text-ink focus:ring-signal w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none';

type Props = {
  conference: Conference;
  /** Wordt aangeroepen na een geslaagde aanmelding, zodat tellingen elders ververst worden. */
  onChanged: () => void;
  /** Onder elkaar i.p.v. twee kolommen (voor smalle kaarten). */
  stacked?: boolean;
};

export function ConferenceCommunity({ conference: c, onChanged, stacked = false }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const canAttend = c.start_date <= today;

  const [data, setData] = useState<AttendancesResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  // Paneel rendert alleen client-side (na klik), dus localStorage is hier beschikbaar.
  const { data: session } = useSession();
  const name = session?.user.name ?? '';
  const [status, setStatus] = useState<AttendanceStatus>('interested');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/attendances?conferenceId=${encodeURIComponent(c.id)}`)
      .then(async (res) => {
        const body = (await res.json()) as AttendancesResponse | ErrorResponse;
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
  }, [c.id, reload]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    setNotice(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setSubmitError('Vul je naam in.');
      return;
    }
    const body: CreateAttendanceRequest = {
      conferenceId: c.id,
      status,
      ...(status === 'attended' && rating > 0 ? { rating, comment: comment.trim() || null } : {}),
    };
    setSubmitting(true);
    try {
      const res = await fetch('/api/attendances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as ErrorResponse | null;
        setSubmitError(err?.error ?? `HTTP ${res.status}`);
        return;
      }
      setNotice(
        status === 'attended'
          ? rating > 0
            ? `Bedankt ${trimmed}! Je bent als bezoeker toegevoegd met ${rating} ${rating === 1 ? 'ster' : 'sterren'}.`
            : `Bedankt ${trimmed}! Je bent als bezoeker toegevoegd.`
          : `Bedankt ${trimmed}! Je staat op de lijst als geïnteresseerd.`,
      );
      setRating(0);
      setComment('');
      setReload((n) => n + 1);
      onChanged();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Netwerkfout');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={`border-hairline bg-void/50 grid gap-6 border-t p-4 ${stacked ? '' : 'md:grid-cols-2'}`}
    >
      {/* Deelnemers */}
      <section aria-label={`Deelnemers van ${c.name}`}>
        <h3 className="text-ink-soft mb-2 font-mono text-sm">
          $ who --conference{' '}
          <span className="text-ink-muted">
            · {data ? `${data.interested} geïnteresseerd, ${data.attended} bijgewoond` : '…'}
          </span>
        </h3>

        {loadError ? (
          <p className="text-alert font-mono text-xs">✗ deelnemers niet beschikbaar: {loadError}</p>
        ) : !data ? (
          <p className="text-ink-muted font-mono text-xs">laden…</p>
        ) : data.items.length === 0 ? (
          <p className="text-ink-muted text-sm">Nog niemand. Wees de eerste!</p>
        ) : (
          <ul className="divide-hairline border-hairline bg-surface mb-4 divide-y rounded-md border">
            {data.items.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate font-semibold">
                  {a.person_name}
                  {a.user_id === null ? ' · legacy' : ''}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {a.rating !== null ? <Stars value={a.rating} /> : null}
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[11px] font-semibold ${
                      a.status === 'attended'
                        ? 'bg-signal-glow text-signal'
                        : 'bg-glass text-ink-soft'
                    }`}
                  >
                    {a.status === 'attended' ? '✓ bijgewoond' : '☆ interesse'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Aanmelden */}
        <ContributionGate>
          <form
            onSubmit={submit}
            className="border-hairline bg-surface space-y-3 rounded-md border p-3"
          >
            <p className="font-display text-sm font-semibold">Meld je aan</p>
            <p className="text-ink-soft text-sm">
              Ingelogd als <strong>{name}</strong>
            </p>
            <fieldset>
              <legend className="text-ink-muted mb-1 font-mono text-xs">--status</legend>
              <div className="border-hairline flex rounded-md border p-0.5">
                {(['interested', 'attended'] as const).map((s) => {
                  const disabled = s === 'attended' && !canAttend;
                  return (
                    <label
                      key={s}
                      className={`flex-1 rounded px-3 py-1.5 text-center text-sm transition-colors ${
                        status === s ? 'bg-signal text-white' : 'text-ink-soft'
                      } ${disabled ? 'cursor-not-allowed opacity-40' : 'hover:text-ink cursor-pointer'} has-[:focus-visible]:ring-signal has-[:focus-visible]:ring-2`}
                    >
                      <input
                        type="radio"
                        name={`status-${c.id}`}
                        value={s}
                        checked={status === s}
                        disabled={disabled}
                        onChange={() => setStatus(s)}
                        className="sr-only"
                      />
                      {STATUS_LABELS[s]}
                    </label>
                  );
                })}
              </div>
              {!canAttend ? (
                <p className="text-ink-muted mt-1 font-mono text-[11px]">
                  &quot;Bijgewoond&quot; kan vanaf {formatDate(c.start_date)}.
                </p>
              ) : null}
            </fieldset>

            {status === 'attended' ? (
              <div className="space-y-2">
                <p className="text-ink-muted font-mono text-xs">--rating (optioneel)</p>
                <StarInput value={rating} onChange={setRating} label="Jouw rating" />
                {rating > 0 ? (
                  <label className="text-ink-muted flex flex-col gap-1 font-mono text-xs">
                    --review (optioneel)
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      maxLength={COMMENT_MAX}
                      rows={3}
                      placeholder="Wat vond je ervan?"
                      className={FIELD}
                    />
                  </label>
                ) : null}
              </div>
            ) : null}

            {submitError ? (
              <p role="alert" className="text-alert text-sm">
                {submitError}
              </p>
            ) : null}
            {notice ? (
              <p aria-live="polite" className="text-adopt text-sm">
                ✓ {notice}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <p className="text-ink-muted font-mono text-[11px]">
                Gekoppeld aan je Microsoft-account
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="bg-signal rounded-md px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {submitting ? 'Opslaan…' : 'Aanmelden'}
              </button>
            </div>
          </form>
        </ContributionGate>
      </section>

      {/* Reviews (component van D); key ververst na een aanmelding met rating. */}
      <section aria-label={`Reviews van ${c.name}`}>
        <h3 className="text-ink-soft mb-2 font-mono text-sm">$ cat reviews.md</h3>
        <Reviews key={reload} conferenceId={c.id} />
        <p className="border-hairline mt-4 border-t pt-3 text-sm">
          <Link
            href={`/ervaringen?conference=${encodeURIComponent(c.id)}`}
            className="text-signal font-semibold hover:underline"
          >
            📝 Verslagen en foto&apos;s van {c.name} →
          </Link>
        </p>
      </section>
    </div>
  );
}
