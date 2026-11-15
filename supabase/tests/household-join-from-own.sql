-- A grown-up who already set up their own family can still join the one they were invited to
-- (supabase/migrations/20261130000000_household_join_from_own.sql). Throwaway local database only.
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
  ('00000000-0000-0000-0000-0000000e0001', 'join-ana@example.com', now()),
  ('00000000-0000-0000-0000-0000000e0002', 'join-ben@example.com', now()),
  ('00000000-0000-0000-0000-0000000e0003', 'join-cleo@example.com', now()),
  ('00000000-0000-0000-0000-0000000e0004', 'join-dev@example.com', now()),
  ('00000000-0000-0000-0000-0000000e0005', 'join-eve@example.com', now()),
  ('00000000-0000-0000-0000-0000000e0006', 'join-finn@example.com', now()),
  ('00000000-0000-0000-0000-0000000e0007', 'join-stranger@example.com', now());
\set ANA '''00000000-0000-0000-0000-0000000e0001'''
\set BEN '''00000000-0000-0000-0000-0000000e0002'''
\set CLEO '''00000000-0000-0000-0000-0000000e0003'''
\set DEV '''00000000-0000-0000-0000-0000000e0004'''
\set EVE '''00000000-0000-0000-0000-0000000e0005'''
\set FINN '''00000000-0000-0000-0000-0000000e0006'''
\set STRANGER '''00000000-0000-0000-0000-0000000e0007'''
\set HID_OF '(select household_id from public.household_adults where user_id ='

-- Ana sets up the family and invites Ben.
select pg_temp.as_user('authenticated', :ANA);
select public.club_household_save('The Ortegas', '{}',
  '[{"first_name":"Ana","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Ben","kind":"adult","role":"partner"},
    {"first_name":"Lia","kind":"child","role":"child","birth_year":2019,"birth_month":3}]');
create temp table inv_ben as select public.household_invite_create((select id from public.club_family_members where first_name = 'Ben' and household_id = public.household_id_for(auth.uid())), 'join-ben@example.com') as i;
reset role;
grant select on inv_ben to authenticated;
create temp table ana_hid as select household_id as id from public.household_adults where user_id = :ANA;
grant select on ana_hid to authenticated;

-- ---------------------------------------------------------------- the dead end
-- Ben installs the app first, signs in, and the app sends him to "Set up your family": now he owns a second household.
select pg_temp.as_user('authenticated', :BEN);
select public.club_household_save('Ben''s family', '{}', '[{"first_name":"Ben","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Lia","kind":"child","role":"child","birth_year":2019,"birth_month":3}]');
select public.calendar_event_save(jsonb_build_object('id', 'ee000000-0000-0000-0000-000000000001', 'title', 'Soccer', 'starts_on', '2026-11-20', 'timezone', 'UTC'), null);
create temp table ben_old as select public.household_id_for(auth.uid()) as id;
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_accept(%L)', (select i ->> 'code' from inv_ben)), 'already_in_household'), 'before: the invitation is refused because he set up his own family');
select pg_temp.expect(pg_temp.fails('select public.household_leave()', 'owner_cannot_leave'), 'before: and he can''t leave the family he set up');

-- ---------------------------------------------------------------- preview
create temp table pv as select public.household_invite_preview((select i ->> 'code' from inv_ben)) as p;
select pg_temp.expect((select p ->> 'status' from pv) = 'leave_own', 'preview: joining means leaving his own family');
select pg_temp.expect((select p ->> 'invited_as' from pv) = 'Ben' and (select p ->> 'family' from pv) = 'The Ortegas', 'preview: who he''d be and whose family');
select pg_temp.expect((select p -> 'mine' -> 'people' from pv) = '["Ben", "Lia"]' and (select (p -> 'mine' ->> 'events')::int from pv) = 1 and (select p -> 'mine' ->> 'role' from pv) = 'owner', 'preview: what he''d leave (people, plans)');
select pg_temp.expect((select count(*) from public.club_households where id = (select id from ben_old)) = 1, 'preview changes nothing');
reset role;

