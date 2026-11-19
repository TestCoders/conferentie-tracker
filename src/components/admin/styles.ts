// Eigenaar: D. Gedeelde Tailwind-klassen voor beheer en reviews, in lijn met de huisstijl
// van de explorer (tokens uit globals.css: surface, hairline, ink, signal, …).

export const CARD = 'rounded-md border border-hairline bg-surface p-4';

export const FIELD =
  'rounded-md border border-hairline bg-surface px-3 py-2 font-sans text-sm text-ink focus:ring-2 focus:ring-signal focus:outline-none';

export const FIELD_LABEL = 'flex flex-col gap-1 font-mono text-xs text-ink-muted';

export const BTN_PRIMARY =
  'rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-40';

export const BTN_SECONDARY =
  'rounded-md border border-hairline bg-glass px-3 py-1.5 font-mono text-xs text-ink-soft transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none disabled:opacity-40';

export const PROMPT = 'font-mono text-sm text-signal';

export const MUTED = 'text-ink-muted';
