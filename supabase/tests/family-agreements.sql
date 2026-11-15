-- Family agreements (supabase/migrations/20261127000000_family_agreements.sql): "We agreed" in Everyone's Part.
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
  ('00000000-0000-0000-0000-0000000a9101', 'agr-mom@example.com', now()),
  ('00000000-0000-0000-0000-0000000a9102', 'agr-dad@example.com', now()),
  ('00000000-0000-0000-0000-0000000a9103', 'agr-other@example.com', now()),
  ('00000000-0000-0000-0000-0000000a9104', 'agr-nobody@example.com', now());
\set MOM '''00000000-0000-0000-0000-0000000a9101'''
\set DAD '''00000000-0000-0000-0000-0000000a9102'''
\set OTHER '''00000000-0000-0000-0000-0000000a9103'''
\set NOBODY '''00000000-0000-0000-0000-0000000a9104'''

-- A household with existing and desired responsibilities from the family profile, and a partner.
select pg_temp.as_user('authenticated', :MOM);
select public.club_household_save('The Okafors', '{}',
  '[{"first_name":"Ada","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Obi","kind":"adult","role":"partner"},
    {"first_name":"Zara","kind":"child","role":"child","birth_year":2017,"birth_month":2},{"first_name":"Kofi","kind":"child","role":"child","birth_year":2019,"birth_month":5}]');
reset role;
\set ADA '(select id from public.club_family_members where first_name = ''Ada'')'
\set OBI '(select id from public.club_family_members where first_name = ''Obi'')'
\set ZARA '(select id from public.club_family_members where first_name = ''Zara'')'
\set KOFI '(select id from public.club_family_members where first_name = ''Kofi'')'
\set HID '(select household_id from public.household_adults where user_id = ''00000000-0000-0000-0000-0000000a9101'')'
select pg_temp.as_user('authenticated', :MOM);
select public.club_responsibilities_save('existing', jsonb_build_array(
  jsonb_build_object('category', 'meals', 'owner_ids', jsonb_build_array(:ADA), 'helper_ids', jsonb_build_array(:ZARA))));
select public.club_responsibilities_save('desired', jsonb_build_array(
  jsonb_build_object('category', 'school-prep', 'item', 'pack-school-bag', 'owner_ids', jsonb_build_array(:ZARA), 'helper_ids', '[]'::jsonb)));
create temp table inv as select public.household_invite_create(:OBI, 'agr-dad@example.com') as i;
reset role;
grant select on inv to authenticated;
select pg_temp.as_user('authenticated', :DAD);
select public.household_invite_accept((select i ->> 'code' from inv));
reset role;
select pg_temp.as_user('authenticated', :OTHER);
select public.club_household_save('Others', '{}', '[{"first_name":"Lee","kind":"adult","role":"parent","is_account_holder":true}]');
reset role;
\set LEE '(select id from public.club_family_members where first_name = ''Lee'')'

-- ---------------------------------------------------------------- agree

select pg_temp.as_user('authenticated', :MOM);
create temp table p1 as select public.household_agreement_save(jsonb_build_object(
  'category', 'belongings', 'text', ' Check and pack my things for swim before bed. ', 'finished', 'Everything for swim is by the door.',
  'when', 'Sunday evening', 'month', '2027-01', 'source', 'jan-gear', 'owner_ids', jsonb_build_array(:ZARA))) as p;
reset role;
grant select on p1 to authenticated;
select pg_temp.expect((select count(*) from public.club_responsibilities where household_id = :HID and status = 'confirmed') = 1, 'agree: one confirmed row');
select pg_temp.expect((select agreed_text from public.club_responsibilities where household_id = :HID and status = 'confirmed') = 'Check and pack my things for swim before bed.', 'agree: the meeting''s words, trimmed');
select pg_temp.expect((select owner_ids = array[:ZARA] and confirmed_at is not null and scope = 'individual' and household_id = (select household_id from public.household_adults where user_id = :MOM)
                         from public.club_responsibilities where household_id = :HID and status = 'confirmed'), 'agree: on the household, by stable member id, confirmed now');
select pg_temp.expect((select jsonb_path_exists(p, '$.responsibilities[*] ? (@.status == "confirmed" && @.agreed_source == "jan-gear" && @.agreed_month == "2027-01")') from p1),
  'profile read returns the agreement with its month and source');

select pg_temp.as_user('authenticated', :MOM);
select public.household_agreement_save(jsonb_build_object('category', 'belongings', 'text', 'Check and pack my things for swim before bed.', 'month', '2027-01', 'source', 'jan-gear', 'owner_ids', jsonb_build_array(:ZARA)));
reset role;
select pg_temp.expect((select count(*) from public.club_responsibilities where household_id = :HID and status = 'confirmed') = 1, 'agreeing twice (double tap, retry) never duplicates');

-- The partner agrees too, for two people at once (shared).
select pg_temp.as_user('authenticated', :DAD);
select public.household_agreement_save(jsonb_build_object('category', 'cleaning', 'text', 'Wipe the table after dinner.', 'month', '2027-01', 'source', 'jan-x', 'owner_ids', jsonb_build_array(:ZARA, :KOFI)));
reset role;
select pg_temp.expect((select scope from public.club_responsibilities where household_id = :HID and agreed_source = 'jan-x') = 'shared', 'partner agrees; two owners = shared');
select pg_temp.expect((select updated_by from public.club_responsibilities where household_id = :HID and agreed_source = 'jan-x') = :DAD, 'records which grown-up agreed');

