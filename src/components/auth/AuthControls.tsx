'use client';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';

export function AuthControls() {
  const { data: session, status } = useSession();
  if (status === 'loading') return <span className="text-ink-muted text-xs">Account laden…</span>;
  if (!session)
    return (
      <Link href="/login" className="text-signal text-xs font-semibold hover:underline">
        Inloggen met Microsoft
      </Link>
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
