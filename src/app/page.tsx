// Eigenaar: C. Header (logo, menu, thema) staat in layout.tsx via SiteHeader.
import { Explorer } from '@/components/explorer/Explorer';

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <p className="text-signal font-mono text-sm">$ ls ./conferenties --upcoming</p>
      <h1 className="terminal-cursor font-display mt-2 text-3xl font-bold sm:text-4xl">
        Conference Tracker
      </h1>
      <p className="text-ink-soft mt-2 mb-8 max-w-2xl">
        Automatisch ontdekte conferenties over development, softwaretesten en testautomatisering.
      </p>
      <Explorer />
    </main>
  );
}
