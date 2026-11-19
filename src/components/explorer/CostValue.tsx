// Eigenaar: C. Kostenschatting tonen: totaal met uitleg van de berekening, of 'Onbekend'.
import { formatEuro, type CostEstimate } from '@/lib/costs';
import { UNKNOWN } from './format';

/** Waar de reis-/hotelschatting op gebaseerd is, kort. */
export function basisNote(e: CostEstimate): string {
  if (e.basis === 'online') return 'online, geen reis';
  if (e.basis === 'default') return 'standaardaanname';
  return `aanname ${e.countryLabel}`;
}

/** Uitleg van de berekening, voor tooltip en schermlezer. */
export function costExplanation(e: CostEstimate): string {
  const ticket = e.ticket
    ? `ticket ${formatEuro(e.ticket.amount)} (officieel)`
    : 'ticket onbekend, niet meegeteld';
  if (e.basis === 'online') {
    return `Online conferentie: geen reis- of hotelkosten; ${ticket}. Totaal ${formatEuro(e.total)}.`;
  }
  const basis =
    e.basis === 'default'
      ? 'standaardaanname, geen aanname voor dit land'
      : `aanname ${e.countryLabel}`;
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
              {formatEuro(estimate.ticket.amount)} officieel ↗
            </a>
          ) : (
            `${formatEuro(estimate.ticket.amount)} officieel`
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
