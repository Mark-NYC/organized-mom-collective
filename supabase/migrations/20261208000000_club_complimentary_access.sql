-- Complimentary Family Meeting Club access, granted by the owner from /admin/club (docs/ios/APP_STORE_LAUNCH.md).
--
-- NOT APPLIED. Needs the owner's approval, a production preflight and a verified backup
-- (supabase/rollout/club-complimentary/). Depends only on what production already has: 20261020 admin_core
-- (is_admin, admin_log, admin_audit_log), 20261023/20261104 club core (club_access_grants, club_has_access,
-- club_has_paid_access), 20261124 household_shared (household_id_for, household_adults) and 20261128
-- household_club_access (household_billing_user, club_me's partner view). Independent of 20261130, 20261202–04 and
-- 20261207, in either order (20261203 patches a different line of club_me).
--
-- No new entitlement system. A complimentary membership is an ordinary club_access_grants row, the mechanism the
-- Club already uses for its preview and beta access, on the household's owner account:
--   - club_has_access(user) = a live paid subscription OR an unexpired, unrevoked grant. Unchanged.
--   - Both adults: every Club content check already resolves the household's account through household_billing_user
--     (20261128), so a grant on the owner opens the Club for the partner too. club_me's partner view now also reports
--     the grant (one token, patched from the live definition), so the app shows the partner the member Club Home.
--   - Paid is untouched: these functions never read or write club_subscriptions, club_invoices or Stripe. Revoking a
--     grant ends only the grant; a household that also pays keeps access through its subscription, and a household
--     whose subscription ends keeps access through its grant.
--   - Expiry is the grant's existing expires_at: access ends on its own at that moment (club_has_access compares it to
--     now()); nothing has to run.
--   - Who and when: granted_by / revoked_by / updated_at on the row, and every change in the append-only
--     admin_audit_log (club.access.grant | club.access.revoke | club.access.expiry), with the household and the note.
--   - Only an owner admin (is_admin('owner')) can call these functions; the table has no insert, update or delete
--     grant for signed-in users, so nobody can grant themselves access from the app or the website.
begin;

-- ---------------------------------------------------------------- the grant row: a third reason, and who did it

do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.club_access_grants'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%reason%';
  if c is null then raise exception 'club_access_grants: reason check not found'; end if;
  execute format('alter table public.club_access_grants drop constraint %I', c);
end $$;
alter table public.club_access_grants
  add constraint club_access_grants_reason_check check (reason in ('preview', 'beta', 'complimentary')),
  add column granted_by uuid references auth.users (id) on delete set null,
  add column revoked_by uuid references auth.users (id) on delete set null,
  add column updated_at timestamptz not null default now();

-- ---------------------------------------------------------------- helpers (internal)

