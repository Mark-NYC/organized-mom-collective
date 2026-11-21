-- Rolls back 20261209, 20261208, 20261207, 20261206, 20261205, 20261204, 20261203, 20261201, 20261130, 20261129, 20261128, 20261127, 20261126, 20261125 and 20261124, newest first, in one
-- transaction (docs/ios/MIGRATION_DEPLOYMENT_PLAN.md → Rollback). Rehearsed by scripts/rehearse-household-rollback.sh.
--
-- NEVER run without the owner's go. It REMOVES what families made with these features: partner access and
-- invitations, the family calendar, Family Meeting agreements, shared cleaning progress and the 90-day archive
-- copies. It keeps every household, family member, Club record and billing row. Saved member colors
-- (preferences.colors) stay: they are valid for the old code too.
--
-- Use the whole file to go back to the state before 20261124, or only the top sections to undo the newest steps
-- (each section says what it needs). After the "24" section, run restore-functions.sql (captured with capture.sql
-- BEFORE applying) in the same session, then fingerprint.sql must equal the fingerprint taken before applying.
begin;

-- ---- 20261209 Rivera demo (alone: supabase/rollout/demo-rivera/rollback.sql). Drops the demo functions and registry;
-- a demo household that was installed stays an ordinary household (the household sections below remove what they own).
drop function if exists public.demo_rivera_reset(text, text);
drop function if exists public.demo_rivera_status();
drop function if exists public.demo_rivera_seed(uuid, uuid);
drop function if exists public.demo_decide(uuid, jsonb, numeric);
drop function if exists public.demo_age_decision(uuid, numeric);
drop function if exists public.demo_account_ok(uuid, uuid);
drop function if exists public.demo_act_as(uuid);
drop function if exists public.demo_id(text);
drop table if exists public.demo_households;

-- ---- 20261208 Complimentary Club access (alone: supabase/rollout/club-complimentary/rollback.sql). Grants stay;
-- complimentary ones become beta (same access). First: its functions use household_id_for (20261124).
-- club_me: the partner view back to 'grant', null (only if 20261208 patched it).
do $$
declare d text; p text;
begin
  if to_regprocedure('public.club_admin_access_grant(uuid,timestamptz,text)') is not null then
    d := pg_get_functiondef('public.club_me()'::regprocedure);
    p := replace(d, '''grant'', r -> ''grant'',', '''grant'', null,');
    if p <> d then execute p; end if;
  end if;
end $$;
drop function if exists public.club_admin_access_search(text);
drop function if exists public.club_admin_access_detail(uuid);
drop function if exists public.club_admin_access_grant(uuid, timestamptz, text);
drop function if exists public.club_admin_access_revoke(uuid, text);
drop function if exists public.club_admin_access_expiry(uuid, timestamptz);
drop function if exists public.club_access_summary(uuid);
drop function if exists public.club_grant_live(public.club_access_grants);
drop function if exists public.club_access_grant_target(uuid);
drop function if exists public.club_access_household(uuid);
-- Complimentary grants become beta grants (the earlier name for the same thing): nobody loses access by the rollback.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'club_access_grants' and column_name = 'granted_by') then
    update public.club_access_grants set reason = 'beta' where reason = 'complimentary';
    alter table public.club_access_grants drop constraint if exists club_access_grants_reason_check;
    alter table public.club_access_grants add constraint club_access_grants_reason_check check (reason in ('preview', 'beta'));
    alter table public.club_access_grants drop column if exists granted_by, drop column if exists revoked_by, drop column if exists updated_at;
  end if;
end $$;

-- ---- 20261207 Family development records (alone: supabase/rollout/family-development/rollback.sql). Removes the
-- families' MAWL records and their history; agreements made through them are ordinary agreements and go with the
-- 20261127 section below. First, because its RLS policies use household_id_for (20261124).
drop function if exists public.household_development_decide(jsonb, int);
drop function if exists public.household_development();
drop function if exists public.household_development_json(public.household_development);
drop function if exists public.household_development_ensure_agreement(public.household_development, uuid, uuid);
drop table if exists public.household_development_events;
drop table if exists public.household_development;

