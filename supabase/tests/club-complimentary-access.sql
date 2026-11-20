-- Complimentary Family Meeting Club access (supabase/migrations/20261208000000_club_complimentary_access.sql).
-- Run by scripts/test-household-sql.sh on a throwaway local database. Never run on the real project.
\set ON_ERROR_STOP 1
\set QUIET 1
create function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
create function pg_temp.fails(q text, err text default null) returns boolean language plpgsql as $$
begin
  execute q;
  return false;
exception
  when insufficient_privilege then return err is null;
  when raise_exception then return err is null or sqlerrm = err;
end $$;
create function pg_temp.as_user(p_role text, p_sub text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when p_sub is null then '{}' else jsonb_build_object('sub', p_sub)::text end, false);
  execute format('set role %I', p_role);
end $$;

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000c0a01', 'comp-admin@example.com', now()),
  ('00000000-0000-0000-0000-0000000c0a02', 'comp-jen@example.com', now()),
  ('00000000-0000-0000-0000-0000000c0a03', 'comp-sam@example.com', now()),
  ('00000000-0000-0000-0000-0000000c0a04', 'comp-pat@example.com', now()),
  ('00000000-0000-0000-0000-0000000c0a05', 'comp-new@example.com', now()),
  ('00000000-0000-0000-0000-0000000c0a06', 'comp-free@example.com', now());
\set ADMIN '''00000000-0000-0000-0000-0000000c0a01'''
\set JEN '''00000000-0000-0000-0000-0000000c0a02'''
\set SAM '''00000000-0000-0000-0000-0000000c0a03'''
\set PAT '''00000000-0000-0000-0000-0000000c0a04'''
\set NEWBIE '''00000000-0000-0000-0000-0000000c0a05'''
\set FREE '''00000000-0000-0000-0000-0000000c0a06'''
insert into public.admin_users (user_id, role) values (:ADMIN, 'owner');

-- Jen's household, with Sam as the second adult; Pat pays; Free has a family and nothing else; Newbie has no family yet.
select pg_temp.as_user('authenticated', :JEN);
select public.club_household_save('The Comps', '{}',
  '[{"first_name":"Jen","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Sam","kind":"adult","role":"partner"},
    {"first_name":"Ada","kind":"child","role":"child","birth_year":2016,"birth_month":2}]');
create temp table inv as select public.household_invite_create((select id from public.club_family_members where first_name = 'Sam' and household_id = public.household_id_for(auth.uid())), 'comp-sam@example.com') as i;
select public.household_agreement_save(jsonb_build_object('id', gen_random_uuid(), 'category', 'meals', 'text', 'Set the table',
  'owner_ids', jsonb_build_array((select id from public.club_family_members where first_name = 'Ada' and household_id = public.household_id_for(auth.uid())))), null);
reset role;
grant select on inv to authenticated;
select pg_temp.as_user('authenticated', :SAM);
select public.household_invite_accept((select i ->> 'code' from inv));
reset role;
select pg_temp.as_user('authenticated', :PAT);
select public.club_household_save('The Pays', '{}', '[{"first_name":"Pat","kind":"adult","role":"parent","is_account_holder":true}]');
reset role;
select pg_temp.as_user('authenticated', :FREE);
select public.club_household_save('The Frees', '{}', '[{"first_name":"Fay","kind":"adult","role":"parent","is_account_holder":true}]');
reset role;
insert into public.club_subscriptions (stripe_subscription_id, stripe_customer_id, user_id, status, price_id, current_period_start, current_period_end, started_at, livemode)
values ('sub_Comp1', 'cus_Comp1', :PAT, 'active', 'price_1', now() - interval '2 days', now() + interval '28 days', now(), false);
create temp table hids as select household_id as h from public.household_adults where user_id = :JEN;
grant select on hids to authenticated, anon;
\set HID '(select h from hids)'
create temp table family_before as
  select (select count(*) from public.club_family_members where household_id = :HID) as members,
         (select count(*) from public.club_responsibilities where household_id = :HID and status = 'confirmed' and deleted_at is null) as agreements,
         (select count(*) from public.household_adults where household_id = :HID) as adults;
