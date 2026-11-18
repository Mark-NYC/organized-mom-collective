-- Connected calendars (supabase/migrations/20261205000000_calendar_connections.sql). Run by scripts/test-household-sql.sh
-- on a throwaway local database. Never run on the real project.
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

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000cc101', 'cc-mom@example.com', now()),
  ('00000000-0000-0000-0000-0000000cc102', 'cc-dad@example.com', now()),
  ('00000000-0000-0000-0000-0000000cc103', 'cc-other@example.com', now());
\set MOM '''00000000-0000-0000-0000-0000000cc101'''
\set DAD '''00000000-0000-0000-0000-0000000cc102'''
\set OTHER '''00000000-0000-0000-0000-0000000cc103'''

-- A household of two adults and a child; another household.
select pg_temp.as_user('authenticated', :MOM);
select public.club_household_save('The Reyes', '{}',
  '[{"first_name":"Ana","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Luis","kind":"adult","role":"partner"},
    {"first_name":"Sofia","kind":"child","role":"child","birth_year":2018,"birth_month":5}]');
create temp table inv as select public.household_invite_create((select id from public.club_family_members where first_name = 'Luis'), 'cc-dad@example.com') as i;
reset role;
grant select on inv to authenticated;
select pg_temp.as_user('authenticated', :DAD);
select public.household_invite_accept((select i ->> 'code' from inv));
reset role;
select pg_temp.as_user('authenticated', :OTHER);
select public.club_household_save('Others', '{}', '[{"first_name":"Kim","kind":"adult","role":"parent","is_account_holder":true}]');
reset role;
\set SOFIA '(select id from public.club_family_members where first_name = ''Sofia'')'
\set KIM '(select id from public.club_family_members where first_name = ''Kim'')'

-- ---------------------------------------------------------------- the server side (service role only)

select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails($$select public.calendar_connection_upsert('00000000-0000-0000-0000-0000000cc101', 'google', 'x@gmail.com', null)$$),
  'a signed-in adult cannot call the service functions');
select pg_temp.expect(pg_temp.fails($$select * from public.calendar_connection_secrets$$), 'a signed-in adult cannot read the secrets table');
select pg_temp.expect(pg_temp.fails($$select public.calendar_oauth_take('x')$$), 'nor take an OAuth handshake');
reset role;

set role service_role;
-- Google: her account, three calendars; the primary is shown at first, everything private.
create temp table g as select (public.calendar_connection_upsert(:MOM, 'google', 'Ana@Gmail.com', null) ->> 'id')::uuid as id;
select public.calendar_secret_put((select id from g), 'v1.sealed-refresh-token-ciphertext');
select public.calendar_sources_put((select id from g), '[
  {"external_id":"ana@gmail.com","name":"Ana","primary":true,"color":"#9fc6e7","timezone":"America/Chicago"},
  {"external_id":"work","name":"Work","primary":false},
  {"external_id":"soccer","name":"Sofia soccer","primary":false}]', true);
select pg_temp.expect((select count(*) from public.calendar_sources where connection_id = (select id from g)) = 3, 'google: three calendars listed');
select pg_temp.expect((select selected from public.calendar_sources where external_id = 'ana@gmail.com') and not (select selected from public.calendar_sources where external_id = 'work'),
  'google: only the primary calendar is shown at first');
select pg_temp.expect(not exists (select 1 from public.calendar_sources where shared), 'every calendar starts private');
select pg_temp.expect((public.calendar_connection_upsert(:MOM, 'google', 'ana@gmail.com', null) ->> 'existing')::boolean
  and (select count(*) from public.calendar_connections where user_id = :MOM) = 1, 'reconnecting the same Google account never makes a second connection');
-- A feed.
create temp table f as select (public.calendar_connection_upsert(:DAD, 'ical', 'lincoln.k12.us', repeat('a', 64)) ->> 'id')::uuid as id;
select public.calendar_sources_put((select id from f), '[{"external_id":"feed","name":"Lincoln Elementary"}]', true);
select pg_temp.expect(pg_temp.fails(format('select public.calendar_connection_upsert(%L, ''ical'', ''lincoln.k12.us'', %L)', :DAD, repeat('a', 64)), 'duplicate'),
  'the same adult cannot subscribe to the same feed twice');
reset role;
grant select on g, f to authenticated, service_role;

-- ---------------------------------------------------------------- her settings

