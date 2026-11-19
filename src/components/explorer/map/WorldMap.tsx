'use client';
// Eigenaar: C. Statische wereldkaart met de conferenties uit de huidige selectie. Positie komt uit
// stad + land (src/lib/geo), geen GPS of locatie van de bezoeker. Hover/focus toont de details.
import { useMemo, useState } from 'react';
import { GEO_ATTRIBUTION, locate, type MapLocation } from '@/lib/geo/locate';
import type { Conference } from '@/lib/types';
import { formatDateRange, formatLocation } from '@/components/explorer/format';
import { WORLD_LAND_PATH } from '@/components/explorer/map/world-land';

type Region = 'world' | 'europe' | 'america';
/** viewBox in graden: x = lng + 180, y = 90 - lat. */
const REGIONS: Record<Region, { label: string; box: [number, number, number, number] }> = {
  world: { label: 'Wereld', box: [0, 10, 360, 150] },
  europe: { label: 'Europa', box: [150, 17, 78, 40] },
  america: { label: 'Noord-Amerika', box: [40, 25, 100, 48] },
};

type Marker = {
  key: string;
  x: number;
  y: number;
  location: MapLocation;
  conferences: Conference[];
};

type Props = {
  conferences: Conference[];
  favorites: ReadonlySet<string>;
};