create temp table sub_before as select to_jsonb(s) - 'synced_at' as s from public.club_subscriptions s where stripe_subscription_id = 'sub_Comp1';
grant select on family_before, sub_before to authenticated;

-- ---------------------------------------------------------------- nobody but an owner admin
select pg_temp.as_user('authenticated', :JEN);
select pg_temp.expect(pg_temp.fails(format('select public.club_admin_access_grant(%L)', :JEN)), 'a family cannot grant itself the Club');
select pg_temp.expect(pg_temp.fails(format('select public.club_admin_access_search(%L)', 'comp-')), 'a family cannot search other people');
select pg_temp.expect(pg_temp.fails(format('insert into public.club_access_grants (user_id, reason) values (%L, %L)', :JEN, 'complimentary')), 'no direct insert of a grant');
select pg_temp.expect(pg_temp.fails('update public.club_access_grants set revoked_at = null'), 'no direct update of grants');
select pg_temp.expect(pg_temp.fails(format('select public.club_access_summary(%L)', :JEN)), 'internal helpers are not callable');
select pg_temp.expect((public.club_me() ->> 'access')::boolean is false, 'Jen starts free');
reset role;
select pg_temp.as_user('anon', null);
select pg_temp.expect(pg_temp.fails(format('select public.club_admin_access_detail(%L)', :JEN)), 'anonymous callers are refused');
reset role;

-- ---------------------------------------------------------------- find, see, grant
select pg_temp.as_user('authenticated', :ADMIN);
select pg_temp.expect(pg_temp.fails(format('select public.club_admin_access_search(%L)', 'co'), 'invalid'), 'search needs at least 3 characters');
select pg_temp.expect(jsonb_array_length(public.club_admin_access_search('COMP-')) = 6, 'search by part of an email, any case');
select pg_temp.expect((public.club_admin_access_search('comp-sam@example.com') -> 0 ->> 'email') = 'comp-sam@example.com', 'an exact email comes first');
select pg_temp.expect(pg_temp.fails(format('select public.club_admin_access_search(%L)', '%%%')) is false and jsonb_array_length(public.club_admin_access_search('%%%')) = 0, 'wildcards are taken literally');
create temp table s0 as select public.club_admin_access_detail(:SAM) as d;
select pg_temp.expect((select d ->> 'status' from s0) = 'free', 'Sam''s household is Free');
select pg_temp.expect((select d -> 'household' ->> 'display_name' from s0) = 'The Comps' and (select jsonb_array_length(d -> 'household' -> 'adults') from s0) = 2, 'the household and both adults are shown');
select pg_temp.expect(pg_temp.fails(format('select public.club_admin_access_grant(%L, now() - interval ''1 day'')', :SAM), 'invalid'), 'an expiry must be in the future');
-- Granting through the partner's email puts the grant on the household's owner account.
create temp table s1 as select public.club_admin_access_grant(:SAM, null, 'Friend of the family') as d;
select pg_temp.expect((select d ->> 'status' from s1) = 'complimentary', 'granted: Complimentary Club');
select pg_temp.expect((select user_id from public.club_access_grants where reason = 'complimentary' and revoked_at is null and user_id in (:JEN, :SAM)) = :JEN::uuid, 'the grant is on the household owner''s account');
select pg_temp.expect((select d -> 'grant' ->> 'granted_by' from s1) = 'comp-admin@example.com' and (select (d -> 'grant' ->> 'granted_at') is not null from s1), 'who granted it and when');
select pg_temp.expect((select count(*) from public.admin_audit_log where action = 'club.access.grant' and actor = :ADMIN and target = :HID::text) = 1, 'the grant is in the audit log, for the household');
select pg_temp.expect((select jsonb_array_length(d -> 'history') from s1) = 1, 'the detail shows the history');
reset role;

