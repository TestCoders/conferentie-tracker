// Eigenaar: C.
import Image from 'next/image';
import { Explorer } from '@/components/explorer/Explorer';
import { ThemeToggle } from '@/components/explorer/ThemeToggle';

export default function Home() {
  return (
    <>
      <header className="border-hairline bg-void/85 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-testcoders.svg"
              alt="TestCoders"
              width={90}
              height={36}
              className="h-9 w-auto dark:hidden"
            />
            <Image
              src="/logo-testcoders-white.svg"
              alt="TestCoders"
              width={90}
              height={36}
              className="hidden h-9 w-auto dark:block"
            />
            <span className="border-hairline text-ink-soft hidden border-l pl-3 font-mono text-sm sm:inline">
              conference-tracker
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

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
    </>
  );
}
