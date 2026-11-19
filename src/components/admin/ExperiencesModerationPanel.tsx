'use client';
// Moderatie van gedeelde ervaringen (roadmap #3): bekijken en verwijderen, inclusief foto's.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BTN_SECONDARY, CARD, PROMPT } from '@/components/admin/styles';
import type { ErrorResponse, Experience, ListResponse } from '@/lib/types';

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as ErrorResponse | null;
  return body?.error ?? `HTTP ${res.status}`;
}

export function ExperiencesModerationPanel({ token }: { token: string }) {
  const [items, setItems] = useState<Experience[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/experiences')
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res));
        const list = ((await res.json()) as ListResponse<Experience>).items;
        if (!cancelled) setItems(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Laden mislukt');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function remove(e: Experience) {
    setError(null);
    setNotice(null);
    setBusyId(e.id);
    try {
      const res = await fetch(`/api/admin/experiences/${e.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      setItems((prev) => prev?.filter((x) => x.id !== e.id) ?? null);
      setNotice(`✓ "${e.title}" en ${e.photos.length} foto('s) verwijderd.`);
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <p className={PROMPT}>$ ls ./ervaringen --moderate</p>
        <h2 className="font-display mt-1 text-xl font-semibold">Ervaringen modereren</h2>
        <p className="text-ink-soft mt-1 max-w-2xl text-sm">
          Gedeelde verslagen en foto&apos;s zijn openbaar en zonder login geplaatst. Verwijder
          ongepaste inhoud; foto&apos;s worden dan ook uit de opslag gewist.
        </p>
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

      {!items ? (
        error ? null : (
          <p className="text-ink-muted font-mono text-xs">laden…</p>
        )
      ) : items.length === 0 ? (
        <p className="text-ink-muted font-mono text-xs">Nog geen ervaringen gedeeld.</p>
      ) : (
        <ul className={`${CARD} divide-hairline divide-y p-0`}>
          {items.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <Link
                  href={`/ervaringen?id=${e.id}`}
                  className="font-display block truncate font-semibold hover:underline"
                >
                  {e.title}
                </Link>
                <p className="text-ink-muted font-mono text-[11px]">
                  {e.conference_name} · door {e.author_name} · {e.photos.length} foto(&apos;s) ·{' '}
                  {e.created_at.slice(0, 10)}
                </p>
              </div>
              {confirmId === e.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-alert font-mono text-xs">Zeker weten?</span>
                  <button
                    type="button"
                    className={`${BTN_SECONDARY} text-alert`}
                    disabled={!token || busyId === e.id}
                    onClick={() => remove(e)}
                  >
                    {busyId === e.id ? '…' : 'ja, verwijder'}
                  </button>
                  <button
                    type="button"
                    className={BTN_SECONDARY}
                    onClick={() => setConfirmId(null)}
                  >
                    nee
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  disabled={!token}
                  onClick={() => setConfirmId(e.id)}
                  aria-label={`Verwijder "${e.title}"`}
                >
                  ✕ verwijderen
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
