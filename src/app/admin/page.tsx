// Eigenaar: D.
import { AdminPanel } from '@/components/admin/AdminPanel';

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <p className="text-signal font-mono text-sm">$ sudo ./beheer</p>
      <h1 className="terminal-cursor font-display mt-2 mb-8 text-3xl font-bold sm:text-4xl">
        Beheer
      </h1>
      <AdminPanel />
    </main>
  );
}
