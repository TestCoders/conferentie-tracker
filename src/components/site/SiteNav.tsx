'use client';
// Hoofdmenu: wissel tussen het publieke overzicht en beheer. Actieve pagina via usePathname.
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'conferenties' },
  { href: '/ervaringen', label: 'ervaringen' },
  { href: '/admin', label: 'beheer' },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Hoofdmenu" className="min-w-0 overflow-x-auto">
      <ul className="flex items-center gap-0.5 sm:gap-1">
        {LINKS.map(({ href, label }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`focus-visible:ring-signal block rounded-md px-2 py-1.5 font-mono text-xs whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none sm:px-2.5 sm:text-sm ${
                  active
                    ? 'bg-signal-glow text-signal'
                    : 'text-ink-soft hover:bg-glass hover:text-ink'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`hidden sm:inline ${active ? '' : 'text-ink-muted'}`}
                >
                  ${' '}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