-- ---------------------------------------------------------------- both adults have the Club, server side
select pg_temp.as_user('authenticated', :JEN);
create temp table jme as select public.club_me() as m;
select pg_temp.expect((select (m ->> 'access')::boolean and m ->> 'grant' = 'complimentary' from jme), 'Jen: Club access, complimentary');
reset role;
select pg_temp.as_user('authenticated', :SAM);
create temp table sme as select public.club_me() as m;
select pg_temp.expect((select (m ->> 'access')::boolean from sme), 'Sam (second adult): Club access through the household');
select pg_temp.expect((select m ->> 'grant' = 'complimentary' and m ->> 'plan' is null and m ->> 'status' is null from sme), 'Sam sees the household''s grant (so the app shows Club Home), and still no billing');
reset role;
select pg_temp.expect(public.club_has_access(public.household_billing_user(:SAM)) and public.club_has_access(public.household_billing_user(:JEN)), 'every content check resolves both adults to the granted account');
select pg_temp.expect((select (d -> 'household' -> 'adults' -> 0 ->> 'club_access')::boolean and (d -> 'household' -> 'adults' -> 1 ->> 'club_access')::boolean from (select public.club_access_summary(:JEN) as d) x), 'the admin sees both adults with access');

-- ---------------------------------------------------------------- expiry: set, clear, lapse
select pg_temp.as_user('authenticated', :ADMIN);
select pg_temp.expect((public.club_admin_access_expiry(:JEN, now() + interval '30 days') -> 'grant' ->> 'expires_at') is not null, 'an expiry can be set');
select pg_temp.expect((public.club_admin_access_expiry(:JEN, null) -> 'grant' ->> 'expires_at') is null, 'and removed');
select pg_temp.expect(pg_temp.fails(format('select public.club_admin_access_expiry(%L, now() - interval ''1 minute'')', :JEN), 'invalid'), 'an expiry in the past is refused');
reset role;
-- Time passes (test only): the expiry is reached.
update public.club_access_grants set expires_at = now() - interval '1 second' where user_id = :JEN;
select pg_temp.expect(not public.club_has_access(:JEN) and not public.club_has_access(public.household_billing_user(:SAM)), 'expired: the Club closes for both adults by itself');
select pg_temp.as_user('authenticated', :ADMIN);
create temp table s2 as select public.club_admin_access_detail(:JEN) as d;
select pg_temp.expect((select d ->> 'status' from s2) = 'free' and (select (d -> 'grant' ->> 'expired')::boolean from s2), 'the admin sees it expired, now Free');
select pg_temp.expect(pg_temp.fails(format('select public.club_admin_access_expiry(%L, null)', :JEN), 'not_granted'), 'an expired grant can''t be stretched; grant again instead');
select pg_temp.expect((public.club_admin_access_grant(:JEN, now() + interval '90 days') ->> 'status') = 'complimentary', 'granting again renews it, with a new expiry');
reset role;
select pg_temp.expect(public.club_has_access(:JEN), 'renewed: access again');

-- ---------------------------------------------------------------- the MAWL development layer works for the second adult
-- (only where 20261207 is applied: this migration doesn't depend on it)
select to_regclass('public.household_development') is not null as has_dev \gset
\if :has_dev
select pg_temp.as_user('authenticated', :SAM);
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', gen_random_uuid(), 'decision', 'start',
  'member_id', (select id from public.club_family_members where first_name = 'Ada' and household_id = public.household_id_for(auth.uid())),
  'skill_id', 'table', 'title', 'Set the table', 'stage', 'model', 'category', 'meals', 'agreement_id', gen_random_uuid(), 'library_version', 1)) ->> 'status') = 'active',
  'Club personalization: the second adult can add a skill to the plan');
reset role;
\endif

-- ---------------------------------------------------------------- revoke: the Club closes, the family stays
select pg_temp.as_user('authenticated', :ADMIN);
create temp table s3 as select public.club_admin_access_revoke(:JEN, 'Trial ended') as d;
select pg_temp.expect((select d ->> 'status' from s3) = 'free', 'revoked: Free');
select pg_temp.expect((select d -> 'grant' ->> 'revoked_by' from s3) = 'comp-admin@example.com' and (select (d -> 'grant' ->> 'revoked_at') is not null from s3), 'who revoked it and when');
select pg_temp.expect(pg_temp.fails(format('select public.club_admin_access_revoke(%L)', :JEN), 'not_granted'), 'revoking twice says there is nothing to revoke');
select pg_temp.expect((select count(*) from public.admin_audit_log where action like 'club.access.%' and target = :HID::text) = 5, 'every change is in the audit log (grant, expiry set, expiry removed, grant, revoke; refused calls leave none)');
reset role;
select pg_temp.expect(not public.club_has_access(public.household_billing_user(:SAM)) and not public.club_has_access(:JEN), 'both adults lose the Club');
select pg_temp.expect((select members from family_before) = (select count(*) from public.club_family_members where household_id = :HID)
  and (select agreements from family_before) <= (select count(*) from public.club_responsibilities where household_id = :HID and status = 'confirmed' and deleted_at is null)
  and (select adults from family_before) = (select count(*) from public.household_adults where household_id = :HID), 'family, agreements and both adults are kept');
