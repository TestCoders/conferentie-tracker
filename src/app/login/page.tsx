import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <main className="w-full px-4 py-16 sm:py-24">
      <Suspense fallback={<p className="text-ink-muted text-center">Inloggen laden…</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