-- Only the invited, verified email with the right code learns anything.
select pg_temp.as_user('authenticated', :STRANGER);
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_preview(%L)', (select i ->> 'code' from inv_ben)), 'invite_wrong_email'), 'preview: another account with the code learns nothing');
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_accept_leaving(%L, null)', (select i ->> 'code' from inv_ben)), 'invite_wrong_email'), 'accept: another account with the code is refused');
select pg_temp.expect(pg_temp.fails('select public.household_invite_preview(''00000000000000000000000000000000'')', 'invite_invalid'), 'preview: a wrong code is refused');
reset role;
select pg_temp.as_user('anon', null);
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_preview(%L)', 'x')), 'anon can''t preview');
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_accept_leaving(%L, null)', 'x')), 'anon can''t accept');
reset role;
select pg_temp.as_user('authenticated', :BEN);
select pg_temp.expect(pg_temp.fails('select public.household_own_blocker(auth.uid(), null)') and pg_temp.fails('select public.household_invite_for_me(''x'')'), 'the internal helpers aren''t callable');

-- ---------------------------------------------------------------- an owner on his own joins
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_accept_leaving(%L, null)', (select i ->> 'code' from inv_ben)), 'leaving_mismatch')
  and pg_temp.fails(format('select public.household_invite_accept_leaving(%L, %L)', (select i ->> 'code' from inv_ben), (select id from ana_hid)), 'leaving_mismatch'), 'it must name the family the screen showed: a blind or stale call replaces nothing');
select pg_temp.expect((select count(*) from public.club_households where id = (select id from ben_old)) = 1 and (select count(*) from public.household_archives) = 0, 'and nothing was touched');
create temp table joined as select public.household_invite_accept_leaving((select i ->> 'code' from inv_ben), (select (p -> 'mine' ->> 'id')::uuid from pv)) as j;
select pg_temp.expect((select j ->> 'my_role' from joined) = 'partner' and (select (j ->> 'brought_events')::int from joined) = 1, 'he joins as the other grown-up, bringing his one plan');
select pg_temp.expect((select count(*) from public.household_archives) = 1
  and (select snapshot -> 'members' @> '[{"first_name":"Ben"},{"first_name":"Lia"}]' and jsonb_array_length(snapshot -> 'calendar_events') = 1 and family = 'Ben''s family' from public.household_archives), 'he can read the copy of what he set up (people and plans)');
select pg_temp.expect(public.household_id_for(auth.uid()) = (select id from ana_hid), 'he''s in the family he was invited to');
select pg_temp.expect((public.club_household() ->> 'display_name') = 'The Ortegas' and jsonb_array_length(public.club_household() -> 'members') = 3, 'he sees that family: one Ben, one Lia');
reset role;
select pg_temp.expect((select count(*) from public.club_households where id = (select id from ben_old)) = 0, 'the family he set up by mistake is gone');
select pg_temp.expect((select count(*) from public.club_family_members where household_id = (select id from ben_old)) = 0, 'with its duplicate people');
select pg_temp.expect((select household_id = (select id from ana_hid) and member_ids = '{}' and owner_member_id is null and revision = 2 and deleted_at is null from public.calendar_events where id = 'ee000000-0000-0000-0000-000000000001'), 'his plan is now on the shared calendar, as a change her phone will pick up, without people from the old family');
select pg_temp.expect((select count(*) from public.household_archives where user_id = :BEN and purge_after > now() + interval '89 days') = 1, 'the safety copy is his and kept 90 days');
select pg_temp.as_user('authenticated', :ANA);
select pg_temp.expect((select count(*) from public.household_archives) = 0, 'she can''t read his copy');
select pg_temp.expect(pg_temp.fails('insert into public.household_archives (user_id, reason, snapshot) values (auth.uid(), ''joined_another'', ''{}'')') and pg_temp.fails('select public.household_snapshot(public.household_id_for(auth.uid()))'), 'nobody writes copies or takes snapshots directly');
reset role;
select pg_temp.expect((select count(*) from public.household_adults where household_id = (select id from ana_hid)) = 2 and (select role from public.household_adults where user_id = :ANA) = 'owner', 'the family has its two grown-ups; she still owns it');
select pg_temp.expect((select member_id from public.household_adults where user_id = :BEN) = (select id from public.club_family_members where first_name = 'Ben' and household_id = (select id from ana_hid)), 'he is the Ben already in that family');
select pg_temp.expect((select accepted_by from public.household_invites where household_id = (select id from ana_hid) and accepted_at is not null) = :BEN, 'the invitation is used');
select pg_temp.as_user('authenticated', :BEN);
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_accept_leaving(%L, null)', (select i ->> 'code' from inv_ben)), 'invite_invalid'), 'the code doesn''t work twice');
reset role;

