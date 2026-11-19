'use client';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export function ContributionGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  if (status === 'loading') return <p className="text-ink-muted text-sm">Account controleren…</p>;
  if (!session)
    return (
      <p className="text-sm">
        <Link href="/login" className="text-signal font-semibold hover:underline">
          Log in met Microsoft om een bijdrage te plaatsen.
        </Link>
      </p>
    );
  return children;
}
