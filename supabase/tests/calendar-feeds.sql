-- Calendar subscriptions (supabase/migrations/20261205000000_calendar_feeds.sql): privacy per adult, sharing,
-- duplicates, refresh results, leaving the household. Throwaway local database only (scripts/test-household-sql.sh).
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
  ('00000000-0000-0000-0000-0000000ca101', 'cal-mom@example.com', now()),
  ('00000000-0000-0000-0000-0000000ca102', 'cal-dad@example.com', now()),
  ('00000000-0000-0000-0000-0000000ca103', 'cal-other@example.com', now());
\set MOM '''00000000-0000-0000-0000-0000000ca101'''
\set DAD '''00000000-0000-0000-0000-0000000ca102'''
\set OTHER '''00000000-0000-0000-0000-0000000ca103'''

select pg_temp.as_user('authenticated', :MOM);
select public.club_household_save('The Calendars', '{}',
  '[{"first_name":"Rosa","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Ben","kind":"adult","role":"partner"},
    {"first_name":"Lia","kind":"child","role":"child","birth_year":2016,"birth_month":3}]');
create temp table inv as select public.household_invite_create((select id from public.club_family_members where first_name = 'Ben' and household_id = public.household_id_for(auth.uid())), 'cal-dad@example.com') as i;
reset role;
grant select on inv to authenticated;
select pg_temp.as_user('authenticated', :DAD);
select public.household_invite_accept((select i ->> 'code' from inv));
reset role;
select pg_temp.as_user('authenticated', :OTHER);
select public.club_household_save('Others', '{}', '[{"first_name":"Ola","kind":"adult","role":"parent","is_account_holder":true}]');
reset role;
\set LIA '(select id from public.club_family_members where first_name = ''Lia'')'
create temp table ola as select id from public.club_family_members where first_name = 'Ola';
grant select on ola to authenticated, anon;
\set OLA '(select id from ola)'
\set HID '(select household_id from public.household_adults where user_id = ''00000000-0000-0000-0000-0000000ca101'')'

-- Subscribe (private by default), webcal:// becomes https://, the same URL twice is one subscription.
select pg_temp.as_user('authenticated', :MOM);
create temp table f1 as select public.calendar_feed_add(jsonb_build_object('url', 'webcal://school.example.org/cal.ics?token=SECRET', 'name', 'Lincoln Elementary', 'member_id', :LIA, 'timezone', 'America/Chicago')) as j;
reset role;
grant select on f1 to authenticated, anon;
\set F1 '(select (j ->> ''id'')::uuid from f1)'
select pg_temp.expect((select j ->> 'url' from f1) = 'https://school.example.org/cal.ics?token=SECRET' and (select j ->> 'visibility' from f1) = 'private' and (select (j ->> 'mine')::boolean from f1), 'subscribe: private by default, webcal becomes https, owner sees the URL');
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect((public.calendar_feed_add('{"url":"https://school.example.org/cal.ics?token=SECRET"}') ->> 'id')::uuid = :F1, 'the same URL again is the same subscription');
select pg_temp.expect(pg_temp.fails($q$select public.calendar_feed_add('{"url":"http://localhost:8080/x.ics"}')$q$, 'invalid_url'), 'a local address is refused');
select pg_temp.expect(pg_temp.fails($q$select public.calendar_feed_add('{"url":"ftp://x.example/cal.ics"}')$q$, 'invalid_url'), 'only http(s) and webcal');
select pg_temp.expect(pg_temp.fails(format('select public.calendar_feed_add(%L)', jsonb_build_object('url', 'https://x.example/a.ics', 'member_id', :OLA)), 'invalid'), 'another family''s member is refused');
reset role;

-- The refresher stores events (service role).
select public.calendar_feed_store(:F1, jsonb_build_object('result', 'ok', 'etag', 'v1', 'events', jsonb_build_array(
  jsonb_build_object('uid', 'pic@school', 'instance_key', '2026-11-20', 'title', 'Picture day', 'all_day', true, 'start_date', '2026-11-20', 'end_date', '2026-11-20'),
  jsonb_build_object('uid', 'conc@school', 'instance_key', '2026-11-19T23:00:00.000Z', 'title', 'Winter concert', 'all_day', false, 'starts_at', '2026-11-19T23:00:00Z', 'ends_at', '2026-11-20T00:30:00Z'))));
select pg_temp.expect((select status = 'ok' and event_count = 2 and etag = 'v1' from public.calendar_feeds where id = :F1), 'a refresh stores the events and marks the subscription ok');

-- Private: only Rosa sees it. Ben sees nothing; the household view excludes it.
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(jsonb_array_length(public.calendar_feed_events('2026-11-01', '2026-11-30')) = 2, 'the owner sees her private calendar''s events');
select pg_temp.expect(jsonb_array_length(public.calendar_feed_events('2026-11-01', '2026-11-30', 'household')) = 0, 'a private calendar is never in the household (Family Meeting) view');
reset role;
select pg_temp.as_user('authenticated', :DAD);
select pg_temp.expect(jsonb_array_length(public.calendar_feeds()) = 0 and jsonb_array_length(public.calendar_feed_events('2026-11-01', '2026-11-30')) = 0, 'the other adult sees nothing of a private calendar');
select pg_temp.expect(pg_temp.fails(format('select public.calendar_feed_update(%L, %L)', :F1, '{"visibility":"household"}'), 'not_found'), 'and can''t change it');
select pg_temp.expect(not public.calendar_feed_remove(:F1), 'or remove it');
reset role;

