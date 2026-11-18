-- Membership states for the Club journey test (scripts/e2e/club-journey.mjs), on the THROWAWAY database from
-- family-db.sh only, after seed.sql. Each household is made through the family functions, as its owner; the billing
-- rows are what Stripe's webhook would have written (test mode, livemode = false). Never run against production.
\set ON_ERROR_STOP 1
\set QUIET 1
update public.club_kits set status = 'scheduled', release_at = least(release_at, now()) where month = '2026-12-01';
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000c1b01', 'free@e2e.test', now()),
  ('00000000-0000-0000-0000-0000000c1b02', 'trial@e2e.test', now()),
  ('00000000-0000-0000-0000-0000000c1b03', 'active@e2e.test', now()),
  ('00000000-0000-0000-0000-0000000c1b04', 'canceled@e2e.test', now()),
  ('00000000-0000-0000-0000-0000000c1b05', 'partner@e2e.test', now());

create function pg_temp.family(uid uuid, name text, kid text) returns uuid language plpgsql as $f$
declare r jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  r := public.club_household_save(name, '{}'::jsonb, jsonb_build_array(
    jsonb_build_object('first_name', split_part(name, ' ', 2), 'kind', 'adult', 'role', 'parent', 'is_account_holder', true),
    jsonb_build_object('first_name', 'Alex', 'kind', 'adult', 'role', 'partner'),
    jsonb_build_object('first_name', kid, 'kind', 'child', 'role', 'child', 'birth_year', 2017, 'birth_month', 5)));
  return (r ->> 'id')::uuid;
end $f$;

