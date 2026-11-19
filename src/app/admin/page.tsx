// Eigenaar: D.
import { AdminPanel } from '@/components/admin/AdminPanel';

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Beheer</h1>
      <AdminPanel />
    </main>
  );
}