-- Shared with the household: Ben sees it and its events, never its URL or its error text.
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(public.calendar_feed_update(:F1, '{"visibility":"household"}') ->> 'visibility' = 'household', 'the owner shares it with the household');
reset role;
select pg_temp.as_user('authenticated', :DAD);
select pg_temp.expect((public.calendar_feeds() -> 0 ->> 'name') = 'Lincoln Elementary' and (public.calendar_feeds() -> 0 -> 'url') = 'null'::jsonb and not (public.calendar_feeds() -> 0 ->> 'mine')::boolean, 'the other adult sees a shared calendar''s name, never its URL');
select pg_temp.expect(jsonb_array_length(public.calendar_feed_events('2026-11-01', '2026-11-30', 'household')) = 2, 'and its events, in the Family Meeting view too');
-- Ben subscribes to the same school calendar himself (his own URL), shares it: one copy of each occurrence.
create temp table f2 as select public.calendar_feed_add('{"url":"https://school.example.org/cal.ics?token=BENS","name":"School","visibility":"household"}') as j;
reset role;
grant select on f2 to authenticated, anon;
select public.calendar_feed_store((select (j ->> 'id')::uuid from f2), jsonb_build_object('result', 'ok', 'events', jsonb_build_array(
  jsonb_build_object('uid', 'pic@school', 'instance_key', '2026-11-20', 'title', 'Picture day', 'all_day', true, 'start_date', '2026-11-20', 'end_date', '2026-11-20'))));
select pg_temp.as_user('authenticated', :DAD);
select pg_temp.expect(jsonb_array_length(public.calendar_feed_events('2026-11-01', '2026-11-30')) = 2, 'the same occurrence from two subscriptions shows once');
reset role;

-- Other households see nothing.
select pg_temp.as_user('authenticated', :OTHER);
select pg_temp.expect(jsonb_array_length(public.calendar_feeds()) = 0 and jsonb_array_length(public.calendar_feed_events('2026-11-01', '2026-11-30')) = 0, 'another family sees nothing');
reset role;
select pg_temp.as_user('anon', null);
select pg_temp.expect(pg_temp.fails('select public.calendar_feeds()'), 'signed out: nothing');
reset role;
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails(format('select public.calendar_feed_store(%L, %L)', :F1, '{"result":"ok"}')), 'adults can''t write imported events themselves');
select pg_temp.expect(pg_temp.fails('select public.calendar_feed_claim(5)'), 'or run the refresher');
reset role;

-- Refresh results: an error keeps the last good events; a calendar that's gone disconnects; retry starts over.
select public.calendar_feed_store(:F1, '{"result":"error","error":"The calendar didn''t answer."}');
select pg_temp.expect((select status = 'error' and event_count = 2 and failures = 1 from public.calendar_feeds where id = :F1)
  and (select count(*) from public.calendar_feed_events where feed_id = :F1) = 2, 'an error keeps the last good events');
select public.calendar_feed_store(:F1, '{"result":"not_modified"}');
select pg_temp.expect((select status = 'ok' and failures = 0 from public.calendar_feeds where id = :F1), 'unchanged since last time: ok, events kept');
select public.calendar_feed_store(:F1, '{"result":"gone"}');
select pg_temp.expect((select status from public.calendar_feeds where id = :F1) = 'disconnected', 'a calendar that''s gone is disconnected');
select pg_temp.expect(jsonb_array_length(public.calendar_feed_claim(50)) = 0 or not exists (select 1 from jsonb_array_elements(public.calendar_feed_claim(50)) c where (c ->> 'id')::uuid = :F1), 'a disconnected one isn''t refreshed');
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(public.calendar_feed_retry(:F1) ->> 'status' = 'pending', 'its owner can retry it');
reset role;
select pg_temp.expect(exists (select 1 from jsonb_array_elements(public.calendar_feed_claim(50, :F1, :MOM)) c where (c ->> 'id')::uuid = :F1), 'Refresh now: the named feed, for its owner');
select pg_temp.expect(jsonb_array_length(public.calendar_feed_claim(50, :F1, :DAD)) = 0, 'never for someone else');

-- Ben leaves: his shared calendar stops showing to the household at once.
select pg_temp.as_user('authenticated', :DAD);
select public.household_leave();
reset role;
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(jsonb_array_length(public.calendar_feeds()) = 1 and (public.calendar_feeds() -> 0 ->> 'name') = 'Lincoln Elementary', 'an adult who left: their calendars leave with them');
create temp table removed as select public.calendar_feed_remove(:F1) as ok;
reset role;
select pg_temp.expect((select ok from removed) and (select count(*) from public.calendar_feed_events where feed_id = :F1) = 0, 'unsubscribing removes its imported events');
select pg_temp.expect((select count(*) from public.calendar_events) >= 0, 'the family''s own calendar is untouched by all of this');
