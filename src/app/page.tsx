// Eigenaar: C.
import { Explorer } from '@/components/explorer/Explorer';

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Conference Tracker</h1>
      <p className="mt-2 mb-8 text-black/70 dark:text-white/70">
        Automatisch ontdekte conferenties over development, softwaretesten en testautomatisering.
      </p>
      <Explorer />
    </main>
  );
}
