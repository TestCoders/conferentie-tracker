-- Kostenschatting voor (bijna) elke conferentie (roadmap #4, vervolg op cost_assumptions).
-- Draai dit in de Supabase SQL editor. Idempotent: mag opnieuw gedraaid worden.
-- Staat ook in supabase/schema.sql voor nieuwe omgevingen.
--
-- online_only:       gezet door discovery; online-only = geen reis- of hotelkosten.
-- ticket_price_eur:  officiële ticketprijs per persoon in hele euro's, ingevuld door een beheerder.
-- ticket_price_url:  bron van die prijs (pagina op de officiële website).
-- Standaardaanname voor landen zonder eigen aanname: rij in cost_assumptions met country_key '*'.

alter table public.conferences
  add column if not exists online_only boolean not null default false;
alter table public.conferences
  add column if not exists ticket_price_eur integer
    check (ticket_price_eur between 0 and 20000);
alter table public.conferences
  add column if not exists ticket_price_url text
    check (ticket_price_url like 'https://%' and char_length(ticket_price_url) <= 2000);

-- Laat de API (PostgREST) de nieuwe kolommen direct zien.
notify pgrst, 'reload schema';
