-- Membership lifecycle and access tests (supabase/migrations/20261104000000_club_membership.sql), on a throwaway
-- database after every migration and club-access.sql. The Stripe side (fresh reads, signatures, line periods) is
-- tested in tests/club-billing.test.ts; this file drives the same database functions the webhook calls.
-- Never run on the real project.
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
-- The webhook's view of a subscription and an invoice.
create function pg_temp.sub(p_id text, p_cus text, p_user uuid, p_status text, p_plan text, p_start timestamptz, p_end timestamptz,
  p_cancel boolean default false) returns jsonb language sql as $$
  select public.club_subscription_sync(jsonb_build_object('id', p_id, 'customer', p_cus, 'user_id', p_user, 'status', p_status,
    'plan', p_plan, 'price_id', 'price_' || p_plan, 'current_period_start', p_start, 'current_period_end', p_end,
    'cancel_at_period_end', p_cancel, 'started_at', p_start, 'livemode', false, 'event_at', now()));
$$;
create function pg_temp.inv(p_id text, p_sub text, p_status text, p_cents int, p_start timestamptz, p_end timestamptz, p_plan text,
  p_paid_at timestamptz default null) returns jsonb language sql as $$
  select public.club_invoice_apply(jsonb_build_object('id', p_id, 'subscription', p_sub, 'status', p_status, 'billing_reason', 'subscription_cycle',
    'amount_due_cents', p_cents, 'amount_paid_cents', case when p_status = 'paid' then p_cents else 0 end, 'period_start', p_start,
    'period_end', p_end, 'paid_at', case when p_status = 'paid' then coalesce(p_paid_at, p_start) end, 'livemode', false,
    'payment_intent', 'pi_' || p_id, 'charge', 'ch_' || p_id, 'plan', p_plan),
    jsonb_build_array(jsonb_build_object('start', p_start, 'end', p_end, 'plan', p_plan)));
$$;

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000f001', 'monthly@example.com', now()),
  ('00000000-0000-0000-0000-00000000f002', 'annual@example.com', now()),
  ('00000000-0000-0000-0000-00000000f003', 'other@example.com', now()),
  ('00000000-0000-0000-0000-00000000f004', 'owner2@example.com', now());
insert into public.admin_users (user_id, role) values ('00000000-0000-0000-0000-00000000f004', 'owner') on conflict do nothing;
\set M '''00000000-0000-0000-0000-00000000f001'''
\set Y '''00000000-0000-0000-0000-00000000f002'''
\set X '''00000000-0000-0000-0000-00000000f003'''
\set OWNER '''00000000-0000-0000-0000-00000000f004'''

-- Publish November and December (drafts open for nobody, paid or not); January stays a draft.
update public.club_kits set status = 'scheduled' where slug in ('2026-11-family-ownership', '2026-12-christmas-mission');
select pg_temp.expect((select first_mailing_month from public.club_settings) = '2026-11-01', 'first mailing month is a setting (November 2026)');
select pg_temp.expect((select checkout_mode from public.club_settings) = 'off', 'checkout starts switched off');
select pg_temp.expect(public.club_month_of('2026-11-01 03:00:00+00') = '2026-10-01', 'months are New York months (3 a.m. UTC Nov 1 is still October 31)');

-- Cutoff rule: the second Sunday of the month before, 23:59:59 New York time.
select pg_temp.expect((select (cutoff_ordinal, cutoff_weekday) = (2::smallint, 0::smallint) from public.club_settings), 'the default rule is the second Sunday');
select pg_temp.expect(public.club_cutoff_at('2026-11-01') = '2026-10-11 23:59:59-04', 'November''s list closed Sunday Oct 11 (a month starting on Thursday; daylight time)');
select pg_temp.expect(public.club_cutoff_at('2026-12-01') = '2026-11-08 23:59:59-05', 'December''s closes Sunday Nov 8 (a month starting on Sunday: the earliest possible date; standard time)');
select pg_temp.expect(public.club_cutoff_at('2027-01-01') = '2026-12-13 23:59:59-05', 'January''s closes Sunday Dec 13 (across the year boundary)');
select pg_temp.expect(public.club_cutoff_at('2027-02-01') = '2027-01-10 23:59:59-05', 'February''s closes Sunday Jan 10 (a month starting on Friday)');
select pg_temp.expect(public.club_cutoff_at('2027-03-01') = '2027-02-14 23:59:59-05', 'March''s closes Sunday Feb 14 (a month starting on Monday: the latest possible date)');
select pg_temp.expect(public.club_cutoff_at('2027-09-01') = '2027-08-08 23:59:59-04', 'September''s closes Sunday Aug 8');
select pg_temp.expect(public.club_cutoff_at('2028-03-01') = '2028-02-13 23:59:59-05', 'leap year: March 2028''s closes Sunday Feb 13, 2028');
select pg_temp.expect(public.club_rule_cutoff_at('2028-03-01', -1, 2) = '2028-02-29 23:59:59-05', 'leap year: the last Tuesday of February 2028 is the 29th');
select pg_temp.expect(public.club_rule_cutoff_at('2027-03-01', -1, 0) = '2027-02-28 23:59:59-05', 'the last Sunday of a 28-day February');
select pg_temp.expect(public.club_rule_cutoff_at('2030-01-01', 2, 0) = '2029-12-09 23:59:59-05', 'a month starting on Saturday (December 2029)');
select pg_temp.expect(public.club_rule_cutoff_at('2027-02-01', 4, 6) = '2027-01-23 23:59:59-05', 'any ordinal weekday: the fourth Saturday');
select pg_temp.expect(not exists (select 1 from public.club_kits where mailer_cutoff_at <> public.club_cutoff_at(month)), 'every kit''s cutoff follows the rule (no seeded 15ths left)');
select pg_temp.expect((select (launch_exception_month, launch_exception_cutoff_at) = ('2026-11-01'::date, '2026-11-08 23:59:59-05'::timestamptz) from public.club_settings), 'launch exception: November 2026, through Sunday Nov 8');
select pg_temp.expect(public.club_cutoff_at('2026-11-01') = '2026-10-11 23:59:59-04', 'and November''s regular cutoff is unchanged by it');

