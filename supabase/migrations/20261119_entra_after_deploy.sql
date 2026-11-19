-- Run ONLY after the authenticated deployment is live and old anonymous write routes are gone.
-- The old application requires this conflict target; do not run before deploying the new code.
-- After this step, distinct users with the same display name can both attend a conference.
begin;
alter table public.attendances drop constraint if exists attendances_conference_id_name_key_key;
commit;