-- ---- 20261206 Connect Google Calendar (independent of the steps below; alone: supabase/rollout/calendar-google/rollback.sql).
-- The encrypted Google tokens first (Vault), then the Google calendars (their imported events go with them).
do $$ begin if to_regclass('vault.secrets') is not null then delete from vault.secrets where name like 'calendar\_google:%'; end if; end $$;
do $$ begin if to_regclass('public.calendar_google_accounts') is not null then delete from public.calendar_feeds where kind = 'google'; end if; end $$;
drop trigger if exists calendar_google_forget_token on public.calendar_google_accounts;
drop function if exists public.calendar_google_forget_token();
drop function if exists public.calendar_google_forget(uuid, uuid);
drop function if exists public.calendar_google_account_status(uuid, text, text);
drop function if exists public.calendar_google_account_token(uuid, uuid);
drop function if exists public.calendar_google_account_save(uuid, text, text, text, text);
drop function if exists public.calendar_google_state_take(text);
drop function if exists public.calendar_google_state_save(text, uuid, text, text, text);
drop function if exists public.calendar_google_select(uuid, jsonb);
drop function if exists public.calendar_google_accounts();
drop index if exists public.calendar_feeds_google_calendar;
alter table if exists public.calendar_feeds drop constraint if exists calendar_feeds_google_ref, drop column if exists google_calendar_id, drop column if exists google_account_id;
drop table if exists public.calendar_google_oauth_states;
drop table if exists public.calendar_google_accounts;
drop function if exists public.calendar_google_enabled(uuid);
alter table if exists public.calendar_feed_testers drop column if exists google;
alter table if exists public.calendar_feed_rollout drop column if exists google_everyone;

-- ---- 20261205 calendar subscriptions (independent; safe to run alone: supabase/rollout/calendar/rollback.sql).
-- Removes subscriptions and imported events; the family calendar and every other table are untouched.
do $$ begin if exists (select 1 from pg_extension where extname = 'pg_cron') then perform cron.unschedule('omc-calendar-feeds-refresh'); end if; exception when others then null; end $$;
-- The encrypted links first (Vault), then everything the migration created.
do $$ begin if to_regclass('vault.secrets') is not null then delete from vault.secrets where name like 'calendar\_feed:%'; end if; end $$;
drop trigger if exists calendar_feed_forget_link on public.calendar_feeds;
drop function if exists public.calendar_feed_forget_link();
drop function if exists public.calendar_feed_retry(uuid);
drop function if exists public.calendar_feed_store(uuid, jsonb);
drop function if exists public.calendar_feed_claim(int, uuid, uuid);
drop function if exists public.calendar_feed_events(timestamptz, timestamptz, text);
drop function if exists public.calendar_feeds();
drop function if exists public.calendar_feed_remove(uuid);
drop function if exists public.calendar_feed_update(uuid, jsonb);
drop function if exists public.calendar_feed_add(jsonb);
drop function if exists public.calendar_feeds_visible(uuid);
drop function if exists public.calendar_feed_json(public.calendar_feeds, uuid);
drop function if exists public.calendar_feeds_enabled(uuid);
drop table if exists public.calendar_feed_events;
drop table if exists public.calendar_feeds;
drop table if exists public.calendar_feed_testers;
drop table if exists public.calendar_feed_rollout;

-- ---- 20261204 follow-through on agreements (independent; safe to run alone). Removes the check-in answers families
-- gave (progress, checked_on, barrier); the agreements themselves stay exactly as they are.
drop function if exists public.household_agreement_check_in(uuid, text, text, int);
drop function if exists public.household_follow_through();
drop function if exists public.household_follow_through_json(public.club_responsibilities);
alter table public.club_responsibilities
  drop constraint if exists club_responsibilities_barrier_only_struggling,
  drop constraint if exists club_responsibilities_follow_through_only_confirmed,
  drop column if exists barrier,
  drop column if exists checked_on,
  drop column if exists progress;

-- ---- 20261203 billing for either adult. To undo ONLY this step use rollback-billing.sql (with capture-billing.sql).
-- In a full rollback the patched functions come back from restore-functions.sql. Months already kept for a household
-- stay (ordinary admin-granted months); a payer-partner's months stay theirs.
drop trigger if exists household_keep_months on auth.users;
drop function if exists public.household_keep_months_on_delete();
drop function if exists public.household_keep_received_months(uuid, uuid);
drop function if exists public.club_admin_orphan_verify(uuid, text);
drop function if exists public.club_orphans_flag();
drop function if exists public.club_orphaned_subscriptions();
drop function if exists public.club_orphans();
do $$ begin if exists (select 1 from pg_extension where extname = 'pg_cron') then perform cron.unschedule('omc-club-orphans-flag'); end if; exception when others then null; end $$;
update public.club_subscriptions set flags = array_remove(array_remove(flags, 'orphaned'), 'orphan_cancel_verified')
 where flags && array['orphaned', 'orphan_cancel_verified'];