-- ---------------------------------------------------------------- new monthly member, joins Nov 2, 2026

select public.club_member_link(:M, 'Monthly@Example.com', 'cus_M', false);
select pg_temp.expect((select billing_email from public.club_households where owner_user_id = :M) = 'monthly@example.com', 'checkout creates her household before onboarding');
select pg_temp.expect((select household_id from public.club_customers where stripe_customer_id = 'cus_M') = (select id from public.club_households where owner_user_id = :M), 'Stripe customer ↔ household ↔ account');
select pg_temp.expect(pg_temp.fails($$select public.club_member_link('00000000-0000-0000-0000-00000000f003', 'x@example.com', 'cus_M', false)$$, 'customer_user_mismatch'), 'a Stripe customer can''t move to another account');

select pg_temp.sub('sub_M', 'cus_M', :M, 'incomplete', 'monthly', '2026-11-02 15:00:00+00', '2026-12-02 15:00:00+00');
select pg_temp.expect((pg_temp.inv('in_M1', 'sub_M', 'open', 500, '2026-11-02 15:00:00+00', '2026-12-02 15:00:00+00', 'monthly') ->> 'granted')::int = 0, 'an unpaid first invoice grants nothing');
select pg_temp.sub('sub_M', 'cus_M', :M, 'active', 'monthly', '2026-11-02 15:00:00+00', '2026-12-02 15:00:00+00');
create temp table r as select pg_temp.inv('in_M1', 'sub_M', 'paid', 500, '2026-11-02 15:00:00+00', '2026-12-02 15:00:00+00', 'monthly') as j;
select pg_temp.expect((select (j ->> 'granted')::int = 1 and (j ->> 'first_paid')::boolean from r), 'the first paid invoice grants one month and is her first payment (welcome email)');
select pg_temp.expect((select array_agg(resource_month::text || ':' || kind order by kind, resource_month) from public.club_entitlements where user_id = :M) = '{2026-11-01:digital,2026-11-01:physical,2026-12-01:physical}', 'a Nov 2 joiner: November digital, December''s mailing (paid before Nov 8), and November''s by the launch exception');
select pg_temp.expect((select membership_year from public.club_entitlements where user_id = :M and kind = 'digital') = 1, 'membership year 1');
select pg_temp.expect((select invoice_id from public.club_entitlements where user_id = :M and kind = 'digital') = 'in_M1', 'the entitlement records the paid invoice that granted it');
select pg_temp.expect((select kit_id from public.club_entitlements where user_id = :M and kind = 'digital') = (select id from public.club_kits where slug = '2026-11-family-ownership'), 'and the exact resource edition');
select pg_temp.expect((select first_paid_month from public.club_households where owner_user_id = :M) = '2026-11-01' and (select enrolled_at from public.club_households where owner_user_id = :M) is not null, 'enrollment date and first paid month recorded');
select pg_temp.expect((select bool_and(not late) from public.club_fulfillment_orders where user_id = :M), 'nothing is late: every mailing goes to a list that was still open');
select pg_temp.expect((select note from public.club_entitlements where user_id = :M and kind = 'physical' and resource_month = '2026-11-01') = 'launch_exception', 'November''s mailing is marked as the launch exception');
select pg_temp.expect((select cutoff_at from public.club_fulfillment_orders where user_id = :M and resource_month = '2026-11-01') = '2026-11-08 23:59:59-05', 'its order carries the exception deadline');
drop table r;

