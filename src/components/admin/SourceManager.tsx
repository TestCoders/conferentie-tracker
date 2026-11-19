'use client';
// Eigenaar: D. Eigen discoverybronnen: URL analyseren (formaat wordt automatisch herkend), voorbeeld
// bekijken, toevoegen of verwijderen. Data en API-calls zitten in AdminPanel.
import { useState, type FormEvent } from 'react';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD,
  FIELD,
  FIELD_LABEL,
  PROMPT,
} from '@/components/admin/styles';
import {
  CATEGORIES,
  type Category,
  type CreateCustomSourceRequest,
  type CustomDiscoverySource,
  type CustomSourceFormat,
  type MappedField,
  type SourceAnalysis,
} from '@/lib/types';

export const FORMAT_LABELS: Record<CustomSourceFormat, string> = {
  'confs-tech-json': 'JSON in confs.tech-formaat',
  'testing-conferences-yaml': 'YAML in TestingConferences-formaat',
  json: 'JSON-feed',
  yaml: 'YAML-feed',
  ical: 'iCalendar (.ics)',
  jsonld: 'Webpagina met schema.org-events',
  ai: 'Webpagina, uitgelezen door AI',
};

/** Formaten van de vaste bronnen: die houden hun eigen categorieregels. */
const OWN_CATEGORY_RULES: CustomSourceFormat[] = ['confs-tech-json', 'testing-conferences-yaml'];

const FIELD_LABELS: Record<MappedField, string> = {
  name: 'naam',
  url: 'website',
  startDate: 'begindatum',
  endDate: 'einddatum',
  dates: 'datums (tekst)',
  city: 'stad',
  country: 'land',
  location: 'locatie',
  online: 'online',
  cfpUrl: 'CFP-link',
  cfpDeadline: 'CFP-deadline',
  price: 'prijs',
};

type Props = {
  sources: CustomDiscoverySource[] | null;
  loading: boolean;
  error: string | null;
  disabled: boolean;
  onLoad: () => void;
  /** Geeft de analyse terug, of een foutmelding (string). */
  onAnalyze: (url: string) => Promise<SourceAnalysis | string>;
  /** Geeft null terug bij succes, anders een foutmelding. */
  onCreate: (input: CreateCustomSourceRequest) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
};

function mappingSummary(source: Pick<CustomDiscoverySource, 'config'>): string | null {
  const fields = source.config?.fields;
  if (!fields) return null;
  return Object.entries(fields)
    .map(([field, key]) => `${FIELD_LABELS[field as MappedField]} ← ${key}`)
    .join(' · ');
}

function Unknown({ value }: { value: string | null }) {
  return value ? <>{value}</> : <span className="text-ink-muted italic">Onbekend</span>;
}