export function WorldMap({ conferences, favorites }: Props) {
  const [region, setRegion] = useState<Region>('world');
  const [active, setActive] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);

  const { markers, online, unknown } = useMemo(() => {
    const byKey = new Map<string, Marker>();
    let onlineCount = 0;
    let unknownCount = 0;
    for (const c of conferences) {
      const location = locate(c.city, c.country, c.online_only);
      if (!location) {
        if (c.online_only) onlineCount++;
        else unknownCount++;
        continue;
      }
      const key = `${location.lat.toFixed(2)},${location.lng.toFixed(2)}`;
      const marker = byKey.get(key) ?? {
        key,
        x: location.lng + 180,
        y: 90 - location.lat,
        location,
        conferences: [],
      };
      marker.conferences.push(c);
      byKey.set(key, marker);
    }
    return { markers: [...byKey.values()], online: onlineCount, unknown: unknownCount };
  }, [conferences]);

  const [bx, by, bw, bh] = REGIONS[region].box;
  // Markers even groot op het scherm, ongeacht de uitsnede.
  const radius = (bw / 360) * 1.8;
  const shown = pinned ?? active;
  const current = markers.find((m) => m.key === shown) ?? null;
  const placed = markers.reduce((sum, m) => sum + m.conferences.length, 0);

  const left = current ? ((current.x - bx) / bw) * 100 : 0;
  const top = current ? ((current.y - by) / bh) * 100 : 0;

  return (
    <section aria-label="Wereldkaart met conferenties" className="space-y-2">
      <div
        role="group"
        aria-label="Uitsnede van de kaart"
        className="border-hairline bg-surface flex w-fit rounded-md border p-0.5"
      >
        {(Object.keys(REGIONS) as Region[]).map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={region === r}
            onClick={() => {
              setRegion(r);
              setPinned(null);
            }}
            className={`rounded px-3 py-1 font-mono text-xs transition-colors ${
              region === r ? 'bg-signal text-white' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {REGIONS[r].label}
          </button>
        ))}
      </div>

      <div
        className="border-hairline bg-glass relative overflow-hidden rounded-md border"
        style={{ aspectRatio: `${bw} / ${bh}` }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setPinned(null);
            setActive(null);
          }
        }}
      >
        <svg
          viewBox={`${bx} ${by} ${bw} ${bh}`}
          className="absolute inset-0 size-full"
          role="img"
          aria-label={`Kaart met ${placed} conferenties op ${markers.length} locaties`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPinned(null);
          }}
        >
          <path
            d={WORLD_LAND_PATH}
            className="fill-surface stroke-ink-muted/40"
            strokeWidth={0.6}
            vectorEffect="non-scaling-stroke"
          />
          {markers.map((m) => {
            const favorite = m.conferences.some((c) => favorites.has(c.id));
            const approximate = m.location.precision === 'country';
            const label = `${formatLocation(m.conferences[0])}: ${m.conferences
              .map((c) => `${c.name}${favorites.has(c.id) ? ' (favoriet)' : ''}`)
              .join(', ')}${approximate ? '. Positie bij benadering (land)' : ''}`;
            return (
              <g
                key={m.key}
                tabIndex={0}
                role="button"
                aria-label={label}
                aria-pressed={pinned === m.key}
                className="cursor-pointer focus:outline-none"
                onMouseEnter={() => setActive(m.key)}
                onMouseLeave={() => setActive((k) => (k === m.key ? null : k))}
                onFocus={() => setActive(m.key)}
                onBlur={() => setActive((k) => (k === m.key ? null : k))}
                onClick={() => setPinned((k) => (k === m.key ? null : m.key))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setPinned((k) => (k === m.key ? null : m.key));
                  }
                }}
              >
                {/* Groter, onzichtbaar raakvlak voor muis en touch. */}
                <circle cx={m.x} cy={m.y} r={radius * 2.2} className="fill-transparent" />
                <circle
                  cx={m.x}
                  cy={m.y}
                  r={radius * (m.conferences.length > 1 ? 1.3 : 1) * (shown === m.key ? 1.4 : 1)}
                  className={`${
                    approximate ? 'fill-surface' : favorite ? 'fill-assess' : 'fill-signal'
                  } ${favorite ? 'stroke-assess' : 'stroke-surface'} transition-all`}
                  strokeWidth={approximate ? 2 : 1.2}
                  strokeDasharray={approximate ? '2 1.5' : undefined}
                  vectorEffect="non-scaling-stroke"
                />
                {m.conferences.length > 1 && (
                  <text
                    x={m.x}
                    y={m.y}
                    dy="0.35em"
                    textAnchor="middle"
                    fontSize={radius * 1.4}
                    className="pointer-events-none fill-white font-mono font-semibold"
                  >
                    {m.conferences.length}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {current && (
          <div
            role="tooltip"
            className="border-hairline bg-surface text-ink pointer-events-none absolute z-10 w-64 max-w-[80%] rounded-md border p-3 text-sm shadow-lg"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              transform: `translate(${left > 60 ? 'calc(-100% - 12px)' : '12px'}, ${
                top > 55 ? 'calc(-100% - 8px)' : '8px'
              })`,
            }}
          >
            <ul className="space-y-2">
              {current.conferences.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <p className="leading-snug font-semibold">
                    {favorites.has(c.id) && (
                      <span className="text-assess mr-1" aria-label="favoriet">
                        ★
                      </span>
                    )}
                    {c.name}
                  </p>
                  <p className="text-ink-soft text-xs">
                    {formatLocation(c)}
                    <span className="text-ink-muted"> · {formatDateRange(c)}</span>
                  </p>
                  {favorites.has(c.id) && (
                    <p className="text-assess font-mono text-[11px]">★ in je favorieten</p>
                  )}
                </li>
              ))}
            </ul>
            {current.conferences.length > 6 && (
              <p className="text-ink-muted mt-2 font-mono text-[11px]">
                + {current.conferences.length - 6} meer op deze locatie
              </p>
            )}
            {current.location.precision === 'country' && (
              <p className="text-ink-muted mt-2 font-mono text-[11px]">
                positie bij benadering: midden van het land
              </p>
            )}
          </div>
        )}
      </div>

      <div className="text-ink-muted flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
        <span>
          {placed} op de kaart
          {online > 0 && ` · ${online} online`}
          {unknown > 0 && ` · ${unknown} zonder bekende locatie`}
        </span>
        <span className="flex items-center gap-1">
          <span className="bg-signal inline-block size-2.5 rounded-full" aria-hidden="true" />
          conferentie
        </span>
        <span className="flex items-center gap-1">
          <span className="bg-assess inline-block size-2.5 rounded-full" aria-hidden="true" />
          favoriet
        </span>
        <span className="flex items-center gap-1">
          <span
            className="border-signal inline-block size-2.5 rounded-full border border-dashed"
            aria-hidden="true"
          />
          alleen land bekend
        </span>
      </div>
      <p className="text-ink-muted text-[11px]">{GEO_ATTRIBUTION}</p>
    </section>
  );
}
