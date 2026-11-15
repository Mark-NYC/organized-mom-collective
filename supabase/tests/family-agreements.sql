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

-- A household created after the household migration links its owner to her own family row (e2e finding, 2026-11-15).
select pg_temp.expect((select member_id from public.household_adults where user_id = :MOM) = :ADA, 'new household: owner linked to her account-holder row');
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_create(%L, %L)', :ADA, 'someone@example.com'), 'invite_member_invalid'), 'the owner can''t invite someone into her own place');
reset role;

-- ---------------------------------------------------------------- agree (ids made on the phone)
\set G1 '''a9000000-0000-0000-0000-000000000001'''
\set G2 '''a9000000-0000-0000-0000-000000000002'''
\set G3 '''a9000000-0000-0000-0000-000000000003'''
\set LIVE ' household_id = (select household_id from public.household_adults where user_id = ''00000000-0000-0000-0000-0000000a9101'') and status = ''confirmed'' and deleted_at is null'

select pg_temp.as_user('authenticated', :MOM);
create temp table p1 as select public.household_agreement_save(jsonb_build_object('id', :G1,
  'category', 'belongings', 'text', ' Check and pack my things for swim before bed. ', 'finished', 'Everything for swim is by the door.',
  'when', 'Sunday evening', 'month', '2027-01', 'source', 'month:jan-gear', 'owner_ids', jsonb_build_array(:ZARA)), null) as a;
create temp table prof1 as select public.club_family_profile() as p;
reset role;
grant select on p1, prof1 to authenticated;
select pg_temp.expect((select count(*) from public.club_responsibilities where :LIVE) = 1, 'agree: one confirmed row');
select pg_temp.expect((select a ->> 'id' from p1) = :G1 and (select (a ->> 'revision')::int from p1) = 1, 'agree: keeps the phone''s id, revision 1');
select pg_temp.expect((select agreed_text from public.club_responsibilities where id = :G1) = 'Check and pack my things for swim before bed.', 'agree: the meeting''s words, trimmed');
select pg_temp.expect((select owner_ids = array[:ZARA] and confirmed_at is not null and scope = 'individual' from public.club_responsibilities where id = :G1), 'agree: by stable member id, confirmed now');
select pg_temp.expect((select jsonb_path_exists(p, '$.responsibilities[*] ? (@.status == "confirmed" && @.agreed_source == "month:jan-gear" && @.agreed_month == "2027-01")') from prof1),
  'profile read returns the agreement with its month and source');

-- A retry after a lost response (same id): a conflict the phone resolves by taking the server copy; never a duplicate.
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_save(%L, null)', (select a - 'revision' - 'deleted' - 'confirmed_at' - 'updated_at' from p1)), 'conflict'), 'same id again: conflict, not a second row');
-- The other phone agreed to the same suggestion offline (its own id): the existing agreement comes back instead.
create temp table dup as select public.household_agreement_save(jsonb_build_object('id', :G3, 'category', 'belongings', 'text', 'Pack swim things',
  'month', '2027-01', 'source', 'month:jan-gear', 'owner_ids', jsonb_build_array(:ZARA)), null) as a;
reset role;
grant select on dup to authenticated;
select pg_temp.expect((select a ->> 'id' from dup) = :G1, 'the same suggestion agreed on two phones = one agreement (the phone adopts its id)');
select pg_temp.expect((select count(*) from public.club_responsibilities where :LIVE) = 1, 'still one agreement');

-- The partner agrees too, for two people at once (shared).
select pg_temp.as_user('authenticated', :DAD);
select public.household_agreement_save(jsonb_build_object('id', :G2, 'category', 'cleaning', 'text', 'Wipe the table after dinner.', 'month', '2027-01', 'source', 'month:jan-x', 'owner_ids', jsonb_build_array(:ZARA, :KOFI)), null);
reset role;
select pg_temp.expect((select scope from public.club_responsibilities where id = :G2) = 'shared', 'partner agrees; two owners = shared');
select pg_temp.expect((select updated_by from public.club_responsibilities where id = :G2) = :DAD, 'records which grown-up agreed');

-- ---------------------------------------------------------------- the family profile is preserved

select pg_temp.expect((select count(*) from public.club_responsibilities where household_id = :HID and status = 'existing') = 1
                  and (select count(*) from public.club_responsibilities where household_id = :HID and status = 'desired') = 1, 'existing and desired untouched by agreements');
select pg_temp.as_user('authenticated', :MOM);
select public.club_responsibilities_save('existing', jsonb_build_array(
  jsonb_build_object('category', 'meals', 'owner_ids', jsonb_build_array(:ADA, :OBI), 'helper_ids', '[]'::jsonb)));
reset role;
select pg_temp.expect((select count(*) from public.club_responsibilities where :LIVE) = 2, 're-saving the profile''s responsibilities keeps every agreement');
select pg_temp.expect(pg_temp.fails($$select public.club_responsibilities_save('confirmed', '[]')$$, 'invalid'), 'the profile save still can''t write confirmed');

