-- Favorieten per account (roadmap R5). Vereist migrations/20261119_entra_identity.sql (app_users).
-- Veilig opnieuw uit te voeren. Tot deze migratie draait, valt de app terug op favorieten per browser.
begin;

create table if not exists public.favorites (
  user_id uuid not null references public.app_users(id) on delete cascade,
  conference_id uuid not null references public.conferences(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, conference_id)
);

alter table public.favorites enable row level security;
revoke all on public.favorites from anon, authenticated;
grant all on public.favorites to service_role;

commit;