do $d$
declare h_free uuid; h_trial uuid; h_active uuid; h_canceled uuid; pm uuid; inv jsonb;
begin
  h_free := pg_temp.family('00000000-0000-0000-0000-0000000c1b01', 'The Free', 'Ivy');
  h_trial := pg_temp.family('00000000-0000-0000-0000-0000000c1b02', 'The Trial', 'Noah');
  h_active := pg_temp.family('00000000-0000-0000-0000-0000000c1b03', 'The Active', 'Mia');
  h_canceled := pg_temp.family('00000000-0000-0000-0000-0000000c1b04', 'The Canceled', 'Owen');
  -- The trial household's second adult joins by invitation.
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000c1b02', 'role', 'authenticated')::text, true);
  select id into pm from public.club_family_members where household_id = h_trial and first_name = 'Alex';
  inv := public.household_invite_create(pm, 'partner@e2e.test');
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000c1b05', 'role', 'authenticated')::text, true);
  perform public.household_invite_accept(inv ->> 'code');
  perform set_config('request.jwt.claims', '', true);

  insert into public.club_customers (stripe_customer_id, user_id, email, livemode, household_id) values
    ('cus_e2etrial', '00000000-0000-0000-0000-0000000c1b02', 'trial@e2e.test', false, h_trial),
    ('cus_e2eactive', '00000000-0000-0000-0000-0000000c1b03', 'active@e2e.test', false, h_active),
    ('cus_e2ecanceled', '00000000-0000-0000-0000-0000000c1b04', 'canceled@e2e.test', false, h_canceled);
  insert into public.club_subscriptions (stripe_subscription_id, stripe_customer_id, user_id, status, price_id, current_period_start, current_period_end, started_at, canceled_at, ended_at, livemode, household_id, plan) values
    ('sub_e2etrial', 'cus_e2etrial', '00000000-0000-0000-0000-0000000c1b02', 'trialing', 'price_test', now(), now() + interval '20 days', now(), null, null, false, h_trial, 'monthly'),
    ('sub_e2eactive', 'cus_e2eactive', '00000000-0000-0000-0000-0000000c1b03', 'active', 'price_test', now() - interval '10 days', now() + interval '20 days', now() - interval '40 days', null, null, false, h_active, 'monthly'),
    ('sub_e2ecanceled', 'cus_e2ecanceled', '00000000-0000-0000-0000-0000000c1b04', 'canceled', 'price_test', now() - interval '40 days', now() - interval '10 days', now() - interval '70 days', now() - interval '12 days', now() - interval '10 days', false, h_canceled, 'monthly');
  insert into public.club_entitlements (user_id, household_id, resource_month, kind, membership_year, plan, source, note) values
    ('00000000-0000-0000-0000-0000000c1b02', h_trial, '2026-11-01', 'digital', 1, 'admin', 'admin', 'e2e: free first month'),
    ('00000000-0000-0000-0000-0000000c1b03', h_active, '2026-11-01', 'digital', 1, 'admin', 'admin', 'e2e: paid month'),
    ('00000000-0000-0000-0000-0000000c1b03', h_active, '2026-12-01', 'digital', 1, 'admin', 'admin', 'e2e: paid month'),
    ('00000000-0000-0000-0000-0000000c1b04', h_canceled, '2026-11-01', 'digital', 1, 'admin', 'admin', 'e2e: delivered before canceling');
  -- The returning members have finished their Welcome Kit setup; the trial is a new member.
  update public.club_households set onboarded_at = now() - interval '30 days', setup_completed_at = now() - interval '30 days', meeting_guide_seen_at = now() - interval '20 days', enrolled_at = now() - interval '40 days', first_paid_month = '2026-11-01' where id in (h_active, h_canceled);
  -- A returning member has her mailing address on file (saved through the member's own function, as she would).
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000c1b03', 'role', 'authenticated')::text, true);
  perform public.club_address_save(jsonb_build_object('name', 'The Active Family', 'line1', '1 Test Street', 'city', 'Testville', 'state', 'NY', 'postal_code', '10001'));
  perform set_config('request.jwt.claims', '', true);
end $d$;

-- Agreements from an earlier meeting, so this week's meeting has something to follow through on
-- (docs/product/UNIFIED_FAMILY_ARCHITECTURE.md §7): agreed 8 days ago, never checked in on.
do $a$
declare r record; kid uuid;
begin
  for r in select * from (values ('00000000-0000-0000-0000-0000000c1b01'::uuid, 'Put my shoes by the door'),
                                 ('00000000-0000-0000-0000-0000000c1b02'::uuid, 'Feed the fish after breakfast'),
                                 ('00000000-0000-0000-0000-0000000c1b03'::uuid, 'Pack my school bag before bed')) v(uid, txt) loop
    perform set_config('request.jwt.claims', json_build_object('sub', r.uid, 'role', 'authenticated')::text, true);
    select m.id into kid from public.club_family_members m where m.household_id = public.household_id_for(r.uid) and m.kind = 'child' limit 1;
    perform public.household_agreement_save(jsonb_build_object('id', gen_random_uuid(), 'category', 'other', 'text', r.txt,
      'owner_ids', jsonb_build_array(kid), 'month', to_char(now() - interval '8 days', 'YYYY-MM')), null);
  end loop;
  perform set_config('request.jwt.claims', '', true);
  update public.club_responsibilities set confirmed_at = now() - interval '8 days', updated_at = now() - interval '8 days'
   where status = 'confirmed' and agreed_text in ('Put my shoes by the door', 'Feed the fish after breakfast', 'Pack my school bag before bed');
end $a$;

-- January's earlier tools, shaped like production's (2026-11-18, keys only): a returning family holds January and saved
-- on the retired Weekly Meeting tool and on the old Habit Cards copy, never on the current Our Family Focus page.
-- The journey checks both stay reachable and that viewing them changes nothing saved.
update public.club_kits set status = 'scheduled', release_at = least(release_at, now()) where month = '2027-01-01';
insert into public.club_entitlements (user_id, household_id, resource_month, kind, membership_year, plan, source, note)
select '00000000-0000-0000-0000-0000000c1b03', public.household_id_for('00000000-0000-0000-0000-0000000c1b03'), '2027-01-01', 'digital', 1, 'admin', 'admin', 'e2e: January held';
insert into public.club_resource_versions (household_id, kit_id, state, profile_version, revision)
select public.household_id_for('00000000-0000-0000-0000-0000000c1b03'), k.id,
  jsonb_build_object(
    'omc:club:january-weekly-meeting:v1', jsonb_build_object('s', 's', 'v', '{"current":"seed","state":{"trigger":"Sunday after lunch","assignments":{},"fallJobs":[]}}'),
    'omc:club:member:2027-01-fresh-start-together:v1', jsonb_build_object('s', 's', 'v', '{}')),
  1, 7
from public.club_kits k where k.slug = '2027-01-fresh-start-together';

-- November has two editions (owner, 2026-11-18): 2026 and 2027. The returning family holds both (digital and printed),
-- each with a pending mailing, and an admin can open each mailing's print view. Test database only.
update public.club_kits set status = 'scheduled', release_at = least(release_at, now()) where month = '2027-11-01';
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000c1b0a', 'admin@e2e.test', now()) on conflict do nothing;
insert into public.admin_users (user_id, role) values ('00000000-0000-0000-0000-0000000c1b0a', 'owner') on conflict do nothing;
do $n$
declare hid uuid := public.household_id_for('00000000-0000-0000-0000-0000000c1b03'); e uuid; m date;
begin
  insert into public.club_entitlements (user_id, household_id, resource_month, kind, membership_year, plan, source, note)
  values ('00000000-0000-0000-0000-0000000c1b03', hid, '2027-11-01', 'digital', 2, 'admin', 'admin', 'e2e: November 2027');
  foreach m in array array['2026-11-01'::date, '2027-11-01'::date] loop
    insert into public.club_entitlements (user_id, household_id, resource_month, kind, membership_year, plan, source, note)
    values ('00000000-0000-0000-0000-0000000c1b03', hid, m, 'physical', case when m = '2026-11-01' then 1 else 2 end, 'admin', 'admin', 'e2e: printed November')
    returning id into e;
    insert into public.club_fulfillment_orders (entitlement_id, user_id, household_id, resource_month, kit_id, status, cutoff_at, note)
    select e, '00000000-0000-0000-0000-0000000c1b03', hid, m, k.id, 'pending', now() + interval '10 days', 'e2e November ' || extract(year from m)
      from public.club_kits k where k.month = m;
  end loop;
end $n$;

-- A family that saved November 2026 BEFORE the year fix: its plan was prepared with the old 2027 ages, so Noah (born
-- May 2017, 9 that November) got the age-10 job. Saved work must stay exactly as saved; the journey checks it.
insert into public.club_resource_versions (household_id, kit_id, state, profile_version, revision)
select h, k.id, jsonb_build_object('omc:club:member:2026-11-family-ownership:v1', jsonb_build_object('s', 's', 'v', jsonb_build_object(
    'familyKey', 'account:' || h,
    'state', jsonb_build_object('family', 'The Trial', 'familyLine', 'A ready-to-use plan for The Trial', 'planTitle', 'Our School-Night Reset',
      'goal', 'Tomorrow is ready without Mom managing every step.', 'readyWhen', 'Tomorrow’s bags, clothes, supplies, and plans are ready.',
      'guideIntro', 'A simple way to move responsibility beyond Mom.', 'familyRule', 'Ask the owner what comes next. Let the owner finish the job.',
      'people', jsonb_build_array(jsonb_build_object('id', (select id from public.club_family_members where household_id = h and kind = 'child' limit 1),
        'name', 'Noah', 'kind', 'child', 'label', 'CHILD RESPONSIBILITY', 'job', 'Prepare my school and activity gear', 'when', 'Each evening',
        'done', 'My bag, clothes and gear are ready.'))))::text)),
  1, 3
from (select public.household_id_for('00000000-0000-0000-0000-0000000c1b02') as h) x, public.club_kits k where k.slug = '2026-11-family-ownership';
