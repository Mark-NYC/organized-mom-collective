-- One household, two adults (supabase/migrations/20261124000000_household_shared.sql;
-- docs/ios/HOUSEHOLD_ARCHITECTURE.md). Run by scripts/test-household-sql.sh on a throwaway local database.
-- Never run on the real project.
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

create function pg_temp.count_of(q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || q || ') x' into n;
  return n;
end $$;

-- Accounts: Mom (owner), Luis (her partner), Other (another household), Stranger (no household), Unverified.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000aa01', 'mom@example.com', now()),
  ('00000000-0000-0000-0000-00000000aa02', 'luis@example.com', now()),
  ('00000000-0000-0000-0000-00000000aa03', 'other@example.com', now()),
  ('00000000-0000-0000-0000-00000000aa04', 'stranger@example.com', now()),
  ('00000000-0000-0000-0000-00000000aa05', 'unverified@example.com', null);

\set MOM '''00000000-0000-0000-0000-00000000aa01'''
\set LUIS '''00000000-0000-0000-0000-00000000aa02'''
\set OTHER '''00000000-0000-0000-0000-00000000aa03'''
\set STRANGER '''00000000-0000-0000-0000-00000000aa04'''
\set UNVERIFIED '''00000000-0000-0000-0000-00000000aa05'''

-- ---------------------------------------------------------------- an existing Club household, created the old way

select pg_temp.as_user('authenticated', :MOM);
create temp table h0 as select public.club_household_save('The Rivera Family', '{"week_starts":"sunday"}',
  '[{"first_name":"Ana","kind":"adult","role":"parent","is_account_holder":true},
    {"first_name":"Luis","kind":"adult","role":"partner"},
    {"first_name":"Sofia","kind":"child","role":"child","birth_year":2016,"birth_month":4},
    {"first_name":"Mateo","kind":"child","role":"child","birth_year":2019,"birth_month":9}]') as h;
reset role;
grant select on h0 to authenticated;

\set HID '(select (h ->> ''id'')::uuid from h0)'
\set ANA '(select (m ->> ''id'')::uuid from h0, jsonb_array_elements(h -> ''members'') m where m ->> ''first_name'' = ''Ana'')'
\set LUISM '(select (m ->> ''id'')::uuid from h0, jsonb_array_elements(h -> ''members'') m where m ->> ''first_name'' = ''Luis'')'
\set SOFIA '(select (m ->> ''id'')::uuid from h0, jsonb_array_elements(h -> ''members'') m where m ->> ''first_name'' = ''Sofia'')'
\set MATEO '(select (m ->> ''id'')::uuid from h0, jsonb_array_elements(h -> ''members'') m where m ->> ''first_name'' = ''Mateo'')'

select pg_temp.expect((select role from public.household_adults where user_id = :MOM) = 'owner', 'a new household gets its owner row');
select pg_temp.expect((select count(*) from public.household_adults where household_id = :HID) = 1, 'one adult so far');

-- Backfill: a household that existed before household_adults (simulate by removing its row, then re-running the backfill).
delete from public.household_adults where user_id = :MOM;
insert into public.household_adults (household_id, user_id, role, member_id, joined_at)
select h.id, h.owner_user_id, 'owner',
       case when (select count(*) from public.club_family_members m where m.household_id = h.id and m.is_account_holder and m.kind = 'adult' and m.archived_at is null) = 1
            then (select m.id from public.club_family_members m where m.household_id = h.id and m.is_account_holder and m.kind = 'adult' and m.archived_at is null) end,
       h.created_at
  from public.club_households h on conflict do nothing;
select pg_temp.expect((select member_id from public.household_adults where user_id = :MOM) = :ANA, 'backfill links the owner to her account-holder row');

-- Her existing Club reads are unchanged.
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect((public.club_household() ->> 'my_role') = 'owner', 'club_household: she is the owner');
select pg_temp.expect(jsonb_array_length(public.club_household() -> 'members') = 4, 'club_household: her four people');
select pg_temp.expect((public.club_household() ->> 'id')::uuid = :HID, 'club_household: the same household id');
select public.club_activities_save(jsonb_build_array(jsonb_build_object('category', 'sports', 'name', 'Soccer', 'member_ids', jsonb_build_array(:SOFIA), 'days', '[2,4]'::jsonb, 'starts_at', '17:30')));
select public.club_responsibilities_save('existing', jsonb_build_array(jsonb_build_object('category', 'laundry', 'label', 'Fold towels', 'owner_ids', jsonb_build_array(:SOFIA))));
reset role;

-- Another household, for isolation.
select pg_temp.as_user('authenticated', :OTHER);
select public.club_household_save('The Other Family', '{}', '[{"first_name":"Kim","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Jo","kind":"adult","role":"partner"}]');
reset role;
\set OTHERHID '(select household_id from public.household_adults where user_id = ''00000000-0000-0000-0000-00000000aa03'')'
\set JO '(select id from public.club_family_members where first_name = ''Jo'')'

-- ---------------------------------------------------------------- inviting the partner

select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_create(%L, %L)', :SOFIA, 'luis@example.com'), 'invite_member_invalid'), 'invite: never a child');
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_create(%L, %L)', :ANA, 'luis@example.com'), 'invite_member_invalid'), 'invite: never her own row');
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_create(%L, %L)', :JO, 'luis@example.com'), 'invite_member_invalid'), 'invite: never another household''s adult');
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_create(%L, %L)', :LUISM, 'mom@example.com'), 'invite_member_invalid'), 'invite: never her own email');
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_create(%L, %L)', :LUISM, 'not-an-email'), 'invalid'), 'invite: a real email address');
create temp table inv1 as select public.household_invite_create(:LUISM, '  Luis@Example.com ') as i;
create temp table inv2 as select public.household_invite_create(:LUISM, 'luis@example.com') as i;
reset role;
grant select on inv1, inv2 to authenticated;
\set CODE1 '(select i ->> ''code'' from inv1)'
\set CODE2 '(select i ->> ''code'' from inv2)'
select pg_temp.expect((select i ->> 'email' from inv2) = 'luis@example.com', 'invite: email normalized');
select pg_temp.expect(length((select i ->> 'code' from inv2)) = 32, 'invite: a 128-bit code');
select pg_temp.expect(not exists (select 1 from public.household_invites where code_hash = (select i ->> 'code' from inv2)), 'invite: the code itself is never stored');
select pg_temp.expect((select revoked_at is not null from public.household_invites where id = (select (i ->> 'id')::uuid from inv1)), 'invite: a new invite for the same adult replaces the old one');

-- Who can't accept.
select pg_temp.as_user('authenticated', :LUIS);
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_accept(%L)', (select i ->> 'code' from inv1)), 'invite_invalid'), 'accept: a replaced invite is dead');
select pg_temp.expect(pg_temp.fails($$select public.household_invite_accept('0123456789abcdef0123456789abcdef')$$, 'invite_invalid'), 'accept: a made-up code');
reset role;
select pg_temp.as_user('authenticated', :STRANGER);
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_accept(%L)', (select i ->> 'code' from inv2)), 'invite_wrong_email'), 'accept: a forwarded link is useless to another account');
reset role;
select pg_temp.as_user('authenticated', :OTHER);
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_accept(%L)', (select i ->> 'code' from inv2)), 'invite_wrong_email'), 'accept: another household''s adult can''t either');
reset role;
select pg_temp.as_user('anon', null);
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_accept(%L)', 'x')), 'accept: anon can''t call it');
reset role;

-- Expired.
update public.household_invites set expires_at = now() - interval '1 minute' where id = (select (i ->> 'id')::uuid from inv2);
select pg_temp.as_user('authenticated', :LUIS);
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_accept(%L)', (select i ->> 'code' from inv2)), 'invite_expired'), 'accept: expired after 7 days');
reset role;
update public.household_invites set expires_at = now() + interval '7 days' where id = (select (i ->> 'id')::uuid from inv2);

-- Unverified email with the same address (simulated: unverified user with Luis's email can't accept).
update auth.users set email = 'luis@example.com' where id = :UNVERIFIED;
select pg_temp.as_user('authenticated', :UNVERIFIED);
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_accept(%L)', (select i ->> 'code' from inv2)), 'invite_wrong_email'), 'accept: an unverified email never matches');
reset role;
update auth.users set email = 'unverified@example.com' where id = :UNVERIFIED;

-- Luis accepts.
select pg_temp.as_user('authenticated', :LUIS);
create temp table joined as select public.household_invite_accept(upper((select i ->> 'code' from inv2))) as h;
reset role;
select pg_temp.expect((select (h ->> 'id')::uuid from joined) = :HID, 'accept: Luis joins her household (code is case-insensitive)');
select pg_temp.expect((select h ->> 'my_role' from joined) = 'partner', 'accept: as the partner');
select pg_temp.expect((select (h ->> 'my_member_id')::uuid from joined) = :LUISM, 'accept: linked to his existing family row (one profile)');
select pg_temp.expect((select count(*) from public.club_family_members where household_id = :HID) = 4, 'accept: no duplicate person was created');
select pg_temp.expect(not exists (select 1 from public.club_households where owner_user_id = :LUIS), 'accept: no second household for him');
select pg_temp.as_user('authenticated', :LUIS);
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_accept(%L)', (select i ->> 'code' from inv2)), 'invite_invalid'), 'accept: single use');
reset role;

-- ---------------------------------------------------------------- both adults share one family

select pg_temp.as_user('authenticated', :LUIS);
select pg_temp.expect(jsonb_array_length(public.club_household() -> 'members') = 4, 'partner reads the same family');
select pg_temp.expect(jsonb_array_length(public.club_family_profile() -> 'activities') = 1, 'partner reads the typical week');
select pg_temp.expect(jsonb_array_length(public.club_family_profile() -> 'responsibilities') = 1, 'partner reads who owns what');
select pg_temp.expect(pg_temp.count_of('select 1 from public.club_family_members') = 4, 'partner: RLS shows exactly his household''s people');
select pg_temp.expect(pg_temp.count_of('select 1 from public.club_households') = 1, 'partner: RLS shows exactly one household');
select pg_temp.expect(pg_temp.count_of('select 1 from public.household_adults') = 2, 'partner sees both adults');
-- He edits the shared family: Mateo's birthday corrected, a color picked for Sofia.
select public.household_save(
  (public.club_household() ->> 'profile_version')::int, 'The Rivera Family',
  jsonb_build_object('week_starts', 'sunday', 'colors', jsonb_build_object(:SOFIA, 'purple')),
  (select jsonb_agg(case when m ->> 'first_name' = 'Mateo' then m || '{"birth_month":10}' else m end order by (m ->> 'first_name'))
     from jsonb_array_elements(public.club_household() -> 'members') m));
select public.club_responsibilities_save('existing', jsonb_build_array(
  jsonb_build_object('category', 'laundry', 'label', 'Fold towels', 'owner_ids', jsonb_build_array(:SOFIA)),
  jsonb_build_object('category', 'meals', 'label', 'Set the table', 'owner_ids', jsonb_build_array(:MATEO))));
reset role;

select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect((select (m ->> 'birth_month')::int from jsonb_array_elements(public.club_household() -> 'members') m where m ->> 'first_name' = 'Mateo') = 10,
  'his change shows up for her');
select pg_temp.expect(public.club_household() #>> array['preferences', 'colors', (:SOFIA)::text] = 'purple', 'his color choice shows up for her');
select pg_temp.expect(jsonb_array_length(public.club_family_profile() -> 'responsibilities') = 2, 'his responsibility shows up for her');
-- An old page saves without colors: Sofia keeps purple.
select public.club_household_save('The Rivera Family', '{"week_starts":"sunday"}',
  (select jsonb_agg(m) from jsonb_array_elements(public.club_household() -> 'members') m));
select pg_temp.expect(public.club_household() #>> array['preferences', 'colors', (:SOFIA)::text] = 'purple', 'colors: a save without colors never wipes them');
-- She changes Sofia's color on purpose: that wins.
select public.club_household_save('The Rivera Family', jsonb_build_object('week_starts', 'sunday', 'colors', jsonb_build_object(:SOFIA, 'teal')),
  (select jsonb_agg(m) from jsonb_array_elements(public.club_household() -> 'members') m));
select pg_temp.expect(public.club_household() #>> array['preferences', 'colors', (:SOFIA)::text] = 'teal', 'colors: changed only when a new color is sent');
-- A stale copy is refused, not merged over the other adult's change.
select pg_temp.expect(pg_temp.fails(format($q$select public.household_save(%s, 'X', '{}', %L)$q$,
  (public.club_household() ->> 'profile_version')::int - 1, (select jsonb_agg(m) from jsonb_array_elements(public.club_household() -> 'members') m)), 'stale_profile'),
  'concurrent edit: a stale copy gets stale_profile');
select pg_temp.expect(public.club_household() ->> 'display_name' = 'The Rivera Family', 'concurrent edit: nothing was overwritten');
-- An adult with an account can't be dropped from the family by a save.
select pg_temp.expect(pg_temp.fails(format($q$select public.club_household_save('The Rivera Family', '{}', %L)$q$,
  (select jsonb_agg(m) from jsonb_array_elements(public.club_household() -> 'members') m where m ->> 'first_name' <> 'Luis')), 'linked_member'),
  'a save can''t archive the partner''s own row');
reset role;

-- ---------------------------------------------------------------- isolation

select pg_temp.as_user('authenticated', :OTHER);
select pg_temp.expect(pg_temp.count_of('select 1 from public.club_family_members') = 2, 'other household: sees only its own 2 people');
select pg_temp.expect(pg_temp.count_of('select 1 from public.club_activities') = 0, 'other household: none of the Riveras'' activities');
select pg_temp.expect(pg_temp.count_of('select 1 from public.club_responsibilities') = 0, 'other household: none of their responsibilities');
select pg_temp.expect(pg_temp.count_of('select 1 from public.household_adults') = 1, 'other household: only its own adult');
select pg_temp.expect(public.household_invites() = '[]', 'other household: none of their invites');
select pg_temp.expect(pg_temp.fails(format($q$select public.household_save(null, 'Hijack', '{}', %L)$q$,
  jsonb_build_array(jsonb_build_object('id', :SOFIA, 'first_name', 'Sofia', 'kind', 'child', 'role', 'child', 'birth_year', 2016))), 'invalid'),
  'other household: can''t write a Rivera member id into its own family');
select pg_temp.expect(pg_temp.fails('select * from public.household_invites'), 'invites table: no direct read');
reset role;
select pg_temp.as_user('authenticated', :STRANGER);
select pg_temp.expect(public.club_household() is null, 'no household: nothing');
select pg_temp.expect(pg_temp.count_of('select 1 from public.club_family_members') = 0, 'no household: no rows');
reset role;
select pg_temp.as_user('anon', null);
select pg_temp.expect(pg_temp.fails('select 1 from public.household_adults'), 'anon: no adults table');
select pg_temp.expect(pg_temp.fails('select public.club_household()'), 'anon: no household');
reset role;

-- ---------------------------------------------------------------- owner-only actions

select pg_temp.as_user('authenticated', :LUIS);
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_create(%L, %L)', :ANA, 'x@example.com'), 'owner_only'), 'partner can''t invite');
select pg_temp.expect(pg_temp.fails('select public.household_partner_remove()', 'owner_only'), 'partner can''t remove');
select pg_temp.expect((public.club_me() ->> 'member')::boolean is not true, 'partner gets no Club membership or billing from the owner''s account');
reset role;

select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails('select public.household_leave()', 'owner_cannot_leave'), 'owner can''t leave her own household');
select public.household_partner_remove();
reset role;
select pg_temp.expect(not exists (select 1 from public.household_adults where user_id = :LUIS), 'owner removed the partner');
select pg_temp.expect((select count(*) from public.club_family_members where household_id = :HID and archived_at is null) = 4, 'removing the partner keeps the whole family');
select pg_temp.as_user('authenticated', :LUIS);
select pg_temp.expect(public.club_household() is null, 'removed partner: no access');
select pg_temp.expect(pg_temp.count_of('select 1 from public.club_family_members') = 0, 'removed partner: RLS shows nothing');
reset role;

-- Rejoin, then leave on his own.
select pg_temp.as_user('authenticated', :MOM);
create temp table inv3 as select public.household_invite_create(:LUISM, 'luis@example.com') as i;
reset role;
grant select on inv3 to authenticated;
select pg_temp.as_user('authenticated', :LUIS);
select public.household_invite_accept((select i ->> 'code' from inv3));
select public.household_leave();
select pg_temp.expect(public.club_household() is null, 'partner left');
reset role;

-- Someone already in a household can't join another one.
select pg_temp.as_user('authenticated', :MOM);
create temp table inv4 as select public.household_invite_create(:LUISM, 'other@example.com') as i;
reset role;
grant select on inv4 to authenticated;
select pg_temp.as_user('authenticated', :OTHER);
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_accept(%L)', (select i ->> 'code' from inv4)), 'already_in_household'), 'accept: already in a household, no silent merge');
reset role;

-- Too many open invites.
select pg_temp.as_user('authenticated', :MOM);
select public.club_household_save('The Rivera Family', '{}', (select jsonb_agg(m) from jsonb_array_elements(public.club_household() -> 'members') m)
  || '[{"first_name":"Gran","kind":"adult","role":"grandparent"},{"first_name":"Pop","kind":"adult","role":"grandparent"},{"first_name":"Aunt","kind":"adult","role":"other"},{"first_name":"Nanny","kind":"adult","role":"caregiver"},{"first_name":"Uncle","kind":"adult","role":"other"}]'::jsonb);
select public.household_invite_create(id, lower(first_name) || '@example.com') from public.club_family_members
 where household_id = :HID and first_name in ('Gran', 'Pop', 'Aunt', 'Nanny');
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_create(%L, %L)',
  (select id from public.club_family_members where first_name = 'Uncle'), 'uncle@example.com'), 'too_many_invites'), 'invites: at most 5 open');
reset role;

-- ---------------------------------------------------------------- deleting accounts

delete from auth.users where id = :LUIS;
select pg_temp.expect((select count(*) from public.club_family_members where household_id = :HID and first_name = 'Luis') = 1, 'partner account deleted: his family row stays');
delete from auth.users where id = :OTHER;
select pg_temp.expect(not exists (select 1 from public.club_households where id = :OTHERHID), 'owner account deleted: her household goes, as before');

-- ---------------------------------------------------------------- concurrency between two adults

select pg_temp.expect(pg_get_functiondef('public.club_activities_save(jsonb)'::regprocedure) like '%club-household-id:%',
  'typical-week saves serialize per household (two adults), not per account');
select pg_temp.expect(pg_get_functiondef('public.club_responsibilities_save(text, jsonb)'::regprocedure) like '%club-household-id:%',
  'responsibility saves serialize per household');