-- ---------------------------------------------------------------- nothing is left when the acceptance fails
-- Cleo owns a family and is invited by Dev; Dev's family fills up first (Eve joins). Cleo's family must survive.
select pg_temp.as_user('authenticated', :CLEO);
select public.club_household_save('Cleo''s', '{}', '[{"first_name":"Cleo","kind":"adult","role":"parent","is_account_holder":true}]');
reset role;
select pg_temp.as_user('authenticated', :DEV);
select public.club_household_save('The Devs', '{}', '[{"first_name":"Dev","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Cleo","kind":"adult","role":"partner"},{"first_name":"Eve","kind":"adult","role":"other"}]');
create temp table inv_cleo as select public.household_invite_create((select id from public.club_family_members where first_name = 'Cleo' and household_id = public.household_id_for(auth.uid())), 'join-cleo@example.com') as i;
create temp table inv_eve as select public.household_invite_create((select id from public.club_family_members where first_name = 'Eve' and household_id = public.household_id_for(auth.uid())), 'join-eve@example.com') as i;
reset role;
grant select on inv_cleo, inv_eve to authenticated;
select pg_temp.as_user('authenticated', :EVE);
select public.household_invite_accept((select i ->> 'code' from inv_eve));
reset role;
select pg_temp.as_user('authenticated', :CLEO);
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_accept_leaving(%L, public.household_id_for(auth.uid()))', (select i ->> 'code' from inv_cleo)), 'household_full'), 'a full family refuses her');
select pg_temp.expect((public.club_household() ->> 'display_name') = 'Cleo''s' and (public.club_household() ->> 'my_role') = 'owner', 'and her own family is untouched');
reset role;

-- ---------------------------------------------------------------- a partner elsewhere switches; that family is untouched
-- Eve (partner in the Devs) is invited by Finn.
select pg_temp.as_user('authenticated', :FINN);
select public.club_household_save('The Finns', '{}', '[{"first_name":"Finn","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Eve","kind":"adult","role":"partner"}]');
create temp table inv_eve2 as select public.household_invite_create((select id from public.club_family_members where first_name = 'Eve' and household_id = public.household_id_for(auth.uid())), 'join-eve@example.com') as i;
reset role;
grant select on inv_eve2 to authenticated;
select pg_temp.as_user('authenticated', :EVE);
select pg_temp.expect((public.household_invite_preview((select i ->> 'code' from inv_eve2)) ->> 'status') = 'leave_own' and (public.household_invite_preview((select i ->> 'code' from inv_eve2)) -> 'mine' ->> 'role') = 'partner', 'preview: a partner elsewhere would leave that family');
select pg_temp.expect((public.household_invite_accept_leaving((select i ->> 'code' from inv_eve2), public.household_id_for(auth.uid())) ->> 'display_name') = 'The Finns', 'she joins the new family');
reset role;
select pg_temp.expect((select count(*) from public.club_households h join public.household_adults a on a.household_id = h.id where a.user_id = :DEV) = 1
  and (select count(*) from public.club_family_members f where f.household_id = (select household_id from public.household_adults where user_id = :DEV) and f.archived_at is null) = 3, 'the family she left keeps everything, her family row included');

