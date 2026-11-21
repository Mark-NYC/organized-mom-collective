-- Family Meeting Club for the whole household (supabase/migrations/20261128000000_household_club_access.sql).
-- Throwaway local database only.
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
  ('00000000-0000-0000-0000-0000000f1001', 'hca-owner@example.com', now()),
  ('00000000-0000-0000-0000-0000000f1002', 'hca-partner@example.com', now()),
  ('00000000-0000-0000-0000-0000000f1003', 'hca-stranger@example.com', now());
\set OWNER '''00000000-0000-0000-0000-0000000f1001'''
\set PARTNER '''00000000-0000-0000-0000-0000000f1002'''
\set STRANGER '''00000000-0000-0000-0000-0000000f1003'''
\set SLUG '''2027-02-better-together'''

-- The owner's household; February is published and released; she holds February (paid) and has Club access.
select pg_temp.as_user('authenticated', :OWNER);
select public.club_household_save('The Halls', '{}',
  '[{"first_name":"Hana","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Hugo","kind":"adult","role":"partner"},
    {"first_name":"Ivo","kind":"child","role":"child","birth_year":2018,"birth_month":3}]');
reset role;
\set HID '(select household_id from public.household_adults where user_id = ''00000000-0000-0000-0000-0000000f1001'')'
update public.club_kits set status = 'scheduled', release_at = least(release_at, now()) where slug = :SLUG;
insert into public.club_entitlements (user_id, household_id, resource_month, kind, membership_year, plan, source, note)
  values (:OWNER, :HID, '2027-02-01', 'digital', 1, 'admin', 'admin', 'household club access test');
insert into public.club_access_grants (user_id, reason, note) values (:OWNER, 'beta', 'household club access test');
select pg_temp.as_user('authenticated', :OWNER);
create temp table inv as select public.household_invite_create((select id from public.club_family_members where first_name = 'Hugo'), 'hca-partner@example.com') as i;
reset role;
grant select on inv to authenticated;

-- ---------------------------------------------------------------- before joining: nothing
select pg_temp.as_user('authenticated', :PARTNER);
select pg_temp.expect((public.club_me() ->> 'access')::boolean is false, 'before joining: no Club access');
select pg_temp.expect(pg_temp.fails(format('select public.club_resource_get(%L)', :SLUG), 'not_found'), 'before joining: can''t open the household''s month');
select public.household_invite_accept((select i ->> 'code' from inv));

-- ---------------------------------------------------------------- the partner uses the household's membership
create temp table pme as select public.club_me() as m;
select pg_temp.expect((select (m ->> 'access')::boolean from pme), 'partner: Club access through the household');
select pg_temp.expect((select m ->> 'household_role' from pme) = 'partner', 'partner: told they''re the partner');
select pg_temp.expect((select jsonb_path_exists(m, '$.kits[*] ? (@.slug == "2027-02-better-together" && @.can == "edit")') from pme), 'partner: the household''s month, editable');
select pg_temp.expect((select jsonb_path_exists(m, '$.months[*] ? (@.month == "2027-02-01")') from pme), 'partner: the household''s months');
select pg_temp.expect((select m -> 'plan' = 'null'::jsonb and m -> 'status' = 'null'::jsonb and m -> 'renews' = 'null'::jsonb
                         and m -> 'intro' = 'null'::jsonb and m -> 'has_address' = 'null'::jsonb and m -> 'welcome' = 'null'::jsonb and m -> 'next' = 'null'::jsonb from pme),
  'partner: no plan, status, renewal, intro, address, welcome items or next charge');
-- The household's grant: hidden by 20261128; shown since 20261208 (complimentary access), so the app opens the member
-- Club Home for the second adult of a complimentary household. Not billing information.
select pg_temp.expect((select m -> 'grant' from pme) = case when to_regprocedure('public.club_admin_access_grant(uuid,timestamptz,text)') is null
                                                           then 'null'::jsonb else '"beta"'::jsonb end,
  'partner: the household''s grant (from 20261208 on)');
