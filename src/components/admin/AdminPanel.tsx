'use client';
// Eigenaar: D. Token alleen in React state — niet in URL, localStorage of source code.
import { useState } from 'react';
import type { DiscoveryRunResponse, ErrorResponse } from '@/lib/types';

export function AdminPanel() {
  const [token, setToken] = useState('');
  const [result, setResult] = useState<DiscoveryRunResponse | ErrorResponse | null>(null);
  const [busy, setBusy] = useState(false);

  async function runDiscovery() {
    setBusy(true);
    try {
      const res = await fetch('/api/discovery/run', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'confs-tech' }),
      });
      setResult((await res.json()) as DiscoveryRunResponse | ErrorResponse);
    } finally {
      setBusy(false);
    }
  }

  // TODO(D): conferentielijst via GET /api/admin/conferences + approve/reject via PATCH.
  return (
    <section className="space-y-4">
      <label className="block">
        <span className="text-sm">Admin-token</span>
        <input
          type="password"
          className="mt-1 block w-full rounded border px-2 py-1"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoComplete="off"
        />
      </label>
      <button
        type="button"
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        onClick={runDiscovery}
        disabled={!token || busy}
      >
        {busy ? 'Bezig…' : 'Run discovery'}
      </button>
      {result && (
        <pre className="overflow-x-auto rounded bg-black/5 p-3 text-sm">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </section>
  );
}
