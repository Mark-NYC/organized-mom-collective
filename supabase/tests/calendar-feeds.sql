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
  ('00000000-0000-0000-0000-0000000cf101', 'feed-mom@example.com', now()),
  ('00000000-0000-0000-0000-0000000cf102', 'feed-dad@example.com', now()),
  ('00000000-0000-0000-0000-0000000cf103', 'feed-other@example.com', now());
\set MOM '''00000000-0000-0000-0000-0000000cf101'''
\set DAD '''00000000-0000-0000-0000-0000000cf102'''
\set OTHER '''00000000-0000-0000-0000-0000000cf103'''

select pg_temp.as_user('authenticated', :MOM);
select public.club_household_save('The Calendars', '{}',
  '[{"first_name":"Rosa","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Ben","kind":"adult","role":"partner"},
    {"first_name":"Lia","kind":"child","role":"child","birth_year":2016,"birth_month":3}]');
create temp table inv as select public.household_invite_create((select id from public.club_family_members where first_name = 'Ben' and household_id = public.household_id_for(auth.uid())), 'feed-dad@example.com') as i;
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
\set HID '(select household_id from public.household_adults where user_id = ''00000000-0000-0000-0000-0000000cf101'')'

-- One event the family made itself: nothing below may change it.
select pg_temp.as_user('authenticated', :MOM);
select public.calendar_event_save(jsonb_build_object('id', 'cf000000-0000-0000-0000-0000000000e1', 'title', 'Dentist', 'starts_on', '2026-11-20', 'timezone', 'America/Chicago'), null);
reset role;
create temp table own_before as select id, title, revision, deleted_at from public.calendar_events;

-- Staged rollout: off until a tester is in the household (or it's turned on for everyone).
-- The V20 launch (20261215000002) turned it on for everyone; check that, then test the gate itself from off.
select pg_temp.expect((select everyone from public.calendar_feed_rollout where id), 'the V20 launch turned calendar links on for everyone');
update public.calendar_feed_rollout set everyone = false where id;
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails($q$select public.calendar_feed_add('{"url":"https://school.example.org/a.ics"}')$q$, 'not_enabled') and pg_temp.fails('select public.calendar_feeds()', 'not_enabled'), 'off by default: nobody can subscribe or list');
reset role;
insert into public.calendar_feed_testers (user_id, note) values ('00000000-0000-0000-0000-0000000cf101', 'test account');
select pg_temp.as_user('authenticated', :DAD);
select pg_temp.expect(jsonb_array_length(public.calendar_feeds()) = 0, 'a tester''s household: both adults have it (sharing can be tested)');
reset role;
select pg_temp.as_user('authenticated', :OTHER);
select pg_temp.expect(pg_temp.fails('select public.calendar_feeds()', 'not_enabled'), 'other households still don''t');
reset role;
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails('select * from public.calendar_feed_testers'), 'adults can''t read or add testers');
reset role;

