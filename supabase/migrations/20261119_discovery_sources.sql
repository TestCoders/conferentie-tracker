-- Handmatig door een beheerder toegevoegde discoverybronnen.
-- Draai dit in de Supabase SQL editor. Idempotent: mag opnieuw gedraaid worden.
-- Staat ook in supabase/schema.sql voor nieuwe omgevingen.

create table if not exists public.discovery_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  name_key text generated always as (lower(btrim(name))) stored,
  url text not null check (url like 'https://%' and char_length(url) <= 2000),
  format text not null check (format in ('confs-tech-json', 'testing-conferences-yaml')),
  created_at timestamptz not null default now(),
  unique (name_key),
  unique (url)
);

-- Publieke clients praten uitsluitend met de Next.js API; geen publieke policies.
alter table public.discovery_sources enable row level security;

-- Laat de API (PostgREST) de nieuwe tabel direct zien.
notify pgrst, 'reload schema';