-- Duplicate and out-of-order deliveries
select pg_temp.inv('in_M1', 'sub_M', 'paid', 500, '2026-11-02 15:00:00+00', '2026-12-02 15:00:00+00', 'monthly');
select pg_temp.inv('in_M1', 'sub_M', 'paid', 500, '2026-11-02 15:00:00+00', '2026-12-02 15:00:00+00', 'monthly');
select pg_temp.expect((select count(*) from public.club_entitlements where user_id = :M) = 3, 'replayed invoice.paid: no duplicate access, and no extra mailing month');
select pg_temp.expect((select count(*) from public.club_fulfillment_orders where user_id = :M) = 2, 'and no duplicate mailing order');
select pg_temp.expect((pg_temp.inv('in_M1', 'sub_M', 'paid', 500, '2026-11-02 15:00:00+00', '2026-12-02 15:00:00+00', 'monthly') ->> 'first_paid')::boolean = false, 'and no second welcome');
select pg_temp.sub('sub_M', 'cus_M', :M, 'incomplete', 'monthly', '2026-11-02 15:00:00+00', '2026-12-02 15:00:00+00');
select pg_temp.sub('sub_M', 'cus_M', :M, 'active', 'monthly', '2026-11-02 15:00:00+00', '2026-12-02 15:00:00+00');
select pg_temp.expect((select count(*) from public.club_entitlements where user_id = :M and revoked_at is null) = 3, 'a late, stale subscription event changes no access');

-- Unknown subscription (invoice arrives before anything else): refused, so the webhook syncs the subscription first.
select pg_temp.expect(pg_temp.fails($$select pg_temp.inv('in_Z', 'sub_unknown', 'paid', 500, now(), now() + interval '30 days', 'monthly')$$, 'unknown_subscription'), 'an invoice for an unknown subscription waits for the subscription');

-- Duplicate checkout attempt: a second live subscription for the same account is refused at the database.
select pg_temp.expect((pg_temp.sub('sub_M2', 'cus_M', :M, 'active', 'monthly', now(), now() + interval '30 days') ->> 'duplicate')::boolean, 'a second live subscription is reported as a duplicate (webhook cancels and refunds it)');
select pg_temp.expect(not exists (select 1 from public.club_subscriptions where stripe_subscription_id = 'sub_M2'), 'and never stored as live');
select pg_temp.expect((public.club_checkout_state(null, 'MONTHLY@example.com') ->> 'live_subscription')::boolean, 'checkout sees her live membership by email (refuses a second checkout)');
select pg_temp.expect(public.club_checkout_state(null, 'monthly@example.com') ->> 'customer' = 'cus_M', 'and reuses her Stripe customer');

-- Member view: November open, December locked, earlier months unavailable
select pg_temp.as_user('authenticated', :M);
select pg_temp.expect(public.club_document_get('2026-11-family-ownership') ->> 'can' = 'edit', 'she opens November');
select pg_temp.expect(pg_temp.fails($$select public.club_resource_get('2026-12-christmas-mission')$$, 'not_found'), 'but not December before she pays for it');
create temp table me as select public.club_me() as j;
select pg_temp.expect((select j ->> 'plan' from me) = 'monthly' and (select (j ->> 'access')::boolean from me), 'club_me: monthly, access');
select pg_temp.expect((select r ->> 'state' from me, jsonb_array_elements(j -> 'months') r where r ->> 'month' = '2026-11-01') = 'available', 'November available');
select pg_temp.expect((select r ->> 'state' from me, jsonb_array_elements(j -> 'months') r where r ->> 'month' = '2026-12-01') = 'locked', 'December locked');
select pg_temp.expect((select r -> 'mailing' ->> 'readiness' from me, jsonb_array_elements(j -> 'months') r where r ->> 'month' = '2026-11-01') = 'needs_profile', 'mailing waits for her family profile');
select pg_temp.expect((select (j ->> 'onboarded')::boolean from me) = false, 'account without completed onboarding is reported as such');
drop table me;
reset role;

-- ---------------------------------------------------------------- recurring payment, failure, cancellation

select pg_temp.sub('sub_M', 'cus_M', :M, 'active', 'monthly', '2026-12-02 15:00:00+00', '2027-01-02 15:00:00+00');
select pg_temp.expect((pg_temp.inv('in_M2', 'sub_M', 'paid', 500, '2026-12-02 15:00:00+00', '2027-01-02 15:00:00+00', 'monthly') ->> 'granted')::int = 1, 'December''s payment unlocks December');
select pg_temp.expect((select membership_year from public.club_entitlements where user_id = :M and resource_month = '2026-12-01' and kind = 'digital') = 1, 'still year 1');
select pg_temp.expect((select resource_month from public.club_entitlements where invoice_id = 'in_M2' and kind = 'physical') = '2027-01-01', 'paid Dec 2, before Sunday Dec 13: its mailing is January''s');

