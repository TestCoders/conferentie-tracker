'use client';
// Eigenaar: C. Agenda: drukte per maand, maandkalender, eigen agenda (.ics) ernaast en export.
import { useMemo, useState, type ChangeEvent } from 'react';
import type { Conference } from '@/lib/types';
import {
  addMonths,
  buildIcs,
  conflictsFor,
  lastDay,
  monthGrid,
  overlaps,
  parseIcs,
  type CalendarEvent,
} from './calendar';
import { CATEGORY_LABELS, formatDateRange, formatLocation } from './format';
import { Value } from './Value';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MONTHS_SHOWN = 12;
const WEEKDAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const MAX_CHIPS = 3;

function monthLabel(month: string, style: 'short' | 'long'): string {
  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString('nl-NL', {
    month: style,
    ...(style === 'long' ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
  return label.replace('.', '');
}

function dayLabel(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function downloadIcs(c: Conference) {
  const blob = new Blob([buildIcs(c, new Date())], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${c.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'conferentie'}.ics`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const covers = (start: string, end: string, day: string) => start <= day && day <= end;

export function AgendaView({ conferences }: { conferences: Conference[] }) {
  const firstMonth = useMemo(
    () =>
      conferences
        .reduce((min, c) => (c.start_date < min ? c.start_date : min), '9999-12')
        .slice(0, 7),
    [conferences],
  );
  const [month, setMonth] = useState(firstMonth);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [own, setOwn] = useState<CalendarEvent[]>([]);
  const [ownFile, setOwnFile] = useState<string | null>(null);
  const [ownError, setOwnError] = useState<string | null>(null);

  const months = useMemo(
    () => Array.from({ length: MONTHS_SHOWN }, (_, i) => addMonths(firstMonth, i)),
    [firstMonth],
  );

  const perMonth = useMemo(() => {
    const result = new Map<string, { count: number; clashes: number }>();
    for (const m of months) {
      const start = `${m}-01`;
      const end = `${m}-31`;
      const inMonth = conferences.filter((c) => overlaps(c.start_date, lastDay(c), start, end));
      result.set(m, {
        count: inMonth.length,
        clashes: inMonth.filter((c) => conflictsFor(c, own).length > 0).length,
      });
    }
    return result;
  }, [months, conferences, own]);
  const maxCount = Math.max(1, ...[...perMonth.values()].map((v) => v.count));

  const { offset, days } = monthGrid(month);
  const pickedConferences = pickedDay
    ? conferences.filter((c) => covers(c.start_date, lastDay(c), pickedDay))
    : [];

  async function onImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setOwnError(null);
    if (file.size > MAX_FILE_BYTES) {
      setOwnError('Bestand is groter dan 2 MB.');
      return;
    }
    const events = parseIcs(await file.text());
    if (events.length === 0) {
      setOwnError('Geen afspraken gevonden in dit bestand. Is het een .ics-export?');
      return;
    }
    setOwn(events);
    setOwnFile(file.name);
  }

  function clearOwn() {
    setOwn([]);
    setOwnFile(null);
    setOwnError(null);
  }

  return (
    <div>
      {/* Eigen agenda */}
      <div className="border-hairline bg-surface mb-6 flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display font-semibold">Mijn agenda ernaast</h2>
          <p className="text-ink-soft text-sm" aria-live="polite">
            {ownError ? (
              <span className="text-alert">{ownError}</span>
            ) : ownFile ? (
              <>
                <span className="text-adopt">✓</span> {own.length} afspraken uit {ownFile}. Alleen
                in deze browser gelezen, niet geüpload of opgeslagen.
              </>
            ) : (
              <>
                Exporteer je agenda als <code className="font-mono text-xs">.ics</code> (Outlook,
                Google, Apple) en laad hem hier. Het bestand blijft in je browser.
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <label className="border-hairline bg-glass hover:text-signal focus-within:ring-signal cursor-pointer rounded-md border px-3 py-2 text-sm focus-within:ring-2">
            ⤒ .ics importeren
            <input
              type="file"
              accept=".ics,text/calendar"
              className="sr-only"
              onChange={onImport}
            />
          </label>
          {ownFile ? (
            <button
              type="button"
              onClick={clearOwn}
              className="text-ink-soft hover:bg-glass hover:text-ink rounded-md px-2 py-2 font-mono text-xs"
            >
              ✕ wis
            </button>
          ) : null}
        </div>
      </div>

      {/* Drukte per maand */}
      <section aria-labelledby="months-heading" className="mb-6">
        <h2 id="months-heading" className="text-ink-muted mb-2 font-mono text-xs">
          drukte per maand · klik om te openen
        </h2>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
          {months.map((m) => {
            const { count, clashes } = perMonth.get(m) ?? { count: 0, clashes: 0 };
            const active = m === month;
            const ratio = count / maxCount;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                aria-label={`${monthLabel(m, 'long')}: ${count} conferenties${clashes ? `, ${clashes} botsen met je agenda` : ''}`}
                onClick={() => {
                  setMonth(m);
                  setPickedDay(null);
                }}
                className={`bg-surface flex flex-col gap-1 rounded-md border p-2 text-left transition-colors ${
                  active ? 'border-signal ring-signal/30 ring-2' : 'border-hairline hover:bg-glass'
                }`}
              >
                <span className="text-ink-muted font-mono text-[11px] uppercase">
                  {monthLabel(m, 'short')} {m.slice(2, 4)}
                </span>
                <span className="flex h-10 items-end" aria-hidden="true">
                  <span
                    className="bg-signal w-full rounded-sm"
                    style={{
                      height: count ? `${15 + ratio * 85}%` : '4%',
                      opacity: count ? 0.35 + ratio * 0.65 : 0.15,
                    }}
                  />
                </span>
                <span className="font-display text-sm font-semibold">
                  {count}
                  {clashes ? (
                    <span className="text-alert ml-1 font-mono text-[10px]">● {clashes}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Maandkalender */}
      <section
        aria-labelledby="month-heading"
        className="border-hairline bg-surface overflow-hidden rounded-md border"
      >
        <div className="bg-titlebar flex items-center justify-between px-4 py-2">
          <button
            type="button"
            onClick={() => setMonth(addMonths(month, -1))}
            className="text-ink-soft hover:bg-glass rounded px-2 py-1 font-mono text-sm"
            aria-label="Vorige maand"
          >
            ←
          </button>
          <h2 id="month-heading" className="font-display font-semibold capitalize">
            {monthLabel(month, 'long')}
          </h2>
          <button
            type="button"
            onClick={() => setMonth(addMonths(month, 1))}
            className="text-ink-soft hover:bg-glass rounded px-2 py-1 font-mono text-sm"
            aria-label="Volgende maand"
          >
            →
          </button>
        </div>
        <div
          className="border-hairline text-ink-muted grid grid-cols-7 border-b font-mono text-[11px]"
          aria-hidden="true"
        >
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: offset }, (_, i) => (
            <div
              key={`empty-${i}`}
              className="border-hairline bg-void/40 min-h-24 border-r border-b"
            />
          ))}
          {days.map((day, i) => {
            const dayConfs = conferences.filter((c) => covers(c.start_date, lastDay(c), day));
            const dayOwn = own.filter((e) => covers(e.start, e.end, day));
            const weekend = (offset + i) % 7 >= 5;
            const status =
              dayConfs.length && own.length ? (dayOwn.length ? 'clash' : 'free') : null;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setPickedDay(day)}
                aria-label={`${dayLabel(day)}: ${dayConfs.length} conferenties${dayOwn.length ? `, ${dayOwn.length} eigen afspraken` : ''}`}
                className={`border-hairline hover:bg-glass/70 min-h-24 min-w-0 border-r border-b p-1 text-left align-top ${
                  weekend ? 'bg-void/40' : ''
                } ${pickedDay === day ? 'ring-signal ring-2 ring-inset' : ''}`}
              >
                <span className="text-ink-muted flex items-center gap-1 font-mono text-[11px]">
                  {i + 1}
                  {status ? (
                    <span
                      aria-hidden="true"
                      className={`size-2 rounded-full ${status === 'clash' ? 'bg-alert' : 'bg-adopt'}`}
                    />
                  ) : null}
                </span>
                {dayOwn.slice(0, 2).map((e, j) => (
                  <span
                    key={`own-${j}`}
                    className="border-assess bg-assess/15 mt-0.5 block truncate rounded-sm border-l-2 px-1 text-[11px]"
                  >
                    {e.title}
                  </span>
                ))}
                {dayConfs.slice(0, MAX_CHIPS).map((c) => (
                  <span
                    key={c.id}
                    className={`bg-signal-glow text-signal mt-0.5 block truncate rounded-sm px-1 text-[11px] font-semibold ${
                      c.start_date === day ? '' : 'opacity-70'
                    }`}
                  >
                    {c.start_date === day ? '' : '↳ '}
                    {c.name}
                  </span>
                ))}
                {dayConfs.length > MAX_CHIPS ? (
                  <span className="text-ink-muted font-mono text-[10px]">
                    +{dayConfs.length - MAX_CHIPS} meer
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <div className="text-ink-muted mt-3 flex flex-wrap gap-4 font-mono text-xs">
        <span className="flex items-center gap-1">
          <span className="bg-signal-glow inline-block h-3 w-6 rounded-sm" />
          conferentie
        </span>
        <span className="flex items-center gap-1">
          <span className="border-assess bg-assess/15 inline-block h-3 w-6 rounded-sm border-l-2" />
          mijn agenda
        </span>
        <span className="flex items-center gap-1">
          <span className="bg-alert inline-block size-3 rounded-full" />
          botsing
        </span>
        <span className="flex items-center gap-1">
          <span className="bg-adopt inline-block size-3 rounded-full" />
          past
        </span>
      </div>

      {/* Details van gekozen dag */}
      {pickedDay ? (
        <section
          aria-live="polite"
          className="border-hairline bg-surface mt-6 rounded-md border p-4"
        >
          <h3 className="text-ink-soft mb-3 font-mono text-sm">
            $ cal --day {pickedDay} <span className="text-ink-muted">· {dayLabel(pickedDay)}</span>
          </h3>
          {pickedConferences.length === 0 ? (
            <p className="text-ink-muted text-sm">Geen conferenties op deze dag.</p>
          ) : (
            <ul className="divide-hairline divide-y">
              {pickedConferences.map((c) => {
                const clashes = conflictsFor(c, own);
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <a
                        className="font-display hover:text-signal font-semibold hover:underline"
                        href={c.official_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {c.name}
                      </a>
                      <p className="text-ink-soft text-sm">
                        {formatDateRange(c)} · <Value text={formatLocation(c)} /> ·{' '}
                        {CATEGORY_LABELS[c.category]}
                      </p>
                      {own.length ? (
                        clashes.length ? (
                          <p className="text-alert mt-1 font-mono text-xs">
                            ● botst met: {clashes.map((e) => e.title).join(', ')}
                          </p>
                        ) : (
                          <p className="text-adopt mt-1 font-mono text-xs">● past in je agenda</p>
                        )
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadIcs(c)}
                      className="border-hairline bg-glass hover:text-signal shrink-0 rounded-md border px-3 py-1.5 text-sm"
                    >
                      ＋ Zet in mijn agenda (.ics)
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
