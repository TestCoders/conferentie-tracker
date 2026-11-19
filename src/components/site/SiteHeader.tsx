// Gedeelde header voor alle pagina's: logo, hoofdmenu en thema-toggle.
import Image from 'next/image';
import Link from 'next/link';
import { ThemeToggle } from '@/components/explorer/ThemeToggle';
import { SiteNav } from './SiteNav';
import { AuthControls } from '@/components/auth/AuthControls';

export function SiteHeader() {
  return (
    <header className="border-hairline bg-void/85 sticky top-0 z-10 border-b backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-3"
          aria-label="Conference Tracker – home"
        >
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
          <span className="border-hairline text-ink-soft hidden border-l pl-3 font-mono text-sm md:inline">
            conference-tracker
          </span>
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <SiteNav />
          <ThemeToggle />
          <AuthControls />
        </div>
      </div>
    </header>
  );
}