select pg_temp.sub('sub_M', 'cus_M', :M, 'past_due', 'monthly', '2027-01-02 15:00:00+00', '2027-02-02 15:00:00+00');
select pg_temp.expect((pg_temp.inv('in_M3', 'sub_M', 'open', 500, '2027-01-02 15:00:00+00', '2027-02-02 15:00:00+00', 'monthly') ->> 'granted')::int = 0, 'a failed January payment grants nothing');
select pg_temp.expect(not exists (select 1 from public.club_entitlements where user_id = :M and resource_month = '2027-01-01' and kind = 'digital'), 'no January access');
select pg_temp.expect(not exists (select 1 from public.club_entitlements where invoice_id = 'in_M3'), 'and no mailing from the failed payment');
select pg_temp.as_user('authenticated', :M);
select pg_temp.expect((public.club_me() ->> 'payment_problem')::boolean, 'the dashboard shows the payment problem');
select pg_temp.expect(public.club_document_get('2026-12-christmas-mission') ->> 'can' = 'edit', 'past_due: months she paid for stay editable while Stripe retries');
reset role;

select pg_temp.sub('sub_M', 'cus_M', :M, 'canceled', 'monthly', '2027-01-02 15:00:00+00', '2027-02-02 15:00:00+00');
select pg_temp.as_user('authenticated', :M);
select pg_temp.expect(public.club_document_get('2026-11-family-ownership') ->> 'can' = 'read', 'after cancelling, November stays (read and print)');
select pg_temp.expect(public.club_resource_get('2026-12-christmas-mission') ->> 'can' = 'read', 'and December');
select pg_temp.expect(pg_temp.fails($$select public.club_resource_save('2026-12-christmas-mission', '{}', 0)$$, 'read_only'), 'read-only once cancelled');
select pg_temp.expect((public.club_me() ->> 'access')::boolean = false, 'no live access');
reset role;

-- ---------------------------------------------------------------- annual member: twelve months at once, renewal

select public.club_member_link(:Y, 'annual@example.com', 'cus_Y', false);
select pg_temp.sub('sub_Y', 'cus_Y', :Y, 'active', 'annual', '2026-11-03 12:00:00+00', '2027-11-03 12:00:00+00');
select pg_temp.expect((pg_temp.inv('in_Y1', 'sub_Y', 'paid', 6000, '2026-11-03 12:00:00+00', '2027-11-03 12:00:00+00', 'annual') ->> 'granted')::int = 12, 'annual: twelve digital months at once');
select pg_temp.expect((select min(resource_month) = '2026-11-01' and max(resource_month) = '2027-10-01' and count(*) = 12 from public.club_entitlements where user_id = :Y and kind = 'digital'), 'November 2026 through October 2027');
select pg_temp.expect((select min(resource_month) = '2026-12-01' and max(resource_month) = '2027-11-01' and count(*) = 12 from public.club_entitlements where invoice_id = 'in_Y1' and kind = 'physical' and note is null), 'twelve consecutive mailings from the first open list: December 2026 through November 2027');
select pg_temp.expect((select count(*) from public.club_fulfillment_orders where user_id = :Y) = 13 and exists (select 1 from public.club_fulfillment_orders where user_id = :Y and resource_month = '2026-11-01'), 'plus November''s, by the launch exception');
select pg_temp.expect(not exists (select 1 from public.club_fulfillment_orders where user_id = :Y and late), 'none late');
select pg_temp.as_user('authenticated', :Y);
select pg_temp.expect(public.club_resource_get('2026-12-christmas-mission') ->> 'can' = 'edit', 'annual opens December now (published)');
select pg_temp.expect(pg_temp.fails($$select public.club_resource_get('2027-01-fresh-start-together')$$, 'not_found'), 'but not a kit that is still a draft');
select pg_temp.expect((select count(*) from jsonb_array_elements(public.club_me() -> 'months') r where r ->> 'state' in ('available', 'preparing')) = 12, 'her dashboard shows all twelve months as hers');
reset role;

select pg_temp.sub('sub_Y', 'cus_Y', :Y, 'active', 'annual', '2027-11-03 12:00:00+00', '2028-11-03 12:00:00+00');
select pg_temp.expect((pg_temp.inv('in_Y2', 'sub_Y', 'paid', 6000, '2027-11-03 12:00:00+00', '2028-11-03 12:00:00+00', 'annual') ->> 'granted')::int = 12, 'annual renewal grants the next collection');
select pg_temp.expect((select array_agg(distinct membership_year) from public.club_entitlements where invoice_id = 'in_Y2') = '{2}', 'as year 2 (its mailings too, into November 2028)');
select pg_temp.expect((select array_agg(distinct membership_year) from public.club_entitlements where invoice_id = 'in_Y1') = '{1}', 'year 1''s mailings stay year 1, through November 2027');
select pg_temp.expect((select kit_id from public.club_entitlements where user_id = :Y and resource_month = '2027-12-01' and kind = 'digital') = (select id from public.club_kits where slug = '2027-12-christmas-family-affair'), 'year 2 December is the year 2 edition');

