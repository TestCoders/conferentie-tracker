'use client';
// Eigenaar: C. Favorieten per browser (localStorage); later naar het account zodra login er is.
import { useCallback, useMemo, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'conference-tracker:favorites';
const MAX_FAVORITES = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export function useFavorites() {
  // Server en eerste render: geen favorieten; daarna de waarde uit de browser.
  const raw = useSyncExternalStore(subscribe, read, () => '[]');
  const ids = useMemo(() => new Set(parseFavorites(raw)), [raw]);

  const toggle = useCallback((id: string) => {
    const current = parseFavorites(read());
    write(
      current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id].slice(-MAX_FAVORITES),
    );
  }, []);

  return { ids, toggle };
}