-- Subscribe (private by default), webcal:// becomes https://, the same URL twice is one subscription.
select pg_temp.as_user('authenticated', :MOM);
create temp table f1 as select public.calendar_feed_add(jsonb_build_object('url', 'webcal://school.example.org/cal.ics?token=SECRET', 'name', 'Lincoln Elementary', 'member_id', :LIA, 'timezone', 'America/Chicago')) as j;
reset role;
grant select on f1 to authenticated, anon;
\set F1 '(select (j ->> ''id'')::uuid from f1)'
select pg_temp.expect((select j ->> 'url_host' from f1) = 'school.example.org' and not (select j::text from f1) ~ 'token|SECRET|https?:' and (select j ->> 'visibility' from f1) = 'private' and (select (j ->> 'mine')::boolean from f1), 'subscribe: private by default; the answer carries the host, never the link');
select pg_temp.expect((select ds.decrypted_secret from public.calendar_feeds f join vault.decrypted_secrets ds on ds.id = f.url_secret_id where f.id = :F1) = 'https://school.example.org/cal.ics?token=SECRET', 'the link is in Vault (webcal became https)');
select pg_temp.expect(not exists (select 1 from public.calendar_feeds f where to_jsonb(f)::text ~ 'SECRET|cal\.ics'), 'and nowhere in the subscriptions table');
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect((public.calendar_feed_add('{"url":"https://school.example.org/cal.ics?token=SECRET"}') ->> 'id')::uuid = :F1, 'the same URL again is the same subscription');
select pg_temp.expect(pg_temp.fails($q$select public.calendar_feed_add('{"url":"http://localhost:8080/x.ics"}')$q$, 'invalid_url'), 'a local address is refused');
select pg_temp.expect(pg_temp.fails($q$select public.calendar_feed_add('{"url":"ftp://x.example/cal.ics"}')$q$, 'invalid_url'), 'only http(s) and webcal');
select pg_temp.expect(pg_temp.fails($q$select public.calendar_feed_add('{"url":"https://172.20.1.1/x.ics"}')$q$, 'invalid_url') and pg_temp.fails($q$select public.calendar_feed_add('{"url":"https://printer.local/x.ics"}')$q$, 'invalid_url'), 'private networks and local names are refused');
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
select pg_temp.expect((public.calendar_feeds() -> 0 ->> 'name') = 'Lincoln Elementary' and (public.calendar_feeds() -> 0 -> 'url_host') = 'null'::jsonb and not (public.calendar_feeds()::text ~ 'SECRET|token|https?:') and not (public.calendar_feeds() -> 0 ->> 'mine')::boolean, 'the other adult sees a shared calendar''s name, never its URL');
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

-- Other households see nothing, even with calendars switched on for them too.
insert into public.calendar_feed_testers (user_id) values ('00000000-0000-0000-0000-0000000cf103');
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
select public.calendar_feed_store(:F1, '{"result":"ok","events":[]}');
select pg_temp.expect((select status = 'error' and event_count = 2 from public.calendar_feeds where id = :F1)
  and (select count(*) from public.calendar_feed_events where feed_id = :F1) = 2, 'a calendar that suddenly comes back empty keeps its events (a hiccup)');
select public.calendar_feed_store(:F1, '{"result":"not_modified","etag":"v2"}');
select pg_temp.expect((select etag from public.calendar_feeds where id = :F1) = 'v2', 'unchanged: the new ETag is kept');
select public.calendar_feed_store(:F1, '{"result":"gone","error":"This calendar no longer exists at that link."}');
select public.calendar_feed_store(:F1, '{"result":"gone"}');
select pg_temp.expect((select status = 'error' and failures = 2 and event_count = 2 from public.calendar_feeds where id = :F1)
  and (select count(*) from public.calendar_feed_events where feed_id = :F1) = 2, 'a link that stops working: events kept through two failed refreshes');
select public.calendar_feed_store(:F1, '{"result":"gone"}');
select pg_temp.expect((select status = 'disconnected' and event_count = 0 and etag is null and content_hash is null from public.calendar_feeds where id = :F1)
  and (select count(*) from public.calendar_feed_events where feed_id = :F1) = 0, 'the third in a row disconnects it and its stale events leave the calendar');
select pg_temp.expect(jsonb_array_length(public.calendar_feed_claim(50)) = 0 or not exists (select 1 from jsonb_array_elements(public.calendar_feed_claim(50)) c where (c ->> 'id')::uuid = :F1), 'a disconnected one isn''t refreshed');
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(public.calendar_feed_retry(:F1) ->> 'status' = 'pending', 'its owner can retry it');
reset role;
select pg_temp.expect(exists (select 1 from jsonb_array_elements(public.calendar_feed_claim(50, :F1, :MOM)) c where (c ->> 'id')::uuid = :F1 and c ->> 'url' = 'https://school.example.org/cal.ics?token=SECRET'), 'Refresh now: the named feed with its decrypted link, for the refresher only');
select pg_temp.expect((public.calendar_feed_claim(1, :F1, :MOM) -> 0 ->> 'recent')::boolean and not (public.calendar_feed_claim(1, :F1, :MOM) -> 0 ? 'url'), 'refreshed seconds ago: not fetched again (a double tap)');
select pg_temp.as_user('authenticated', :MOM);
select public.calendar_feed_retry(:F1);
reset role;
select pg_temp.expect((select last_attempt_at is not null from public.calendar_feeds where id = :F1), 'retry only restarts a disconnected calendar (no way around the double-tap guard)');
select pg_temp.expect(jsonb_array_length(public.calendar_feed_claim(50, :F1, :DAD)) = 0, 'never for someone else');

