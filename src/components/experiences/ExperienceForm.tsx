'use client';
// Ervaring delen in twee stappen: 1) verslag opslaan, 2) foto's toevoegen (met eenmalig bewerktoken).
import { useState, type FormEvent } from 'react';
import { CATEGORY_LABELS } from '@/components/explorer/format';
import { StarInput } from '@/components/explorer/Stars';
import {
  CATEGORIES,
  WOULD_RETURN,
  type Category,
  type CreateExperienceRequest,
  type CreateExperienceResponse,
  type ErrorResponse,
  type Experience,
  type ExperienceConference,
  type WouldReturn,
} from '@/lib/types';
import { resizeImage, type ResizedImage } from './image-resize';
import { WOULD_RETURN_LABELS } from './labels';

const MAX_PHOTOS = 8;
const NAME_STORAGE_KEY = 'conference-tracker:name';
const OTHER = '__other__';

const FIELD =
  'border-hairline bg-surface text-ink focus:ring-signal w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none';
const LABEL = 'text-ink-muted flex flex-col gap-1 font-mono text-xs';
const HINT = 'text-ink-muted font-sans text-[11px]';

function savedName(): string {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as ErrorResponse | null;
  return body?.error ?? `HTTP ${res.status}`;
}

const lines = (value: string) =>
  value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

type Props = {
  conferences: ExperienceConference[];
  initialConferenceId?: string | null;
  onDone: (experienceId: string) => void;
  onCancel: () => void;
};

type PendingPhoto = ResizedImage & {
  key: string;
  name: string;
  caption: string;
  status: 'ready' | 'uploading' | 'done' | 'error';
  error?: string;
};

