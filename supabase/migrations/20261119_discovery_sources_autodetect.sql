-- Eigen discoverybronnen: formaat wordt per URL automatisch herkend (geen vaste dropdown meer).
-- Draai dit in de Supabase SQL editor, na 20261119_discovery_sources.sql. Idempotent.
-- Staat ook in supabase/schema.sql voor nieuwe omgevingen.
--
-- format:            herkend formaat (zie CUSTOM_SOURCE_FORMATS in src/lib/types.ts).
-- config:            bij json/yaml: pad naar de lijst en welke sleutel welk veld is.
-- default_category:  categorie als de conferentienaam geen bewijs voor testing bevat.

alter table public.discovery_sources
  drop constraint if exists discovery_sources_format_check;
alter table public.discovery_sources
  add constraint discovery_sources_format_check check (
    format in ('confs-tech-json', 'testing-conferences-yaml', 'json', 'yaml', 'ical', 'jsonld', 'ai')
  );
alter table public.discovery_sources
  add column if not exists config jsonb;
alter table public.discovery_sources
  add column if not exists default_category text not null default 'development'
    check (default_category in ('development', 'testing', 'test-automation'));

-- Laat de API (PostgREST) de nieuwe kolommen direct zien.
notify pgrst, 'reload schema';