-- ---------------------------------------------------------------- edit, reassign, conflicts (two phones)

select pg_temp.as_user('authenticated', :DAD);
select public.household_agreement_save(jsonb_build_object('id', :G1, 'category', 'belongings', 'text', 'Pack my swim bag before bed.', 'owner_ids', jsonb_build_array(:KOFI)), 1);
reset role;
select pg_temp.expect((select agreed_text = 'Pack my swim bag before bed.' and owner_ids = array[:KOFI] and agreed_source = 'month:jan-gear' and agreed_month = '2027-01' and revision = 2
                         from public.club_responsibilities where id = :G1), 'edit + reassign from revision 1: new words and person, revision 2; month and source kept');
-- Mom's phone was offline with revision 1: her edit is refused, his stays.
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_save(%L, 1)', jsonb_build_object('id', :G1, 'category', 'belongings', 'text', 'Mom''s words', 'owner_ids', jsonb_build_array(:ZARA))), 'conflict'),
  'edit vs edit: the stale one gets conflict');
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_remove(%L, 1)', :G1), 'conflict'), 'a stale remove of an edited agreement: conflict, the edit stays');
reset role;
select pg_temp.expect((select agreed_text from public.club_responsibilities where id = :G1) = 'Pack my swim bag before bed.' and (select deleted_at is null from public.club_responsibilities where id = :G1), 'nothing overwritten, nothing lost');

-- Remove (tombstone), then an offline edit of it.
select pg_temp.as_user('authenticated', :MOM);
create temp table rm as select public.household_agreement_remove(:G2, 1) as a;
reset role;
grant select on rm to authenticated;
select pg_temp.expect((select (a ->> 'deleted')::boolean and (a ->> 'revision')::int = 2 from rm), 'remove: kept as a tombstone, revision 2');
select pg_temp.expect((select count(*) from public.club_responsibilities where :LIVE) = 1, 'remove: gone from the family');
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect((select a ->> 'id' from (select public.household_agreement_remove(:G2, 1) as a) x) = :G2, 'removing again (a retry) returns it, no error');
reset role;
select pg_temp.as_user('authenticated', :DAD);
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_save(%L, 1)', jsonb_build_object('id', :G2, 'category', 'cleaning', 'text', 'edited offline', 'owner_ids', jsonb_build_array(:ZARA))), 'removed'),
  'edit vs remove: the edit is told it was removed (not brought back silently)');
reset role;

-- Catching up after being offline: changes since a time include removals.
select pg_temp.as_user('authenticated', :MOM);
create temp table ch as select public.household_agreements(null) as all_, public.household_agreements(now() - interval '1 hour') as since;
reset role;
grant select on ch to authenticated;
select pg_temp.expect((select jsonb_array_length(all_ -> 'agreements') from ch) = 1, 'first sync: every current agreement (no tombstones)');
select pg_temp.expect((select jsonb_path_exists(since, '$.agreements[*] ? (@.deleted == true)') from ch), 'later syncs: removals come through as tombstones');
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(not (select jsonb_path_exists(p, '$.responsibilities[*] ? (@.agreed_text == "Wipe the table after dinner.")') from (select public.club_family_profile() p) x), 'the family profile leaves removed agreements out');
-- Existing (profile) responsibilities can't be edited or removed as agreements.
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_save(%L, 0)', jsonb_build_object('id', (select id from public.club_responsibilities where household_id = :HID and status = 'existing' limit 1),
  'category', 'meals', 'text', 'x', 'owner_ids', jsonb_build_array(:ADA))), 'invalid'), 'an existing (profile) responsibility can''t be edited as an agreement');
select pg_temp.expect((select public.household_agreement_remove((select id from public.club_responsibilities where household_id = :HID and status = 'existing' limit 1), 0)) is null,
  'remove never touches the profile''s own responsibilities');
reset role;
select pg_temp.expect((select count(*) from public.club_responsibilities where household_id = :HID and status = 'existing') = 1, 'the existing responsibility is still there');

-- ---------------------------------------------------------------- validation