-- ---------------------------------------------------------------- the family profile is preserved

select pg_temp.expect((select count(*) from public.club_responsibilities where household_id = :HID and status = 'existing') = 1
                  and (select count(*) from public.club_responsibilities where household_id = :HID and status = 'desired') = 1, 'existing and desired untouched by agreements');
select pg_temp.as_user('authenticated', :MOM);
select public.club_responsibilities_save('existing', jsonb_build_array(
  jsonb_build_object('category', 'meals', 'owner_ids', jsonb_build_array(:ADA, :OBI), 'helper_ids', '[]'::jsonb)));
reset role;
select pg_temp.expect((select count(*) from public.club_responsibilities where household_id = :HID and status = 'confirmed') = 2, 're-saving the profile''s responsibilities keeps every agreement');
select pg_temp.expect(pg_temp.fails($$select public.club_responsibilities_save('confirmed', '[]')$$, 'invalid'), 'the profile save still can''t write confirmed');

-- ---------------------------------------------------------------- edit, reassign, remove

select pg_temp.as_user('authenticated', :DAD);
select public.household_agreement_save(jsonb_build_object('id', (select id from public.club_responsibilities where household_id = :HID and agreed_source = 'jan-gear'),
  'category', 'belongings', 'text', 'Pack my swim bag before bed.', 'owner_ids', jsonb_build_array(:KOFI)));
reset role;
select pg_temp.expect((select agreed_text = 'Pack my swim bag before bed.' and owner_ids = array[:KOFI] and agreed_source = 'jan-gear' and agreed_month = '2027-01'
                         from public.club_responsibilities where household_id = :HID and agreed_source = 'jan-gear'), 'edit + reassign: new words and person; month and source kept');
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_save(%L)', jsonb_build_object('id', (select id from public.club_responsibilities where household_id = :HID and status = 'existing' limit 1),
  'category', 'meals', 'text', 'x', 'owner_ids', jsonb_build_array(:ADA))), 'not_found'), 'an existing (profile) responsibility can''t be edited as an agreement');
select public.household_agreement_remove((select id from public.club_responsibilities where household_id = :HID and agreed_source = 'jan-x'));
reset role;
select pg_temp.expect((select count(*) from public.club_responsibilities where household_id = :HID and status = 'confirmed') = 1, 'remove: gone');
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_remove(%L)', (select id from public.club_responsibilities where household_id = :HID and status = 'existing' limit 1)), 'not_found'),
  'remove never deletes the profile''s own responsibilities');
reset role;

-- ---------------------------------------------------------------- validation

select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_save(%L)', jsonb_build_object('category', 'cleaning', 'text', 'x', 'owner_ids', '[]'::jsonb)), 'invalid'), 'at least one person');
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_save(%L)', jsonb_build_object('category', 'cleaning', 'text', '  ', 'owner_ids', jsonb_build_array(:ZARA))), 'invalid'), 'words required');
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_save(%L)', jsonb_build_object('category', 'chores', 'text', 'x', 'owner_ids', jsonb_build_array(:ZARA))), 'invalid'), 'a known category');
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_save(%L)', jsonb_build_object('category', 'cleaning', 'text', 'x', 'month', '2027-13', 'owner_ids', jsonb_build_array(:ZARA))), 'invalid'), 'a real month');
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_save(%L)', jsonb_build_object('category', 'cleaning', 'text', 'x', 'status', 'existing', 'owner_ids', jsonb_build_array(:ZARA))), 'invalid'), 'no other fields (can''t set a status)');
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_save(%L)', jsonb_build_object('category', 'cleaning', 'text', 'x', 'owner_ids', jsonb_build_array(:LEE))), 'invalid'), 'people must be in this family');
reset role;
-- Someone who left the family can't be given a new agreement.
update public.club_family_members set archived_at = now() where first_name = 'Kofi';
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_save(%L)', jsonb_build_object('category', 'cleaning', 'text', 'x', 'owner_ids', jsonb_build_array(:KOFI))), 'invalid'), 'not to an archived member');
reset role;
update public.club_family_members set archived_at = null where first_name = 'Kofi';

-- ---------------------------------------------------------------- isolation

select pg_temp.as_user('authenticated', :OTHER);
select pg_temp.expect((select count(*) from public.club_responsibilities where status = 'confirmed') = 0, 'another family reads none (RLS)');
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_remove(%L)', (select id from public.club_responsibilities where agreed_source = 'jan-gear')), 'not_found'), 'another family can''t remove it');
reset role;
select pg_temp.as_user('authenticated', :NOBODY);
select pg_temp.expect(pg_temp.fails($$select public.household_agreement_save('{"category":"cleaning","text":"x","owner_ids":[]}')$$, 'no_household'), 'no household: nothing to agree');
reset role;
select pg_temp.as_user('anon', null);
select pg_temp.expect(pg_temp.fails($$select public.household_agreement_save('{}')$$), 'anon can''t call it');
select pg_temp.expect(pg_temp.fails($$select public.household_agreement_remove(gen_random_uuid())$$), 'anon can''t remove');
reset role;
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails($$update public.club_responsibilities set status = 'confirmed' where true$$), 'no direct table writes');
reset role;
select pg_temp.expect((select count(*) from public.club_responsibilities where household_id = :HID and status = 'confirmed') = 1, 'still exactly one agreement');
