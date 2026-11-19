-- Apply when the deployment with authenticated /api/experience-photos/[id] is live.
-- Previously shared public storage URLs must no longer bypass Microsoft login.
begin;
update storage.buckets set public = false where id = 'experience-photos';
commit;
