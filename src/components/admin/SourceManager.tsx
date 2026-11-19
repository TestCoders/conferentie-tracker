'use client';
// Eigenaar: D. Eigen discoverybronnen toevoegen/verwijderen. Data en API-calls zitten in AdminPanel.
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
  CUSTOM_SOURCE_FORMATS,
  type CreateCustomSourceRequest,
  type CustomDiscoverySource,
  type CustomSourceFormat,
} from '@/lib/types';

export const FORMAT_LABELS: Record<CustomSourceFormat, string> = {
  'confs-tech-json': 'confs.tech JSON',
  'testing-conferences-yaml': 'TestingConferences YAML',
};

type Props = {
  sources: CustomDiscoverySource[] | null;
  loading: boolean;
  error: string | null;
  disabled: boolean;
  onLoad: () => void;
  /** Geeft null terug bij succes, anders een foutmelding. */
  onCreate: (input: CreateCustomSourceRequest) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
};

export function SourceManager({
  sources,
  loading,
  error,
  disabled,
  onLoad,
  onCreate,
  onDelete,
}: Props) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<CustomSourceFormat>('confs-tech-json');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const failure = await onCreate({ name, url, format });
    setSaving(false);
    if (failure) {
      setFormError(failure);
      return;
    }
    setName('');
    setUrl('');
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
            Voeg een publieke https-feed toe in hetzelfde formaat als confs.tech (JSON-array) of
            TestingConferences.org (YAML-lijst). De import gebruikt exact dezelfde verwerking als de
            vaste bronnen.
          </p>
          <p className="text-ink-muted mt-1 max-w-2xl text-xs">
            Kosten: reis en hotel worden geschat uit het land (eigen aanname of standaardaanname),
            online conferenties kosten € 0. Feeds bevatten geen ticketprijzen; die haalt de
            AI-verrijking van de officiële website (of vul je in via ✎ Corrigeren). Conferenties die
            de AI nog nooit controleerde gaan daarbij voor. Na een run zie je hoeveel records een
            schatting krijgen.
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

      <form onSubmit={submit} className={`${CARD} grid gap-3 sm:grid-cols-[1fr_2fr_auto_auto]`}>
        <label className={FIELD_LABEL}>
          --naam
          <input
            className={FIELD}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
            placeholder="bijv. confs.tech python 2027"
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
            placeholder="https://raw.githubusercontent.com/…/python.json"
          />
        </label>
        <label className={FIELD_LABEL}>
          --formaat
          <select
            className={FIELD}
            value={format}
            onChange={(e) => setFormat(e.target.value as CustomSourceFormat)}
          >
            {CUSTOM_SOURCE_FORMATS.map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABELS[f]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" className={BTN_PRIMARY} disabled={disabled || saving}>
            {saving ? 'Opslaan…' : '+ Toevoegen'}
          </button>
        </div>
      </form>

      {formError && (
        <p role="alert" className="text-alert font-mono text-sm">
          ✗ Toevoegen mislukt: {formError}
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
                <div className="min-w-0">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-ink-muted font-mono text-xs break-all">
                    {FORMAT_LABELS[s.format]} ·{' '}
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-ink underline"
                    >
                      {s.url}
                    </a>
                  </p>
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
