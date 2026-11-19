'use client';
import { useSession } from 'next-auth/react';
import { Suspense } from 'react';
import { MicrosoftSignInButton } from '@/components/auth/MicrosoftSignInButton';

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function ContributionGate({
  children,
  message = 'Log in met Microsoft om een bijdrage te plaatsen.',
}: {
  children: React.ReactNode;
  message?: string;
}) {
  const { data: session, status } = useSession();
  if (status === 'loading')
    return (
      <div
        aria-busy="true"
        className="border-hairline bg-surface h-24 animate-pulse rounded-xl border"
      >
        <span className="sr-only">Account controleren…</span>
      </div>
    );
  if (!session)
    return (
      <section className="border-hairline bg-surface flex flex-col gap-4 rounded-xl border p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <span className="bg-signal-glow text-signal flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <LockIcon />
          </span>
          <div>
            <h2 className="font-display text-ink text-base font-semibold">
              Alleen voor TestCoders-collega&apos;s
            </h2>
            <p className="text-ink-soft mt-1 text-sm">{message}</p>
          </div>
        </div>
        <div className="shrink-0 sm:ml-4">
          <Suspense fallback={null}>
            <MicrosoftSignInButton size="md" />
          </Suspense>
        </div>
      </section>
    );
  return children;
}