-- ---------------------------------------------------------------- blocked: someone shares it, or it has Club records
-- Dev (owner, no partner now) invites Cleo again; Cleo meanwhile shares her own family with Eve? Use the simpler shape:
-- Finn's family now has a partner (Eve). Finn is invited to Cleo's family: refused, Eve would lose hers.
select pg_temp.as_user('authenticated', :CLEO);
select public.club_household_save('Cleo''s', '{}', '[{"first_name":"Cleo","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Finn","kind":"adult","role":"partner"},{"first_name":"Dev","kind":"adult","role":"other"}]');
create temp table inv_finn as select public.household_invite_create((select id from public.club_family_members where first_name = 'Finn' and household_id = public.household_id_for(auth.uid())), 'join-finn@example.com') as i;
reset role;
grant select on inv_finn to authenticated;
select pg_temp.as_user('authenticated', :FINN);
select pg_temp.expect((public.household_invite_preview((select i ->> 'code' from inv_finn)) ->> 'status') = 'blocked' and (public.household_invite_preview((select i ->> 'code' from inv_finn)) ->> 'reason') = 'own_household_shared', 'preview: blocked while another grown-up shares his family');
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_accept_leaving(%L, public.household_id_for(auth.uid()))', (select i ->> 'code' from inv_finn)), 'own_household_shared'), 'an owner whose family is shared can''t drop it');
select pg_temp.expect((public.club_household() ->> 'display_name') = 'The Finns', 'his family is untouched');
reset role;

-- Dev owns the Devs alone again (Eve left) and has a Club membership record. Invited to Cleo's: refused, nothing deleted.
insert into public.club_subscriptions (user_id, household_id, stripe_subscription_id, stripe_customer_id, status, price_id, started_at, livemode)
select :DEV, (select household_id from public.household_adults where user_id = :DEV), 'sub_joindev', 'cus_join_dev', 'canceled', 'price_x', now(), false;
select pg_temp.as_user('authenticated', :CLEO);
select public.household_invite_revoke((select (i ->> 'id')::uuid from inv_finn));
create temp table inv_dev as select public.household_invite_create((select id from public.club_family_members where first_name = 'Dev' and household_id = public.household_id_for(auth.uid())), 'join-dev@example.com') as i;
reset role;
grant select on inv_dev to authenticated;
select pg_temp.as_user('authenticated', :DEV);
select pg_temp.expect((public.household_invite_preview((select i ->> 'code' from inv_dev)) ->> 'reason') = 'own_household_membership', 'preview: blocked while his family has Club membership records');
select pg_temp.expect(pg_temp.fails(format('select public.household_invite_accept_leaving(%L, public.household_id_for(auth.uid()))', (select i ->> 'code' from inv_dev)), 'own_household_membership'), 'a family with membership records is never deleted this way');
select pg_temp.expect((public.club_household() ->> 'display_name') = 'The Devs', 'his family is untouched');
reset role;
select pg_temp.expect((select count(*) from public.club_subscriptions where stripe_subscription_id = 'sub_joindev' and household_id is not null) = 1, 'and so is the membership record');

-- ---------------------------------------------------------------- no household: same as the plain accept
delete from public.club_subscriptions where stripe_subscription_id = 'sub_joindev';
select pg_temp.as_user('authenticated', :DEV);
select public.calendar_event_save(jsonb_build_object('id', 'ee000000-0000-0000-0000-000000000002', 'title', 'Dev trip', 'starts_on', '2026-12-01', 'timezone', 'UTC'), null);
select pg_temp.expect((public.household_invite_accept_leaving((select i ->> 'code' from inv_dev), public.household_id_for(auth.uid()), false) ->> 'display_name') = 'Cleo''s', 'without Club records he can join (his solo family is replaced)');
reset role;
select pg_temp.expect((select count(*) from public.calendar_events where id = 'ee000000-0000-0000-0000-000000000002') = 0
  and (select jsonb_array_length(snapshot -> 'calendar_events') from public.household_archives where user_id = :DEV) = 1, 'choosing not to bring plans: they aren''t moved, and are still in his copy');
select pg_temp.expect((select count(*) from public.household_archives) = 2, 'a partner switching families and refused attempts made no copies');
reset role;
