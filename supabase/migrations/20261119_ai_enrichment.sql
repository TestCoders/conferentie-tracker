-- AI-verrijking (roadmap #1/#4): ontbrekende conferentiegegevens en kostenaannames per land
-- laten schatten door een AI-model, met herkomst en datum zodat de UI het als AI-schatting toont.
-- Draai dit in de Supabase SQL editor. Idempotent: mag opnieuw gedraaid worden.
-- Staat ook in supabase/schema.sql voor nieuwe omgevingen.

-- Per conferentie: wanneer de AI hem voor het laatst bekeek en welke velden de AI heeft gevuld.
alter table public.conferences
  add column if not exists ai_checked_at timestamptz;
alter table public.conferences
  add column if not exists ai_fields text[] not null default '{}';
create index if not exists conferences_ai_checked_at_idx
  on public.conferences (ai_checked_at nulls first);

-- Per kostenaanname: door een beheerder ingevuld of door de AI geschat (met korte toelichting).
alter table public.cost_assumptions
  add column if not exists source text not null default 'admin'
    check (source in ('admin', 'ai'));
alter table public.cost_assumptions
  add column if not exists note text check (char_length(note) <= 300);

-- AI-runs worden gelogd in ingestion_runs met source_name 'ai-enrichment'.

-- Laat de API (PostgREST) de nieuwe kolommen direct zien.
notify pgrst, 'reload schema';
