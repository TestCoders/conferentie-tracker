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
  -- Zie migrations/20261119_cost_estimate_coverage.sql.
  online_only boolean not null default false,
  ticket_price_eur integer check (ticket_price_eur between 0 and 20000),
  ticket_price_url text
    check (ticket_price_url like 'https://%' and char_length(ticket_price_url) <= 2000),
  -- Van de officiële website (og:image / icon); zie migrations/20261119_conference_images.sql.
  image_url text,
  icon_url text,
  images_checked_at timestamptz,
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

-- Interesse / bijgewoond per persoon (zie ook migrations/20261119_attendances.sql).
create table if not exists public.attendances (
  id uuid primary key default gen_random_uuid(),
  conference_id uuid not null references public.conferences(id) on delete cascade,
  person_name text not null check (char_length(btrim(person_name)) between 1 and 80),
  name_key text generated always as (lower(btrim(person_name))) stored,
  status text not null check (status in ('interested', 'attended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conference_id, name_key)
);
create index if not exists attendances_conference_id_idx on public.attendances (conference_id);

-- Kostenaannames per land (zie ook migrations/20261119_cost_assumptions.sql).
-- country_key '*' = standaardaanname voor landen zonder eigen aanname.
create table if not exists public.cost_assumptions (
  country_key text primary key check (char_length(country_key) between 1 and 80),
  country_label text not null check (char_length(country_label) between 1 and 80),
  travel_eur integer not null check (travel_eur between 0 and 20000),
  hotel_per_night_eur integer not null check (hotel_per_night_eur between 0 and 5000),
  updated_at timestamptz not null default now()
);

-- Handmatig toegevoegde discoverybronnen (zie ook migrations/20261119_discovery_sources.sql).
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

-- Publieke clients praten uitsluitend met de Next.js API, niet direct met Supabase.
-- De server gebruikt de service-role key. Maak voor deze demo GEEN publieke policies.
alter table public.conferences enable row level security;
alter table public.reviews enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.attendances enable row level security;
alter table public.cost_assumptions enable row level security;
alter table public.discovery_sources enable row level security;

-- Ervaringen en foto's (roadmap #3): zie migrations/20261119_experiences.sql voor de
-- volledige definitie, inclusief de storage-bucket 'experience-photos'.

-- AI-verrijking: zie migrations/20261119_ai_enrichment.sql (conferences.ai_checked_at,
-- conferences.ai_fields, cost_assumptions.source en cost_assumptions.note).
