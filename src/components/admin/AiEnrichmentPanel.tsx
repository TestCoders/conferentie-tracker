'use client';
// AI-verrijking starten (OpenRouter): kostenaannames per land verversen en conferenties aanvullen.
import { useState } from 'react';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD,
  FIELD,
  FIELD_LABEL,
  PROMPT,
} from '@/components/admin/styles';
import type { EnrichRequest, EnrichResponse, EnrichTarget, ErrorResponse } from '@/lib/types';

const LABELS: Record<EnrichTarget, string> = {
  costs: 'Kostenaannames per land',
  conferences: 'Conferenties aanvullen',
};

export function AiEnrichmentPanel({ token }: { token: string }) {
  const [limit, setLimit] = useState(6);
  const [running, setRunning] = useState<EnrichTarget | null>(null);
  const [result, setResult] = useState<EnrichResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(target: EnrichTarget) {
    setRunning(target);
    setError(null);
    setResult(null);
    try {
      const body: EnrichRequest = target === 'conferences' ? { target, limit } : { target };
      const res = await fetch('/api/admin/enrich', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as EnrichResponse | ErrorResponse | null;
      if (!res.ok || !json || 'error' in json) {
        setError(json && 'error' in json ? json.error : `HTTP ${res.status}`);
        return;
      }
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Netwerkfout');
    } finally {
      setRunning(null);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <p className={PROMPT}>$ ./ai-verrijking --run</p>
        <h2 className="font-display mt-1 text-xl font-semibold">AI-verrijking</h2>
        <p className="text-ink-soft mt-1 max-w-2xl text-sm">
          Een AI-model (via OpenRouter) schat per land ruwe reis- en hotelkosten vanuit Nederland en
          haalt ontbrekende gegevens (land, online, ticketprijs, CFP) van de officiële websites.
          Elke run ververst de waarden, ook eerder handmatig ingevulde; in de explorer staan ze als{' '}
          <em>AI-schatting</em> met datum. Gratis modellen: max. 50 verzoeken per dag.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <button
          type="button"
          className={BTN_PRIMARY}
          onClick={() => run('costs')}
          disabled={!token || running !== null}
        >
          {running === 'costs' ? 'Bezig…' : '▶ Aannames per land verversen'}
        </button>
        <label className={FIELD_LABEL}>
          --aantal
          <select
            className={FIELD}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {[3, 6, 9, 12].map((n) => (
              <option key={n} value={n}>
                {n} conferenties ({Math.ceil(n / 3)} AI-verzoek{n > 3 ? 'en' : ''})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={BTN_SECONDARY}
          onClick={() => run('conferences')}
          disabled={!token || running !== null}
        >
          {running === 'conferences' ? 'Bezig…' : '▶ Conferenties aanvullen'}
        </button>
      </div>
      <p className="text-ink-muted font-mono text-xs">
        Conferenties: eerst nog nooit gecontroleerde, daarna het langst geleden. Herhaal de run tot
        &quot;nog niet gecontroleerd&quot; 0 is.
      </p>

      {error ? (
        <p role="alert" className="text-alert font-mono text-sm">
          ✗ {error}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-3" aria-live="polite">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ['verwerkt', result.processed, 'text-ink'],
                ['bijgewerkt', result.updated, 'text-adopt'],
                ['AI-verzoeken', result.requests, 'text-signal'],
                result.remaining !== null
                  ? ['nog niet gecontroleerd', result.remaining, 'text-assess']
                  : [
                      'meldingen',
                      result.errors.length,
                      result.errors.length ? 'text-alert' : 'text-ink',
                    ],
              ] as const
            ).map(([label, value, color]) => (
              <div key={label} className={CARD}>
                <dt className="text-ink-muted font-mono text-xs">{label}</dt>
                <dd className={`font-display mt-1 text-3xl font-bold ${color}`}>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-ink-muted font-mono text-xs">
            <span className="text-adopt">✓</span> {LABELS[result.target]} · model:{' '}
            {result.model ?? 'onbekend'}
          </p>
          {result.errors.length > 0 ? (
            <details className="text-ink-soft font-mono text-xs">
              <summary className="cursor-pointer">{result.errors.length} meldingen</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
