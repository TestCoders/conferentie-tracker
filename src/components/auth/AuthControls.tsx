'use client';
import { signOut, useSession } from 'next-auth/react';
import { Suspense } from 'react';
import { MicrosoftSignInButton } from '@/components/auth/MicrosoftSignInButton';

export function AuthControls() {
  const { data: session, status } = useSession();
  if (status === 'loading') return <span className="text-ink-muted text-xs">Account laden…</span>;
  if (!session)
    return (
      <Suspense fallback={null}>
        <MicrosoftSignInButton size="sm" />
      </Suspense>
    );
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-ink-soft hidden max-w-40 truncate sm:inline">{session.user.name}</span>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/' })}
        className="text-signal hover:underline"
      >
        Uitloggen
      </button>
    </div>
  );
}