export function ExperienceForm({ conferences, initialConferenceId, onDone, onCancel }: Props) {
  const knownInitial = conferences.some((c) => c.id === initialConferenceId);
  const [conferenceChoice, setConferenceChoice] = useState(
    knownInitial && initialConferenceId ? initialConferenceId : conferences.length ? '' : OTHER,
  );
  const [conferenceName, setConferenceName] = useState('');
  const [conferenceDate, setConferenceDate] = useState('');
  const [conferenceCity, setConferenceCity] = useState('');
  const [authorName, setAuthorName] = useState(savedName);
  const [title, setTitle] = useState('');
  const [rating, setRating] = useState(0);
  const [wouldReturn, setWouldReturn] = useState<WouldReturn | ''>('');
  const [recommendedFor, setRecommendedFor] = useState<Category[]>([]);
  const [summary, setSummary] = useState('');
  const [report, setReport] = useState('');
  const [highlights, setHighlights] = useState('');
  const [tips, setTips] = useState('');
  const [links, setLinks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [created, setCreated] = useState<{ experience: Experience; token: string } | null>(null);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [consent, setConsent] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const isOther = conferenceChoice === OTHER;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!conferenceChoice) return setError('Kies een conferentie of kies "Andere conferentie".');
    if (rating < 1) return setError('Geef een rating van 1 t/m 5 sterren.');
    if (!wouldReturn) return setError('Geef aan of je weer zou gaan.');

    const body: CreateExperienceRequest = {
      ...(isOther
        ? {
            conferenceName,
            conferenceDate: conferenceDate || null,
            conferenceCity: conferenceCity || null,
          }
        : { conferenceId: conferenceChoice, conferenceDate: conferenceDate || null }),
      authorName,
      title,
      summary,
      report: report || null,
      rating,
      wouldReturn,
      recommendedFor,
      highlights: lines(highlights),
      tips: tips || null,
      links: lines(links),
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/experiences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return setError(await readError(res));
      const data = (await res.json()) as CreateExperienceResponse;
      try {
        localStorage.setItem(NAME_STORAGE_KEY, authorName.trim());
      } catch {
        // Naam onthouden is optioneel.
      }
      setCreated({ experience: data.experience, token: data.editToken });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Netwerkfout');
    } finally {
      setSubmitting(false);
    }
  }

  async function addFiles(files: FileList | null) {
    if (!files) return;
    setPhotoError(null);
    const room = MAX_PHOTOS - photos.length;
    const selected = [...files].slice(0, room);
    if (files.length > room) setPhotoError(`Maximaal ${MAX_PHOTOS} foto's per ervaring.`);
    for (const file of selected) {
      try {
        const resized = await resizeImage(file);
        setPhotos((prev) => [
          ...prev,
          { ...resized, key: crypto.randomUUID(), name: file.name, caption: '', status: 'ready' },
        ]);
      } catch (err) {
        setPhotoError(err instanceof Error ? err.message : 'Foto verwerken mislukt');
      }
    }
  }

  function updatePhoto(key: string, patch: Partial<PendingPhoto>) {
    setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  function removePhoto(key: string) {
    setPhotos((prev) => {
      const p = prev.find((x) => x.key === key);
      if (p) URL.revokeObjectURL(p.previewUrl);
      return prev.filter((x) => x.key !== key);
    });
  }

  async function uploadAll() {
    if (!created) return;
    setPhotoError(null);
    if (!consent) {
      setPhotoError('Bevestig dat herkenbare personen toestemming hebben gegeven.');
      return;
    }
    setUploading(true);
    let failed = 0;
    for (const p of photos) {
      if (p.status === 'done') continue;
      updatePhoto(p.key, { status: 'uploading', error: undefined });
      const form = new FormData();
      form.append('file', p.blob, `${p.key}.jpg`);
      form.append('caption', p.caption);
      form.append('consent', 'yes');
      form.append('width', String(p.width));
      form.append('height', String(p.height));
      try {
        const res = await fetch(`/api/experiences/${created.experience.id}/photos`, {
          method: 'POST',
          headers: { 'X-Edit-Token': created.token },
          body: form,
        });
        if (!res.ok) {
          failed += 1;
          updatePhoto(p.key, { status: 'error', error: await readError(res) });
        } else {
          updatePhoto(p.key, { status: 'done' });
        }
      } catch (err) {
        failed += 1;
        updatePhoto(p.key, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Netwerkfout',
        });
      }
    }
    setUploading(false);
    if (failed === 0) onDone(created.experience.id);
  }

  /* ---------- stap 2: foto's ---------- */
  if (created) {
    const pending = photos.filter((p) => p.status !== 'done').length;
    return (
      <section className="border-hairline bg-surface space-y-4 rounded-md border p-4">
        <p className="text-adopt font-mono text-sm">
          ✓ Je ervaring &quot;{created.experience.title}&quot; is gedeeld.
        </p>
        <div>
          <h2 className="font-display text-xl font-semibold">Foto&apos;s toevoegen (optioneel)</h2>
          <p className="text-ink-soft mt-1 text-sm">
            Maximaal {MAX_PHOTOS} foto&apos;s. Ze worden verkleind en locatiegegevens (GPS) worden
            verwijderd. Foto&apos;s toevoegen kan alleen nu, direct na het delen.
          </p>
        </div>

        <label className="border-hairline hover:bg-glass/60 focus-within:ring-signal flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed p-6 text-center focus-within:ring-2">
          <span className="text-2xl" aria-hidden="true">
            📷
          </span>
          <span className="font-semibold">Kies foto&apos;s</span>
          <span className={HINT}>JPEG, PNG of WebP · nog {MAX_PHOTOS - photos.length} over</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={photos.length >= MAX_PHOTOS || uploading}
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>

        {photos.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {photos.map((p) => (
              <li key={p.key} className="border-hairline space-y-2 rounded-md border p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- lokale preview (blob-URL) */}
                <img
                  src={p.previewUrl}
                  alt=""
                  className="aspect-square w-full rounded object-cover"
                />
                <input
                  value={p.caption}
                  onChange={(e) => updatePhoto(p.key, { caption: e.target.value })}
                  maxLength={200}
                  placeholder="Bijschrift (optioneel)"
                  aria-label={`Bijschrift voor ${p.name}`}
                  className={FIELD}
                  disabled={p.status === 'done' || uploading}
                />
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span
                    className={
                      p.status === 'done'
                        ? 'text-adopt'
                        : p.status === 'error'
                          ? 'text-alert'
                          : 'text-ink-muted'
                    }
                  >
                    {p.status === 'done'
                      ? '✓ geüpload'
                      : p.status === 'uploading'
                        ? 'uploaden…'
                        : p.status === 'error'
                          ? `✗ ${p.error}`
                          : `${Math.round(p.blob.size / 1024)} KB`}
                  </span>
                  {p.status !== 'done' && !uploading ? (
                    <button
                      type="button"
                      onClick={() => removePhoto(p.key)}
                      className="text-ink-soft hover:text-alert"
                      aria-label={`Verwijder ${p.name}`}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {photos.length ? (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-signal mt-1 size-4"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              Ik heb het recht om deze foto&apos;s te delen en herkenbare personen hebben
              toestemming gegeven. De foto&apos;s zijn openbaar zichtbaar.
            </span>
          </label>
        ) : null}

        {photoError ? (
          <p role="alert" className="text-alert text-sm">
            {photoError}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => onDone(created.experience.id)}
            disabled={uploading}
            className="border-hairline bg-glass text-ink-soft hover:text-ink rounded-md border px-4 py-2 text-sm disabled:opacity-40"
          >
            {photos.length && pending ? 'Overslaan' : 'Klaar'}
          </button>
          {pending ? (
            <button
              type="button"
              onClick={uploadAll}
              disabled={uploading}
              className="bg-signal rounded-md px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
            >
              {uploading ? 'Uploaden…' : `${pending} foto${pending === 1 ? '' : "'s"} uploaden`}
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  /* ---------- stap 1: verslag ---------- */
  return (
    <form onSubmit={submit} className="border-hairline bg-surface space-y-6 rounded-md border p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Deel je ervaring</h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-ink-soft hover:text-ink font-mono text-xs"
        >
          ✕ annuleren
        </button>
      </div>

      <fieldset className="space-y-3">
        <legend className="font-display mb-1 font-semibold">1. Welke conferentie?</legend>
        <label className={LABEL}>
          --conferentie
          <select
            value={conferenceChoice}
            onChange={(e) => setConferenceChoice(e.target.value)}
            className={FIELD}
            required
          >
            <option value="" disabled>
              Kies een conferentie…
            </option>
            {conferences.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.start_date.slice(0, 4)}
                {c.city ? `, ${c.city}` : ''})
              </option>
            ))}
            <option value={OTHER}>Andere / eerdere editie (zelf invullen)</option>
          </select>
          <span className={HINT}>
            Staat de editie die je bezocht niet in de lijst? Kies dan &quot;Andere&quot;.
          </span>
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          {isOther ? (
            <label className={`${LABEL} sm:col-span-1`}>
              --naam*
              <input
                value={conferenceName}
                onChange={(e) => setConferenceName(e.target.value)}
                maxLength={200}
                required
                placeholder="Bijv. TestBash Brighton"
                className={FIELD}
              />
            </label>
          ) : null}
          <label className={LABEL}>
            --datum
            <input
              type="date"
              value={conferenceDate}
              max={today}
              onChange={(e) => setConferenceDate(e.target.value)}
              className={FIELD}
            />
            <span className={HINT}>
              {isOther ? 'Eerste dag die je er was' : 'Leeg = begindatum'}
            </span>
          </label>
          {isOther ? (
            <label className={LABEL}>
              --stad
              <input
                value={conferenceCity}
                onChange={(e) => setConferenceCity(e.target.value)}
                maxLength={100}
                placeholder="Bijv. Brighton"
                className={FIELD}
              />
            </label>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-display mb-1 font-semibold">2. In het kort</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={LABEL}>
            --jouw-naam*
            <input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              maxLength={80}
              required
              autoComplete="name"
              placeholder="Publiek zichtbaar"
              className={FIELD}
            />
          </label>
          <label className={LABEL}>
            --titel*
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
              placeholder="Bijv. Veel geleerd over contract testing"
              className={FIELD}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-6">
          <div className={LABEL}>
            --rating*
            <StarInput value={rating} onChange={setRating} label="Totaalrating" />
          </div>
          <fieldset className={LABEL}>
            <legend className="mb-1">--weer-gaan*</legend>
            <div className="border-hairline flex rounded-md border p-0.5 font-sans">
              {WOULD_RETURN.map((w) => (
                <label
                  key={w}
                  className={`has-[:focus-visible]:ring-signal cursor-pointer rounded px-3 py-1.5 text-sm has-[:focus-visible]:ring-2 ${
                    wouldReturn === w ? 'bg-signal text-white' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  <input
                    type="radio"
                    name="would-return"
                    value={w}
                    checked={wouldReturn === w}
                    onChange={() => setWouldReturn(w)}
                    className="sr-only"
                  />
                  {WOULD_RETURN_LABELS[w]}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className={LABEL}>
            <legend className="mb-1">--aanrader-voor</legend>
            <div className="flex flex-wrap gap-3 font-sans text-sm">
              {CATEGORIES.map((c) => (
                <label key={c} className="text-ink flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="accent-signal size-4"
                    checked={recommendedFor.includes(c)}
                    onChange={(e) =>
                      setRecommendedFor((prev) =>
                        e.target.checked ? [...prev, c] : prev.filter((x) => x !== c),
                      )
                    }
                  />
                  {CATEGORY_LABELS[c]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <label className={LABEL}>
          --samenvatting*
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={500}
            required
            rows={2}
            placeholder="In twee zinnen: wat was het en wat vond je ervan?"
            className={FIELD}
          />
          <span className={HINT}>{summary.length}/500</span>
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-display mb-1 font-semibold">3. Het verslag (optioneel)</legend>
        <label className={LABEL}>
          --verslag
          <textarea
            value={report}
            onChange={(e) => setReport(e.target.value)}
            maxLength={8000}
            rows={8}
            placeholder={
              'Hoe was de sfeer, de organisatie, het niveau van de talks?\n\nLege regel = nieuwe alinea.'
            }
            className={FIELD}
          />
          <span className={HINT}>{report.length}/8000</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={LABEL}>
            --highlights
            <textarea
              value={highlights}
              onChange={(e) => setHighlights(e.target.value)}
              rows={4}
              placeholder={'Eén per regel, bijv.\nKeynote over AI in testing\nWorkshop Playwright'}
              className={FIELD}
            />
            <span className={HINT}>Beste talks of momenten · max. 10</span>
          </label>
          <label className={LABEL}>
            --tips
            <textarea
              value={tips}
              onChange={(e) => setTips(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Hotel, reizen, eten, welke dag het drukst is…"
              className={FIELD}
            />
            <span className={HINT}>Praktische tips voor collega&apos;s</span>
          </label>
        </div>
        <label className={LABEL}>
          --links
          <textarea
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            rows={2}
            placeholder={'https://… (slides, opnames, blog) · één per regel, max. 5'}
            className={FIELD}
          />
        </label>
      </fieldset>

      {error ? (
        <p role="alert" className="text-alert text-sm">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-muted font-mono text-[11px]">
          * verplicht · demo-input zonder login · alles wat je deelt is openbaar
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="bg-signal rounded-md px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
        >
          {submitting ? 'Delen…' : 'Delen en foto’s toevoegen →'}
        </button>
      </div>
    </form>
  );
}
