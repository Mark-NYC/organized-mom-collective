-- Connect Google Calendar (supabase/migrations/20261206000000_calendar_google.sql): the Google rollout switch,
-- one-time OAuth states, encrypted refresh tokens, account binding, reconnecting, choosing calendars, privacy,
-- multiple accounts, disconnect and cleanup, the refresher's claim. Throwaway local database only.
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
  ('00000000-0000-0000-0000-0000000c6101', 'g-mom@example.com', now()),
  ('00000000-0000-0000-0000-0000000c6102', 'g-dad@example.com', now()),
  ('00000000-0000-0000-0000-0000000c6103', 'g-other@example.com', now());
\set MOM '''00000000-0000-0000-0000-0000000c6101'''
\set DAD '''00000000-0000-0000-0000-0000000c6102'''
\set OTHER '''00000000-0000-0000-0000-0000000c6103'''

select pg_temp.as_user('authenticated', :MOM);
select public.club_household_save('The Googles', '{}',
  '[{"first_name":"Gina","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Gus","kind":"adult","role":"partner"},
    {"first_name":"Gemma","kind":"child","role":"child","birth_year":2016,"birth_month":3}]');
create temp table inv as select public.household_invite_create((select id from public.club_family_members where first_name = 'Gus' and household_id = public.household_id_for(auth.uid())), 'g-dad@example.com') as i;
select public.calendar_event_save(jsonb_build_object('id', 'c6000000-0000-0000-0000-0000000000e1', 'title', 'Dentist', 'starts_on', '2026-11-20', 'timezone', 'America/Chicago'), null);
reset role;
grant select on inv to authenticated;
select pg_temp.as_user('authenticated', :DAD);
select public.household_invite_accept((select i ->> 'code' from inv));
reset role;
select pg_temp.as_user('authenticated', :OTHER);
select public.club_household_save('Others', '{}', '[{"first_name":"Gwendolyn-other","kind":"adult","role":"parent","is_account_holder":true}]');
reset role;
\set GEMMA '(select id from public.club_family_members where first_name = ''Gemma'')'
create temp table ola as select id from public.club_family_members where first_name = 'Gwendolyn-other';
grant select on ola to authenticated;
create temp table own_before as select id, title, revision, deleted_at from public.calendar_events;
create temp table vault_other as select count(*) as n from vault.secrets;

-- ---- The switch: Google is separate from calendar subscriptions (iCal testers don't get Google).
insert into public.calendar_feed_testers (user_id, note) values ('00000000-0000-0000-0000-0000000c6101', 'iCal tester');
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails('select public.calendar_google_accounts()', 'not_enabled'), 'an iCal test household doesn''t get Google until switched on');
select pg_temp.expect(jsonb_array_length(public.calendar_feeds()) = 0, 'iCal subscriptions still work for it');
reset role;
select pg_temp.expect(pg_temp.fails($q$select public.calendar_google_state_save(repeat('a', 64), '00000000-0000-0000-0000-0000000c6101', repeat('v', 43), 'web', 'https://organizedmomcollective.com')$q$, 'not_enabled'), 'and can''t start a Google connection');
update public.calendar_feed_testers set google = true where user_id = '00000000-0000-0000-0000-0000000c6101';
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(jsonb_array_length(public.calendar_google_accounts()) = 0, 'Google tester: on');
reset role;
select pg_temp.as_user('authenticated', :DAD);
select pg_temp.expect(jsonb_array_length(public.calendar_google_accounts()) = 0, 'for both adults of the test household');
reset role;
select pg_temp.as_user('authenticated', :OTHER);
select pg_temp.expect(pg_temp.fails('select public.calendar_google_accounts()', 'not_enabled'), 'other households: off');
reset role;

-- ---- The app roles reach none of it directly.
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails('select * from public.calendar_google_accounts') and pg_temp.fails('select * from public.calendar_google_oauth_states'), 'no direct table access');
select pg_temp.expect(pg_temp.fails($q$select public.calendar_google_state_save(repeat('a', 64), auth.uid(), repeat('v', 43), 'web', 'x')$q$)
  and pg_temp.fails($q$select public.calendar_google_account_save(auth.uid(), 's', 'e', 't', 'x')$q$)
  and pg_temp.fails($q$select public.calendar_google_account_token(gen_random_uuid(), auth.uid())$q$)
  and pg_temp.fails($q$select public.calendar_google_forget(gen_random_uuid(), auth.uid())$q$), 'the OAuth and token functions are service-role only');