\if :has_dev
select pg_temp.expect((select count(*) from public.household_development where household_id = :HID) = 1, 'the MAWL records are kept (readable again if the Club returns)');
select pg_temp.as_user('authenticated', :SAM);
select pg_temp.expect(jsonb_array_length(public.household_development()) = 1, 'the family still reads its development history');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb, 1)', jsonb_build_object('id', (select id from public.household_development limit 1), 'decision', 'stay', 'library_version', 1)), 'club_required'), 'but paid-layer decisions are closed again');
reset role;
\endif

-- ---------------------------------------------------------------- paid stays paid; paid + complimentary
select pg_temp.expect(public.club_has_access(:PAT), 'Pat pays: Club access');
select pg_temp.as_user('authenticated', :ADMIN);
select pg_temp.expect((public.club_admin_access_detail(:PAT) ->> 'status') = 'paid', 'Pat is Paid Club');
select pg_temp.expect(pg_temp.fails(format('select public.club_admin_access_revoke(%L)', :PAT), 'not_granted'), 'revoke never touches a paid membership (nothing to revoke)');
select pg_temp.expect((public.club_admin_access_grant(:PAT) ->> 'status') = 'paid_and_complimentary', 'paid and complimentary together');
select pg_temp.expect((public.club_admin_access_revoke(:PAT) ->> 'status') = 'paid', 'revoking the complimentary part leaves Paid');
reset role;
select pg_temp.expect(public.club_has_access(:PAT), 'Pat keeps access through the subscription');
select pg_temp.expect((select to_jsonb(s) - 'synced_at' from public.club_subscriptions s where stripe_subscription_id = 'sub_Comp1') = (select s from sub_before), 'the subscription row is exactly as before');
-- The other way round: the subscription ends while a complimentary grant is live.
select pg_temp.as_user('authenticated', :ADMIN);
select public.club_admin_access_grant(:PAT);
reset role;
update public.club_subscriptions set status = 'canceled', ended_at = now() where stripe_subscription_id = 'sub_Comp1';
select pg_temp.expect(public.club_has_access(:PAT), 'subscription ended, complimentary grant live: access stays');
select pg_temp.as_user('authenticated', :ADMIN);
select pg_temp.expect((public.club_admin_access_detail(:PAT) ->> 'status') = 'complimentary', 'now Complimentary');
reset role;

-- ---------------------------------------------------------------- someone with no family yet; an old beta grant
select pg_temp.as_user('authenticated', :ADMIN);
select pg_temp.expect((public.club_admin_access_grant(:NEWBIE) ->> 'status') = 'complimentary' and (public.club_admin_access_detail(:NEWBIE) -> 'household') = 'null'::jsonb, 'a new account without a family can be granted (on their own account)');
reset role;
select pg_temp.expect(public.club_has_access(:NEWBIE), 'and has access');
insert into public.club_access_grants (user_id, reason, note) values (:FREE, 'beta', 'old beta');
select pg_temp.as_user('authenticated', :ADMIN);
select pg_temp.expect((public.club_admin_access_detail(:FREE) ->> 'status') = 'complimentary', 'an existing beta grant shows as complimentary');
select pg_temp.expect((public.club_admin_access_grant(:FREE) -> 'grant' ->> 'reason') = 'complimentary', 'granting it again records it as complimentary');
reset role;
do $$ begin
  insert into public.club_access_grants (user_id, reason) values ('00000000-0000-0000-0000-0000000c0a01', 'free-forever');
  raise exception 'FAIL: an unknown grant reason was accepted';
exception when check_violation then raise notice 'ok - only preview, beta and complimentary grants exist';
end $$;