export function SourceManager({
  sources,
  loading,
  error,
  disabled,
  onLoad,
  onAnalyze,
  onCreate,
  onDelete,
}: Props) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [analysis, setAnalysis] = useState<SourceAnalysis | null>(null);
  const [category, setCategory] = useState<Category>('development');
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Een gewijzigde URL vraagt een nieuwe analyse.
  const analyzed = analysis !== null && analysis.url === url.trim();

  async function analyze() {
    setAnalyzing(true);
    setFormError(null);
    setAnalysis(null);
    const outcome = await onAnalyze(url.trim());
    setAnalyzing(false);
    if (typeof outcome === 'string') {
      setFormError(outcome);
      return;
    }
    setAnalysis(outcome);
    setUrl(outcome.url);
    setCategory(outcome.defaultCategory);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!analyzed) {
      await analyze();
      return;
    }
    setSaving(true);
    setFormError(null);
    const failure = await onCreate({ name, url: url.trim(), defaultCategory: category });
    setSaving(false);
    if (failure) {
      setFormError(failure);
      return;
    }
    setName('');
    setUrl('');
    setAnalysis(null);
  }

  async function remove(source: CustomDiscoverySource) {
    if (!window.confirm(`Bron "${source.name}" verwijderen? Geïmporteerde conferenties blijven.`)) {
      return;
    }
    setDeletingId(source.id);
    setDeleteError(null);
    const failure = await onDelete(source.id);
    setDeletingId(null);
    if (failure) setDeleteError(failure);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={PROMPT}>$ ./discovery --sources</p>
          <h2 className="font-display mt-1 text-xl font-semibold">Eigen bronnen</h2>
          <p className="text-ink-muted mt-1 max-w-2xl text-sm">
            Voer een URL in en klik op <em>Analyseren</em>. Het formaat wordt per URL herkend: JSON,
            YAML, iCalendar, een webpagina met schema.org-events, of een gewone webpagina die de AI
            uitleest. Je ziet eerst een voorbeeld; daarna voeg je de bron toe.
          </p>
          <p className="text-ink-muted mt-1 max-w-2xl text-xs">
            Kosten: reis en hotel worden geschat uit het land (eigen aanname of standaardaanname),
            online conferenties kosten € 0. Ticketprijzen staan zelden in een bron; die haalt de
            AI-verrijking van de officiële website (of vul je in via ✎ Corrigeren).
          </p>
        </div>
        <button
          type="button"
          className={BTN_SECONDARY}
          onClick={onLoad}
          disabled={disabled || loading}
        >
          {loading ? 'Laden…' : sources ? '↻ Vernieuwen' : '↓ Laden'}
        </button>
      </div>

      <form onSubmit={submit} className={`${CARD} space-y-4`}>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <label className={FIELD_LABEL}>
            --naam
            <input
              className={FIELD}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
              placeholder="bijv. Testing events NL"
            />
          </label>
          <label className={FIELD_LABEL}>
            --url
            <input
              type="url"
              className={FIELD}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              maxLength={2000}
              required
              pattern="https://.*"
              placeholder="https://… (feed, .ics of webpagina)"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              className={BTN_SECONDARY}
              onClick={analyze}
              disabled={disabled || analyzing || !url.trim()}
            >
              {analyzing ? 'Analyseren…' : '🔍 Analyseren'}
            </button>
          </div>
        </div>

        {analyzed && analysis && (
          <div className="border-hairline space-y-3 border-t pt-3" aria-live="polite">
            <p className="font-mono text-xs">
              <span className="text-adopt">✓</span> formaat:{' '}
              <strong>{FORMAT_LABELS[analysis.format]}</strong> · {analysis.found}{' '}
              {analysis.found === 1 ? 'conferentie' : 'conferenties'} gevonden
              {analysis.errors.length > 0 && (
                <span className="text-signal"> · {analysis.errors.length}+ overgeslagen</span>
              )}
            </p>
            {mappingSummary(analysis) && (
              <p className="text-ink-muted font-mono text-xs break-words">
                velden: {mappingSummary(analysis)}
              </p>
            )}
            {analysis.pending && (
              <p className="text-signal font-mono text-xs">
                ⚠ Door de AI uitgelezen: nieuwe conferenties krijgen status pending en verschijnen
                pas na goedkeuring. Elke run kost een AI-verzoek.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="text-ink-muted font-mono text-xs">
                    <th scope="col" className="py-1 pr-3 font-normal">
                      naam
                    </th>
                    <th scope="col" className="py-1 pr-3 font-normal">
                      datum
                    </th>
                    <th scope="col" className="py-1 pr-3 font-normal">
                      locatie
                    </th>
                    <th scope="col" className="py-1 pr-3 font-normal">
                      categorie
                    </th>
                    <th scope="col" className="py-1 font-normal">
                      prijs
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.sample.map((c) => (
                    <tr key={`${c.canonical_url}|${c.start_date}`} className="align-top">
                      <td className="py-1 pr-3">
                        <a
                          href={c.official_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-signal hover:underline"
                        >
                          {c.name}
                        </a>
                      </td>
                      <td className="py-1 pr-3 font-mono text-xs">
                        {c.end_date && c.end_date !== c.start_date
                          ? `${c.start_date} – ${c.end_date}`
                          : c.start_date}
                      </td>
                      <td className="py-1 pr-3">
                        {c.online_only ? (
                          'online'
                        ) : (
                          <Unknown value={[c.city, c.country].filter(Boolean).join(', ') || null} />
                        )}
                      </td>
                      <td className="py-1 pr-3 font-mono text-xs">{c.category}</td>
                      <td className="py-1">
                        <Unknown value={c.price_text} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {analysis.errors.length > 0 && (
              <details className="text-ink-muted font-mono text-xs">
                <summary className="cursor-pointer">overgeslagen records</summary>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {analysis.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </details>
            )}
            <div className="flex flex-wrap items-end gap-3">
              {OWN_CATEGORY_RULES.includes(analysis.format) ? (
                <p className="text-ink-muted font-mono text-xs">
                  categorie: dezelfde regels als de vaste bron
                </p>
              ) : (
                <label className={FIELD_LABEL}>
                  --standaardcategorie (als de naam niets zegt)
                  <select
                    className={FIELD}
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Category)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="submit"
                className={BTN_PRIMARY}
                disabled={disabled || saving || !name.trim()}
              >
                {saving ? 'Opslaan…' : '+ Toevoegen'}
              </button>
            </div>
          </div>
        )}
      </form>

      {formError && (
        <p role="alert" className="text-alert font-mono text-sm">
          ✗ {formError}
        </p>
      )}
      {error && (
        <p role="alert" className="text-alert font-mono text-sm">
          ✗ Laden mislukt: {error}
        </p>
      )}
      {deleteError && (
        <p role="alert" className="text-alert font-mono text-sm">
          ✗ Verwijderen mislukt: {deleteError}
        </p>
      )}

      {sources &&
        (sources.length === 0 ? (
          <p className="text-ink-muted">Nog geen eigen bronnen.</p>
        ) : (
          <ul className="divide-hairline border-hairline bg-surface divide-y overflow-hidden rounded-md border">
            {sources.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-ink-muted font-mono text-xs break-all">
                    {FORMAT_LABELS[s.format] ?? s.format} · {s.default_category ?? 'development'} ·{' '}
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-ink underline"
                    >
                      {s.url}
                    </a>
                  </p>
                  {mappingSummary(s) && (
                    <p className="text-ink-muted font-mono text-[11px] break-words">
                      {mappingSummary(s)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  onClick={() => remove(s)}
                  disabled={disabled || deletingId === s.id}
                >
                  {deletingId === s.id ? 'Verwijderen…' : '✕ Verwijderen'}
                </button>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
