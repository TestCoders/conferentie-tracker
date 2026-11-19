// Eigenaar: C. Kostenschatting tonen: totaal met uitleg van de berekening, of 'Onbekend'.
import { formatEuro, type CostEstimate } from '@/lib/costs';
import { UNKNOWN } from './format';

const shortDate = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "AI-schatting · 19 nov 2026" of null als de aanname van een beheerder komt. */
export function aiNote(e: CostEstimate): string | null {
  if (e.assumptionSource !== 'ai') return null;
  const d = e.assumptionDate ? shortDate.format(new Date(`${e.assumptionDate}T00:00:00Z`)) : null;
  return d ? `AI-schatting · ${d}` : 'AI-schatting';
}

/** Waar de reis-/hotelschatting op gebaseerd is, kort. */
export function basisNote(e: CostEstimate): string {
  if (e.basis === 'online') return 'online, geen reis';
  const ai = aiNote(e);
  if (e.basis === 'default') return ai ? `standaard, ${ai}` : 'standaardaanname';
  return ai ? `${e.countryLabel}, ${ai}` : `aanname ${e.countryLabel}`;
}

function ticketLabel(e: CostEstimate): string {
  if (!e.ticket) return 'ticket onbekend, niet meegeteld';
  return `ticket ${formatEuro(e.ticket.amount)} (${e.ticket.byAi ? 'door AI van de website' : 'officieel'})`;
}

/** Uitleg van de berekening, voor tooltip en schermlezer. */
export function costExplanation(e: CostEstimate): string {
  const ticket = ticketLabel(e);
  if (e.basis === 'online') {
    return `Online conferentie: geen reis- of hotelkosten; ${ticket}. Totaal ${formatEuro(e.total)}.`;
  }
  const ai = aiNote(e);
  const basis =
    (e.basis === 'default'
      ? 'standaardaanname, geen aanname voor dit land'
      : `aanname ${e.countryLabel}`) + (ai ? `, ${ai.toLowerCase()}` : '');
  return `Schatting: reis ${formatEuro(e.travel)} (${basis}) + hotel ${e.nights} ${
    e.nights === 1 ? 'nacht' : 'nachten'
  } × ${formatEuro(e.hotelPerNight)}; ${ticket}. Totaal ${formatEuro(e.total)}.`;
}

export function CostValue({ estimate }: { estimate: CostEstimate | null }) {
  if (!estimate) return <span className="text-ink-muted italic">{UNKNOWN}</span>;
  const explanation = costExplanation(estimate);
  return (
    <span title={explanation}>
      <span className="font-semibold">~{formatEuro(estimate.total)}</span>
      {estimate.ticket ? null : (
        <span className="text-ink-muted ml-1 font-mono text-[10px]">excl. ticket</span>
      )}
      <span className="sr-only"> ({explanation})</span>
    </span>
  );
}

/** Uitgesplitste regels voor kaart en vergelijking. */
export function CostBreakdown({ estimate }: { estimate: CostEstimate }) {
  return (
    <ul className="text-ink-soft space-y-0.5 font-mono text-[11px]">
      <li>
        ticket{' '}
        {estimate.ticket ? (
          estimate.ticket.sourceUrl ? (
            <a
              className="text-signal hover:underline"
              href={estimate.ticket.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {formatEuro(estimate.ticket.amount)}{' '}
              {estimate.ticket.byAi ? 'AI van website' : 'officieel'} ↗
            </a>
          ) : (
            `${formatEuro(estimate.ticket.amount)} ${estimate.ticket.byAi ? 'AI van website' : 'officieel'}`
          )
        ) : (
          <span className="italic">{UNKNOWN}</span>
        )}
      </li>
      <li>
        reis {formatEuro(estimate.travel)}{' '}
        <span className="text-ink-muted">{basisNote(estimate)}</span>
      </li>
      <li>
        hotel {formatEuro(estimate.hotel)}{' '}
        <span className="text-ink-muted">
          {estimate.basis === 'online'
            ? 'online, geen hotel'
            : `${estimate.nights} × ${formatEuro(estimate.hotelPerNight)}`}
        </span>
      </li>
    </ul>
  );
}
