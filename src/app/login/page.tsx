import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <main className="w-full px-4 py-12">
      <Suspense fallback={<p>Inloggen laden…</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