-- The household a person belongs to: as one of its adults, else the one they own.
create function public.club_access_household(p_uid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(public.household_id_for(p_uid), (select h.id from public.club_households h where h.owner_user_id = p_uid))
$$;
revoke execute on function public.club_access_household(uuid) from public, anon, authenticated;

-- Where a household's complimentary grant lives: its owner's account (whose membership both adults use), or the person
-- themself before they have a household.
create function public.club_access_grant_target(p_uid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce((select h.owner_user_id from public.club_households h where h.id = public.club_access_household(p_uid)), p_uid)
$$;
revoke execute on function public.club_access_grant_target(uuid) from public, anon, authenticated;

-- A grant is live while it is neither revoked nor past its expiry.
create function public.club_grant_live(g public.club_access_grants) returns boolean
language sql stable set search_path = '' as $$
  select g.revoked_at is null and (g.expires_at is null or g.expires_at > now())
$$;
revoke execute on function public.club_grant_live(public.club_access_grants) from public, anon, authenticated;

-- What the admin page shows for one person and their household.
create function public.club_access_summary(p_uid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  hid uuid := public.club_access_household(p_uid);
  target uuid := public.club_access_grant_target(p_uid);
  h public.club_households%rowtype;
  g public.club_access_grants%rowtype;
  adults uuid[];
  paid boolean;
  comp boolean;
begin
  select * into h from public.club_households where id = hid;
  adults := case when hid is null then array[p_uid]
                 else coalesce((select array_agg(a.user_id) from public.household_adults a where a.household_id = hid), array[h.owner_user_id]) end;
  select * into g from public.club_access_grants where user_id = target;
  paid := exists (select 1 from unnest(adults) u where public.club_has_paid_access(u));
  comp := exists (select 1 from public.club_access_grants x where x.user_id = any (adults) and public.club_grant_live(x));
  return jsonb_build_object(
    'user_id', p_uid,
    'email', (select email from auth.users where id = p_uid),
    'signed_up_at', (select to_jsonb(u) ->> 'created_at' from auth.users u where u.id = p_uid), -- (the local test stub has no created_at)
    'household', case when hid is null then null else jsonb_build_object(
      'id', h.id, 'display_name', h.display_name, 'owner_user_id', h.owner_user_id,
      'adults', coalesce((select jsonb_agg(jsonb_build_object(
          'user_id', a.user_id, 'email', u.email, 'role', a.role,
          'club_access', public.club_has_access(public.household_billing_user(a.user_id))) order by a.role desc, u.email)
        from public.household_adults a join auth.users u on u.id = a.user_id where a.household_id = hid), '[]'),
      'children', (select count(*) from public.club_family_members m where m.household_id = hid and m.archived_at is null and m.kind = 'child')) end,
    'status', case when paid and comp then 'paid_and_complimentary' when paid then 'paid' when comp then 'complimentary' else 'free' end,
    'paid', coalesce((select jsonb_build_object('plan', s.plan, 'status', s.status, 'current_period_end', s.current_period_end,
                                                'cancel_at_period_end', s.cancel_at_period_end, 'revoked', s.access_revoked_at is not null)
                        from public.club_subscriptions s where s.user_id = any (adults)
                       order by (s.status in ('trialing', 'active', 'past_due')) desc, s.created_at desc limit 1), 'null'::jsonb),
    'grant', case when g.user_id is null then null else jsonb_build_object(
      'on', g.user_id, 'reason', g.reason, 'note', g.note, 'live', public.club_grant_live(g),
      'granted_at', g.granted_at, 'granted_by', (select email from auth.users where id = g.granted_by),
      'expires_at', g.expires_at, 'expired', g.expires_at is not null and g.expires_at <= now(),
      'revoked_at', g.revoked_at, 'revoked_by', (select email from auth.users where id = g.revoked_by),
      'updated_at', g.updated_at) end,
    'history', coalesce((select jsonb_agg(jsonb_build_object('at', l.at, 'by', l.actor_email, 'action', l.action, 'detail', l.detail) order by l.at desc)
                           from (select * from public.admin_audit_log l
                                  where l.action like 'club.access.%' and l.target = coalesce(hid::text, p_uid::text)
                                  order by l.at desc limit 20) l), '[]'));
end $$;
revoke execute on function public.club_access_summary(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- owner admin (browser, is_admin('owner'), audited)

-- Find people by email (at least 3 characters; up to 20 matches, closest first).
create function public.club_admin_access_search(p_query text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare q text := lower(btrim(coalesce(p_query, '')));
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(q) < 3 or char_length(q) > 254 then raise exception 'invalid'; end if;
  return coalesce((select jsonb_agg(public.club_access_summary(u.id) - 'history' order by (lower(u.email) = q) desc, (lower(u.email) like q || '%') desc, u.email)
                     from (select id, email from auth.users
                            where lower(email) like '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%'
                            order by (lower(email) = q) desc, email limit 20) u), '[]');
end $$;

create function public.club_admin_access_detail(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'not_found'; end if;
  return public.club_access_summary(p_user);
end $$;

-- Grant (or renew) complimentary access for this person's household. p_expires_at: optional, in the future.
create function public.club_admin_access_grant(p_user uuid, p_expires_at timestamptz default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  admin uuid := auth.uid();
  target uuid;
  hid uuid;
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'not_found'; end if;
  if p_expires_at is not null and p_expires_at <= now() then raise exception 'invalid'; end if;
  if p_note is not null and char_length(btrim(p_note)) > 200 then raise exception 'invalid'; end if;
  target := public.club_access_grant_target(p_user);
  hid := public.club_access_household(p_user);
  insert into public.club_access_grants as g (user_id, reason, note, granted_at, expires_at, revoked_at, granted_by, revoked_by, updated_at)
  values (target, 'complimentary', nullif(btrim(p_note), ''), now(), p_expires_at, null, admin, null, now())
  on conflict (user_id) do update
    set reason = 'complimentary', note = coalesce(nullif(btrim(p_note), ''), g.note), granted_at = now(),
        expires_at = p_expires_at, revoked_at = null, revoked_by = null, granted_by = admin, updated_at = now();
  perform public.admin_log('club.access.grant', coalesce(hid::text, target::text),
    jsonb_build_object('on', target, 'expires_at', p_expires_at, 'note', nullif(btrim(p_note), '')));
  return public.club_access_summary(p_user);
end $$;

-- End complimentary access for this person's household (every live grant on its adults). Never touches a paid
-- subscription: a household that also pays keeps access through it.
create function public.club_admin_access_revoke(p_user uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  admin uuid := auth.uid();
  hid uuid;
  adults uuid[];
  n int;
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'not_found'; end if;
  if p_note is not null and char_length(btrim(p_note)) > 200 then raise exception 'invalid'; end if;
  hid := public.club_access_household(p_user);
  adults := case when hid is null then array[p_user]
                 else array(select a.user_id from public.household_adults a where a.household_id = hid
                            union select h.owner_user_id from public.club_households h where h.id = hid) end;
  update public.club_access_grants g set revoked_at = now(), revoked_by = admin, updated_at = now()
   where g.user_id = any (adults) and g.revoked_at is null;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'not_granted'; end if;
  perform public.admin_log('club.access.revoke', coalesce(hid::text, p_user::text),
    jsonb_build_object('grants', n, 'note', nullif(btrim(p_note), '')));
  return public.club_access_summary(p_user);
end $$;

-- Set (or, with null, remove) the expiry of the household's live complimentary grant.
create function public.club_admin_access_expiry(p_user uuid, p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  hid uuid;
  n int;
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'not_found'; end if;
  if p_expires_at is not null and p_expires_at <= now() then raise exception 'invalid'; end if;
  target := public.club_access_grant_target(p_user);
  hid := public.club_access_household(p_user);
  update public.club_access_grants g set expires_at = p_expires_at, updated_at = now()
   where g.user_id = target and g.revoked_at is null and (g.expires_at is null or g.expires_at > now());
  get diagnostics n = row_count;
  if n = 0 then raise exception 'not_granted'; end if;
  perform public.admin_log('club.access.expiry', coalesce(hid::text, target::text), jsonb_build_object('on', target, 'expires_at', p_expires_at));
  return public.club_access_summary(p_user);
end $$;

revoke execute on function public.club_admin_access_search(text), public.club_admin_access_detail(uuid),
  public.club_admin_access_grant(uuid, timestamptz, text), public.club_admin_access_revoke(uuid, text),
  public.club_admin_access_expiry(uuid, timestamptz) from public, anon;
grant execute on function public.club_admin_access_search(text), public.club_admin_access_detail(uuid),
  public.club_admin_access_grant(uuid, timestamptz, text), public.club_admin_access_revoke(uuid, text),
  public.club_admin_access_expiry(uuid, timestamptz) to authenticated;

-- ---------------------------------------------------------------- club_me: the partner sees the household's grant

-- 20261128 gave the other adult the household's access but reported no grant, so the app's Club Home (which shows the
-- member view for a paid membership or a grant) showed a complimentary household's partner the preview. One token,
-- patched from the live definition; nothing about billing is added.
do $$
declare
  d text := pg_get_functiondef('public.club_me()'::regprocedure);
  patched text;
begin
  patched := replace(d, '''grant'', null,', '''grant'', r -> ''grant'',');
  if patched = d then raise exception 'club_me: unexpected definition, not patched'; end if;
  execute patched;
end $$;

commit;