drop function if exists public.club_household_of(uuid);

-- ---- 20261201 shared cleaning progress (independent; safe to run alone)
drop function if exists public.cleaning_marks_changes(timestamptz);
drop function if exists public.cleaning_marks_push(jsonb);
drop table if exists public.household_cleaning_marks;

-- ---- 20261130 join from own household (independent; safe to run alone)
drop function if exists public.household_invite_accept_leaving(text, uuid, boolean);
drop function if exists public.household_invite_preview(text);
drop function if exists public.household_invite_for_me(text);
drop function if exists public.household_own_blocker(uuid, uuid);
drop function if exists public.household_snapshot(uuid);
drop function if exists public.household_archive_restore(uuid);
drop function if exists public.household_archives_purge();
do $$ begin if exists (select 1 from pg_extension where extname = 'pg_cron') then perform cron.unschedule('omc-household-archives-purge'); end if; exception when others then null; end $$;
drop table if exists public.household_archives;

-- ---- 20261129 deletion billing guard (then restore public.account_delete from restore-functions.sql)
drop trigger if exists account_chargeable_guard on auth.users;
drop function if exists public.account_chargeable_guard();
drop function if exists public.account_chargeable(uuid);

-- ---- 20261128 household Club access (then restore club_me, club_address_save and the six content functions)
drop function if exists public.club_me_for(uuid);
drop function if exists public.household_billing_user(uuid);

-- ---- 20261127 agreements (then restore club_family_profile). Removes every "We agreed" agreement.
drop function if exists public.household_agreements(timestamptz);
drop function if exists public.household_agreement_remove(uuid, int);
drop function if exists public.household_agreement_save(jsonb, int);
drop function if exists public.household_agreement_json(public.club_responsibilities);
delete from public.club_responsibilities where agreed_text is not null or deleted_at is not null;
alter table public.club_responsibilities
  drop column if exists agreed_text, drop column if exists agreed_finished, drop column if exists agreed_when,
  drop column if exists agreed_month, drop column if exists agreed_source, drop column if exists updated_by,
  drop column if exists revision, drop column if exists deleted_at;

-- ---- 20261126 permanent colors (saved colors stay; only the function goes)
drop function if exists public.household_colors_complete(uuid);

-- ---- 20261125 family calendar. Removes every calendar event.
drop function if exists public.calendar_import_activities(date, text);
drop function if exists public.calendar_changes(timestamptz);
drop function if exists public.calendar_event_delete(uuid, int);
drop function if exists public.calendar_event_save(jsonb, int);
drop function if exists public.calendar_event_json(public.calendar_events);
drop table if exists public.calendar_events;
drop function if exists public.calendar_recurrence_ok(jsonb);

-- ---- 20261124 shared household. Partners lose access; every household keeps its owner (club_households.owner_user_id).
drop trigger if exists household_owner_leaving on auth.users;
drop function if exists public.household_owner_leaving();
drop function if exists public.household_owner_handover(uuid, uuid);
drop function if exists public.household_leave();
drop function if exists public.household_partner_remove();
drop function if exists public.household_invite_accept(text);
drop function if exists public.household_invite_revoke(uuid);
drop function if exists public.household_invites();
drop function if exists public.household_invite_create(uuid, text);
drop function if exists public.household_invite_hash(text);
drop function if exists public.household_save(int, text, jsonb, jsonb);
drop policy if exists "Adults read their household" on public.club_households;
drop policy if exists "Adults read their family" on public.club_family_members;
drop policy if exists "Adults read their activities" on public.club_activities;
drop policy if exists "Adults read their responsibilities" on public.club_responsibilities;
create policy "Members read their household" on public.club_households
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy "Members read their family" on public.club_family_members
  for select to authenticated using (household_id in (select id from public.club_households where owner_user_id = (select auth.uid())));
create policy "Members read their activities" on public.club_activities
  for select to authenticated using (household_id in (select id from public.club_households where owner_user_id = (select auth.uid())));
create policy "Members read their responsibilities" on public.club_responsibilities
  for select to authenticated using (household_id in (select id from public.club_households where owner_user_id = (select auth.uid())));
drop trigger if exists club_households_owner_row on public.club_households;
drop function if exists public.household_owner_row();
drop table if exists public.household_invites;
drop table if exists public.household_adults;
-- Still referenced by the function bodies restore-functions.sql is about to replace; dropped by finish.sql after it.

commit;
