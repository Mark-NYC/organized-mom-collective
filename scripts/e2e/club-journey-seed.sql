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
end $d$;
