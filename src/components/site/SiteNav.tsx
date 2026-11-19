'use client';
// Hoofdmenu: wissel tussen het publieke overzicht en beheer. Actieve pagina via usePathname.
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'conferenties' },
  { href: '/admin', label: 'beheer' },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Hoofdmenu">
      <ul className="flex items-center gap-1">
        {LINKS.map(({ href, label }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`focus-visible:ring-signal block rounded-md px-2.5 py-1.5 font-mono text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                  active
                    ? 'bg-signal-glow text-signal'
                    : 'text-ink-soft hover:bg-glass hover:text-ink'
                }`}
              >
                <span aria-hidden="true" className={active ? '' : 'text-ink-muted'}>
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
