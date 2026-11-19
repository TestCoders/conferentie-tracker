'use client';
// Eigenaar: C. Wisselt data-theme op <html>; keuze wordt onthouden in localStorage.

function toggleTheme() {
  const root = document.documentElement;
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try {
    localStorage.setItem('theme', next);
  } catch {
    // Opslag geblokkeerd (bijv. privévenster): thema geldt dan alleen voor deze sessie.
  }
}

export function ThemeToggle() {
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Wissel tussen licht en donker thema"
      className="border-hairline bg-glass text-ink-soft hover:text-ink focus-visible:ring-signal rounded-md border px-3 py-1.5 font-mono text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      {/* Beide labels renderen; CSS kiest, zodat server en client gelijk blijven. */}
      <span className="dark:hidden">☾ dark</span>
      <span className="hidden dark:inline">☀ light</span>
    </button>
  );
}
