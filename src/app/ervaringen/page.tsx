// Ervaringen delen: verslagen, tips en foto's van conferenties (roadmap #3).
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ExperiencesPage } from '@/components/experiences/ExperiencesPage';

export const metadata: Metadata = {
  title: 'Ervaringen — Conference Tracker',
  description: "Verslagen, tips en foto's van collega's die een conferentie bezochten",
};

export default function ErvaringenPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <p className="text-signal font-mono text-sm">$ cat ./ervaringen/*.md</p>
      <h1 className="terminal-cursor font-display mt-2 text-3xl font-bold sm:text-4xl">
        Ervaringen
      </h1>
      <p className="text-ink-soft mt-2 mb-8 max-w-2xl">
        Hoe was het echt? Lees verslagen, tips en foto&apos;s van collega&apos;s, en deel je eigen
        ervaring, ook van eerdere edities.
      </p>
      {/* useSearchParams in ExperiencesPage vraagt een Suspense-grens. */}
      <Suspense fallback={<p aria-live="polite">Laden…</p>}>
        <ExperiencesPage />
      </Suspense>
    </main>
  );
}