reset role;

-- ---- One-time states (CSRF protection, binding to the adult who pressed Connect).
select public.calendar_google_state_save(encode(extensions.digest('state-1', 'sha256'), 'hex'), '00000000-0000-0000-0000-0000000c6101', repeat('v', 43), 'web', 'https://organizedmomcollective.com');
select pg_temp.expect((select (public.calendar_google_state_take(encode(extensions.digest('state-1', 'sha256'), 'hex')) ->> 'user_id')::uuid) = :MOM, 'a state belongs to the adult who started it');
select pg_temp.expect(public.calendar_google_state_take(encode(extensions.digest('state-1', 'sha256'), 'hex')) is null, 'and works once (a replayed state is refused)');
select pg_temp.expect(public.calendar_google_state_take(encode(extensions.digest('never-issued', 'sha256'), 'hex')) is null, 'an unknown state is refused');
select public.calendar_google_state_save(encode(extensions.digest('state-old', 'sha256'), 'hex'), '00000000-0000-0000-0000-0000000c6101', repeat('v', 43), 'web', 'https://organizedmomcollective.com');
update public.calendar_google_oauth_states set created_at = now() - interval '11 minutes';
select pg_temp.expect(public.calendar_google_state_take(encode(extensions.digest('state-old', 'sha256'), 'hex')) is null, 'an expired state is refused');
select pg_temp.expect(not exists (select 1 from public.calendar_google_oauth_states), 'and gone');
select pg_temp.expect(not exists (select 1 from public.calendar_google_oauth_states s where s.state_hash = 'state-1'), 'only hashes of states are stored');

-- ---- Connecting: the token goes to Vault; the same Google account again updates it (no duplicate).
create temp table a1 as select public.calendar_google_account_save('00000000-0000-0000-0000-0000000c6101', 'google-sub-personal', 'gina@gmail.example', 'refresh-ONE', 'calendar.events.readonly calendar.calendarlist.readonly') as id;
grant select on a1 to authenticated;
\set A1 '(select id from a1)'
select pg_temp.expect((select ds.decrypted_secret from public.calendar_google_accounts a join vault.decrypted_secrets ds on ds.id = a.refresh_secret_id where a.id = :A1) = 'refresh-ONE', 'the refresh token is in Vault');
select pg_temp.expect(not exists (select 1 from public.calendar_google_accounts a where to_jsonb(a)::text like '%refresh-ONE%'), 'and nowhere in the accounts table');
create temp table again as select public.calendar_google_account_save('00000000-0000-0000-0000-0000000c6101', 'google-sub-personal', 'gina@gmail.example', 'refresh-TWO', 'x') as id;
select pg_temp.expect((select id from again) = :A1
  and (select count(*) from public.calendar_google_accounts where owner_user_id = '00000000-0000-0000-0000-0000000c6101') = 1
  and (select ds.decrypted_secret from public.calendar_google_accounts a join vault.decrypted_secrets ds on ds.id = a.refresh_secret_id where a.id = :A1) = 'refresh-TWO'
  and (select count(*) from vault.secrets where name like 'calendar\_google:%') = 1, 'reconnecting the same Google account replaces its token, no duplicate');
create temp table a2 as select public.calendar_google_account_save('00000000-0000-0000-0000-0000000c6101', 'google-sub-work', 'gina@work.example', 'refresh-WORK', 'x') as id;
grant select on a2 to authenticated;
\set A2 '(select id from a2)'
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(jsonb_array_length(public.calendar_google_accounts()) = 2 and (public.calendar_google_accounts() -> 0 ->> 'calendars')::int = 0
  and not public.calendar_google_accounts()::text ~ 'refresh-', 'two Google accounts, each still to choose calendars; no token in the answer');