-- Refund: the renewal is refunded in full → its twelve months go, year 1 stays.
select pg_temp.expect((public.club_invoice_refund('in_Y2', 1000) ->> 'full')::boolean = false, 'a partial refund is recorded');
select pg_temp.expect((select min(resource_month) = '2027-12-01' and max(resource_month) = '2028-11-01' and count(*) = 12 from public.club_entitlements where invoice_id = 'in_Y2' and kind = 'physical'), 'the renewal''s twelve mailings continue where year 1''s end, with no gap or double');
select pg_temp.expect((select count(*) from public.club_entitlements where user_id = :Y and revoked_at is null) = 49, 'and changes no access');
select pg_temp.expect((public.club_invoice_refund('in_Y2', 6000) ->> 'revoked')::int = 24, 'a full refund revokes exactly what its invoice granted');
select pg_temp.expect((select count(*) from public.club_entitlements where user_id = :Y and revoked_at is null) = 25, 'year 1 is untouched');
select pg_temp.expect((select count(*) from public.club_fulfillment_orders where user_id = :Y and status = 'canceled') = 12, 'its unmailed mailings are canceled');
select pg_temp.expect((public.club_invoice_refund('in_Y2', 6000) ->> 'revoked')::int = 0, 'a replayed refund changes nothing');
-- A refunded invoice replayed as paid grants nothing again.
select pg_temp.expect((pg_temp.inv('in_Y2', 'sub_Y', 'paid', 6000, '2027-11-03 12:00:00+00', '2028-11-03 12:00:00+00', 'annual') ->> 'granted')::int = 0, 'a refunded invoice can''t grant again');

-- Chargeback on the monthly member's December.
select pg_temp.expect((public.club_invoice_dispute('in_M2') ->> 'revoked')::int = 2, 'a dispute revokes that invoice''s month');
select pg_temp.expect(exists (select 1 from public.club_entitlements where user_id = :M and resource_month = '2026-11-01' and revoked_at is null), 'and leaves November');
select pg_temp.as_user('authenticated', :M);
select pg_temp.expect(pg_temp.fails($$select public.club_resource_get('2026-12-christmas-mission')$$, 'not_found'), 'December is closed after the chargeback');
reset role;

-- ---------------------------------------------------------------- profile, address, resource versions, approval

select pg_temp.as_user('authenticated', :Y);
select public.club_household_save('The Annuals', '{}', '[{"first_name":"Ann","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Bo","kind":"child","role":"child","birth_year":2018,"birth_month":3}]');
select pg_temp.expect(pg_temp.fails($$select public.club_address_save('{"name":"Ann","line1":"1 Elm","city":"Town","state":"NY","postal_code":"ABCDE"}')$$, 'invalid'), 'a bad ZIP is refused');
select pg_temp.expect(public.club_address_save('{"name":"Ann A","line1":"1 Elm St","city":"Town","state":"ny","postal_code":"10001"}') ->> 'state' = 'NY', 'she saves her mailing address');
select pg_temp.expect((select r -> 'mailing' ->> 'readiness' from jsonb_array_elements(public.club_me() -> 'months') r where r ->> 'month' = '2026-12-01') = 'needs_pdf', 'December''s mailing now waits only for its printable');
select pg_temp.expect(public.club_resource_save('2026-12-christmas-mission', '{"omc:club:dec":"{\"a\":1}"}', 0) = 1, 'she saves her December version');
select pg_temp.expect(pg_temp.fails($$select public.club_resource_save('2026-12-christmas-mission', '{}', 0)$$, 'conflict'), 'a stale tab can''t overwrite it');
select pg_temp.expect(public.club_resource_save('2026-12-christmas-mission', '{"omc:club:dec":"{\"a\":2}"}', 1) = 2, 'a current save works');
select pg_temp.expect(public.club_fulfillment_approve('2026-12-christmas-mission'), 'she approves it for printing');
select pg_temp.expect(public.club_resource_get('2026-12-christmas-mission') -> 'mailing' ->> 'approved' = 'true', 'approval shows on her page');
select public.club_household_save('The Annuals', '{}', '[{"first_name":"Ann","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Bo","kind":"child","role":"child","birth_year":2018,"birth_month":3},{"first_name":"Cy","kind":"child","role":"child","birth_year":2021}]');
select pg_temp.expect((public.club_household() ->> 'profile_version')::int = 3, 'family profile updates bump the profile version');
reset role;

-- ---------------------------------------------------------------- another household

