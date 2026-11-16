-- Shared cleaning progress (supabase/migrations/20261201000000_household_cleaning_progress.sql). Throwaway local database only.
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
-- [{list,period,item,done,at}] for one tap.
create function pg_temp.tap(p_list text, p_period text, p_item text, p_done boolean, p_at timestamptz) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('list', p_list, 'period', p_period, 'item', p_item, 'done', p_done, 'at', p_at))
$$;

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000f0001', 'clean-kim@example.com', now()),
  ('00000000-0000-0000-0000-0000000f0002', 'clean-lee@example.com', now()),
  ('00000000-0000-0000-0000-0000000f0003', 'clean-other@example.com', now()),
  ('00000000-0000-0000-0000-0000000f0004', 'clean-nobody@example.com', now());
\set KIM '''00000000-0000-0000-0000-0000000f0001'''
\set LEE '''00000000-0000-0000-0000-0000000f0002'''
\set OTHER '''00000000-0000-0000-0000-0000000f0003'''
\set NOBODY '''00000000-0000-0000-0000-0000000f0004'''

select pg_temp.as_user('authenticated', :KIM);
select public.club_household_save('The Kims', '{}', '[{"first_name":"Kim","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Lee","kind":"adult","role":"partner"}]');
create temp table inv as select public.household_invite_create((select id from public.club_family_members where first_name = 'Lee' and household_id = public.household_id_for(auth.uid())), 'clean-lee@example.com') as i;
reset role;
grant select on inv to authenticated;
select pg_temp.as_user('authenticated', :LEE);
select public.household_invite_accept((select i ->> 'code' from inv));
reset role;
select pg_temp.as_user('authenticated', :OTHER);
select public.club_household_save('Others', '{}', '[{"first_name":"Olu","kind":"adult","role":"parent","is_account_holder":true}]');
reset role;

-- ---------------------------------------------------------------- one checks, the other sees it
select pg_temp.as_user('authenticated', :KIM);
select pg_temp.expect((public.cleaning_marks_push(pg_temp.tap('daily', '2026-11-16', 'dishes', true, now() - interval '10 minutes')) ->> 'applied')::int = 1, 'she checks the dishes');
reset role;
select pg_temp.as_user('authenticated', :LEE);
create temp table first_pull as select public.cleaning_marks_changes(null) as c;
select pg_temp.expect((select c -> 'marks' @> '[{"list":"daily","period":"2026-11-16","item":"dishes","done":true}]' from first_pull), 'he sees it on his phone');
-- Different items never collide.
select public.cleaning_marks_push(pg_temp.tap('daily', '2026-11-16', 'counters', true, now() - interval '9 minutes'));
select pg_temp.expect((select count(*) from public.household_cleaning_marks where done) = 2, 'they check different things: both stand');
-- An uncheck travels too.
select public.cleaning_marks_push(pg_temp.tap('daily', '2026-11-16', 'dishes', false, now() - interval '8 minutes'));
reset role;
select pg_temp.as_user('authenticated', :KIM);
select pg_temp.expect((public.cleaning_marks_changes((select (c ->> 'now')::timestamptz from first_pull)) -> 'marks') @> '[{"item":"dishes","done":false}]', 'his uncheck reaches her as a change');
select pg_temp.expect(not ((public.cleaning_marks_changes(null) -> 'marks') @> '[{"item":"dishes"}]') and (public.cleaning_marks_changes(null) -> 'marks') @> '[{"item":"counters","done":true}]', 'a phone starting fresh gets only what is checked');

-- ---------------------------------------------------------------- the same item: the latest tap wins, whenever it arrives
-- She checked the dishes offline 20 minutes ago (before his uncheck); it arrives now.
select pg_temp.expect((public.cleaning_marks_push(pg_temp.tap('daily', '2026-11-16', 'dishes', true, now() - interval '20 minutes')) ->> 'applied')::int = 0, 'an older offline tap arriving late is ignored, not an error');
select pg_temp.expect((select not done from public.household_cleaning_marks where item = 'dishes'), 'his later uncheck still stands');
select (now() - interval '1 minute')::text as t1 \gset
select pg_temp.expect((public.cleaning_marks_push(pg_temp.tap('daily', '2026-11-16', 'dishes', true, :'t1')) ->> 'applied')::int = 1, 'a newer tap is taken');
select pg_temp.expect((select done from public.household_cleaning_marks where item = 'dishes'), 'and wins');
-- Sending the same thing again changes nothing.
select pg_temp.expect((public.cleaning_marks_push(pg_temp.tap('daily', '2026-11-16', 'dishes', true, :'t1')) ->> 'applied')::int = 0, 'a retry of the same tap is harmless');
-- A phone with a fast clock can't claim the future and block everyone after it.
select public.cleaning_marks_push(pg_temp.tap('focus', '2026-11-16', 'mirrors', true, now() + interval '3 days'));
select pg_temp.expect((select changed_at <= now() from public.household_cleaning_marks where item = 'mirrors'), 'a tap dated in the future is held to the server''s clock');
-- Several taps for one item in one call: the latest.
select public.cleaning_marks_push(jsonb_build_array(
  jsonb_build_object('list', 'monthly', 'period', '2026-11', 'item', 'nov-shoes', 'done', true, 'at', now() - interval '5 minutes'),
  jsonb_build_object('list', 'monthly', 'period', '2026-11', 'item', 'nov-shoes', 'done', false, 'at', now() - interval '2 minutes'),
  jsonb_build_object('list', 'active', 'period', '2026-11-16', 'item', 'monthly:2026-11:nov-shoes', 'done', true, 'at', now() - interval '5 minutes')));
