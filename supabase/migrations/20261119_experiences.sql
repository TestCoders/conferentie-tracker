-- Ervaringen delen: verslagen en foto's van (ook afgelopen) conferenties (roadmap #3).
-- Draai dit in de Supabase SQL editor. Idempotent: mag opnieuw gedraaid worden.
-- Staat ook in supabase/schema.sql voor nieuwe omgevingen.

create table if not exists public.experiences (
  id uuid primary key default gen_random_uuid(),
  -- Gekoppeld aan een conferentie uit de lijst, of vrij ingevuld (historische edities).
  conference_id uuid references public.conferences(id) on delete set null,
  conference_name text not null check (char_length(conference_name) between 1 and 200),
  conference_date date,
  conference_city text check (char_length(conference_city) <= 100),
  author_name text not null check (char_length(author_name) between 1 and 80),
  title text not null check (char_length(title) between 1 and 120),
  summary text not null check (char_length(summary) between 1 and 500),
  report text check (char_length(report) <= 8000),
  rating integer not null check (rating between 1 and 5),
  would_return text not null check (would_return in ('yes', 'maybe', 'no')),
  recommended_for text[] not null default '{}'
    check (recommended_for <@ array['development', 'testing', 'test-automation']::text[]),
  highlights text[] not null default '{}' check (cardinality(highlights) <= 10),
  tips text check (char_length(tips) <= 2000),
  links text[] not null default '{}' check (cardinality(links) <= 5),
  -- SHA-256 van het eenmalige bewerktoken (alleen de maker mag foto's toevoegen).
  edit_token_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists experiences_conference_id_idx on public.experiences (conference_id);
create index if not exists experiences_created_at_idx on public.experiences (created_at desc);

create table if not exists public.experience_photos (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences(id) on delete cascade,
  storage_path text not null unique,
  caption text check (char_length(caption) <= 200),
  width integer check (width between 1 and 10000),
  height integer check (height between 1 and 10000),
  created_at timestamptz not null default now()
);
create index if not exists experience_photos_experience_id_idx
  on public.experience_photos (experience_id);

-- Publieke clients praten uitsluitend met de Next.js API; geen publieke policies.
alter table public.experiences enable row level security;
alter table public.experience_photos enable row level security;

-- Openbare bucket voor foto's: lezen via URL, schrijven alleen via de server (service role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'experience-photos',
  'experience-photos',
  true,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Laat de API (PostgREST) de nieuwe tabellen direct zien.
notify pgrst, 'reload schema';
