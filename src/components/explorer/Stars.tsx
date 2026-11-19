'use client';
// Eigenaar: C. Sterren tonen (alleen-lezen) en kiezen (1–5) voor ratings.
import { useState } from 'react';

export function Stars({ value, size = 'text-sm' }: { value: number; size?: string }) {
  const rounded = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span
      role="img"
      aria-label={`${value} van 5 sterren`}
      title={`${value} van 5`}
      className={`text-assess tracking-tight ${size}`}
    >
      {'★'.repeat(rounded)}
      <span className="text-ink-muted/40">{'★'.repeat(5 - rounded)}</span>
    </span>
  );
}

export function StarInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? 'ster' : 'sterren'}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          className={`focus-visible:ring-signal rounded px-0.5 text-2xl leading-none transition-colors focus-visible:ring-2 focus-visible:outline-none ${
            n <= shown ? 'text-assess' : 'text-ink-muted/40 hover:text-assess/60'
          }`}
        >
          ★
        </button>
      ))}
      <span className="text-ink-muted ml-2 font-mono text-xs">{value ? `${value}/5` : ''}</span>
    </div>
  );
}