-- Calendar ids, read once as the test owner (RLS would hide a private calendar from the macros otherwise).
create temp table cals as select external_id, id from public.calendar_sources;
grant select on cals to authenticated, service_role;
\set ANA_CAL '(select id from cals where external_id = ''ana@gmail.com'')'
\set WORK_CAL '(select id from cals where external_id = ''work'')'
\set SOCCER_CAL '(select id from cals where external_id = ''soccer'')'
\set FEED_CAL '(select id from cals where external_id = ''feed'')'

select pg_temp.as_user('authenticated', :DAD);
select pg_temp.expect(pg_temp.fails(format('select public.calendar_source_update(%L, true, true, null)', :ANA_CAL), 'not_found'), 'the other adult cannot change her calendar settings');
select pg_temp.expect(public.calendar_source_update(:FEED_CAL, true, true, jsonb_build_array(:SOFIA)) ->> 'shared' = 'true', 'he shares the school feed, as Sofia''s');
reset role;
select pg_temp.as_user('authenticated', :MOM);
select public.calendar_source_update(:SOCCER_CAL, true, true, jsonb_build_array(:SOFIA));
select public.calendar_source_update(:WORK_CAL, true, false, null);
select public.calendar_source_update(:ANA_CAL, true, true, null);
select pg_temp.expect(pg_temp.fails(format('select public.calendar_source_update(%L, null, null, %L)', :ANA_CAL, jsonb_build_array(:KIM)), 'invalid'), 'whose calendar: only people of her family');
reset role;

-- ---------------------------------------------------------------- syncing

set role service_role;
select pg_temp.expect(jsonb_array_length(public.calendar_sync_claim(null, 50)) = 4, 'claim: the four shown calendars are due');
select pg_temp.expect(jsonb_array_length(public.calendar_sync_claim(null, 50)) = 0, 'claim: claimed calendars are not handed out twice');
create function pg_temp.ev(key text, title text, starts text, priv boolean default false) returns jsonb language sql as $$
  select jsonb_build_object('instance_key', key, 'uid', key || '@x', 'title', title, 'all_day', false, 'starts_at', starts, 'ends_at', null,
                            'location', 'Room 4', 'notes', 'n', 'url', 'https://calendar.google.com/e/' || key, 'recurring', false, 'private', priv)
$$;
select public.calendar_sync_apply(:ANA_CAL, '2026-11-01Z', '2027-05-01Z', jsonb_build_array(
  pg_temp.ev('a1', 'Dentist', '2026-11-20T15:00:00Z'), pg_temp.ev('a2', 'Therapy', '2026-11-21T15:00:00Z', true)), null, null, '30 minutes');
select public.calendar_sync_apply(:WORK_CAL, '2026-11-01Z', '2027-05-01Z', jsonb_build_array(pg_temp.ev('w1', 'Board meeting', '2026-11-20T14:00:00Z')), null, null, '30 minutes');
select public.calendar_sync_apply(:SOCCER_CAL, '2026-11-01Z', '2027-05-01Z', jsonb_build_array(pg_temp.ev('s1', 'U8 game', '2026-11-21T15:00:00Z')), null, null, '30 minutes');
select public.calendar_sync_apply(:FEED_CAL, '2026-11-01Z', '2027-05-01Z', jsonb_build_array(
  jsonb_build_object('instance_key', 'break', 'uid', 'break@school', 'title', 'Thanksgiving Break', 'all_day', true, 'start_date', '2026-11-25', 'end_date', '2026-11-27'),
  pg_temp.ev('s1-dup', 'U8 game', '2026-11-21T15:00:00Z')), '"etag-1"', null, '2 hours');
select pg_temp.expect((select count(*) from public.calendar_imported_events) = 6, 'sync: events stored');
-- The same sync again changes nothing and duplicates nothing.
select public.calendar_sync_apply(:ANA_CAL, '2026-11-01Z', '2027-05-01Z', jsonb_build_array(
  pg_temp.ev('a1', 'Dentist', '2026-11-20T15:00:00Z'), pg_temp.ev('a2', 'Therapy', '2026-11-21T15:00:00Z', true)), null, null, '30 minutes');
select pg_temp.expect((select count(*) from public.calendar_imported_events) = 6, 'sync twice: no duplicates');
select pg_temp.expect((select etag from public.calendar_sources where id = :FEED_CAL) = '"etag-1"', 'feed: ETag kept for the next conditional fetch');
reset role;

-- ---------------------------------------------------------------- who sees what

