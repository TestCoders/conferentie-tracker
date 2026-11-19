'use client';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { MicrosoftSignInButton, safeCallbackUrl } from '@/components/auth/MicrosoftSignInButton';

function errorMessage(error: string | null): string {
  if (error === 'AccessDenied')
    return 'Je account heeft geen geldige TestCoders-app-rol. Laat een beheerder je User of Admin toewijzen.';
  if (error === 'OAuthCallbackError')
    return 'Microsoft heeft de aanmelding niet voltooid. Controleer of de vereiste beheerderstoestemming is verleend en probeer opnieuw.';
  return 'Inloggen is niet gelukt. Controleer je TestCoders-account en app-rol of neem contact op met de beheerder.';
}

export function LoginForm() {
  const params = useSearchParams();
  const [failed, setFailed] = useState(false);
  const error = params.get('error');
  const callbackUrl = safeCallbackUrl(params.get('callbackUrl'));
  return (
    <div className="border-hairline bg-surface mx-auto max-w-sm rounded-xl border p-8 text-center shadow-sm">
      <p className="text-signal font-mono text-sm">$ ./login</p>
      <h1 className="font-display mt-2 text-2xl font-bold">Welkom terug</h1>
      <p className="text-ink-soft mt-2 text-sm">Log in met je TestCoders-account.</p>
      {(error || failed) && (
        <p
          role="alert"
          className="border-alert/30 bg-alert/10 text-alert mt-6 rounded-md border px-3 py-2 text-left text-sm"
        >
          {errorMessage(error)}
        </p>
      )}
      <div className="mt-6">
        <MicrosoftSignInButton callbackUrl={callbackUrl} onError={() => setFailed(true)} />
      </div>
      <p className="text-ink-muted mt-6 text-xs">
        Toegang wordt bepaald door je toegewezen User- of Admin-rol.
      </p>
    </div>
  );
}
