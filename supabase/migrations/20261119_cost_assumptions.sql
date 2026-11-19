-- Kostenaannames per land voor de schatting van reis- en hotelkosten (roadmap #4).
-- Draai dit in de Supabase SQL editor. Idempotent: mag opnieuw gedraaid worden.
-- Staat ook in supabase/schema.sql voor nieuwe omgevingen.
--
-- country_key is genormaliseerd door de API (src/lib/costs.ts: countryKey), zodat
-- 'USA', 'U.S.A.' en 'United States' dezelfde aanname gebruiken.

create table if not exists public.cost_assumptions (
  country_key text primary key check (char_length(country_key) between 1 and 80),
  country_label text not null check (char_length(country_label) between 1 and 80),
  -- Reis retour vanuit Nederland, per persoon, hele euro's.
  travel_eur integer not null check (travel_eur between 0 and 20000),
  -- Hotel per nacht, per persoon, hele euro's.
  hotel_per_night_eur integer not null check (hotel_per_night_eur between 0 and 5000),
  updated_at timestamptz not null default now()
);

-- Publieke clients praten uitsluitend met de Next.js API; geen publieke policies.
alter table public.cost_assumptions enable row level security;

-- Laat de API (PostgREST) de nieuwe tabel direct zien.
notify pgrst, 'reload schema';
