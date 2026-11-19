'use client';
// Eigenaar: C. Logo en afbeelding van de officiële website (via discovery); verdwijnen netjes bij
// ontbreken of een kapotte link. Bewust <img>: willekeurige externe hosts, geen next/image-proxy.
/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import type { Conference } from '@/lib/types';

type ImgProps = { src: string; className: string };

/** Decoratief (naam staat ernaast); geen referrer naar de conferentiesite. */
function ExternalImg({ src, className, onError }: ImgProps & { onError: () => void }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
      onError={onError}
    />
  );
}

const SIZES = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
} as const;

function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return (
    words
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase() || '?'
  );
}

type LogoProps = {
  conference: Pick<Conference, 'name' | 'icon_url'>;
  size?: keyof typeof SIZES;
  /** Toon initialen als er geen (werkend) logo is, zodat lijsten uitgelijnd blijven. */
  fallback?: boolean;
};

export function ConferenceLogo({ conference, size = 'md', fallback = false }: LogoProps) {
  // Per URL onthouden, zodat een nieuwe URL (na refresh) opnieuw geprobeerd wordt.
  const [failed, setFailed] = useState<string | null>(null);
  const src = conference.icon_url && failed !== conference.icon_url ? conference.icon_url : null;
  const box = `${SIZES[size]} shrink-0 overflow-hidden rounded-md border border-hairline`;

  if (src) {
    return (
      <span className={`${box} flex items-center justify-center bg-white p-1`}>
        <ExternalImg
          src={src}
          className="size-full object-contain"
          onError={() => setFailed(src)}
        />
      </span>
    );
  }
  if (!fallback) return null;
  return (
    <span
      aria-hidden="true"
      className={`${box} bg-glass text-ink-muted font-display flex items-center justify-center font-bold`}
    >
      {initials(conference.name)}
    </span>
  );
}

type BannerProps = {
  conference: Pick<Conference, 'image_url'>;
  className?: string;
};

/** Social-afbeelding (og:image, meestal 1200×630); niets renderen als die er niet is. */
export function ConferenceBanner({ conference, className = '' }: BannerProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = conference.image_url && failed !== conference.image_url ? conference.image_url : null;
  if (!src) return null;
  return (
    <div className={`border-hairline aspect-[1200/630] overflow-hidden bg-white ${className}`}>
      <ExternalImg src={src} className="size-full object-contain" onError={() => setFailed(src)} />
    </div>
  );
}
