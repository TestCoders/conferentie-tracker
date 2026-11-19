-- Conference Tracker — schema voor demo 1 (eigenaar: A).
-- Draai dit in de Supabase SQL editor. Idempotent: mag opnieuw gedraaid worden.
-- Wijzigingen alleen via A en met akkoord van het team (zie AGENTS.md).

create table if not exists public.conferences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  official_url text not null,
  canonical_url text not null,
  source_name text not null,
  source_url text not null,
  start_date date not null,
  end_date date,
  city text,
  country text,
  category text not null default 'development'
    check (category in ('development', 'testing', 'test-automation')),
  cfp_url text,
  cfp_deadline date,
  price_text text,
  status text not null default 'approved'
    check (status in ('pending', 'approved', 'rejected')),
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (canonical_url, start_date)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  conference_id uuid not null references public.conferences(id) on delete cascade,
  reviewer_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  status text not null check (status in ('running', 'success', 'failed')),
  found_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Publieke clients praten uitsluitend met de Next.js API, niet direct met Supabase.
-- De server gebruikt de service-role key. Maak voor deze demo GEEN publieke policies.
alter table public.conferences enable row level security;
alter table public.reviews enable row level security;
alter table public.ingestion_runs enable row level security;