select pg_temp.as_user('authenticated', :X);
select pg_temp.expect(pg_temp.fails($$select public.club_resource_get('2026-12-christmas-mission')$$, 'not_found'), 'a signed-in non-member can''t open a paid resource');
select pg_temp.expect(pg_temp.fails($$select public.club_resource_save('2026-12-christmas-mission', '{}', 0)$$, 'read_only'), 'or save one');
select pg_temp.expect(not exists (select 1 from public.club_entitlements), 'she reads nobody else''s entitlements');
select pg_temp.expect(not exists (select 1 from public.club_fulfillment_orders), 'or mailings');
select pg_temp.expect(not exists (select 1 from public.club_mailing_addresses), 'or addresses');
select pg_temp.expect(pg_temp.fails($$select * from public.club_resource_versions$$), 'resource versions are closed to direct reads');
select pg_temp.expect(pg_temp.fails($$select * from public.club_fulfillment_queue$$), 'the queue view is closed');
select pg_temp.expect(pg_temp.fails($$select * from public.club_secret$$), 'webhook secrets are closed');
select pg_temp.expect(pg_temp.fails($$select public.club_invoice_apply('{}', '[]')$$), 'billing functions are server-only');
select pg_temp.expect(pg_temp.fails($$select public.club_admin_members()$$), 'admin functions refuse a customer');
select pg_temp.expect(pg_temp.fails($$select public.club_admin_entitlement('00000000-0000-0000-0000-00000000f003', '2026-11-01', 'digital', 'grant', 'free')$$), 'she can''t grant herself a month');
select pg_temp.expect(pg_temp.fails($$select public.club_fulfillment_approve('2026-12-christmas-mission')$$, 'read_only'), 'or approve someone else''s mailing');
select pg_temp.expect(pg_temp.fails($$insert into public.club_entitlements (user_id, household_id, resource_month, kind, membership_year, plan, source, note) values ('00000000-0000-0000-0000-00000000f003', gen_random_uuid(), '2026-11-01', 'digital', 1, 'admin', 'admin', 'x')$$), 'no direct entitlement writes');
reset role;
select pg_temp.as_user('anon', null);
select pg_temp.expect(pg_temp.fails($$select public.club_resource_get('2026-11-family-ownership')$$), 'anon can''t read resources');
reset role;

-- ---------------------------------------------------------------- admin: queue, corrections, overrides, audit

select pg_temp.as_user('authenticated', :OWNER);
select pg_temp.expect(jsonb_array_length(public.club_admin_members('annual')) = 1, 'admin filters members by plan');
select pg_temp.expect(jsonb_array_length(public.club_admin_members('canceled')) >= 1, 'and canceled memberships');
select pg_temp.expect(jsonb_array_length(public.club_admin_members(null, '2027-10-01')) = 1, 'and by month');
select pg_temp.expect((select (x ->> 'children')::int from jsonb_array_elements(public.club_admin_members('annual')) x) = 2, 'member list shows profile counts, not children''s names');
create temp table dec_order as select (x ->> 'id')::uuid as id from jsonb_array_elements(public.club_admin_fulfillment('2026-12-01')) x where x ->> 'email' = 'annual@example.com';
select pg_temp.expect((select count(*) from dec_order) = 1, 'December''s fulfillment queue lists her');
select pg_temp.expect(pg_temp.fails($$select public.club_admin_set_fulfillment((select id from dec_order), 'approved')$$, 'not_ready'), 'can''t approve before the PDF is ready');
select public.club_admin_set_fulfillment((select id from dec_order), null, null, 'ready');
select pg_temp.expect(public.club_admin_set_fulfillment((select id from dec_order), 'approved') ->> 'address' like '%1 Elm St%', 'approved: the address is frozen');
select pg_temp.expect(pg_temp.fails($$select public.club_admin_set_fulfillment((select id from dec_order), 'mailed')$$, 'invalid_transition'), 'can''t mark mailed before printed');
select public.club_admin_set_fulfillment((select id from dec_order), 'printed');
select pg_temp.expect(public.club_admin_set_fulfillment((select id from dec_order), 'mailed') ->> 'readiness' = 'mailed', 'printed → mailed');
select pg_temp.expect(public.club_admin_fulfillment_bundle((select id from dec_order)) -> 'household' -> 'members' -> 0 ->> 'first_name' = 'Ann', 'the print bundle has the names for that one mailing');
select pg_temp.expect(pg_temp.fails($$select public.club_admin_entitlement('00000000-0000-0000-0000-00000000f003', '2026-11-01', 'digital', 'grant', 'goodwill')$$, 'no_household'), 'an override needs a household');
select pg_temp.expect(pg_temp.fails($$select public.club_admin_entitlement('00000000-0000-0000-0000-00000000f002', '2026-11-01', 'digital', 'grant', '')$$, 'invalid'), 'and a note');
select pg_temp.expect(public.club_admin_settings('{"member_review": true}') ->> 'member_review' = 'true', 'settings save through the API (an UPDATE with a WHERE: pg-safeupdate)');
select pg_temp.expect(public.club_admin_settings('{"cutoff_ordinal": -1, "cutoff_weekday": 6}') ->> 'cutoff_ordinal' = '-1', 'admin changes the rule (last Saturday)');
select pg_temp.expect((select mailer_cutoff_at from public.club_kits where month = '2027-02-01') = '2027-01-30 23:59:59-05', 'the kits'' cutoffs follow the new rule');
select pg_temp.expect((public.club_admin_cutoffs('2027-02-01', 1) -> 0 ->> 'cutoff_date') = '2027-01-30', 'and the admin schedule shows it');
select public.club_admin_settings('{"cutoff_ordinal": 2, "cutoff_weekday": 0}');
select pg_temp.expect(pg_temp.fails($$select public.club_admin_settings('{"cutoff_ordinal": 5}')$$, 'invalid'), 'no fifth weekday (it doesn''t exist every month)');
select pg_temp.expect(pg_temp.fails($$select public.club_admin_settings('{"cutoff_day": 15}')$$, 'invalid'), 'the old fixed day is gone');
select pg_temp.expect(pg_temp.fails($$select public.club_admin_settings('{"launch_exception_cutoff_at": "2026-10-10 12:00:00-04"}')$$, 'invalid'), 'a launch exception can''t close before the month''s regular cutoff');
select pg_temp.expect(pg_temp.fails($$select public.club_admin_settings('{"launch_exception_cutoff_at": "2026-12-01 00:00:00-05"}')$$, 'invalid'), 'or after its month starts the next');
select pg_temp.expect(pg_temp.fails($$select public.club_admin_settings('{"launch_exception_month": null}')$$, 'invalid'), 'month and deadline are cleared together');
select pg_temp.expect(public.club_admin_settings('{"launch_exception_month": null, "launch_exception_cutoff_at": null}') ->> 'launch_exception_month' is null, 'the exception can be switched off');
select pg_temp.expect((public.club_admin_cutoffs('2026-12-01', 1) -> 0 ->> 'cutoff_at')::timestamptz = '2026-11-08 23:59:59-05', 'without touching the rule');
select public.club_admin_settings('{"launch_exception_month": "2026-11-01", "launch_exception_cutoff_at": "2026-11-08 23:59:59-05"}');
select pg_temp.expect((public.club_admin_cutoffs('2026-11-01', 4) -> 0 ->> 'launch_exception_cutoff_at')::timestamptz = '2026-11-08 23:59:59-05', 'the schedule shows the exception on its month only');
select pg_temp.expect(pg_temp.fails($$select public.club_admin_settings('{"evil": 1}')$$, 'invalid'), 'only known settings');
reset role;
select pg_temp.expect((select count(*) from public.admin_audit_log where action like 'club.%') >= 6, 'every admin change is in the audit log');
select pg_temp.expect(exists (select 1 from public.admin_audit_log where action = 'club.fulfillment_open'), 'including opening a family''s names to print');