reset role;
select pg_temp.as_user('authenticated', :DAD);
select pg_temp.expect(jsonb_array_length(public.calendar_google_accounts()) = 0, 'the other adult doesn''t see her Google accounts');
select pg_temp.expect(pg_temp.fails(format('select public.calendar_google_select(%L, %L)', :A1, '[{"id":"primary","name":"x"}]'), 'not_found'), 'or choose calendars on them');
reset role;
select pg_temp.expect(public.calendar_google_account_token(:A1, :DAD) is null, 'the refresher hands a token only to its owner''s request');

-- ---- Choosing calendars: private by default, whose calendar, shared; the calendar list is the source of truth.
select pg_temp.as_user('authenticated', :MOM);
create temp table sel as select public.calendar_google_select(:A1, jsonb_build_array(
  jsonb_build_object('id', 'gina@gmail.example', 'name', 'Gina', 'timezone', 'America/Chicago'),
  jsonb_build_object('id', 'soccer-team@group.calendar.google.com', 'name', 'Soccer team', 'member_id', :GEMMA, 'visibility', 'household'))) as j;
reset role;
select pg_temp.expect(jsonb_array_length((select j from sel)) = 2, 'two Google calendars imported');
select pg_temp.expect((select visibility from public.calendar_feeds where google_calendar_id = 'gina@gmail.example') = 'private'
  and (select visibility || '|' || (member_id = :GEMMA)::text from public.calendar_feeds where google_calendar_id = 'soccer-team@group.calendar.google.com') = 'household|true', 'private unless she chose Our household; whose calendar kept');
select pg_temp.expect((select count(*) from public.calendar_feeds where kind = 'google' and url_secret_id is null and url_hash is null and owner_user_id = '00000000-0000-0000-0000-0000000c6101') = 2, 'Google calendars have no link at all');
select pg_temp.as_user('authenticated', :DAD);
select pg_temp.expect((select string_agg(f ->> 'name', ',') from jsonb_array_elements(public.calendar_feeds()) f) = 'Soccer team'
  and (public.calendar_feeds() -> 0 -> 'google_account_id') = 'null'::jsonb, 'the other adult sees only the shared one, without her account details');
reset role;
-- Store events (as the refresher would) and then deselect one: its events go, the other stays.
select public.calendar_feed_store((select id from public.calendar_feeds where google_calendar_id = 'gina@gmail.example'), jsonb_build_object('result', 'ok', 'events', jsonb_build_array(
  jsonb_build_object('uid', 'g1@google.com', 'instance_key', '2026-11-20T15:00:00.000Z', 'title', 'Book club', 'all_day', false, 'starts_at', '2026-11-20T15:00:00Z', 'ends_at', '2026-11-20T16:00:00Z'))));
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(jsonb_array_length(public.calendar_google_select(:A1, jsonb_build_array(jsonb_build_object('id', 'soccer-team@group.calendar.google.com')))) = 1, 'deselecting a calendar');
reset role;
select pg_temp.expect((select count(*) from public.calendar_feeds where google_calendar_id = 'gina@gmail.example') = 0 and (select count(*) from public.calendar_feed_events where uid = 'g1@google.com') = 0, 'removes it and its imported events');
select pg_temp.expect((select visibility || '|' || name from public.calendar_feeds where google_calendar_id = 'soccer-team@group.calendar.google.com') = 'household|Soccer team', 'a calendar chosen again without settings keeps its settings');
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails(format('select public.calendar_google_select(%L, %L)', :A1, jsonb_build_array(jsonb_build_object('id', 'x', 'member_id', (select id from ola)))), 'invalid'), 'another family''s member is refused');
select pg_temp.expect(pg_temp.fails(format('select public.calendar_google_select(%L, %L)', :A1, '[{"id":"x","visibility":"everyone"}]'), 'invalid'), 'only private or household');
select public.calendar_google_select(:A2, '[{"id":"gina@work.example","name":"Work"}]');
reset role;

-- ---- The refresher: Google calendars come with their account's token; iCal links keep working beside them.
select pg_temp.as_user('authenticated', :MOM);
select public.calendar_feed_add('{"url":"https://school.example.org/cal.ics","name":"School","visibility":"household"}');
reset role;
create temp table claimed as select c from jsonb_array_elements(public.calendar_feed_claim(50)) c
  where (c ->> 'id')::uuid in (select id from public.calendar_feeds where owner_user_id = '00000000-0000-0000-0000-0000000c6101');
