-- Two grown-ups per household, and an owner deleting her account never takes the family with her
-- (supabase/migrations/20261124000000_household_shared.sql). Throwaway local database only.
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
  ('00000000-0000-0000-0000-0000000d0001', 'own-mira@example.com', now()),
  ('00000000-0000-0000-0000-0000000d0002', 'own-tomas@example.com', now()),
  ('00000000-0000-0000-0000-0000000d0003', 'own-gran@example.com', now()),
  ('00000000-0000-0000-0000-0000000d0004', 'own-solo@example.com', now());
\set MIRA '''00000000-0000-0000-0000-0000000d0001'''
\set TOMAS '''00000000-0000-0000-0000-0000000d0002'''
\set GRAN '''00000000-0000-0000-0000-0000000d0003'''
\set SOLO '''00000000-0000-0000-0000-0000000d0004'''

select pg_temp.as_user('authenticated', :MIRA);
select public.club_household_save('The Novaks', '{}',
  '[{"first_name":"Mira","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Tomas","kind":"adult","role":"partner"},
    {"first_name":"Granny","kind":"adult","role":"other"},{"first_name":"Pia","kind":"child","role":"child","birth_year":2018,"birth_month":6}]');
reset role;
\set HID '(select household_id from public.household_adults where user_id = ''00000000-0000-0000-0000-0000000d0001'')'
\set TOMASM '(select id from public.club_family_members where first_name = ''Tomas'')'
\set GRANM '(select id from public.club_family_members where first_name = ''Granny'')'
\set PIA '(select id from public.club_family_members where first_name = ''Pia'')'
select pg_temp.as_user('authenticated', :MIRA);
create temp table inv as select public.household_invite_create(:TOMASM, 'own-tomas@example.com') as i;
reset role;
grant select on inv to authenticated;
select pg_temp.as_user('authenticated', :TOMAS);
select public.household_invite_accept((select i ->> 'code' from inv));
select public.calendar_event_save(jsonb_build_object('id', 'dd000000-0000-0000-0000-000000000001', 'title', 'Swim', 'starts_on', '2026-11-20',
  'timezone', 'UTC', 'member_ids', jsonb_build_array(:PIA)), null);
select public.household_agreement_save(jsonb_build_object('category', 'cleaning', 'text', 'Feed the cat', 'owner_ids', jsonb_build_array(:PIA)));
reset role;
\set COLORS '(select preferences -> ''colors'' from public.club_households where id = (select household_id from public.household_adults where user_id = ''00000000-0000-0000-0000-0000000d0002''))'
create temp table colors_before as select :COLORS c;

-- ---------------------------------------------------------------- two grown-ups
select pg_temp.as_user('authenticated', :MIRA);
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_create(%L, %L)', :GRANM, 'own-gran@example.com'), 'household_full'), 'a third grown-up can''t be invited');
reset role;

-- ---------------------------------------------------------------- the partner leaves: nothing else changes
-- (tested on a copy: a second household below covers the owner leaving)

-- ---------------------------------------------------------------- the owner deletes her account
delete from auth.users where id = :MIRA;
select pg_temp.expect((select count(*) from public.club_households where id = (select household_id from public.household_adults where user_id = :TOMAS)) = 1, 'owner deleted: the household is still there');
select pg_temp.expect((select role from public.household_adults where user_id = :TOMAS) = 'owner', 'the other grown-up is now the owner');
select pg_temp.expect((select owner_user_id from public.club_households h join public.household_adults a on a.household_id = h.id where a.user_id = :TOMAS) = :TOMAS, 'the household belongs to him');
select pg_temp.expect((select is_account_holder from public.club_family_members where id = :TOMASM), 'his family row is the account holder now');
select pg_temp.expect((select count(*) from public.club_family_members where household_id = (select household_id from public.household_adults where user_id = :TOMAS) and archived_at is null) = 4, 'every family member is kept');
select pg_temp.expect((select count(*) from public.calendar_events where id = 'dd000000-0000-0000-0000-000000000001' and deleted_at is null) = 1, 'the calendar is kept');
select pg_temp.expect((select count(*) from public.club_responsibilities r join public.household_adults a on a.household_id = r.household_id where a.user_id = :TOMAS and r.status = 'confirmed') = 1, 'agreements are kept');
select pg_temp.expect(:COLORS = (select c from colors_before), 'colors are kept');
select pg_temp.as_user('authenticated', :TOMAS);
select pg_temp.expect((public.club_household() ->> 'my_role') = 'owner', 'he opens the family as its owner');
select pg_temp.expect(public.household_invite_create(:GRANM, 'own-gran@example.com') ->> 'code' is not null, 'and can invite a new partner');
reset role;

-- ---------------------------------------------------------------- the partner deletes theirs
select pg_temp.as_user('authenticated', :TOMAS);
create temp table inv2 as select public.household_invite_create(:GRANM, 'own-gran@example.com') as i;
reset role;
grant select on inv2 to authenticated;
select pg_temp.as_user('authenticated', :GRAN);
select public.household_invite_accept((select i ->> 'code' from inv2));
reset role;
delete from auth.users where id = :GRAN;
select pg_temp.expect((select count(*) from public.household_adults where household_id = (select household_id from public.household_adults where user_id = :TOMAS)) = 1, 'partner deleted: only their access goes');
select pg_temp.expect((select count(*) from public.club_family_members where id = :GRANM and archived_at is null) = 1, 'their family row stays (they''re still family)');

-- ---------------------------------------------------------------- an owner alone: unchanged
select pg_temp.as_user('authenticated', :SOLO);
select public.club_household_save('Solo', '{}', '[{"first_name":"Sol","kind":"adult","role":"parent","is_account_holder":true}]');
reset role;
delete from auth.users where id = :SOLO;
select pg_temp.expect((select count(*) from public.club_households where display_name = 'Solo') = 0, 'an owner with no partner: her household goes with her account, as before');