select pg_temp.as_user('authenticated', :MOM);
create temp table mom_feed as select public.calendar_imported_feed('2026-11-15', '2026-11-30') as f;
select pg_temp.expect(jsonb_array_length((select f from mom_feed) -> 'events') = 6, 'her view: her three calendars and his shared feed');
select pg_temp.expect((select x ->> 'title' from mom_feed, jsonb_array_elements(f -> 'events') x where x ->> 'title' = 'Therapy') = 'Therapy', 'her own private event: she sees it');
select pg_temp.expect((select count(*) from mom_feed, jsonb_array_elements(f -> 'events') x where x ->> 'url' is not null and x ->> 'mine' = 'false') = 0, 'links to his calendars are not sent to her');
select pg_temp.expect(jsonb_array_length(public.calendar_sources_list() -> 'mine') = 1 and jsonb_array_length(public.calendar_sources_list() -> 'shared_with_me') = 1,
  'her list: her Google connection, and his shared feed');
select pg_temp.expect(public.calendar_sources_list()::text not like '%sealed%', 'the list never includes secrets');
reset role;

select pg_temp.as_user('authenticated', :DAD);
create temp table dad_feed as select public.calendar_imported_feed('2026-11-15', '2026-11-30') as f;
select pg_temp.expect((select jsonb_agg(x ->> 'title' order by x ->> 'title') from dad_feed, jsonb_array_elements(f -> 'events') x) = '["Busy","Dentist","Thanksgiving Break","U8 game","U8 game"]'::jsonb,
  'his view: her shared calendars (the private event as "Busy") and his own feed; never her private Work calendar');
select pg_temp.expect((select x ->> 'location' from dad_feed, jsonb_array_elements(f -> 'events') x where x ->> 'title' = 'Busy') is null, 'Busy: no place, no notes');
select pg_temp.expect(pg_temp.count_of('select 1 from public.calendar_imported_events where title = ''Board meeting''') = 0, 'direct table read: her private calendar is invisible (RLS)');
select pg_temp.expect(pg_temp.count_of('select 1 from public.calendar_imported_events where title = ''Therapy''') = 0, 'direct table read: her private event is invisible (RLS)');
select pg_temp.expect(pg_temp.count_of('select 1 from public.calendar_connections') = 1, 'direct table read: only his own connection');
select pg_temp.expect(pg_temp.count_of('select 1 from public.calendar_sources') = 3, 'direct table read: his feed and her two shared calendars');
select pg_temp.expect(pg_temp.fails('update public.calendar_imported_events set title = ''x'''), 'imported events are read-only to everyone signed in');
select pg_temp.expect(pg_temp.fails('delete from public.calendar_sources'), 'calendar settings change only through the function');
reset role;

select pg_temp.as_user('authenticated', :OTHER);
select pg_temp.expect(jsonb_array_length(public.calendar_imported_feed('2026-11-01', '2026-12-31') -> 'events') = 0, 'another household sees nothing');
select pg_temp.expect(pg_temp.count_of('select 1 from public.calendar_sources') = 0 and pg_temp.count_of('select 1 from public.calendar_imported_events') = 0,
  'another household: direct reads empty');
reset role;

-- Unsharing works at once.
select pg_temp.as_user('authenticated', :MOM);
select public.calendar_source_update(:SOCCER_CAL, null, false, null);
reset role;
select pg_temp.as_user('authenticated', :DAD);
select pg_temp.expect((select count(*) from jsonb_array_elements(public.calendar_imported_feed('2026-11-15', '2026-11-30') -> 'events') x where x ->> 'source_id' = (select id::text from cals where external_id = 'feed')) = 2
  and (select count(*) from jsonb_array_elements(public.calendar_imported_feed('2026-11-15', '2026-11-30') -> 'events')) = 4, 'unshared: he no longer sees her soccer calendar');
reset role;

-- ---------------------------------------------------------------- sync safety

set role service_role;
-- An event that's gone in the source is removed; family-owned events are never touched.
insert into public.calendar_events (id, household_id, title, starts_on, created_by)
values ('22222222-0000-0000-0000-000000000001', (select household_id from public.household_adults where user_id = :MOM), 'Family dinner', '2026-11-20', :MOM);
select public.calendar_sync_apply(:ANA_CAL, '2026-11-01Z', '2027-05-01Z', jsonb_build_array(pg_temp.ev('a1', 'Dentist (moved)', '2026-11-20T16:00:00Z')), null, null, '30 minutes');
select pg_temp.expect((select count(*) from public.calendar_imported_events where source_id = :ANA_CAL) = 1
  and (select title from public.calendar_imported_events where instance_key = 'a1') = 'Dentist (moved)', 'cancelled in Google: removed; changed: updated');
