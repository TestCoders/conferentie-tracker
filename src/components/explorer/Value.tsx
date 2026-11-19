// Eigenaar: C. Toont een waarde; 'Onbekend' krijgt een gedempte stijl.
import { UNKNOWN } from './format';

export function Value({ text }: { text: string }) {
  return text === UNKNOWN ? <span className="text-ink-muted italic">{text}</span> : <>{text}</>;
}