-- Ben leaves: his shared calendar stops showing to the household at once.
select pg_temp.as_user('authenticated', :DAD);
select public.household_leave();
reset role;
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(jsonb_array_length(public.calendar_feeds()) = 1 and (public.calendar_feeds() -> 0 ->> 'name') = 'Lincoln Elementary', 'an adult who left: their calendars leave with them');
reset role;
select pg_temp.expect(not exists (select 1 from jsonb_array_elements(public.calendar_feed_claim(50)) c where (c ->> 'id')::uuid = (select (j ->> 'id')::uuid from f2)), 'and are no longer fetched for that household');
insert into public.calendar_feed_testers (user_id) values ('00000000-0000-0000-0000-0000000cf102');
select pg_temp.as_user('authenticated', :DAD);
select public.club_household_save('Ben''s', '{}', '[{"first_name":"Ben","kind":"adult","role":"parent","is_account_holder":true}]');
create temp table f2b as select public.calendar_feed_add('{"url":"https://school.example.org/cal.ics?token=BENS","name":"School"}') as j;
reset role;
select pg_temp.expect((select (j ->> 'id')::uuid from f2b) = (select (j ->> 'id')::uuid from f2)
  and (select household_id <> :HID and visibility = 'private' and event_count = 0 from public.calendar_feeds where id = (select (j ->> 'id')::uuid from f2))
  and (select count(*) from public.calendar_feed_events where feed_id = (select (j ->> 'id')::uuid from f2)) = 0,
  'adding it again in his new household moves it there, private, without the old household''s events');
select pg_temp.as_user('authenticated', :MOM);
create temp table removed as select public.calendar_feed_remove(:F1) as ok;
reset role;
select pg_temp.expect((select ok from removed) and (select count(*) from public.calendar_feed_events where feed_id = :F1) = 0, 'unsubscribing removes its imported events');
select pg_temp.expect(not exists (select 1 from vault.secrets where name = 'calendar_feed:' || :F1), 'and its encrypted link');
-- Turning the test off for Ben's household: his calendars are neither listed nor refreshed.
delete from public.calendar_feed_testers where user_id = '00000000-0000-0000-0000-0000000cf102';
select pg_temp.expect(not exists (select 1 from jsonb_array_elements(public.calendar_feed_claim(50)) c where (c ->> 'id')::uuid = (select (j ->> 'id')::uuid from f2)), 'switched off: never refreshed');
select pg_temp.as_user('authenticated', :DAD);
select pg_temp.expect(pg_temp.fails('select public.calendar_feeds()', 'not_enabled'), 'outside a tester''s household: off');
select pg_temp.expect(public.calendar_feed_remove((select (j ->> 'id')::uuid from f2)), 'but he can still remove his own subscription');
reset role;
select pg_temp.expect(not exists (select 1 from vault.secrets where name = 'calendar_feed:' || (select j ->> 'id' from f2)), 'removed: its link is gone from Vault');
select pg_temp.expect((select count(*) from public.calendar_events) = (select count(*) from own_before)
  and not exists (select id, title, revision, deleted_at from public.calendar_events except select * from own_before), 'the family''s own events are untouched by all of this');

-- Last (it removes a whole family): deleting an account deletes its subscriptions and their encrypted links.
select pg_temp.as_user('authenticated', :MOM);
select public.calendar_feed_add('{"url":"https://work.example.org/w.ics","name":"Work"}');
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-0000000cf101';
select pg_temp.expect((select count(*) from vault.secrets where name like 'calendar_feed:%') = (select count(*) from public.calendar_feeds), 'deleting an account deletes its subscriptions and their links');
