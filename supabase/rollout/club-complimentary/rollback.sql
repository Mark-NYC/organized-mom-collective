-- Rollback for 20261208_club_complimentary_access ONLY (the same section is at the top of
-- supabase/rollout/household/rollback.sql). Removes the admin functions and the grant columns; every grant stays,
-- complimentary ones as beta (same access). The audit log keeps its rows. NEVER run without the owner's go.
begin;
-- club_me: the partner view back to 'grant', null (only if 20261208 patched it).
do $$
declare d text; p text;
begin
  if to_regprocedure('public.club_admin_access_grant(uuid,timestamptz,text)') is not null then
    d := pg_get_functiondef('public.club_me()'::regprocedure);
    p := replace(d, '''grant'', r -> ''grant'',', '''grant'', null,');
    if p <> d then execute p; end if;
  end if;
end $$;
drop function if exists public.club_admin_access_search(text);
drop function if exists public.club_admin_access_detail(uuid);
drop function if exists public.club_admin_access_grant(uuid, timestamptz, text);
drop function if exists public.club_admin_access_revoke(uuid, text);
drop function if exists public.club_admin_access_expiry(uuid, timestamptz);
drop function if exists public.club_access_summary(uuid);
drop function if exists public.club_grant_live(public.club_access_grants);
drop function if exists public.club_access_grant_target(uuid);
drop function if exists public.club_access_household(uuid);
-- Complimentary grants become beta grants (the earlier name for the same thing): nobody loses access by the rollback.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'club_access_grants' and column_name = 'granted_by') then
    update public.club_access_grants set reason = 'beta' where reason = 'complimentary';
    alter table public.club_access_grants drop constraint if exists club_access_grants_reason_check;
    alter table public.club_access_grants add constraint club_access_grants_reason_check check (reason in ('preview', 'beta'));
    alter table public.club_access_grants drop column if exists granted_by, drop column if exists revoked_by, drop column if exists updated_at;
  end if;
end $$;
commit;
