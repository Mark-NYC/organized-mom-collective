-- /admin: one admin list, roles, audit log. Requires the survey and shop migrations.
-- Plan and setup: docs/operations/ADMIN_DASHBOARD_PLAN.md (Phase 1) and supabase/ADMIN.md.
--
-- Sign-in is email + password (owner decision 2026-10-16: no authenticator-app step).
--
-- What changes:
--   admin_users       replaces shop_admins / survey_admins as the source of truth (both are copied in;
--                     the old tables stay, unused, so nothing that references them breaks)
--   is_admin(role)    true only for a signed-in account with an admin_users row (and the role)
--   is_shop_admin()   now is_admin('owner'): every existing shop RLS policy uses admin_users
--   is_survey_admin() now is_admin('helper')
--   admin_audit_log   append-only record of admin actions (no secrets, addresses or message bodies)
begin;

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- owner: everything. helper: reserved for a future assistant (survey and contacts only today).
  role text not null default 'owner' check (role in ('owner', 'helper')),
  added_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from public, anon, authenticated;
grant select, insert, update, delete on public.admin_users to service_role;

insert into public.admin_users (user_id, role) select user_id, 'owner' from public.shop_admins on conflict do nothing;
insert into public.admin_users (user_id, role) select user_id, 'helper' from public.survey_admins on conflict do nothing;

-- Who counts as an admin lives here and only here.
create function public.is_admin(p_min_role text default 'helper') returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_users a
     where a.user_id = auth.uid() and (a.role = 'owner' or p_min_role = 'helper'));
$$;
revoke execute on function public.is_admin(text) from public, anon;
grant execute on function public.is_admin(text) to authenticated;

create or replace function public.is_shop_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin('owner');
$$;

create or replace function public.is_survey_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin('helper');
$$;

-- The shop-admin Edge Function asks this with the service role after verifying the token itself.
create or replace function public.shop_is_admin_user(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users where user_id = p_user and role = 'owner');
$$;

-- What the signed-in account is, for the /admin shell. Says nothing about anyone else.
create function public.admin_whoami() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'role', (select role from public.admin_users where user_id = auth.uid()),
    'admin', public.is_admin('helper'));
$$;
revoke execute on function public.admin_whoami() from public, anon;
grant execute on function public.admin_whoami() to authenticated;

-- ---------------------------------------------------------------- audit log

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  -- No foreign key: the log must outlive a deleted account (and can't be updated to null it).
  actor uuid,
  actor_email text check (char_length(actor_email) <= 254),
  action text not null check (action ~ '^[a-z][a-z0-9_.]{1,60}$'),
  target text check (char_length(target) <= 200),
  detail jsonb not null default '{}' check (jsonb_typeof(detail) = 'object' and pg_column_size(detail) <= 4000)
);
create index admin_audit_log_at on public.admin_audit_log (at desc);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from public, anon, authenticated;
grant select on public.admin_audit_log to authenticated;
create policy "Owners read the audit log" on public.admin_audit_log for select to authenticated using ((select public.is_admin('owner')));
grant select, insert on public.admin_audit_log to service_role;

-- Append-only, even for the service role.
create function public.admin_audit_log_frozen() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'admin_audit_log is append-only';
end $$;
revoke execute on function public.admin_audit_log_frozen() from public, anon, authenticated;
create trigger admin_audit_log_frozen before update or delete on public.admin_audit_log
  for each statement execute function public.admin_audit_log_frozen();

-- From the dashboard (signed-in admin). At most 60 entries per admin per minute.
create function public.admin_log(p_action text, p_target text default null, p_detail jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin('helper') then raise exception 'forbidden' using errcode = '42501'; end if;
  if (select count(*) from public.admin_audit_log where actor = auth.uid() and at > now() - interval '1 minute') >= 60 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.admin_audit_log (actor, actor_email, action, target, detail)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), p_action, left(p_target, 200), coalesce(p_detail, '{}'));
end $$;
revoke execute on function public.admin_log(text, text, jsonb) from public, anon;
grant execute on function public.admin_log(text, text, jsonb) to authenticated;

-- From Edge Functions (service role), after they verified the caller.
create function public.admin_log_service(p_actor uuid, p_action text, p_target text default null, p_detail jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.admin_audit_log (actor, actor_email, action, target, detail)
  values (p_actor, (select email from auth.users where id = p_actor), p_action, left(p_target, 200), coalesce(p_detail, '{}'));
$$;
revoke execute on function public.admin_log_service(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.admin_log_service(uuid, text, text, jsonb) to service_role;

-- Supabase advisor: a function without a fixed search_path.
alter function public.shop_download_days() set search_path = '';

commit;