select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_save(%L, null)', jsonb_build_object('id', gen_random_uuid(), 'category', 'cleaning', 'text', 'x', 'owner_ids', '[]'::jsonb)), 'invalid'), 'at least one person');
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_save(%L, null)', jsonb_build_object('id', gen_random_uuid(), 'category', 'cleaning', 'text', '  ', 'owner_ids', jsonb_build_array(:ZARA))), 'invalid'), 'words required');
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_save(%L, null)', jsonb_build_object('id', gen_random_uuid(), 'category', 'chores', 'text', 'x', 'owner_ids', jsonb_build_array(:ZARA))), 'invalid'), 'a known category');
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_save(%L, null)', jsonb_build_object('id', gen_random_uuid(), 'category', 'cleaning', 'text', 'x', 'month', '2027-13', 'owner_ids', jsonb_build_array(:ZARA))), 'invalid'), 'a real month');
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_save(%L, null)', jsonb_build_object('id', gen_random_uuid(), 'category', 'cleaning', 'text', 'x', 'status', 'existing', 'owner_ids', jsonb_build_array(:ZARA))), 'invalid'), 'no other fields (can''t set a status)');
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_save(%L, null)', jsonb_build_object('category', 'cleaning', 'text', 'x', 'owner_ids', jsonb_build_array(:ZARA))), 'invalid'), 'an id is required (made on the phone)');
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_save(%L, null)', jsonb_build_object('id', gen_random_uuid(), 'category', 'cleaning', 'text', 'x', 'owner_ids', jsonb_build_array(:LEE))), 'invalid'), 'people must be in this family');
reset role;
-- Reassigning to someone who left the family meanwhile is refused.
update public.club_family_members set archived_at = now() where first_name = 'Kofi';
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_save(%L, 2)', jsonb_build_object('id', :G1, 'category', 'belongings', 'text', 'x', 'owner_ids', jsonb_build_array(:KOFI))), 'invalid'), 'not to an archived member');
reset role;
update public.club_family_members set archived_at = null where first_name = 'Kofi';

-- ---------------------------------------------------------------- isolation

select pg_temp.as_user('authenticated', :OTHER);
select pg_temp.expect((select count(*) from public.club_responsibilities where status = 'confirmed') = 0, 'another family reads none (RLS)');
select pg_temp.expect((select public.household_agreement_remove(:G1, 2)) is null, 'another family can''t remove it (unknown to them)');
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_save(%L, 2)', jsonb_build_object('id', :G1, 'category', 'belongings', 'text', 'hijack', 'owner_ids', jsonb_build_array(:LEE))), 'invalid'), 'another family can''t edit it');
select pg_temp.expect(jsonb_array_length(public.household_agreements(null) -> 'agreements') = 0, 'another family''s sync sees none');
reset role;
select pg_temp.as_user('authenticated', :NOBODY);
select pg_temp.expect(pg_temp.fails($$select public.household_agreement_save('{"id":"a9000000-0000-0000-0000-000000000099","category":"cleaning","text":"x","owner_ids":[]}', null)$$, 'no_household'), 'no household: nothing to agree');
reset role;
select pg_temp.as_user('anon', null);
select pg_temp.expect(pg_temp.fails($$select public.household_agreement_save('{}', null)$$), 'anon can''t call it');
select pg_temp.expect(pg_temp.fails($$select public.household_agreement_remove(gen_random_uuid(), 0)$$), 'anon can''t remove');
select pg_temp.expect(pg_temp.fails($$select public.household_agreements(null)$$), 'anon can''t sync');
reset role;
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails($$update public.club_responsibilities set status = 'confirmed' where true$$), 'no direct table writes');
reset role;
select pg_temp.expect((select count(*) from public.club_responsibilities where :LIVE) = 1 and (select agreed_text from public.club_responsibilities where id = :G1) = 'Pack my swim bag before bed.', 'still exactly one agreement, unchanged');

-- ---------------------------------------------------------------- owner link vs. the family page (e2e finding)
-- The existing family form saves the whole family without member ids (new rows each time). An owner linked to her row
-- (backfilled, or linked on first save) must still be able to save it; her link follows the new account-holder row.
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000a9105', 'agr-owner2@example.com', now());
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000a9105');
select public.club_household_save('The Lins', '{}', '[{"first_name":"Mei","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Kai","kind":"child","role":"child","birth_year":2018,"birth_month":1}]');
reset role;
select pg_temp.expect((select f.first_name from public.household_adults a join public.club_family_members f on f.id = a.member_id where a.user_id = '00000000-0000-0000-0000-0000000a9105') = 'Mei', 'owner linked after the first save');
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000a9105');
select pg_temp.expect(public.club_household_save('The Lins', '{}', '[{"first_name":"Mei","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Kai","kind":"child","role":"child","birth_year":2018,"birth_month":1},{"first_name":"Ivy","kind":"child","role":"child","birth_year":2021}]') is not null,
  'the family form''s id-less save still works for a linked owner');
reset role;
select pg_temp.expect((select f.archived_at is null and f.first_name = 'Mei' from public.household_adults a join public.club_family_members f on f.id = a.member_id where a.user_id = '00000000-0000-0000-0000-0000000a9105'), 'her link follows her current row');
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000a9105');
select pg_temp.expect(public.club_household_save('The Lins', '{}', '[{"first_name":"Mei","kind":"adult","role":"parent"},{"first_name":"Kai","kind":"child","role":"child","birth_year":2018,"birth_month":1}]') is not null, 'no account holder marked: still saves');
reset role;
select pg_temp.expect((select member_id is null from public.household_adults where user_id = '00000000-0000-0000-0000-0000000a9105'), 'and the owner is simply unlinked');
