'use client';
import { signIn } from 'next-auth/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';

/** Alleen interne paden als terugkeeradres; voorkomt open redirects. */
export function safeCallbackUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/login'))
    return '/';
  return value;
}

function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 21 21" aria-hidden="true" className={className}>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

type Props = {
  /** sm: header, md: inline in pagina's, lg: loginpagina (volle breedte). */
  size?: 'sm' | 'md' | 'lg';
  /** Waarheen na inloggen; standaard de huidige pagina. */
  callbackUrl?: string;
  onError?: () => void;
};

export function MicrosoftSignInButton({ size = 'lg', callbackUrl, onError }: Props) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [busy, setBusy] = useState(false);
  const target = safeCallbackUrl(callbackUrl ?? (search ? `${pathname}?${search}` : pathname));
  const sizing = {
    sm: 'gap-2 px-3 py-1.5 text-xs',
    md: 'gap-2.5 px-4 py-2 text-sm',
    lg: 'w-full justify-center gap-3 px-5 py-3 text-base',
  }[size];
  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy}
      className={`border-hairline bg-surface text-ink hover:border-ink-muted hover:bg-glass focus-visible:ring-signal inline-flex items-center rounded-md border font-semibold shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60 ${sizing}`}
      onClick={async () => {
        setBusy(true);
        try {
          await signIn('microsoft-entra-id', { callbackUrl: target });
        } catch {
          setBusy(false);
          onError?.();
        }
      }}
    >
      <MicrosoftLogo className={{ sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' }[size]} />
      <span>{busy ? 'Doorsturen…' : size === 'sm' ? 'Inloggen' : 'Inloggen met Microsoft'}</span>
    </button>
  );
}