select pg_temp.expect(exists (select 1 from public.calendar_events where title = 'Family dinner'), 'sync never touches family-owned events');
-- Events outside the fetched window are left alone.
select public.calendar_sync_apply(:ANA_CAL, '2026-12-01Z', '2027-05-01Z', '[]', null, null, '30 minutes');
select pg_temp.expect((select count(*) from public.calendar_imported_events where source_id = :ANA_CAL) = 1, 'a window that starts later leaves earlier events alone');
-- A big calendar that suddenly comes back nearly empty is held once, then accepted when the next sync agrees.
select public.calendar_sync_apply(:FEED_CAL, '2026-11-01Z', '2027-05-01Z',
  (select jsonb_agg(pg_temp.ev('k' || i, 'Game ' || i, (timestamptz '2026-12-01Z' + i * interval '1 day')::text)) from generate_series(1, 20) i), null, null, '2 hours');
create temp table held as select public.calendar_sync_apply(:FEED_CAL, '2026-11-01Z', '2027-05-01Z', '[]', null, null, '2 hours') as r;
select pg_temp.expect((select (r ->> 'held')::boolean from held) and (select count(*) from public.calendar_imported_events where source_id = :FEED_CAL) = 20,
  'a feed that suddenly comes back empty does not wipe the calendar');
select pg_temp.expect((select sync_error from public.calendar_sources where id = :FEED_CAL) = 'held_large_removal', 'held, and marked');
select public.calendar_sync_apply(:FEED_CAL, '2026-11-01Z', '2027-05-01Z', '[]', null, null, '2 hours');
select pg_temp.expect((select count(*) from public.calendar_imported_events where source_id = :FEED_CAL) = 0, 'the second empty sync in a row is believed');
-- Failures back off; a revoked Google grant asks her to reconnect and keeps the events.
select public.calendar_sync_failed(:ANA_CAL, 'reauth', 'invalid_grant');
select pg_temp.expect((select status from public.calendar_connections where id = (select id from g)) = 'reauth', 'revoked: connection needs reconnecting');
select pg_temp.expect((select count(*) from public.calendar_imported_events where source_id = :ANA_CAL) = 1, 'revoked: events kept until she decides');
update public.calendar_sources set next_sync_at = now() - interval '1 minute';
select pg_temp.expect(not exists (select 1 from jsonb_array_elements(public.calendar_sync_claim(null, 50)) x where x ->> 'connection_id' = (select id::text from g)),
  'a connection waiting to be reconnected is not synced');
select pg_temp.expect((public.calendar_connection_upsert(:MOM, 'google', 'ana@gmail.com', null) ->> 'existing')::boolean, 'reconnecting: the same connection');
select pg_temp.expect((select status from public.calendar_connections where id = (select id from g)) = 'active', 'reconnecting: active again');
select public.calendar_sync_failed(:FEED_CAL, 'retry', 'timeout');
select pg_temp.expect((select next_sync_at > now() + interval '10 minutes' and failures = 1 from public.calendar_sources where id = :FEED_CAL), 'a failed fetch backs off');
-- OAuth handshakes are one-time.
select public.calendar_oauth_begin(:MOM, repeat('s', 40), repeat('v', 43), 'app');
select pg_temp.expect(public.calendar_oauth_take(repeat('s', 40)) ->> 'return_to' = 'app', 'oauth: state taken once');
select pg_temp.expect(public.calendar_oauth_take(repeat('s', 40)) is null, 'oauth: a replayed state is refused');
reset role;

-- ---------------------------------------------------------------- leaving and disconnecting

-- He leaves the household: his feed stops being shared with her at once.
delete from public.household_adults where user_id = :DAD;
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(jsonb_array_length(public.calendar_sources_list() -> 'shared_with_me') = 0, 'after he leaves, his calendars are no longer hers to see');
reset role;
set role service_role;
select pg_temp.expect(pg_temp.fails(format('select public.calendar_connection_remove(%L, %L)', :DAD, (select id from g)), 'not_found'), 'only the owner can remove a connection');
select public.calendar_connection_remove(:MOM, (select id from g));
select pg_temp.expect(not exists (select 1 from public.calendar_connection_secrets where connection_id = (select id from g))
  and not exists (select 1 from public.calendar_sources where connection_id = (select id from g)), 'disconnect: secret, calendars and copied events removed');
reset role;