select pg_temp.expect((select count(*) from claimed where c ->> 'kind' = 'google') = 2 and (select count(*) from claimed where c ->> 'kind' = 'ical') = 1, 'the refresher claims Google calendars and the iCal link together');
select pg_temp.expect((select c ->> 'refresh_token' from claimed where c ->> 'google_calendar_id' = 'gina@work.example') = 'refresh-WORK'
  and (select c ->> 'url' from claimed where c ->> 'kind' = 'ical') = 'https://school.example.org/cal.ics'
  and not exists (select 1 from claimed where c ->> 'kind' = 'google' and c ? 'url'), 'each with only what it needs (token for Google, link for iCal)');
-- Revoked at Google: the account asks to reconnect and its calendars aren't claimed; iCal unaffected.
select public.calendar_google_account_status(:A2, 'reconnect', 'Google stopped accepting the connection. Reconnect it.');
update public.calendar_feeds set last_attempt_at = null;
select pg_temp.expect(not exists (select 1 from jsonb_array_elements(public.calendar_feed_claim(50)) c where c ->> 'google_calendar_id' = 'gina@work.example'), 'an account needing reconnection isn''t refreshed');
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect((select a ->> 'status' from jsonb_array_elements(public.calendar_google_accounts()) a where a ->> 'email' = 'gina@work.example') = 'reconnect', 'and the app shows Reconnect');
reset role;
select public.calendar_google_account_save('00000000-0000-0000-0000-0000000c6101', 'google-sub-work', 'gina@work.example', 'refresh-WORK-2', 'x');
select pg_temp.expect((select status from public.calendar_google_accounts where id = :A2) = 'ok' and (select last_attempt_at is null from public.calendar_feeds where google_calendar_id = 'gina@work.example'), 'reconnecting fixes it and fetches again at once');
-- Switched off: nothing Google is claimed, and the app hides Google.
update public.calendar_feed_testers set google = false;
update public.calendar_feeds set last_attempt_at = null;
select pg_temp.expect(not exists (select 1 from jsonb_array_elements(public.calendar_feed_claim(50)) c where c ->> 'kind' = 'google'), 'Google switched off: never refreshed');
update public.calendar_feed_testers set google = true;

-- ---- Other households see nothing, even switched on.
insert into public.calendar_feed_testers (user_id, google) values ('00000000-0000-0000-0000-0000000c6103', true);
select pg_temp.as_user('authenticated', :OTHER);
select pg_temp.expect(jsonb_array_length(public.calendar_google_accounts()) = 0 and jsonb_array_length(public.calendar_feeds()) = 0, 'another family sees none of the Googles'' accounts or calendars');
select pg_temp.expect(pg_temp.fails(format('select public.calendar_google_select(%L, %L)', :A1, '[{"id":"x"}]'), 'not_found'), 'and can''t touch them');
reset role;

-- ---- Disconnect: account, token, calendars and events go; iCal and family events stay.
select pg_temp.expect(public.calendar_google_forget(:A1, :DAD) is false, 'only its owner can disconnect an account');
select pg_temp.expect(public.calendar_google_forget(:A1, :MOM), 'disconnect');
select pg_temp.expect(not exists (select 1 from public.calendar_google_accounts where id = :A1)
  and not exists (select 1 from public.calendar_feeds where google_calendar_id = 'soccer-team@group.calendar.google.com')
  and (select count(*) from vault.secrets where name = 'calendar_google:' || (select id from a1)) = 0, 'removes the account, its calendars and its encrypted token');
select pg_temp.expect((select count(*) from public.calendar_feeds where kind = 'ical' and owner_user_id = '00000000-0000-0000-0000-0000000c6101') = 1, 'iCal links untouched');
select pg_temp.expect((select count(*) from public.calendar_events) = (select count(*) from own_before)
  and not exists (select id, title, revision, deleted_at from public.calendar_events except select * from own_before), 'the family''s own events untouched');
-- Deleting the adult's account removes the rest, tokens included.
delete from auth.users where id = '00000000-0000-0000-0000-0000000c6101';
select pg_temp.expect(not exists (select 1 from vault.secrets where name like 'calendar\_google:%') and not exists (select 1 from public.calendar_google_accounts), 'deleting an account deletes its Google connections and tokens');
