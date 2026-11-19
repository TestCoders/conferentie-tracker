'use client';
// Ervaringen: verslagen en foto's van conferenties delen en bekijken (roadmap #3).
// URL-parameters: ?id=<ervaring> (deelbaar detail), ?conference=<id> (filter), ?share=1 (formulier).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Stars } from '@/components/explorer/Stars';
import type { ErrorResponse, Experience, ExperienceConference, ListResponse } from '@/lib/types';
import { ExperienceCard } from './ExperienceCard';
import { ExperienceDetail } from './ExperienceDetail';
import { ExperienceForm } from './ExperienceForm';
import { PhotoLightbox, type LightboxPhoto } from './PhotoLightbox';

type Tab = 'reports' | 'photos';

const FIELD =
  'border-hairline bg-surface text-ink focus:ring-signal rounded-md border px-3 py-2 font-sans text-sm focus:ring-2 focus:outline-none';
const FIELD_LABEL = 'text-ink-muted flex flex-col gap-1 font-mono text-xs';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ErrorResponse | null;
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export function ExperiencesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selectedId = params.get('id');
  const conferenceFilter = params.get('conference') ?? '';
  const sharing = params.get('share') === '1';

  const [items, setItems] = useState<Experience[] | null>(null);
  const [conferences, setConferences] = useState<ExperienceConference[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('reports');
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getJson<ListResponse<Experience>>('/api/experiences'),
      getJson<ListResponse<ExperienceConference>>('/api/experiences/conferences'),
    ])
      .then(([exp, confs]) => {
        if (cancelled) return;
        setItems(exp.items);
        setConferences(confs.items);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Laden mislukt');
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const navigate = useCallback(
    (next: Record<string, string | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === '') sp.delete(k);
        else sp.set(k, v);
      }
      const qs = sp.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: true });
    },
    [params, pathname, router],
  );

  const visible = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    return items.filter(
      (e) =>
        (!conferenceFilter || e.conference_id === conferenceFilter) &&
        (!q ||
          [e.title, e.conference_name, e.summary, e.author_name, e.conference_city ?? '']
            .join(' ')
            .toLowerCase()
            .includes(q)),
    );
  }, [items, query, conferenceFilter]);

  const photoWall = useMemo<(LightboxPhoto & { experienceId: string; id: string })[]>(
    () =>
      visible.flatMap((e) =>
        e.photos.map((p) => ({
          id: p.id,
          url: p.url,
          caption: p.caption,
          credit: `${e.author_name} · ${e.conference_name}`,
          experienceId: e.id,
        })),
      ),
    [visible],
  );

  const filterConference = conferences.find((c) => c.id === conferenceFilter);
  const stats = useMemo(() => {
    if (!visible.length) return null;
    const avg = visible.reduce((s, e) => s + e.rating, 0) / visible.length;
    return { count: visible.length, avg: Math.round(avg * 10) / 10 };
  }, [visible]);

  if (error) {
    return (
      <p role="alert" className="text-alert">
        Kon ervaringen niet laden: {error}
      </p>
    );
  }
  if (!items) return <p aria-live="polite">Laden…</p>;

  const selected = selectedId ? items.find((e) => e.id === selectedId) : null;
  if (selectedId && selected) {
    return <ExperienceDetail experience={selected} onBack={() => navigate({ id: null })} />;
  }

  if (sharing) {
    return (
      <ExperienceForm
        conferences={conferences}
        initialConferenceId={conferenceFilter || null}
        onCancel={() => navigate({ share: null })}
        onDone={(id) => {
          setVersion((n) => n + 1);
          navigate({ share: null, id });
        }}
      />
    );
  }

  return (
    <div>
      {selectedId && !selected ? (
        <p role="alert" className="text-alert mb-4 text-sm">
          Deze ervaring bestaat niet (meer).
        </p>
      ) : null}

      <div className="border-hairline bg-void/90 sticky top-[61px] z-[5] -mx-4 mb-4 border-b px-4 py-3 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className={`${FIELD_LABEL} min-w-48 flex-1`}>
            --zoek
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Titel, conferentie, auteur…"
              className={FIELD}
            />
          </label>
          <label className={FIELD_LABEL}>
            --conferentie
            <select
              value={conferenceFilter}
              onChange={(e) => navigate({ conference: e.target.value || null })}
              className={`${FIELD} max-w-64`}
            >
              <option value="">Alle conferenties</option>
              {conferences.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.start_date.slice(0, 4)})
                </option>
              ))}
            </select>
          </label>
          <div className={FIELD_LABEL}>
            <span id="tab-label">--weergave</span>
            <div
              role="group"
              aria-labelledby="tab-label"
              className="border-hairline bg-surface flex rounded-md border p-0.5"
            >
              {(
                [
                  ['reports', '📝 Verslagen'],
                  ['photos', "📷 Foto's"],
                ] as const
              ).map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tab === t}
                  onClick={() => setTab(t)}
                  className={`rounded px-3 py-1.5 font-sans text-sm transition-colors ${
                    tab === t ? 'bg-signal text-white' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate({ share: '1' })}
            className="bg-signal rounded-md px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            ＋ Deel je ervaring
          </button>
        </div>
        <p
          className="text-ink-muted mt-2 flex flex-wrap items-center gap-x-2 font-mono text-xs"
          aria-live="polite"
        >
          <span className="text-adopt">✓</span>
          {tab === 'reports'
            ? `${visible.length} ${visible.length === 1 ? 'ervaring' : 'ervaringen'}`
            : `${photoWall.length} foto's`}
          {filterConference ? ` over ${filterConference.name}` : ''}
          {stats && tab === 'reports' ? (
            <>
              <span>· gemiddeld</span>
              <Stars value={stats.avg} />
              <span>{stats.avg.toFixed(1)}</span>
            </>
          ) : null}
        </p>
      </div>

      {tab === 'reports' ? (
        visible.length === 0 ? (
          <EmptyState
            onShare={() => navigate({ share: '1' })}
            filtered={Boolean(query || conferenceFilter)}
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((e) => (
              <li key={e.id}>
                <ExperienceCard experience={e} onOpen={() => navigate({ id: e.id })} />
              </li>
            ))}
          </ul>
        )
      ) : photoWall.length === 0 ? (
        <EmptyState
          onShare={() => navigate({ share: '1' })}
          filtered={Boolean(query || conferenceFilter)}
          photos
        />
      ) : (
        <ul className="columns-2 gap-2 sm:columns-3 lg:columns-4">
          {photoWall.map((p, i) => (
            <li key={p.id} className="mb-2 break-inside-avoid">
              <button
                type="button"
                onClick={() => setLightbox(i)}
                className="focus-visible:ring-signal group relative block w-full overflow-hidden rounded-md focus-visible:ring-2 focus-visible:outline-none"
                aria-label={`Bekijk foto${p.caption ? `: ${p.caption}` : ''} (${p.credit})`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- door gebruikers geüploade foto uit Supabase Storage */}
                <img src={p.url} alt={p.caption ?? ''} loading="lazy" className="w-full" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left text-[11px] text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                  {p.caption ? <span className="block">{p.caption}</span> : null}
                  <span className="font-mono opacity-80">{p.credit}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {lightbox !== null ? (
        <PhotoLightbox
          photos={photoWall}
          index={lightbox}
          onIndexChange={setLightbox}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </div>
  );
}

function EmptyState({
  onShare,
  filtered,
  photos = false,
}: {
  onShare: () => void;
  filtered: boolean;
  photos?: boolean;
}) {
  return (
    <div className="border-hairline bg-surface rounded-md border border-dashed p-8 text-center">
      <p className="font-display text-lg font-semibold">
        {filtered
          ? `Geen ${photos ? "foto's" : 'ervaringen'} gevonden.`
          : `Nog geen ${photos ? "foto's" : 'ervaringen'} gedeeld.`}
      </p>
      <p className="text-ink-soft mt-1 text-sm">
        Was je bij een conferentie? Help collega&apos;s met je verslag, tips en foto&apos;s.
      </p>
      <button
        type="button"
        onClick={onShare}
        className="bg-signal mt-4 rounded-md px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        ＋ Deel je ervaring
      </button>
    </div>
  );
}
