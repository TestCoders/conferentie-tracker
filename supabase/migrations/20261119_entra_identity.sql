-- Apply before deploying Entra identity writes. Existing anonymous rows remain unclaimed.
begin;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  entra_object_id uuid not null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, entra_object_id)
);
alter table public.app_users enable row level security;
revoke all on public.app_users from anon, authenticated;
grant all on public.app_users to service_role;

alter table public.reviews add column if not exists user_id uuid references public.app_users(id);
alter table public.attendances add column if not exists user_id uuid references public.app_users(id);
alter table public.experiences add column if not exists user_id uuid references public.app_users(id);
-- Keep the old deployment's ON CONFLICT target until the authenticated version is live.
-- Also restores compatibility when the initial revision of this migration was already applied.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.attendances'::regclass
      and conname = 'attendances_conference_id_name_key_key') then
    alter table public.attendances add constraint attendances_conference_id_name_key_key
      unique (conference_id, name_key);
  end if;
end;
$$;
create unique index if not exists attendances_conference_user_key on public.attendances(conference_id, user_id);
create unique index if not exists reviews_conference_user_key on public.reviews(conference_id, user_id);

-- One transaction for the attendance + optional review, shared with the standalone review route.
-- Only the trusted server may call this function with an authenticated application user ID.
create or replace function public.record_conference_contribution(
  p_user_id uuid,
  p_conference_id uuid,
  p_display_name text,
  p_status text default null,
  p_rating integer default null,
  p_comment text default null
) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_start date;
  v_attendance public.attendances;
  v_review public.reviews;
begin
  -- Avoid mixing verified account writes with the old anonymous production writer.
  if exists (select 1 from pg_constraint where conrelid = 'public.attendances'::regclass
      and conname = 'attendances_conference_id_name_key_key') then
    raise exception 'Bijdragen worden overgezet naar Microsoft-accounts. Probeer na de uitrol opnieuw.'
      using errcode = '55000';
  end if;
  if not exists (select 1 from public.app_users where id = p_user_id and disabled_at is null) then
    raise exception 'Account niet beschikbaar' using errcode = '42501';
  end if;
  select start_date into v_start from public.conferences
    where id = p_conference_id and status = 'approved';
  if not found then raise exception 'Conferentie niet gevonden' using errcode = 'P0002'; end if;
  if p_status is not null and p_status not in ('interested', 'attended') then
    raise exception 'Ongeldige status' using errcode = '22023';
  end if;
  if p_status is null and p_rating is null then
    raise exception 'Status of rating vereist' using errcode = '22023';
  end if;
  if p_rating is not null and (p_rating < 1 or p_rating > 5 or p_status = 'interested') then
    raise exception 'Ongeldige rating' using errcode = '22023';
  end if;
  if (p_status = 'attended' or p_rating is not null) and v_start > current_date then
    raise exception 'Beoordelen kan pas als de conferentie is begonnen' using errcode = '22023';
  end if;
  if char_length(btrim(p_display_name)) not between 1 and 80 or
     char_length(coalesce(p_comment, '')) > 1000 or (p_comment is not null and p_rating is null) then
    raise exception 'Ongeldige bijdrage' using errcode = '22023';
  end if;
  if p_status is not null then
    insert into public.attendances (conference_id, user_id, person_name, status)
      values (p_conference_id, p_user_id, p_display_name, p_status)
      on conflict (conference_id, user_id) do update
        set person_name = excluded.person_name, status = excluded.status, updated_at = now()
      returning * into v_attendance;
  end if;
  if p_rating is not null then
    insert into public.reviews (conference_id, user_id, reviewer_name, rating, comment)
      values (p_conference_id, p_user_id, p_display_name, p_rating, p_comment)
      on conflict (conference_id, user_id) do update
        set reviewer_name = excluded.reviewer_name, rating = excluded.rating, comment = excluded.comment
      returning * into v_review;
  end if;
  return jsonb_build_object('attendance', to_jsonb(v_attendance), 'review', to_jsonb(v_review));
end;
$$;
revoke all on function public.record_conference_contribution(uuid, uuid, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.record_conference_contribution(uuid, uuid, text, text, integer, text) to service_role;
commit;