select pg_temp.expect((select not done from public.household_cleaning_marks where item = 'nov-shoes') and (select count(*) from public.household_cleaning_marks) = 5, 'one call, several taps on one item: the latest; monthly and activity lists are shared too');
-- The first upload from a phone is dated at the epoch: it fills gaps and never undoes anyone.
select pg_temp.expect((public.cleaning_marks_push(pg_temp.tap('daily', '2026-11-16', 'dishes', false, 'epoch')) ->> 'applied')::int = 0
  and (public.cleaning_marks_push(pg_temp.tap('daily', '2026-11-10', 'laundry', true, 'epoch')) ->> 'applied')::int = 1, 'a phone''s first upload only adds what the household has no record of');

-- ---------------------------------------------------------------- refused input
select pg_temp.expect(pg_temp.fails($q$select public.cleaning_marks_push('[{"list":"secrets","period":"2026-11-16","item":"x","done":true,"at":"2026-11-16T10:00:00Z"}]')$q$, 'invalid')
  and pg_temp.fails($q$select public.cleaning_marks_push('[{"list":"daily","period":"next week","item":"x","done":true,"at":"2026-11-16T10:00:00Z"}]')$q$, 'invalid')
  and pg_temp.fails($q$select public.cleaning_marks_push('[{"list":"daily","period":"2026-11-16","item":"","done":true,"at":"2026-11-16T10:00:00Z"}]')$q$, 'invalid')
  and pg_temp.fails($q$select public.cleaning_marks_push('[{"list":"daily","period":"2026-11-16","item":"x","done":true,"at":"yesterday-ish"}]')$q$, 'invalid')
  and pg_temp.fails($q$select public.cleaning_marks_push('[{"list":"daily","period":"2026-11-16","item":"x","at":"2026-11-16T10:00:00Z"}]')$q$, 'invalid')
  and pg_temp.fails($q$select public.cleaning_marks_push('{"not":"a list"}')$q$, 'invalid'), 'a bad list, date, item, time or shape is refused');
select pg_temp.expect(pg_temp.fails(format('select public.cleaning_marks_push(%L)', (select jsonb_agg(jsonb_build_object('list', 'daily', 'period', '2026-11-16', 'item', 'i' || g, 'done', true, 'at', now())) from generate_series(1, 501) g)), 'invalid'), 'more than 500 taps in a call is refused');
select pg_temp.expect(pg_temp.fails('insert into public.household_cleaning_marks (household_id, list, period, item, done, changed_at) values (public.household_id_for(auth.uid()), ''daily'', ''2026-11-16'', ''sneaky'', true, now())')
  and pg_temp.fails('update public.household_cleaning_marks set done = false') and pg_temp.fails('delete from public.household_cleaning_marks'), 'nobody writes the table directly');
reset role;

-- ---------------------------------------------------------------- isolation
select pg_temp.as_user('authenticated', :OTHER);
select pg_temp.expect((public.cleaning_marks_changes(null) -> 'marks') = '[]' and (select count(*) from public.household_cleaning_marks) = 0, 'another household sees none of it');
select public.cleaning_marks_push(pg_temp.tap('daily', '2026-11-16', 'dishes', false, now()));
reset role;
select pg_temp.expect((select done from public.household_cleaning_marks c join public.household_adults a on a.household_id = c.household_id where a.user_id = :KIM and c.item = 'dishes'), 'and its taps land in its own household only');
select pg_temp.as_user('authenticated', :NOBODY);
select pg_temp.expect((public.cleaning_marks_changes(null) -> 'marks') = '[]' and pg_temp.fails($q$select public.cleaning_marks_push('[]')$q$, 'no_household'), 'signed in without a family: nothing to read, nowhere to save');
reset role;
select pg_temp.as_user('anon', null);
select pg_temp.expect(pg_temp.fails('select public.cleaning_marks_changes(null)') and pg_temp.fails($q$select public.cleaning_marks_push('[]')$q$) and pg_temp.fails('select * from public.household_cleaning_marks'), 'anon has nothing');
reset role;

-- ---------------------------------------------------------------- access follows the household
select pg_temp.as_user('authenticated', :KIM);
select public.household_partner_remove();
reset role;
select pg_temp.as_user('authenticated', :LEE);
select pg_temp.expect((public.cleaning_marks_changes(null) -> 'marks') = '[]' and (select count(*) from public.household_cleaning_marks) = 0 and pg_temp.fails($q$select public.cleaning_marks_push('[]')$q$, 'no_household'), 'a removed partner loses it at once');
reset role;
delete from auth.users where id = :KIM;
select pg_temp.expect((select count(*) from public.household_cleaning_marks c where not exists (select 1 from public.club_households h where h.id = c.household_id)) = 0, 'a deleted household takes its marks with it');
