// Eigenaar: D.
import { AdminPanel } from '@/components/admin/AdminPanel';
import { auth } from '@/auth';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';

async function AdminContent() {
  const session = await auth();
  if (!session) redirect('/login');
  if (!session.user.isAdmin) return <p role="alert">Beheerrechten vereist.</p>;
  return <AdminPanel />;
}

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <p className="text-signal font-mono text-sm">$ sudo ./beheer</p>
      <h1 className="terminal-cursor font-display mt-2 mb-8 text-3xl font-bold sm:text-4xl">
        Beheer
      </h1>
      <Suspense fallback={<p>Account controleren…</p>}>
        <AdminContent />
      </Suspense>
    </main>
  );
}
