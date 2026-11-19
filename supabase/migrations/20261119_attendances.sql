-- Interesse / bijgewoond per persoon per conferentie.
-- Draai dit in de Supabase SQL editor. Idempotent: mag opnieuw gedraaid worden.
-- Staat ook in supabase/schema.sql voor nieuwe omgevingen.

create table if not exists public.attendances (
  id uuid primary key default gen_random_uuid(),
  conference_id uuid not null references public.conferences(id) on delete cascade,
  person_name text not null check (char_length(btrim(person_name)) between 1 and 80),
  -- Eén regel per naam per conferentie, hoofdletter-ongevoelig.
  name_key text generated always as (lower(btrim(person_name))) stored,
  status text not null check (status in ('interested', 'attended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conference_id, name_key)
);

create index if not exists attendances_conference_id_idx on public.attendances (conference_id);

-- Publieke clients praten uitsluitend met de Next.js API; geen publieke policies.
alter table public.attendances enable row level security;
