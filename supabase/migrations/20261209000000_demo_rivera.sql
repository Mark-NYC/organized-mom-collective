-- The Rivera demo household (docs/demo/RIVERA_DEMO.md): one private, fully used family that the owner can sign in to
-- and explore, and reset to its approved starting point. Built from the established sample family
-- (src/data/club/samples.ts → 'rivera': Ana, Luis, Sofia 10, Mateo 7, Elena 4, a dog).
--
-- NOT APPLIED. Needs the owner's approval like every migration. Depends only on what production has (checked
-- read-only 2026-11-21): 20261124-29, 20261201, 20261205-06, 20261207 (development records), 20261208
-- (complimentary access). Does not use 20261130 or 20261202-04.
--
-- How it is built: ONLY through the app's own database functions, run as the demo's own adults (Ana, then Luis), the
-- way their phones would call them: household_save, the family profile saves, household_invite_create/_accept,
-- calendar_event_save, household_agreement_save, cleaning_marks_push, household_development_decide (every MAWL step
-- is a real decision), club_meeting_guide_mark. Club access is the owner's complimentary grant
-- (club_admin_access_grant, 20261208), made by the owner who runs it. Nothing here writes billing, Stripe, orders,
-- fulfillment, entitlements, emails, calendar feeds or Google tables, and no kit, resource or release is changed.
--
-- The one thing a phone can't do: make history weeks old. After each real decision the seed moves THAT household's
-- display dates back (development events' decided_at, records' created_at and last check-in date, agreements'
-- created_at, cleaning marks' dates).
-- Sync cursors (updated_at, synced_at, revision) are never back-dated, so phones pick up a reset normally.
--
-- Safety, enforced here (supabase/tests/demo-rivera.sql):
--   - Owner admin only (is_admin('owner')), audited (admin_log 'demo.rivera.*').
--   - Demo accounts only: both emails must end in @example.com (a reserved domain that never receives mail), and
--     neither account may have a subscription, invoice, entitlement, fulfillment row or another household.
--   - A reset deletes only the one household registered in demo_households, and only after the same checks.
--   - Idempotent: install and reset leave the same household every time (fixed ids for the seeded rows).
begin;

-- ---------------------------------------------------------------- registry (server only)

create table public.demo_households (
  key text primary key check (key = 'rivera'),
  owner_user_id uuid not null unique references auth.users (id) on delete cascade,
  partner_user_id uuid not null unique references auth.users (id) on delete cascade,
  household_id uuid,
  seeded_at timestamptz,
  seeded_by uuid references auth.users (id) on delete set null,
  seed_version int not null default 1,
  check (owner_user_id <> partner_user_id)
);
alter table public.demo_households enable row level security;
revoke all on public.demo_households from public, anon, authenticated;

-- A fixed id for a seeded row (so a reset recreates the same rows and phones update them in place).
create function public.demo_id(p_key text) returns uuid
language sql immutable set search_path = '' as $$ select md5('omc-rivera-demo:' || p_key)::uuid $$;

-- Calls the following functions as this user (auth.uid()), for the rest of the transaction.
create function public.demo_act_as(p_uid uuid) returns void
language sql set search_path = '' as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

-- An account may be a demo adult only if it is plainly a demo account and touches nothing real.
create function public.demo_account_ok(p_uid uuid, p_household uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare em text := (select lower(email) from auth.users where id = p_uid);
begin
  if em is null then return 'no_account'; end if;
  if em !~ '^[a-z0-9._+-]+@example\.com$' then return 'not_a_demo_email'; end if;
  if exists (select 1 from public.club_subscriptions where user_id = p_uid) then return 'has_subscription'; end if;
  if exists (select 1 from public.club_invoices where user_id = p_uid) then return 'has_invoice'; end if;
  if exists (select 1 from public.club_entitlements where user_id = p_uid) then return 'has_entitlement'; end if;
  if exists (select 1 from public.club_fulfillment_orders where user_id = p_uid) then return 'has_fulfillment'; end if;
  if exists (select 1 from public.household_adults a where a.user_id = p_uid and a.household_id is distinct from p_household)
     or exists (select 1 from public.club_households h where h.owner_user_id = p_uid and h.id is distinct from p_household) then
    return 'has_other_household';
  end if;
  return 'ok';
end $$;

-- Moves one seeded row's display dates back (never a sync cursor).
create function public.demo_age_decision(p_record uuid, p_days numeric) returns void
language sql security definer set search_path = '' as $$
  update public.household_development_events set decided_at = now() - make_interval(secs => p_days * 86400)
   where id = (select max(id) from public.household_development_events where record_id = p_record);
  update public.household_development
     set created_at = least(created_at, now() - make_interval(secs => p_days * 86400)),
         -- A stage decision is also the family's last check-in (household_development_decide sets it to today).
         last_check_in_on = case when last_check_in_on = current_date then (now() - make_interval(secs => p_days * 86400))::date
                                 else last_check_in_on end
   where id = p_record;
$$;

-- One MAWL decision, exactly as the app sends it (household_development_decide), then dated p_days ago.
create function public.demo_decide(p_uid uuid, p jsonb, p_days numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare rid uuid := (p ->> 'id')::uuid;
begin
  perform public.demo_act_as(p_uid);
  perform public.household_development_decide(p || jsonb_build_object('library_version', 1),
                                              (select revision from public.household_development where id = rid));
  perform public.demo_age_decision(rid, p_days);
end $$;

-- ---------------------------------------------------------------- the seed

create function public.demo_rivera_seed(p_owner uuid, p_partner uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  tz constant text := 'America/Chicago';
  admin uuid := auth.uid();
  d date := (now() at time zone tz)::date;          -- the family's today
  mon date;                                         -- the Monday three weeks ago (recurring plans start there)
  hid uuid;
  ana uuid; luis uuid; sofia uuid; mateo uuid; elena uuid;
  everyone jsonb; kids jsonb;
  code text;
  r jsonb;
  dow int;
  zone_items text[];
  mm text;
begin
  mon := d - (extract(isodow from d)::int - 1) - 21;

  -- 1. Ana sets up the family (the family form / app setup: household_save).
  perform public.demo_act_as(p_owner);
  perform public.household_save(null, 'The Rivera Family',
    jsonb_build_object('pets', true, 'priorities', jsonb_build_array('mornings', 'kids-independence', 'time-together'),
                       'week_starts', 'sunday', 'school', true, 'weekday_dinner', '18:00'),
    jsonb_build_array(
      jsonb_build_object('first_name', 'Ana', 'kind', 'adult', 'role', 'parent', 'is_account_holder', true),
      jsonb_build_object('first_name', 'Luis', 'kind', 'adult', 'role', 'partner'),
      jsonb_build_object('first_name', 'Sofia', 'kind', 'child', 'role', 'child', 'birth_year', 2016, 'birth_month', 3),
      jsonb_build_object('first_name', 'Mateo', 'kind', 'child', 'role', 'child', 'birth_year', 2019, 'birth_month', 6),
      jsonb_build_object('first_name', 'Elena', 'kind', 'child', 'role', 'child', 'birth_year', 2022, 'birth_month', 2)));
  hid := public.household_id_for(p_owner);
  select id into ana from public.club_family_members where household_id = hid and first_name = 'Ana';
  select id into luis from public.club_family_members where household_id = hid and first_name = 'Luis';
  select id into sofia from public.club_family_members where household_id = hid and first_name = 'Sofia';
  select id into mateo from public.club_family_members where household_id = hid and first_name = 'Mateo';
  select id into elena from public.club_family_members where household_id = hid and first_name = 'Elena';
  everyone := jsonb_build_array(ana, luis, sofia, mateo, elena);
  kids := jsonb_build_array(sofia, mateo, elena);

  -- 2. The family profile, every step (the setup questions: week, responsibilities, growth, challenges, priority).
  perform public.club_activities_save(jsonb_build_array(
    jsonb_build_object('category', 'school', 'member_ids', jsonb_build_array(sofia, mateo), 'days', jsonb_build_array(1, 2, 3, 4, 5), 'starts_at', '08:00'),
    jsonb_build_object('category', 'school', 'name', 'Preschool', 'member_ids', jsonb_build_array(elena), 'days', jsonb_build_array(1, 3, 5), 'starts_at', '08:30'),
    jsonb_build_object('category', 'sports', 'name', 'Soccer', 'member_ids', jsonb_build_array(sofia), 'days', jsonb_build_array(2, 4, 6), 'starts_at', '17:30'),
    jsonb_build_object('category', 'lessons', 'name', 'Swim lessons', 'member_ids', jsonb_build_array(mateo), 'days', jsonb_build_array(3), 'starts_at', '16:30'),
    jsonb_build_object('category', 'work', 'member_ids', jsonb_build_array(ana, luis), 'days', jsonb_build_array(1, 2, 3, 4, 5))));
  perform public.club_responsibilities_save('existing', jsonb_build_array(
    jsonb_build_object('category', 'meals', 'owner_ids', jsonb_build_array(ana, luis), 'helper_ids', jsonb_build_array(sofia)),
    jsonb_build_object('category', 'transportation', 'owner_ids', jsonb_build_array(luis), 'helper_ids', '[]'::jsonb),
    jsonb_build_object('category', 'laundry', 'owner_ids', jsonb_build_array(ana), 'helper_ids', jsonb_build_array(sofia)),
    jsonb_build_object('category', 'cleaning', 'owner_ids', jsonb_build_array(ana, luis), 'helper_ids', jsonb_build_array(sofia, mateo)),
    jsonb_build_object('category', 'pet-care', 'owner_ids', jsonb_build_array(sofia), 'helper_ids', jsonb_build_array(mateo))));
  perform public.club_responsibilities_save('desired', jsonb_build_array(
    jsonb_build_object('category', 'laundry', 'item', 'put-away-laundry', 'owner_ids', jsonb_build_array(sofia), 'helper_ids', '[]'::jsonb),
    jsonb_build_object('category', 'school-prep', 'item', 'pack-school-bag', 'owner_ids', jsonb_build_array(mateo), 'helper_ids', '[]'::jsonb),
    jsonb_build_object('category', 'routines', 'item', 'morning-routine', 'owner_ids', jsonb_build_array(elena), 'helper_ids', '[]'::jsonb)));
  perform public.club_focus_save('challenges', array['routines', 'remembering', 'sharing-fairly'],
    'Mornings are rushed, the house gets cluttered, and the kids need reminding for everything.', null, null);
  perform public.club_focus_save('priority', array['routines', 'remembering', 'sharing-fairly'],
    'Mornings are rushed, the house gets cluttered, and the kids need reminding for everything.',
    'mornings', 'Calmer mornings, and more time together on weekends');
  perform public.club_meeting_guide_mark();

  -- 3. Luis joins as the second adult (the real invitation: Ana sends it, Luis accepts it).
  code := public.household_invite_create(luis, (select email from auth.users where id = p_partner)) ->> 'code';
  perform public.demo_act_as(p_partner);
  perform public.household_invite_accept(code);

  -- 4. Family Meeting Club: the owner's complimentary grant on Ana's account (both adults get it, 20261208).
  perform public.demo_act_as(admin);
  perform public.club_admin_access_grant(p_owner, null, 'Rivera demo household (docs/demo/RIVERA_DEMO.md)');

  -- 5. The calendar (calendar_event_save as Ana or Luis). Weekly plans repeat, so the calendar never goes stale;
  --    one-off plans are placed around today when the demo is seeded or reset.
  perform public.demo_act_as(p_owner);
  for r in select * from jsonb_array_elements(jsonb_build_array(
    jsonb_build_object('k', 'school', 'title', 'School', 'start_time', '08:00', 'end_time', '15:00', 'location', 'Maple Grove Elementary', 'm', jsonb_build_array(sofia, mateo), 'by_day', jsonb_build_array(1, 2, 3, 4, 5)),
    jsonb_build_object('k', 'preschool', 'title', 'Preschool', 'start_time', '08:30', 'end_time', '11:30', 'location', 'Little Oaks Preschool', 'm', jsonb_build_array(elena), 'by_day', jsonb_build_array(1, 3, 5)),
    jsonb_build_object('k', 'soccer', 'title', 'Soccer practice', 'start_time', '17:30', 'end_time', '18:45', 'location', 'Riverside Park, field 2', 'notes', 'Shin guards and water bottle', 'm', jsonb_build_array(sofia), 'by_day', jsonb_build_array(2, 4)),
    jsonb_build_object('k', 'soccer-game', 'title', 'Soccer game', 'start_time', '09:00', 'end_time', '10:00', 'location', 'Riverside Park', 'm', jsonb_build_array(sofia), 'by_day', jsonb_build_array(6)),
    jsonb_build_object('k', 'swim', 'title', 'Swim lesson', 'start_time', '16:30', 'end_time', '17:15', 'location', 'Community pool', 'notes', 'Goggles in the swim bag', 'm', jsonb_build_array(mateo), 'by_day', jsonb_build_array(3)),
    jsonb_build_object('k', 'library', 'title', 'Library day: return books', 'm', jsonb_build_array(mateo), 'by_day', jsonb_build_array(4)),
    jsonb_build_object('k', 'trash', 'title', 'Trash and recycling to the curb', 'start_time', '19:30', 'end_time', '19:45', 'm', jsonb_build_array(luis, mateo), 'by_day', jsonb_build_array(3)),
    jsonb_build_object('k', 'meeting', 'title', 'Family Meeting', 'start_time', '18:30', 'end_time', '18:45', 'notes', 'Ten minutes, everyone together', 'm', everyone, 'by_day', jsonb_build_array(0)),
    jsonb_build_object('k', 'pancakes', 'title', 'Saturday pancakes', 'start_time', '08:30', 'end_time', '09:30', 'm', everyone, 'by_day', jsonb_build_array(6))
  )) as x(r) loop
    perform public.calendar_event_save(jsonb_strip_nulls(jsonb_build_object(
      'id', public.demo_id('event:' || (r ->> 'k')), 'title', r ->> 'title', 'starts_on', mon, 'timezone', tz,
      'start_time', r ->> 'start_time', 'end_time', r ->> 'end_time', 'location', r ->> 'location', 'notes', r ->> 'notes',
      'member_ids', r -> 'm', 'owner_member_id', ana,
      'recurrence', jsonb_build_object('freq', 'weekly', 'by_day', r -> 'by_day'))), null);
  end loop;
  for r in select * from jsonb_array_elements(jsonb_build_array(
    jsonb_build_object('k', 'pumpkins', 'title', 'Pumpkin patch', 'day', -13, 'start_time', '10:00', 'end_time', '12:00', 'location', 'Hillside Farm', 'm', everyone),
    jsonb_build_object('k', 'slip', 'title', 'Field trip permission slip due', 'day', 2, 'm', jsonb_build_array(mateo), 'notes', 'Signed slip in the blue folder'),
    jsonb_build_object('k', 'dentist', 'title', 'Dentist: Mateo', 'day', 3, 'start_time', '15:45', 'end_time', '16:30', 'location', 'Bright Smiles Dental', 'm', jsonb_build_array(mateo, ana)),
    jsonb_build_object('k', 'party', 'title', 'Birthday party: Lucas', 'day', 5, 'start_time', '14:00', 'end_time', '16:00', 'location', 'Jump Zone', 'notes', 'Gift is in the hall closet', 'm', jsonb_build_array(mateo, luis)),
    jsonb_build_object('k', 'picture-day', 'title', 'School picture day', 'day', 6, 'm', jsonb_build_array(sofia, mateo)),
    jsonb_build_object('k', 'abuela', 'title', 'Dinner at Abuela''s', 'day', 8, 'start_time', '17:00', 'end_time', '19:30', 'm', everyone),
    jsonb_build_object('k', 'science', 'title', 'Science project due', 'day', 9, 'm', jsonb_build_array(sofia), 'notes', 'Poster board is in the garage'),
    jsonb_build_object('k', 'conference', 'title', 'Parent-teacher conference (Sofia)', 'day', 12, 'start_time', '16:15', 'end_time', '16:45', 'location', 'Maple Grove Elementary', 'm', jsonb_build_array(ana, luis)),
    jsonb_build_object('k', 'well-visit', 'title', 'Well visit: Elena', 'day', 15, 'start_time', '10:00', 'end_time', '10:45', 'location', 'Lakeside Pediatrics', 'm', jsonb_build_array(elena, luis))
  )) as x(r) loop
    perform public.calendar_event_save(jsonb_strip_nulls(jsonb_build_object(
      'id', public.demo_id('event:' || (r ->> 'k')), 'title', r ->> 'title', 'starts_on', d + (r ->> 'day')::int,
      'timezone', tz, 'start_time', r ->> 'start_time', 'end_time', r ->> 'end_time', 'location', r ->> 'location',
      'notes', r ->> 'notes', 'member_ids', r -> 'm', 'owner_member_id', ana)), null);
  end loop;

  -- 6. Family agreements with their cues and finish lines (household_agreement_save), made over the past weeks.
  for r in select * from jsonb_array_elements(jsonb_build_array(
    jsonb_build_object('k', 'door', 'category', 'belongings', 'text', 'Shoes, jackets and backpacks wait by the door', 'when', 'Before leaving for school', 'finished', 'Everything is by the door before we walk out', 'o', jsonb_build_array(sofia, mateo), 'by', 'ana', 'ago', 24),
    jsonb_build_object('k', 'coco', 'category', 'pet-care', 'text', 'Feed Coco and refill her water', 'when', 'After breakfast', 'finished', 'Food bowl filled and fresh water', 'o', jsonb_build_array(sofia), 'by', 'ana', 'ago', 24),
    jsonb_build_object('k', 'dishwasher', 'category', 'meals', 'text', 'Load the dishwasher and start it', 'when', 'After dinner', 'finished', 'Sink is empty and the dishwasher is running', 'o', jsonb_build_array(luis), 'by', 'luis', 'ago', 17),
    jsonb_build_object('k', 'lunches', 'category', 'meals', 'text', 'Pack tomorrow''s lunches', 'when', 'After dinner', 'finished', 'Lunches are in the fridge, labeled', 'o', jsonb_build_array(ana), 'by', 'ana', 'ago', 17),
    jsonb_build_object('k', 'clothes', 'category', 'routines', 'text', 'Lay out tomorrow''s clothes with Mom', 'when', 'Before bedtime', 'finished', 'Clothes are on the chair, shoes underneath', 'o', jsonb_build_array(elena), 'by', 'ana', 'ago', 10),
    jsonb_build_object('k', 'homework', 'category', 'homework', 'text', 'Homework at the kitchen table', 'when', 'When we get home', 'finished', 'Folder signed and back in the backpack', 'o', jsonb_build_array(sofia), 'by', 'luis', 'ago', 10),
    jsonb_build_object('k', 'living-room', 'category', 'cleaning', 'text', 'Ten-minute living room reset', 'when', 'After dinner', 'finished', 'Toys in bins and blankets folded', 'o', jsonb_build_array(ana, luis, sofia, mateo), 'by', 'ana', 'ago', 3),
    jsonb_build_object('k', 'rides', 'category', 'transportation', 'text', 'Drive Sofia to soccer', 'when', 'Tuesdays and Thursdays at 5:15', 'finished', 'At the field by 5:30', 'o', jsonb_build_array(luis), 'by', 'luis', 'ago', 3)
  )) as x(r) loop
    perform public.demo_act_as(case when r ->> 'by' = 'luis' then p_partner else p_owner end);
    perform public.household_agreement_save(jsonb_build_object(
      'id', public.demo_id('agreement:' || (r ->> 'k')), 'category', r ->> 'category', 'text', r ->> 'text',
      'when', r ->> 'when', 'finished', r ->> 'finished', 'owner_ids', r -> 'o'), null);
    update public.club_responsibilities
       set created_at = now() - make_interval(days => (r ->> 'ago')::int),
           confirmed_at = now() - make_interval(days => (r ->> 'ago')::int)
     where id = public.demo_id('agreement:' || (r ->> 'k')) and household_id = hid;
  end loop;

  -- 7. Family development (MAWL), every step a real decision by Ana or Luis, over five weeks.
  -- Sofia: Pack my backpack, Model → Assist → Watch → Launch (the family handed it over).
  perform public.demo_decide(p_owner, jsonb_build_object('id', public.demo_id('dev:sofia-bag'), 'decision', 'start',
    'member_id', sofia, 'skill_id', 'school-bag', 'title', 'Pack my backpack', 'stage', 'model', 'cue', 'Before bedtime',
    'finish', 'Backpack zipped by the door with homework, folder and water bottle', 'category', 'school-prep',
    'agreement_id', public.demo_id('agreement:dev-sofia-bag')), 35);
  perform public.demo_decide(p_owner, jsonb_build_object('id', public.demo_id('dev:sofia-bag'), 'decision', 'advance'), 28);
  perform public.demo_decide(p_partner, jsonb_build_object('id', public.demo_id('dev:sofia-bag'), 'decision', 'advance'), 21);
  perform public.demo_decide(p_owner, jsonb_build_object('id', public.demo_id('dev:sofia-bag'), 'decision', 'advance',
    'note', 'Two weeks without a reminder. It''s hers now.'), 7);
  -- Sofia: Unload safe dishwasher items, Assist → Watch, back to Assist (busy weeks), new cue, Watch again.
  perform public.demo_decide(p_owner, jsonb_build_object('id', public.demo_id('dev:sofia-dishes'), 'decision', 'start',
    'member_id', sofia, 'skill_id', 'dishwasher', 'title', 'Unload safe dishwasher items', 'stage', 'assist',
    'cue', 'After breakfast', 'finish', 'Plates, cups and silverware are in the cabinets', 'category', 'meals',
    'agreement_id', public.demo_id('agreement:dev-sofia-dishes')), 21);
  perform public.demo_decide(p_owner, jsonb_build_object('id', public.demo_id('dev:sofia-dishes'), 'decision', 'advance'), 14);
  perform public.demo_decide(p_partner, jsonb_build_object('id', public.demo_id('dev:sofia-dishes'), 'decision', 'step-back',
    'note', 'Mornings are too rushed. Back to doing it together for now.'), 11);
  perform public.demo_decide(p_owner, jsonb_build_object('id', public.demo_id('dev:sofia-dishes'), 'decision', 'modify',
    'cue', 'After dinner'), 10);
  perform public.demo_decide(p_owner, jsonb_build_object('id', public.demo_id('dev:sofia-dishes'), 'decision', 'advance',
    'note', 'Much easier after dinner.'), 6);
  -- Mateo: Unpack backpack and lunchbox, Model → Assist, finish line edited.
  perform public.demo_decide(p_partner, jsonb_build_object('id', public.demo_id('dev:mateo-unpack'), 'decision', 'start',
    'member_id', mateo, 'skill_id', 'after-school', 'title', 'Unpack my backpack and lunchbox', 'stage', 'model',
    'cue', 'When we get home', 'finish', 'Lunchbox on the counter', 'category', 'belongings',
    'agreement_id', public.demo_id('agreement:dev-mateo-unpack')), 20);
  perform public.demo_decide(p_owner, jsonb_build_object('id', public.demo_id('dev:mateo-unpack'), 'decision', 'advance'), 9);
  perform public.demo_decide(p_owner, jsonb_build_object('id', public.demo_id('dev:mateo-unpack'), 'decision', 'modify',
    'finish', 'Lunchbox on the counter, folder on the table, backpack on its hook'), 9);
  -- Mateo: Clear my dishes, started this week (Model).
  perform public.demo_decide(p_owner, jsonb_build_object('id', public.demo_id('dev:mateo-dishes'), 'decision', 'start',
    'member_id', mateo, 'skill_id', 'dishes', 'title', 'Clear my dishes', 'stage', 'model', 'cue', 'After dinner',
    'finish', 'Plate and cup are in the sink', 'category', 'meals',
    'agreement_id', public.demo_id('agreement:dev-mateo-dishes')), 3);
  -- Elena: Put toys away, Model → Assist → Watch → Launch (so this week's meeting can suggest her next skill).
  perform public.demo_decide(p_owner, jsonb_build_object('id', public.demo_id('dev:elena-toys'), 'decision', 'start',
    'member_id', elena, 'skill_id', 'toys', 'title', 'Put toys away', 'stage', 'model', 'cue', 'Before bedtime',
    'finish', 'Toys are back in the bins', 'category', 'cleaning',
    'agreement_id', public.demo_id('agreement:dev-elena-toys')), 26);
  perform public.demo_decide(p_owner, jsonb_build_object('id', public.demo_id('dev:elena-toys'), 'decision', 'advance'), 19);
  perform public.demo_decide(p_partner, jsonb_build_object('id', public.demo_id('dev:elena-toys'), 'decision', 'advance'), 12);
  perform public.demo_decide(p_owner, jsonb_build_object('id', public.demo_id('dev:elena-toys'), 'decision', 'advance',
    'note', 'She does it before bath without being asked.'), 5);
  -- Elena: Put dirty clothes in the hamper, started, then paused ("Not now").
  perform public.demo_decide(p_owner, jsonb_build_object('id', public.demo_id('dev:elena-hamper'), 'decision', 'start',
    'member_id', elena, 'skill_id', 'hamper', 'title', 'Put dirty clothes in the hamper', 'stage', 'model',
    'cue', 'At bath time', 'finish', 'Clothes are in the hamper', 'category', 'laundry',
    'agreement_id', public.demo_id('agreement:dev-elena-hamper')), 18);
  perform public.demo_decide(p_owner, jsonb_build_object('id', public.demo_id('dev:elena-hamper'), 'decision', 'pause',
    'note', 'Not now. Too many new things at once; we''ll come back to it.'), 8);
  -- The agreements the decisions made carry the same dates.
  update public.club_responsibilities r
     set created_at = h.created_at, confirmed_at = h.created_at
    from public.household_development h
   where h.household_id = hid and r.id = h.agreement_id;

  -- 8. Cleaning (cleaning_marks_push, the companion's own sync): today half done, the last two weeks mostly done.
  perform public.demo_act_as(p_owner);
  for i in 0..13 loop
    dow := extract(isodow from d - i)::int;
    -- Monday to Thursday each have a zone (src/data/cleaning.ts); Friday to Sunday are the weekend, no zone.
    zone_items := case dow when 1 then array['mon-items', 'mon-surfaces', 'mon-pillows']
                           when 2 then array['tue-clothes', 'tue-loose', 'tue-bedding']
                           when 3 then array['wed-entry', 'wed-shoes', 'wed-sink', 'wed-toilet']
                           when 4 then array['thu-clear', 'thu-wipe', 'thu-sink', 'thu-floor']
                           else array[]::text[] end;
    if i = 0 then zone_items := zone_items[1:1]; end if;  -- today: started, not finished
    perform public.cleaning_marks_push(coalesce((
      select jsonb_agg(jsonb_build_object('list', m.list, 'period', to_char(d - i, 'YYYY-MM-DD'), 'item', m.item,
                                          'done', true, 'at', ((d - i) + time '07:45') at time zone tz))
        from (select 'daily' as list, unnest(case when i = 0 then array['beds', 'dishwasher']
                                                  when i % 4 = 3 then array['beds', 'counters', 'pickup']
                                                  else array['beds', 'dishwasher', 'counters', 'pickup', 'spills'] end) as item
              union all
              select 'focus', unnest(zone_items)) m), '[]'));
  end loop;
  mm := lower(to_char(d, 'mon'));
  perform public.cleaning_marks_push(jsonb_build_array(
    jsonb_build_object('list', 'monthly', 'period', to_char(d, 'YYYY-MM'), 'item', mm || case mm
      when 'jan' then '-pantry' when 'feb' then '-mattress' when 'mar' then '-baseboards' when 'apr' then '-windows'
      when 'may' then '-cushions' when 'jun' then '-furniture' when 'jul' then '-oven' when 'aug' then '-outgrown'
      when 'sep' then '-hooks' when 'oct' then '-unworn' when 'nov' then '-fridge' else '-toys' end,
      'done', true, 'at', (d - 2 + time '10:00') at time zone tz)));

  perform public.demo_act_as(admin);
  return hid;
end $$;

-- ---------------------------------------------------------------- owner admin (browser, audited)

-- What the admin page shows.
create function public.demo_rivera_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r public.demo_households%rowtype;
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.demo_households where key = 'rivera';
  if not found then return jsonb_build_object('installed', false); end if;
  return jsonb_build_object('installed', true,
    'owner_email', (select email from auth.users where id = r.owner_user_id),
    'partner_email', (select email from auth.users where id = r.partner_user_id),
    'household_present', exists (select 1 from public.club_households where id = r.household_id),
    'club', public.club_has_access(r.owner_user_id),
    'seeded_at', r.seeded_at,
    'seeded_by', (select email from auth.users where id = r.seeded_by));
end $$;

-- Restores Rivera to its approved starting point (also the first install, with the two demo accounts' emails).
create function public.demo_rivera_reset(p_owner_email text default null, p_partner_email text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  admin uuid := auth.uid();
  reg public.demo_households%rowtype;
  o uuid; p uuid; v text; hid uuid;
  first_install boolean;
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into reg from public.demo_households where key = 'rivera' for update;
  first_install := not found;
  if first_install then
    if p_owner_email is null or p_partner_email is null then raise exception 'not_installed'; end if;
    select id into o from auth.users where lower(email) = lower(btrim(p_owner_email));
    select id into p from auth.users where lower(email) = lower(btrim(p_partner_email));
    if o is null or p is null then raise exception 'no_account'; end if;
    if o = p then raise exception 'invalid'; end if;
  else
    if p_owner_email is not null or p_partner_email is not null then raise exception 'already_installed'; end if;
    o := reg.owner_user_id; p := reg.partner_user_id;
  end if;
  -- Never touch anything real: both accounts must be clean demo accounts (their only household being this one).
  v := public.demo_account_ok(o, reg.household_id);
  if v <> 'ok' then raise exception 'owner_%', v; end if;
  v := public.demo_account_ok(p, reg.household_id);
  if v <> 'ok' then raise exception 'partner_%', v; end if;

  -- Clear the demo household (only the registered one; everything in it goes with it).
  if reg.household_id is not null then
    delete from public.household_invites where household_id = reg.household_id;
    delete from public.household_adults where household_id = reg.household_id;
    delete from public.club_households where id = reg.household_id;
  end if;

  hid := public.demo_rivera_seed(o, p);
  insert into public.demo_households (key, owner_user_id, partner_user_id, household_id, seeded_at, seeded_by)
  values ('rivera', o, p, hid, now(), admin)
  on conflict (key) do update set household_id = excluded.household_id, seeded_at = excluded.seeded_at, seeded_by = excluded.seeded_by;
  perform public.admin_log(case when first_install then 'demo.rivera.install' else 'demo.rivera.reset' end, hid::text,
                           jsonb_build_object('owner', o, 'partner', p));
  return public.demo_rivera_status();
end $$;

revoke execute on function public.demo_id(text), public.demo_act_as(uuid), public.demo_account_ok(uuid, uuid),
  public.demo_age_decision(uuid, numeric), public.demo_decide(uuid, jsonb, numeric), public.demo_rivera_seed(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.demo_rivera_status(), public.demo_rivera_reset(text, text) from public, anon;
grant execute on function public.demo_rivera_status(), public.demo_rivera_reset(text, text) to authenticated;

commit;
