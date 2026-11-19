'use client';
// Eigenaar: C. Publiek overzicht + (later) zoeken, filteren en vergelijken.
import { useEffect, useState } from 'react';
import type { Conference, ListResponse } from '@/lib/types';
import { ConferenceCard } from './ConferenceCard';

export function Explorer() {
  const [items, setItems] = useState<Conference[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/conferences')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ListResponse<Conference>;
        setItems(data.items);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Onbekende fout'));
  }, []);

  // TODO(C): zoeken op naam, filter op categorie, 2 selecteren en vergelijken.
  if (error) return <p className="text-red-600">Kon conferenties niet laden: {error}</p>;
  if (!items) return <p>Laden…</p>;
  if (items.length === 0) return <p>Nog geen conferenties. Start een import via /admin.</p>;

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((c) => (
        <li key={c.id}>
          <ConferenceCard conference={c} />
        </li>
      ))}
    </ul>
  );
}
