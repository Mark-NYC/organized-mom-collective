-- Follow-through on family agreements: "How did it go?" in the weekly Family Meeting, weeks 2–4
-- (docs/product/UNIFIED_FAMILY_ARCHITECTURE.md §7; owner decision 2026-11-18).
--
-- NOT APPLIED. Needs the owner's separate approval like every migration. Independent of 20261202 and 20261203.
-- Test: supabase/tests/agreement-follow-through.sql (scripts/test-household-sql.sh).
--
-- The rules already exist in the app (src/lib/club/family-plan.ts: CheckInAnswer, CheckInBarrier, nextStep); only
-- storage was missing. An agreement (a 'confirmed' row of club_responsibilities, 20261127) gains three nullable
-- columns. Nothing existing changes: no row is updated by this migration, no existing function is replaced, and
-- 'existing' and 'desired' rows can never carry them.
--   progress         where the family says it stands: practicing (just agreed) · improving (needs reminders) ·
--                    independent (on my own) · struggling. "We're done with this" is the existing remove.
--   checked_on       the day the family last answered, so the meeting asks once a week, not every time it opens.
--   barrier          after 'struggling' only, optional: what gets in the way (family-plan.ts → BARRIER_PRINCIPLE).
begin;

alter table public.club_responsibilities
  add column progress text check (progress in ('practicing', 'improving', 'independent', 'struggling')),
  add column checked_on date,
  add column barrier text check (barrier in ('forgets', 'too-hard', 'not-set-up', 'not-interested', 'schedule', 'other')),
  add constraint club_responsibilities_follow_through_only_confirmed
    check (status = 'confirmed' or (progress is null and checked_on is null and barrier is null)),
  add constraint club_responsibilities_barrier_only_struggling
    check (barrier is null or progress = 'struggling');

-- Every existing function (household_agreement_json, _save, _remove, household_agreements) stays exactly as it is in
-- production: phones on any build keep syncing agreements unchanged. Follow-through has its own read and write.
create function public.household_follow_through_json(r public.club_responsibilities) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', r.id, 'revision', r.revision, 'progress', r.progress, 'checked_on', r.checked_on, 'barrier', r.barrier);
$$;
revoke execute on function public.household_follow_through_json(public.club_responsibilities) from public, anon, authenticated;

-- Where each current agreement of the household stands, for either adult.
create function public.household_follow_through() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  hid uuid := public.household_id_for(auth.uid());
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if hid is null then raise exception 'no_household'; end if;
  return coalesce((select jsonb_agg(public.household_follow_through_json(r) order by r.confirmed_at)
                     from public.club_responsibilities r
                    where r.household_id = hid and r.status = 'confirmed' and r.deleted_at is null), '[]');
end $$;
revoke execute on function public.household_follow_through() from public, anon;
grant execute on function public.household_follow_through() to authenticated;

-- Check in on one agreement, from either adult of the household. p_answer is the family's answer in the meeting:
--   'on-own' → independent · 'reminders' → improving · 'struggling' → struggling (p_barrier optional).
-- p_base: the revision the phone showed; another adult's change since then is 'conflict' (theirs stays), and a removed
-- agreement is 'removed', exactly like household_agreement_save. The revision moves, so the other phone's sync
-- (household_agreements) picks the change up and an edit started before it is a conflict. Returns its follow-through.
create function public.household_agreement_check_in(p_id uuid, p_answer text, p_barrier text, p_base int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  cur public.club_responsibilities%rowtype;
  prog text;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  hid := public.household_id_for(uid);
  if hid is null then raise exception 'no_household'; end if;
  prog := case p_answer when 'on-own' then 'independent' when 'reminders' then 'improving' when 'struggling' then 'struggling' end;
  if prog is null then raise exception 'invalid'; end if;
  if p_barrier is not null and prog <> 'struggling' then raise exception 'invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('club-household-id:' || hid::text, 0));
  select * into cur from public.club_responsibilities where id = p_id and household_id = hid and status = 'confirmed';
  if not found then raise exception 'invalid'; end if;
  if cur.deleted_at is not null then raise exception 'removed'; end if;
  if p_base is distinct from cur.revision then raise exception 'conflict'; end if;
  update public.club_responsibilities
     set progress = prog, barrier = p_barrier, checked_on = current_date,
         revision = revision + 1, updated_by = uid, updated_at = now()
   where id = p_id returning * into cur;
  return public.household_follow_through_json(cur);
exception
  when check_violation or invalid_text_representation then raise exception 'invalid';
end $$;
revoke execute on function public.household_agreement_check_in(uuid, text, text, int) from public, anon;
grant execute on function public.household_agreement_check_in(uuid, text, text, int) to authenticated;

commit;
