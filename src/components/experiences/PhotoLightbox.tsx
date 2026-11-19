'use client';
// Foto groot bekijken met vorige/volgende; Esc sluit, pijltjestoetsen bladeren.
import { useEffect, useRef } from 'react';

export type LightboxPhoto = { url: string; caption: string | null; credit?: string };

type Props = {
  photos: LightboxPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

export function PhotoLightbox({ photos, index, onIndexChange, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const photo = photos[index];
  const hasMany = photos.length > 1;

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && hasMany) onIndexChange((index + 1) % photos.length);
      if (e.key === 'ArrowLeft' && hasMany)
        onIndexChange((index - 1 + photos.length) % photos.length);
    }
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [index, photos.length, hasMany, onClose, onIndexChange]);

  if (!photo) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ${index + 1} van ${photos.length}`}
      className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex items-center justify-between text-white">
        <span className="font-mono text-xs">
          {index + 1} / {photos.length}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-1.5 font-mono text-sm hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        >
          ✕ sluiten
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center gap-2 py-3">
        {hasMany ? (
          <button
            type="button"
            aria-label="Vorige foto"
            onClick={() => onIndexChange((index - 1 + photos.length) % photos.length)}
            className="rounded-md px-3 py-6 text-2xl text-white hover:bg-white/10"
          >
            ‹
          </button>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element -- door gebruikers geüploade foto uit Supabase Storage, onbekende afmetingen */}
        <img
          src={photo.url}
          alt={photo.caption ?? 'Foto van de conferentie'}
          className="max-h-full max-w-full rounded object-contain"
        />
        {hasMany ? (
          <button
            type="button"
            aria-label="Volgende foto"
            onClick={() => onIndexChange((index + 1) % photos.length)}
            className="rounded-md px-3 py-6 text-2xl text-white hover:bg-white/10"
          >
            ›
          </button>
        ) : null}
      </div>
      {photo.caption || photo.credit ? (
        <p className="text-center text-sm text-white/90">
          {photo.caption}
          {photo.credit ? (
            <span className="ml-2 font-mono text-xs text-white/60">{photo.credit}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