-- After mailing, she can't change what was printed.
select pg_temp.as_user('authenticated', :Y);
select pg_temp.expect(pg_temp.fails($$select public.club_resource_save('2026-12-christmas-mission', '{}', 2)$$, 'already_printed'), 'a printed mailing''s version is locked');
reset role;

-- One standard mailing per household and month, even from an admin grant on top of a paid month.
select public.club_admin_entitlement_service(:OWNER, :Y, '2027-03-01', 'physical', 'revoke', 'moving test');
select public.club_admin_entitlement_service(:OWNER, :Y, '2027-03-01', 'physical', 'grant', 'replacement');
select pg_temp.expect((select count(*) from public.club_fulfillment_orders where user_id = :Y and resource_month = '2027-03-01' and status <> 'canceled') = 1, 'one live mailing for March after revoke and re-grant');

-- Emails: each key once.
select pg_temp.expect(public.club_email_begin('welcome:test', 'welcome', :Y, 'annual@example.com') = 'new', 'first email claims its key');
select pg_temp.expect(public.club_email_begin('welcome:test', 'welcome', :Y, 'annual@example.com') = 'done', 'a retry doesn''t send twice');
select public.club_email_finish('welcome:test', 'failed', null, 'boom');
select pg_temp.expect(public.club_email_begin('welcome:test', 'welcome', :Y, 'annual@example.com') = 'new', 'a failed send may be retried');
select pg_temp.expect(jsonb_array_length(public.club_email_audience('resource_ready', '2026-12-01')) = 1, 'resource-ready audience: entitled members of a published month only');

-- Events: each id once.
select pg_temp.expect(public.club_stripe_event_begin('evt_1', 'invoice.paid') = 'new', 'event recorded');
select pg_temp.expect(public.club_stripe_event_begin('evt_1', 'invoice.paid') = 'retry', 'an unfinished event can be retried');
select public.club_stripe_event_done('evt_1');
select pg_temp.expect(public.club_stripe_event_begin('evt_1', 'invoice.paid') = 'done', 'a finished event is skipped');

-- A kit added later picks up its entitlements.
select pg_temp.expect((select count(*) from public.club_entitlements where resource_month = '2028-01-01' and kit_id is null) > 0, 'months without a kit yet');
insert into public.club_kits (slug, month, title, status, release_at, mailer_cutoff_at) values ('2028-01-test-kit', '2028-01-01', 'Test', 'draft', '2028-01-01', '2027-12-15');
select pg_temp.expect(not exists (select 1 from public.club_entitlements where resource_month = '2028-01-01' and kit_id is null), 'are linked when the kit is created');

