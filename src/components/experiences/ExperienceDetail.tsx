'use client';
// Volledig verslag: kerngegevens, verslag, highlights, tips, links en foto's.
import { useState } from 'react';
import { CATEGORY_LABELS } from '@/components/explorer/format';
import { Stars } from '@/components/explorer/Stars';
import type { Experience } from '@/lib/types';
import { WOULD_RETURN_LABELS, WOULD_RETURN_STYLES, formatLongDate } from './labels';
import { PhotoLightbox } from './PhotoLightbox';

type Props = { experience: Experience; onBack: () => void };

export function ExperienceDetail({ experience: e, onBack }: Props) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const when = formatLongDate(e.conference_date);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Klembord niet beschikbaar; de URL in de adresbalk werkt ook.
    }
  }

  return (
    <article className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-ink-soft hover:text-ink font-mono text-sm"
        >
          ← alle ervaringen
        </button>
        <button
          type="button"
          onClick={copyLink}
          className="border-hairline bg-glass text-ink-soft hover:text-ink rounded-md border px-3 py-1.5 font-mono text-xs"
        >
          {copied ? '✓ link gekopieerd' : '🔗 deel link'}
        </button>
      </div>

      <header className="space-y-3">
        <p className="text-signal font-mono text-sm">
          $ cat ./ervaringen/{e.conference_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md
        </p>
        <h2 className="font-display text-3xl font-bold">{e.title}</h2>
        <p className="text-ink-soft">
          <span className="font-semibold">{e.conference_name}</span>
          {when ? ` · ${when}` : ''}
          {e.conference_city ? ` · ${e.conference_city}` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Stars value={e.rating} size="text-lg" />
          <span
            className={`rounded px-2 py-0.5 font-mono text-xs font-semibold ${WOULD_RETURN_STYLES[e.would_return]}`}
          >
            {WOULD_RETURN_LABELS[e.would_return]}
          </span>
          {e.recommended_for.map((c) => (
            <span key={c} className="bg-glass text-ink-soft rounded px-2 py-0.5 font-mono text-xs">
              aanrader voor {CATEGORY_LABELS[c].toLowerCase()}
            </span>
          ))}
        </div>
        <p className="text-ink-muted font-mono text-xs">
          door {e.author_name} · gedeeld op {formatLongDate(e.created_at)} · demo-input, geen
          geverifieerde review
        </p>
      </header>

      <p className="border-signal bg-surface rounded-md border-l-4 p-4 text-lg">{e.summary}</p>

      {e.photos.length ? (
        <section aria-label="Foto's">
          <h3 className="text-ink-soft mb-2 font-mono text-sm">$ ls ./fotos ({e.photos.length})</h3>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {e.photos.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setLightbox(i)}
                  className="focus-visible:ring-signal block w-full overflow-hidden rounded-md focus-visible:ring-2 focus-visible:outline-none"
                  aria-label={`Bekijk foto ${i + 1}${p.caption ? `: ${p.caption}` : ''}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- door gebruikers geüploade foto uit Supabase Storage */}
                  <img
                    src={p.url}
                    alt={p.caption ?? ''}
                    loading="lazy"
                    className="aspect-square w-full object-cover transition hover:scale-105"
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {e.report ? (
            <section>
              <h3 className="text-ink-soft mb-2 font-mono text-sm">$ cat verslag.md</h3>
              <div className="text-ink space-y-3 leading-relaxed whitespace-pre-line">
                {e.report}
              </div>
            </section>
          ) : null}
          {e.highlights.length ? (
            <section>
              <h3 className="text-ink-soft mb-2 font-mono text-sm">$ grep -i highlight</h3>
              <ul className="space-y-1">
                {e.highlights.map((h, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-adopt" aria-hidden="true">
                      ✓
                    </span>
                    {h}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        <aside className="space-y-6">
          {e.tips ? (
            <section className="border-hairline bg-surface rounded-md border p-4">
              <h3 className="font-display mb-2 font-semibold">Praktische tips</h3>
              <p className="text-ink-soft text-sm whitespace-pre-line">{e.tips}</p>
            </section>
          ) : null}
          {e.links.length ? (
            <section className="border-hairline bg-surface rounded-md border p-4">
              <h3 className="font-display mb-2 font-semibold">Links</h3>
              <ul className="space-y-1 text-sm">
                {e.links.map((l) => (
                  <li key={l} className="truncate">
                    <a
                      href={l}
                      target="_blank"
                      rel="noopener noreferrer nofollow ugc"
                      className="text-signal hover:underline"
                    >
                      {l.replace(/^https:\/\//, '')}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      {lightbox !== null ? (
        <PhotoLightbox
          photos={e.photos.map((p) => ({ url: p.url, caption: p.caption }))}
          index={lightbox}
          onIndexChange={setLightbox}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </article>
  );
}
