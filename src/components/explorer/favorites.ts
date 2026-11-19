'use client';
// Eigenaar: C. Favorieten: ingelogd in je account (/api/favorites), anders per browser (localStorage).
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { FavoritesResponse } from '@/lib/types';

const STORAGE_KEY = 'conference-tracker:favorites';
const MAX_FAVORITES = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Waar de favorieten nu staan: in het account of alleen in deze browser. */
export type FavoritesSource = 'account' | 'browser';

// --- Opslag per browser ---------------------------------------------------------------------

const listeners = new Set<() => void>();
// Fallback als localStorage niet beschikbaar is (privévenster, geblokkeerde opslag).
let memory = '[]';

function read(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '[]';
  } catch {
    return memory;
  }
}

function write(ids: string[]) {
  memory = JSON.stringify(ids);
  try {
    localStorage.setItem(STORAGE_KEY, memory);
  } catch {
    // Alleen in geheugen; verdwijnt bij herladen.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Andere tabbladen houden we gelijk via het storage-event.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Alleen geldige, unieke conferentie-IDs; kapotte of gemanipuleerde opslag wordt genegeerd. */
export function parseFavorites(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const ids = value.filter((id): id is string => typeof id === 'string' && UUID.test(id));
    return [...new Set(ids)].slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}

// --- Account ----------------------------------------------------------------------------------

async function loadAccountFavorites(): Promise<string[] | null> {
  const res = await fetch('/api/favorites', { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as FavoritesResponse).items;
}

async function addAccountFavorites(conferenceIds: string[]): Promise<boolean> {
  const res = await fetch('/api/favorites', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conferenceIds }),
  });
  return res.ok;
}

async function removeAccountFavorite(conferenceId: string): Promise<boolean> {
  const res = await fetch(`/api/favorites?conferenceId=${encodeURIComponent(conferenceId)}`, {
    method: 'DELETE',
  });
  return res.ok;
}

/**
 * Ingelogd en de favorieten-API werkt: het account is leidend en favorieten uit deze browser
 * worden er eenmalig naartoe gekopieerd. Anders (uitgelogd, of migratie nog niet gedraaid):
 * favorieten per browser.
 */
export function useFavorites() {
  const { data: session, status } = useSession();
  const userId = status === 'authenticated' ? session.user.id : null;

  const localRaw = useSyncExternalStore(subscribe, read, () => '[]');
  const localIds = useMemo(() => new Set(parseFavorites(localRaw)), [localRaw]);

  // Favorieten in het account, per gebruiker; null = (nog) niet beschikbaar.
  const [account, setAccount] = useState<{ userId: string; ids: Set<string> } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const server = await loadAccountFavorites().catch(() => null);
      if (cancelled || server === null) return;
      const ids = new Set(server);
      const local = parseFavorites(read()).filter((id) => !ids.has(id));
      if (local.length > 0 && (await addAccountFavorites(local).catch(() => false))) {
        // Opnieuw ophalen: onbekende of afgewezen conferenties slaat de server over.
        const merged = await loadAccountFavorites().catch(() => null);
        if (cancelled) return;
        if (merged) {
          write([]);
          setAccount({ userId, ids: new Set(merged) });
          return;
        }
      }
      if (!cancelled) setAccount({ userId, ids });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const inAccount = userId !== null && account?.userId === userId;
  const ids = inAccount ? account.ids : localIds;
  const source: FavoritesSource = inAccount ? 'account' : 'browser';

  const toggle = useCallback(
    (id: string) => {
      if (!inAccount || !userId) {
        const current = parseFavorites(read());
        write(
          current.includes(id)
            ? current.filter((x) => x !== id)
            : [...current, id].slice(-MAX_FAVORITES),
        );
        return;
      }
      const wasFavorite = ids.has(id);
      const apply = (on: boolean) =>
        setAccount((prev) => {
          if (!prev || prev.userId !== userId) return prev;
          const next = new Set(prev.ids);
          if (on) next.add(id);
          else next.delete(id);
          return { userId, ids: next };
        });
      // Optimistisch bijwerken; bij een fout terugzetten.
      apply(!wasFavorite);
      const request = wasFavorite ? removeAccountFavorite(id) : addAccountFavorites([id]);
      request.catch(() => false).then((ok) => ok || apply(wasFavorite));
    },
    [inAccount, userId, ids],
  );

  return { ids, toggle, source, signedIn: userId !== null };
}
