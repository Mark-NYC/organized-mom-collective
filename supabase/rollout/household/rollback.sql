-- Rolls back 20261203, 20261201, 20261130, 20261129, 20261128, 20261127, 20261126, 20261125 and 20261124, newest first, in one
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
