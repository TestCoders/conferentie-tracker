-- Logo's/afbeeldingen per conferentie, overgenomen van de officiële website (og:image, icon).
-- Draai dit in de Supabase SQL editor. Idempotent: mag opnieuw gedraaid worden.
-- Staat ook in supabase/schema.sql voor nieuwe omgevingen.
-- Draai dit VÓÓR het deployen van de code: de API selecteert deze kolommen.

alter table public.conferences add column if not exists image_url text;
alter table public.conferences add column if not exists icon_url text;
-- null = website nog niet bekeken; daarna periodiek opnieuw (zie src/lib/discovery/images.ts).
alter table public.conferences add column if not exists images_checked_at timestamptz;
