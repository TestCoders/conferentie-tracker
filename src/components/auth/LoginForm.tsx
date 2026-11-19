'use client';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function LoginForm() {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const error = params.get('error');
  const message =
    error === 'AccessDenied'
      ? 'Je account heeft geen geldige TestCoders-app-rol. Laat een beheerder je User of Admin toewijzen.'
      : error === 'OAuthCallbackError'
        ? 'Microsoft heeft de aanmelding niet voltooid. Controleer of de vereiste beheerderstoestemming is verleend en probeer opnieuw.'
        : 'Inloggen is niet gelukt. Controleer je TestCoders-account en app-rol of neem contact op met de beheerder.';
  return (
    <div className="border-hairline bg-surface mx-auto max-w-lg space-y-5 rounded-md border p-6">
      <h1 className="font-display text-2xl font-bold">Inloggen bij TestCoders</h1>
      <p className="text-ink-soft">
        Gebruik je TestCoders Microsoft-account. Toegang wordt bepaald door je toegewezen User- of
        Admin-rol.
      </p>
      {(params.has('error') || failed) && (
        <p role="alert" className="text-alert">
          {message}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        className="bg-signal rounded-md px-4 py-2 font-semibold text-white disabled:opacity-50"
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          try {
            await signIn('microsoft-entra-id', { callbackUrl: '/' });
          } catch {
            setFailed(true);
            setBusy(false);
          }
        }}
      >
        {busy ? 'Doorsturen naar Microsoft…' : 'Inloggen met Microsoft'}
      </button>
    </div>
  );
}