select pg_temp.expect((select not jsonb_path_exists(m, '$.months[*].mailing') and not jsonb_path_exists(m, '$.months[*].plan') from pme), 'partner: no mailing or plan details per month');
select pg_temp.expect((public.club_resource_get(:SLUG) ->> 'can') = 'edit', 'partner opens the month');
select pg_temp.expect(public.club_resource_save(:SLUG, '{"omc:club:feb":"{\"by\":\"partner\"}"}', 0) = 1, 'partner edits the household''s copy');
select pg_temp.expect((public.club_welcome_plan_get() ->> 'can') = 'edit', 'partner opens the Family Rhythm');
select pg_temp.expect(public.club_welcome_plan_save('{}', 0) >= 0, 'partner edits the Family Rhythm');
-- Owner-only.
select pg_temp.expect(pg_temp.fails(format('select public.club_fulfillment_approve(%L)', :SLUG)), 'partner can''t approve the month for printing');
select pg_temp.expect(pg_temp.fails($$select public.club_welcome_plan_approve(1, 'x')$$), 'partner can''t approve the Family Rhythm for printing');
select pg_temp.expect(pg_temp.fails($$select public.club_address_save('{"name":"H","line1":"1 A St","city":"X","state":"NY","postal_code":"10001"}')$$, 'owner_only'), 'partner can''t set a mailing address');
select pg_temp.expect(pg_temp.fails($$select public.club_welcome_save('{}')$$), 'partner can''t personalize the Vision print');
reset role;

-- ---------------------------------------------------------------- the owner is unchanged, and sees the same copy
select pg_temp.as_user('authenticated', :OWNER);
create temp table ome as select public.club_me() as m;
select pg_temp.expect((select m ->> 'grant' from ome) = 'beta' and (select not (m ? 'household_role') from ome), 'owner: club_me exactly as before (grant shown, no partner fields)');
select pg_temp.expect((public.club_resource_get(:SLUG) -> 'state' ->> 'omc:club:feb') like '%partner%', 'owner sees the partner''s edit (one household copy)');
select pg_temp.expect(public.club_address_save('{"name":"Hana Hall","line1":"1 Elm St","city":"Town","state":"NY","postal_code":"10001"}') ->> 'state' = 'NY', 'owner still sets the address');
reset role;

-- ---------------------------------------------------------------- the owner's membership ends: both can read, neither edits
update public.club_access_grants set revoked_at = now() where user_id = :OWNER;
select pg_temp.as_user('authenticated', :PARTNER);
select pg_temp.expect((public.club_resource_get(:SLUG) ->> 'can') = 'read', 'membership ended: the partner can still read the household''s month');
select pg_temp.expect(pg_temp.fails(format('select public.club_resource_save(%L, %L, 1)', :SLUG, '{}'), 'read_only'), 'and can''t edit it');
reset role;
select pg_temp.as_user('authenticated', :OWNER);
select pg_temp.expect((public.club_resource_get(:SLUG) ->> 'can') = 'read', 'the owner too');
reset role;
update public.club_access_grants set revoked_at = null where user_id = :OWNER;

-- ---------------------------------------------------------------- a partner who's removed loses it at once
select pg_temp.as_user('authenticated', :OWNER);
select public.household_partner_remove();
reset role;
select pg_temp.as_user('authenticated', :PARTNER);
select pg_temp.expect((public.club_me() ->> 'access')::boolean is false, 'removed partner: no Club access');
select pg_temp.expect(pg_temp.fails(format('select public.club_resource_get(%L)', :SLUG), 'not_found'), 'removed partner: can''t open the month');
reset role;

-- ---------------------------------------------------------------- strangers: nothing
select pg_temp.as_user('authenticated', :STRANGER);
select pg_temp.expect((public.club_me() ->> 'access')::boolean is false, 'another account: no access');
select pg_temp.expect(pg_temp.fails(format('select public.club_resource_get(%L)', :SLUG), 'not_found'), 'another account: can''t open the month');
reset role;
select pg_temp.as_user('anon', null);
select pg_temp.expect(pg_temp.fails($$select public.club_me()$$), 'anon: no club_me');
select pg_temp.expect(pg_temp.fails($$select public.club_me_for('00000000-0000-0000-0000-0000000f1001')$$), 'nobody calls club_me_for directly');
reset role;
select pg_temp.as_user('authenticated', :STRANGER);
select pg_temp.expect(pg_temp.fails($$select public.club_me_for('00000000-0000-0000-0000-0000000f1001')$$), 'not even signed in');
select pg_temp.expect(pg_temp.fails($$select public.household_billing_user('00000000-0000-0000-0000-0000000f1001')$$), 'the resolver is internal');
reset role;