-- ---------------------------------------------------------------- signups either side of a cutoff, the launch deadline

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000f101', 'before@example.com', now()), ('00000000-0000-0000-0000-00000000f102', 'after@example.com', now()),
  ('00000000-0000-0000-0000-00000000f103', 'launch-last@example.com', now()), ('00000000-0000-0000-0000-00000000f104', 'launch-late@example.com', now()),
  ('00000000-0000-0000-0000-00000000f105', 'leap@example.com', now());
create function pg_temp.join_(p_n int, p_plan text, p_paid timestamptz) returns jsonb language plpgsql as $$
declare u uuid := ('00000000-0000-0000-0000-00000000f1' || lpad(p_n::text, 2, '0'))::uuid;
begin
  perform public.club_member_link(u, (select email from auth.users where id = u), 'cus_c' || p_n, false);
  perform pg_temp.sub('sub_c' || p_n, 'cus_c' || p_n, u, 'active', p_plan, p_paid, p_paid + case when p_plan = 'annual' then interval '1 year' else interval '1 month' end);
  return pg_temp.inv('in_c' || p_n, 'sub_c' || p_n, 'paid', case when p_plan = 'annual' then 6000 else 500 end, p_paid,
    p_paid + case when p_plan = 'annual' then interval '1 year' else interval '1 month' end, p_plan, p_paid);
end $$;
create function pg_temp.mailings(p_n int) returns text language sql as $$
  select string_agg(to_char(resource_month, 'YYYY-MM'), ',' order by resource_month) from public.club_entitlements
   where invoice_id = 'in_c' || p_n and kind = 'physical' and revoked_at is null;
$$;
select pg_temp.join_(1, 'monthly', '2026-12-13 23:59:59-05');
select pg_temp.join_(2, 'monthly', '2026-12-14 00:00:00-05');
select pg_temp.expect(pg_temp.mailings(1) = '2027-01', 'joins one second before Sunday Dec 13 closes: January''s mailing');
select pg_temp.expect(pg_temp.mailings(2) = '2027-02', 'joins one second after: February''s, the next open list');
select pg_temp.expect((select count(*) from public.club_entitlements e join auth.users u on u.id = e.user_id
                        where u.email in ('before@example.com', 'after@example.com') and e.kind = 'digital' and e.resource_month = '2026-12-01') = 2,
  'both open December online at once: missing a cutoff never costs digital access');
select pg_temp.join_(3, 'monthly', '2026-11-08 23:59:59-05');
select pg_temp.join_(4, 'monthly', '2026-11-09 00:00:00-05');
select pg_temp.expect(pg_temp.mailings(3) = '2026-11,2026-12', 'founding family paid at the launch deadline: November (exception) and December (paid by Nov 8)');
select pg_temp.expect(pg_temp.mailings(4) = '2027-01', 'paid a second later: no November mailing, and December''s list has closed too: January''s');
select pg_temp.expect(exists (select 1 from public.club_entitlements e join auth.users u on u.id = e.user_id
                       where u.email = 'launch-late@example.com' and e.kind = 'digital' and e.resource_month = '2026-11-01' and e.revoked_at is null),
  'and she still has November online');
select pg_temp.join_(5, 'annual', '2028-02-13 23:59:59-05');
select pg_temp.expect(pg_temp.mailings(5) = '2028-03,2028-04,2028-05,2028-06,2028-07,2028-08,2028-09,2028-10,2028-11,2028-12,2029-01,2029-02',
  'leap year: annual paid at Sunday Feb 13, 2028''s cutoff gets twelve mailings from March 2028, no exception outside November 2026');
select pg_temp.expect((select (public.club_invoice_dispute('in_c3') ->> 'revoked')::int) = 3, 'a dispute revokes the launch mailing with the rest of that invoice');
select pg_temp.expect(pg_temp.mailings(3) is null, 'nothing of it left');

-- No public function may UPDATE or DELETE without a WHERE: Supabase's API connections load pg-safeupdate, which
-- refuses them ("UPDATE requires a WHERE clause"), and that's what broke the Setup page.
select pg_temp.expect(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
       lateral regexp_split_to_table(regexp_replace(p.prosrc, '--[^\n]*', '', 'g'), ';') stmt
   where n.nspname = 'public' and p.prolang in (select oid from pg_language where lanname in ('sql', 'plpgsql'))
     and stmt ~* '(^|[^a-z_])(update\s+(only\s+)?[a-z_."]+(\s+as)?(\s+[a-z_]+)?\s+set\s|delete\s+from\s)'
     and stmt !~* '\mwhere\M'),
  'every UPDATE and DELETE in a public function has a WHERE');

select pg_temp.expect(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'club\_%' and has_function_privilege('anon', p.oid, 'execute')),
  'anon can execute no club_ function');
