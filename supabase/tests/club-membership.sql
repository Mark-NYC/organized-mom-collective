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

-- The first-month-free migration (20261107000000) as shipped: the 2027 program, the offer on, the plain second-Sunday rule.
select pg_temp.expect((select program_start_month = '2027-01-01' and intro_offer and launch_exception_month is null
  and launch_exception_cutoff_at is null from public.club_settings), 'the program starts January 2027, the free first month is on, no cutoff exceptions');
select pg_temp.expect(not has_table_privilege('authenticated', 'public.club_intro_claims', 'select') and not has_table_privilege('anon', 'public.club_intro_claims', 'select')
  and not has_function_privilege('authenticated', 'public.club_intro_grant(text, text)', 'execute'), 'free-month claims and grants are server-side only');
select pg_temp.expect((select count(*) = 12 from public.club_kits where month between '2027-01-01' and '2027-12-01'), 'the 2027 program has twelve kits');
-- These scenarios run as after the program has started, with the November 2026 founding-batch exception they were
-- written for. Founding enrollment (paid before the program) is tested in tests/club-billing-e2e.test.ts.
update public.club_settings set program_start_month = '2026-10-01', launch_exception_month = '2026-11-01',
  launch_exception_cutoff_at = '2026-11-08 23:59:59-05' where id;

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
select pg_temp.expect((select array_agg(resource_month::text || ':' || kind order by kind, resource_month) from public.club_entitlements where user_id = :M) = '{2026-11-01:digital,2026-11-01:physical}', 'a Nov 2 founding joiner: November online and November''s printed copy, one obligation (no bonus month)');
select pg_temp.expect((select membership_year from public.club_entitlements where user_id = :M and kind = 'digital') = 1, 'membership year 1');
select pg_temp.expect((select invoice_id from public.club_entitlements where user_id = :M and kind = 'digital') = 'in_M1', 'the entitlement records the paid invoice that granted it');
select pg_temp.expect((select kit_id from public.club_entitlements where user_id = :M and kind = 'digital') = (select id from public.club_kits where slug = '2026-11-family-ownership'), 'and the exact resource edition');
select pg_temp.expect((select first_paid_month from public.club_households where owner_user_id = :M) = '2026-11-01' and (select enrolled_at from public.club_households where owner_user_id = :M) is not null, 'enrollment date and first paid month recorded');
select pg_temp.expect((select not late from public.club_fulfillment_orders where user_id = :M and fulfillment_type = 'monthly_resource'), 'paid before the Nov 8 founding deadline: the regular November batch');
select pg_temp.expect((select cutoff_at from public.club_fulfillment_orders where user_id = :M and fulfillment_type = 'monthly_resource') = '2026-11-08 23:59:59-05', 'its order records the founding deadline');
select pg_temp.expect((select status = 'pending' and satisfies_month is null and invoice_id = 'in_M1' from public.club_fulfillment_orders where user_id = :M and fulfillment_type = 'welcome_vision'), 'and her welcome print is waiting for her (extra in November)');
drop table r;

-- Duplicate and out-of-order deliveries
select pg_temp.inv('in_M1', 'sub_M', 'paid', 500, '2026-11-02 15:00:00+00', '2026-12-02 15:00:00+00', 'monthly');
select pg_temp.inv('in_M1', 'sub_M', 'paid', 500, '2026-11-02 15:00:00+00', '2026-12-02 15:00:00+00', 'monthly');
select pg_temp.expect((select count(*) from public.club_entitlements where user_id = :M) = 2, 'replayed invoice.paid: no duplicate access');
select pg_temp.expect((select count(*) from public.club_fulfillment_orders where user_id = :M) = 2, 'and no duplicate mailing or second welcome print');
select pg_temp.expect((pg_temp.inv('in_M1', 'sub_M', 'paid', 500, '2026-11-02 15:00:00+00', '2026-12-02 15:00:00+00', 'monthly') ->> 'first_paid')::boolean = false, 'and no second welcome');
select pg_temp.sub('sub_M', 'cus_M', :M, 'incomplete', 'monthly', '2026-11-02 15:00:00+00', '2026-12-02 15:00:00+00');
select pg_temp.sub('sub_M', 'cus_M', :M, 'active', 'monthly', '2026-11-02 15:00:00+00', '2026-12-02 15:00:00+00');
select pg_temp.expect((select count(*) from public.club_entitlements where user_id = :M and revoked_at is null) = 2, 'a late, stale subscription event changes no access');

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
select pg_temp.expect(not exists (select 1 from me, jsonb_array_elements(j -> 'months') r where r ->> 'month' = '2026-12-01'), 'December isn''t listed until she pays for it');
select pg_temp.expect((select j -> 'next' ->> 'month' from me) = '2026-12-01' and (select (j -> 'next' ->> 'payment_on')::timestamptz from me) = '2026-12-02 15:00:00+00', 'next: December, with her Dec 2 payment');
select pg_temp.expect((select j -> 'welcome' ->> 'readiness' from me) = 'needs_vision', 'her welcome print waits for her personalization');
select pg_temp.expect((select r -> 'mailing' ->> 'readiness' from me, jsonb_array_elements(j -> 'months') r where r ->> 'month' = '2026-11-01') = 'needs_profile', 'mailing waits for her family profile');
select pg_temp.expect((select (j ->> 'onboarded')::boolean from me) = false, 'account without completed onboarding is reported as such');
drop table me;
reset role;

-- ---------------------------------------------------------------- recurring payment, failure, cancellation

select pg_temp.sub('sub_M', 'cus_M', :M, 'active', 'monthly', '2026-12-02 15:00:00+00', '2027-01-02 15:00:00+00');
select pg_temp.expect((pg_temp.inv('in_M2', 'sub_M', 'paid', 500, '2026-12-02 15:00:00+00', '2027-01-02 15:00:00+00', 'monthly') ->> 'granted')::int = 1, 'December''s payment unlocks December');
select pg_temp.expect((select membership_year from public.club_entitlements where user_id = :M and resource_month = '2026-12-01' and kind = 'digital') = 1, 'still year 1');
select pg_temp.expect((select resource_month from public.club_entitlements where invoice_id = 'in_M2' and kind = 'physical') = '2026-12-01', 'its printed copy is December''s Christmas resource');
select pg_temp.expect((select late from public.club_fulfillment_orders where user_id = :M and resource_month = '2026-12-01' and fulfillment_type = 'monthly_resource'), 'paid Dec 2, after December''s list closed (Nov 8): the December catch-up batch, not lost');

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
select pg_temp.expect((select min(resource_month) = '2026-11-01' and max(resource_month) = '2027-10-01' and count(*) = 12 from public.club_entitlements where invoice_id = 'in_Y1' and kind = 'physical'), 'twelve printed copies, the same twelve months');
select pg_temp.expect((select count(*) from public.club_fulfillment_orders where user_id = :Y and fulfillment_type = 'monthly_resource') = 12
  and (select count(*) from public.club_fulfillment_orders where user_id = :Y and fulfillment_type = 'welcome_vision') = 1, 'twelve monthly mailings (never thirteen) plus the one welcome print');
select pg_temp.expect(not exists (select 1 from public.club_fulfillment_orders where user_id = :Y and late), 'none late');
select pg_temp.as_user('authenticated', :Y);
select pg_temp.expect(public.club_resource_get('2026-12-christmas-mission') ->> 'can' = 'edit', 'annual opens December now (published)');
select pg_temp.expect(pg_temp.fails($$select public.club_resource_get('2027-01-fresh-start-together')$$, 'not_found'), 'but not a kit that is still a draft');
select pg_temp.expect((select count(*) from jsonb_array_elements(public.club_me() -> 'months') r where r ->> 'state' in ('available', 'preparing')) = 12, 'her dashboard shows all twelve months as hers');
reset role;

select pg_temp.sub('sub_Y', 'cus_Y', :Y, 'active', 'annual', '2027-11-03 12:00:00+00', '2028-11-03 12:00:00+00');
select pg_temp.expect((pg_temp.inv('in_Y2', 'sub_Y', 'paid', 6000, '2027-11-03 12:00:00+00', '2028-11-03 12:00:00+00', 'annual') ->> 'granted')::int = 12, 'annual renewal grants the next collection');
select pg_temp.expect((select array_agg(distinct membership_year) from public.club_entitlements where invoice_id = 'in_Y2') = '{2}', 'as year 2');
select pg_temp.expect((select array_agg(distinct membership_year) from public.club_entitlements where invoice_id = 'in_Y1') = '{1}', 'year 1 stays year 1');
select pg_temp.expect((select kit_id from public.club_entitlements where user_id = :Y and resource_month = '2027-12-01' and kind = 'digital') = (select id from public.club_kits where slug = '2027-12-christmas-family-affair'), 'year 2 December is the year 2 edition');

-- Refund: the renewal is refunded in full → its twelve months go, year 1 stays.
select pg_temp.expect((public.club_invoice_refund('in_Y2', 1000) ->> 'full')::boolean = false, 'a partial refund is recorded');
select pg_temp.expect((select min(resource_month) = '2027-11-01' and max(resource_month) = '2028-10-01' and count(*) = 12 from public.club_entitlements where invoice_id = 'in_Y2' and kind = 'physical'), 'the renewal''s twelve continue where year 1''s end, with no gap or double');
select pg_temp.expect((select count(*) from public.club_fulfillment_orders where user_id = :Y and fulfillment_type = 'welcome_vision') = 1, 'and the renewal adds no welcome print');
select pg_temp.expect((select count(*) from public.club_entitlements where user_id = :Y and revoked_at is null) = 48, 'and changes no access');
select pg_temp.expect((public.club_invoice_refund('in_Y2', 6000) ->> 'revoked')::int = 24, 'a full refund revokes exactly what its invoice granted');
select pg_temp.expect((select count(*) from public.club_entitlements where user_id = :Y and revoked_at is null) = 24, 'year 1 is untouched');
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

-- ---------------------------------------------------------------- signup scenarios: welcome print, December, cutoffs

insert into auth.users (id, email, email_confirmed_at)
select ('00000000-0000-0000-0000-00000000f1' || lpad(n::text, 2, '0'))::uuid, 'c' || n || '@example.com', now() from generate_series(1, 14) n;
create function pg_temp.u(p_n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000f1' || lpad(p_n::text, 2, '0'))::uuid $$;
-- Her subscription's next paid period (invoice in_cNxK), as the webhook would apply it.
create function pg_temp.pay(p_n int, p_k int, p_plan text, p_start timestamptz, p_status text default 'paid') returns jsonb language plpgsql as $$
declare e timestamptz := p_start + case when p_plan = 'annual' then interval '1 year' else interval '1 month' end;
begin
  perform pg_temp.sub('sub_c' || p_n, 'cus_c' || p_n, pg_temp.u(p_n), case when p_status = 'paid' then 'active' else 'past_due' end, p_plan, p_start, e);
  return pg_temp.inv('in_c' || p_n || 'x' || p_k, 'sub_c' || p_n, p_status, case when p_plan = 'annual' then 6000 else 500 end, p_start, e, p_plan, p_start);
end $$;
create function pg_temp.join_(p_n int, p_plan text, p_paid timestamptz) returns jsonb language plpgsql as $$
begin
  perform public.club_member_link(pg_temp.u(p_n), 'c' || p_n || '@example.com', 'cus_c' || p_n, false);
  return pg_temp.pay(p_n, 1, p_plan, p_paid);
end $$;
-- Her live digital months as 'YYYY-MM:fulfilled_by'.
create function pg_temp.months(p_n int) returns text language sql as $$
  select string_agg(to_char(resource_month, 'YYYY-MM') || case when fulfilled_by = 'welcome_vision' then ':welcome' else '' end, ',' order by resource_month)
    from public.club_entitlements where user_id = pg_temp.u(p_n) and kind = 'digital' and revoked_at is null;
$$;
-- Her live monthly mailings as 'YYYY-MM:batch'.
create function pg_temp.mail(p_n int) returns text language sql as $$
  select string_agg(to_char(resource_month, 'YYYY-MM') || ':' || case when late then 'catch_up' else 'regular' end, ',' order by resource_month)
    from public.club_fulfillment_orders where user_id = pg_temp.u(p_n) and fulfillment_type = 'monthly_resource' and status <> 'canceled';
$$;
create function pg_temp.welcome(p_n int) returns public.club_fulfillment_orders language sql as $$
  select * from public.club_fulfillment_orders where user_id = pg_temp.u(p_n) and fulfillment_type = 'welcome_vision' and status <> 'canceled';
$$;

-- November, at and after the founding deadline (Sunday Nov 8, 23:59:59 New York).
select pg_temp.join_(3, 'monthly', '2026-11-08 23:59:59-05');
select pg_temp.join_(4, 'monthly', '2026-11-09 00:00:00-05');
select pg_temp.expect(pg_temp.months(3) = '2026-11' and pg_temp.mail(3) = '2026-11:regular', 'founding family paid at the deadline: November, in the regular founding batch');
select pg_temp.expect((select cutoff_at from public.club_fulfillment_orders where user_id = pg_temp.u(3) and fulfillment_type = 'monthly_resource') = '2026-11-08 23:59:59-05', 'its order records the founding deadline it met');
select pg_temp.expect(pg_temp.months(4) = '2026-11' and pg_temp.mail(4) = '2026-11:catch_up', 'a second later: November is still paid and still owed, in the catch-up batch, never a different month');
select pg_temp.expect((pg_temp.welcome(3)).id is not null and (pg_temp.welcome(4)).id is not null, 'both get the welcome print');
select pg_temp.expect((pg_temp.welcome(4)).satisfies_month is null and (pg_temp.welcome(4)).cutoff_at is null, 'a November welcome print is extra, with no monthly cutoff');

-- Annual, either side of January's cutoff (Sunday Dec 13): a December first month either way.
select pg_temp.join_(1, 'annual', '2026-12-13 23:59:59-05');
select pg_temp.join_(2, 'annual', '2026-12-14 00:00:00-05');
select pg_temp.expect(split_part(pg_temp.mail(1), ',', 1) = '2027-01:regular', 'paid one second before January''s list closes: January in the regular batch');
select pg_temp.expect(split_part(pg_temp.mail(2), ',', 1) = '2027-01:catch_up', 'one second after: January in its catch-up batch');
select pg_temp.expect(split_part(pg_temp.mail(2), ',', 2) = '2027-02:regular', 'and February regular again');

-- December first-time members: the welcome print IS December.
select pg_temp.join_(6, 'monthly', '2026-12-05 15:00:00+00');
select pg_temp.expect(pg_temp.months(6) = '2026-12:welcome', 'a December joiner''s December is fulfilled by the welcome print');
select pg_temp.expect((select kit_id from public.club_entitlements where user_id = pg_temp.u(6) and resource_month = '2026-12-01' and kind = 'digital') is null, 'and names no Christmas kit');
select pg_temp.expect(pg_temp.mail(6) is null, 'no December monthly mailing');
select pg_temp.expect((pg_temp.welcome(6)).satisfies_month = '2026-12-01'
  and (pg_temp.welcome(6)).entitlement_id = (select id from public.club_entitlements where user_id = pg_temp.u(6) and resource_month = '2026-12-01' and kind = 'physical' and revoked_at is null),
  'the welcome order is December''s paid printed obligation (one order, not two)');
select pg_temp.as_user('authenticated', pg_temp.u(6)::text);
select pg_temp.expect(pg_temp.fails($$select public.club_resource_get('2026-12-christmas-mission')$$, 'not_found'), 'she doesn''t also get the Christmas activity');
select pg_temp.expect((select r ->> 'state' from jsonb_array_elements(public.club_me() -> 'months') r where r ->> 'month' = '2026-12-01') = 'welcome_vision', 'her dashboard shows the print as her December');
select pg_temp.expect(jsonb_array_length(public.club_me() -> 'months') = 1, 'and only the months she bought');
select pg_temp.expect(public.club_me() -> 'next' ->> 'month' = '2027-01-01', 'next: January, with her January payment');
reset role;
select pg_temp.expect(not exists (select 1 from jsonb_array_elements(public.club_email_audience('resource_ready', '2026-12-01')) x where x ->> 'user_id' = pg_temp.u(6)::text), 'no "December is ready" email for the Christmas activity');
select pg_temp.pay(6, 2, 'monthly', '2027-01-05 15:00:00+00');
select pg_temp.expect(pg_temp.months(6) = '2026-12:welcome,2027-01' and pg_temp.mail(6) = '2027-01:catch_up', 'her January payment: January''s resource, catch-up batch (paid after Dec 13)');
select pg_temp.expect((select count(*) from public.club_fulfillment_orders where user_id = pg_temp.u(6) and fulfillment_type = 'welcome_vision') = 1, 'no second welcome print on renewal');

select pg_temp.join_(7, 'annual', '2026-12-05 15:00:00+00');
select pg_temp.expect(pg_temp.months(7) = '2026-12:welcome,2027-01,2027-02,2027-03,2027-04,2027-05,2027-06,2027-07,2027-08,2027-09,2027-10,2027-11', 'annual from December: twelve obligations, December by the welcome print');
select pg_temp.expect((select count(*) from public.club_fulfillment_orders where user_id = pg_temp.u(7) and fulfillment_type = 'monthly_resource' and status <> 'canceled') = 11
  and (pg_temp.welcome(7)).satisfies_month = '2026-12-01', 'eleven monthly mailings plus the welcome print: twelve, never thirteen');
select pg_temp.pay(7, 2, 'annual', '2027-12-05 15:00:00+00');
select pg_temp.expect((select fulfilled_by = 'monthly_resource' and kit_id = (select id from public.club_kits where slug = '2027-12-christmas-family-affair')
                         from public.club_entitlements where user_id = pg_temp.u(7) and resource_month = '2027-12-01' and kind = 'digital' and revoked_at is null),
  'a year later her December is the Christmas resource: only the original first month is substituted');
select pg_temp.expect((select count(*) from public.club_fulfillment_orders where user_id = pg_temp.u(7) and fulfillment_type = 'welcome_vision') = 1, 'and still one welcome print');

-- An existing member (joined November) gets the December Christmas resource.
select pg_temp.expect((select fulfilled_by = 'monthly_resource' and kit_id = (select id from public.club_kits where slug = '2026-12-christmas-mission')
                         from public.club_entitlements where user_id = :Y and resource_month = '2026-12-01' and kind = 'digital'), 'November joiner: December is the Christmas resource');
select pg_temp.expect(exists (select 1 from public.club_fulfillment_orders where user_id = :Y and resource_month = '2026-12-01' and fulfillment_type = 'monthly_resource'), 'with its December mailing');

-- January joiner, eleven monthly renewals: one resource per paid month, Christmas in December 2027.
select pg_temp.join_(8, 'monthly', '2027-01-15 15:00:00+00');
select pg_temp.pay(8, k + 1, 'monthly', '2027-01-15 15:00:00+00'::timestamptz + make_interval(months => k)) from generate_series(1, 11) k;
select pg_temp.expect(pg_temp.months(8) = '2027-01,2027-02,2027-03,2027-04,2027-05,2027-06,2027-07,2027-08,2027-09,2027-10,2027-11,2027-12', 'twelve monthly payments: twelve consecutive months, no gaps or doubles');
select pg_temp.expect(pg_temp.mail(8) like '%2027-12:catch_up', 'December 2027 is the Christmas resource (her original first month is January)');
select pg_temp.expect((select count(*) from public.club_fulfillment_orders where user_id = pg_temp.u(8)) = 13, 'twelve monthly mailings and one welcome print');
select pg_temp.expect((select count(*) from public.club_fulfillment_orders where user_id = pg_temp.u(8) and late) = 12, 'every monthly renewal is paid after its month''s list closed: all in catch-up batches, none lost');

-- Monthly → annual mid-January: the twelve paid months start with the first month not already bought.
select pg_temp.join_(9, 'monthly', '2027-01-15 15:00:00+00');
select pg_temp.pay(9, 2, 'annual', '2027-01-20 15:00:00+00');
select pg_temp.expect(pg_temp.months(9) = '2027-01,2027-02,2027-03,2027-04,2027-05,2027-06,2027-07,2027-08,2027-09,2027-10,2027-11,2027-12,2028-01', 'January (monthly) + twelve new months (annual): thirteen paid months, January not sold twice');
select pg_temp.pay(9, 3, 'annual', '2028-01-20 15:00:00+00');
select pg_temp.expect(split_part(pg_temp.months(9), ',', 14) = '2028-02' and array_length(string_to_array(pg_temp.months(9), ','), 1) = 25, 'the annual renewal continues with February 2028');
select pg_temp.expect((select count(*) from public.club_fulfillment_orders where user_id = pg_temp.u(9) and fulfillment_type = 'welcome_vision') = 1, 'plan changes don''t add a welcome print');

-- A billing anchor near midnight across daylight time still buys consecutive months.
select pg_temp.join_(10, 'monthly', '2027-02-01 04:30:00+00');
select pg_temp.pay(10, 2, 'monthly', '2027-03-01 04:30:00+00');
select pg_temp.pay(10, 3, 'monthly', '2027-04-01 04:30:00+00');
select pg_temp.expect(pg_temp.months(10) = '2027-01,2027-02,2027-03', 'Jan 31 11:30 pm, Feb 28 11:30 pm, Apr 1 12:30 am New York: January, February, March (no skipped March)');

-- A failed first payment: no access, no welcome print. Paid later: both.
select public.club_member_link(pg_temp.u(11), 'c11@example.com', 'cus_c11', false);
select pg_temp.pay(11, 1, 'monthly', '2027-02-10 15:00:00+00', 'open');
select pg_temp.expect(pg_temp.months(11) is null and (pg_temp.welcome(11)).id is null, 'an unpaid first invoice: no months, no welcome print');
select pg_temp.pay(11, 1, 'monthly', '2027-02-10 15:00:00+00');
select pg_temp.expect(pg_temp.months(11) = '2027-02' and (pg_temp.welcome(11)).id is not null, 'paid on retry: February and the welcome print');
select pg_temp.pay(11, 1, 'monthly', '2027-02-10 15:00:00+00');
select pg_temp.expect((select count(*) from public.club_fulfillment_orders where user_id = pg_temp.u(11)) = 2, 'a replayed invoice.paid: still one month and one welcome print');

-- A duplicate subscription (second checkout, canceled and refunded by the webhook) grants nothing.
select public.club_member_link(pg_temp.u(12), 'c12@example.com', 'cus_c12', false);
select pg_temp.sub('sub_c12', 'cus_c12', pg_temp.u(12), 'active', 'monthly', '2027-02-10 15:00:00+00', '2027-03-10 15:00:00+00');
select public.club_subscription_flag('sub_c12', 'duplicate');
select pg_temp.expect((pg_temp.inv('in_c12x1', 'sub_c12', 'paid', 500, '2027-02-10 15:00:00+00', '2027-03-10 15:00:00+00', 'monthly') ->> 'granted')::int = 0
  and (pg_temp.welcome(12)).id is null, 'a duplicate subscription''s paid invoice: no months, no welcome print');

-- Refund / dispute of a first invoice cancels its unprinted welcome print with its month.
select pg_temp.expect((public.club_invoice_dispute('in_c3x1') ->> 'revoked')::int = 2, 'a dispute revokes that invoice''s month (online and printed)');
select pg_temp.expect(pg_temp.months(3) is null and pg_temp.mail(3) is null and (pg_temp.welcome(3)).id is null, 'and cancels the welcome print it created');
select pg_temp.expect((public.club_invoice_refund('in_c6x2', 500) ->> 'revoked')::int = 2 and (pg_temp.welcome(6)).id is not null, 'refunding a renewal leaves the welcome print (it came with the first payment)');

-- Cancellation keeps everything already paid for, the welcome print included.
select pg_temp.sub('sub_c8', 'cus_c8', pg_temp.u(8), 'canceled', 'monthly', '2027-12-15 15:00:00+00', '2028-01-15 15:00:00+00');
select pg_temp.expect(array_length(string_to_array(pg_temp.months(8), ','), 1) = 12 and (pg_temp.welcome(8)).id is not null, 'cancelling keeps her twelve months and her welcome print');

-- Personalizing and approving the welcome print (now, or days later: the order waits, pending).
select pg_temp.as_user('authenticated', pg_temp.u(6)::text);
select pg_temp.expect(public.club_welcome_get() ->> 'readiness' = 'needs_vision', 'a month after joining, her welcome print still waits for her');
select pg_temp.expect(pg_temp.fails($$select public.club_welcome_approve()$$, 'incomplete'), 'it can''t be approved before she personalizes it');
select pg_temp.expect(pg_temp.fails($$select public.club_welcome_save('{"family_name": "The Decembers", "value": "Money"}')$$, 'invalid'), 'only the print''s own choices');
select pg_temp.expect(pg_temp.fails($$select public.club_welcome_save('{"family_name": " ", "value": "Joy"}')$$, 'invalid'), 'and a family name');
select pg_temp.expect(public.club_welcome_save('{"family_name": "  The Decembers ", "value": "Joy", "extra": 1}') -> 'personalization' = '{"family_name": "The Decembers", "value": "Joy"}', 'her family name and value are saved, trimmed, nothing else');
select pg_temp.expect(public.club_welcome_get() ->> 'readiness' = 'needs_vision', 'still waiting for her approval');
select pg_temp.expect((public.club_welcome_approve() ->> 'approved')::boolean, 'she approves the print');
create temp table w1 as select member_approved_at from public.club_fulfillment_orders where user_id = pg_temp.u(6) and fulfillment_type = 'welcome_vision';
select public.club_welcome_approve();
select pg_temp.expect((select member_approved_at from public.club_fulfillment_orders where user_id = pg_temp.u(6) and fulfillment_type = 'welcome_vision') = (select member_approved_at from w1), 'a second click changes nothing');
select pg_temp.expect(public.club_welcome_get() ->> 'readiness' = 'needs_address', 'it goes to the queue as soon as we have her address');
select public.club_address_save('{"name":"Dee Dec","line1":"5 Pine Rd","city":"Town","state":"NJ","postal_code":"07001"}');
select pg_temp.expect(public.club_welcome_get() ->> 'readiness' = 'needs_pdf', 'then it needs only its print-ready PDF, whatever the date');
select public.club_welcome_save('{"family_name": "The Decembers", "value": "Hope"}');
select pg_temp.expect((public.club_welcome_get() ->> 'approved')::boolean = false, 'changing it after approval asks her to approve again');
select public.club_welcome_approve();
reset role;
select pg_temp.as_user('authenticated', :OWNER);
create temp table wq as select x from jsonb_array_elements(public.club_admin_welcome_queue()) x where x ->> 'email' = 'c6@example.com';
select pg_temp.expect((select x ->> 'vision_value' from wq) = 'Hope' and (select x ->> 'batch' from wq) = 'welcome' and (select x ->> 'satisfies_month' from wq) = '2026-12-01', 'the admin welcome queue: her choice, and that it''s her December');
select public.club_admin_set_fulfillment(((select x ->> 'id' from wq))::uuid, null, null, 'ready');
select pg_temp.expect(public.club_admin_set_fulfillment(((select x ->> 'id' from wq))::uuid, 'approved') ->> 'address' like '%5 Pine Rd%', 'PDF ready → approved for print, address frozen');
select pg_temp.expect(public.club_admin_member_months(pg_temp.u(6)) -> 'months' -> 0 ->> 'fulfilled_by' = 'welcome_vision', 'the admin sees which resource fulfills each paid month');
reset role;
select pg_temp.as_user('authenticated', pg_temp.u(6)::text);
select pg_temp.expect(pg_temp.fails($$select public.club_welcome_save('{"family_name": "The Decembers", "value": "Joy"}')$$, 'locked'), 'once it''s approved for print it can''t change');
reset role;
select pg_temp.as_user('authenticated', :X);
select pg_temp.expect(pg_temp.fails($$select public.club_welcome_save('{"family_name": "Mine", "value": "Joy"}')$$, 'not_found'), 'a non-member has no welcome print to change');
select pg_temp.expect(pg_temp.fails($$select public.club_admin_welcome_queue()$$), 'or the admin queue');
reset role;

-- Across every household: exactly one regular resource obligation per paid month, December substitution applied.
select pg_temp.expect(not exists (select 1 from public.club_entitlements where revoked_at is null group by user_id, resource_month, kind having count(*) > 1), 'one live right per member, month and kind');
select pg_temp.expect(not exists (
  select 1 from public.club_entitlements d where d.kind = 'digital' and d.revoked_at is null and d.source = 'invoice'
     and d.resource_month >= (select first_mailing_month from public.club_settings)
     and (select count(*) from public.club_entitlements p where p.user_id = d.user_id and p.resource_month = d.resource_month and p.kind = 'physical'
            and p.revoked_at is null and p.fulfilled_by = d.fulfilled_by and (p.invoice_id = d.invoice_id or p.source = 'admin')) <> 1),
  'every paid month has exactly one printed obligation (from the same payment, or an admin replacement)');
select pg_temp.expect(not exists (
  select 1 from public.club_entitlements p where p.kind = 'physical' and p.revoked_at is null
     and (select count(*) from public.club_fulfillment_orders o where o.entitlement_id = p.id and o.status <> 'canceled'
            and o.fulfillment_type = case when p.fulfilled_by = 'welcome_vision' then 'welcome_vision' else 'monthly_resource' end) <> 1), 'and exactly one order fulfills it: the monthly mailing, or the welcome print for a first December');
select pg_temp.expect(not exists (select 1 from public.club_entitlements where fulfilled_by = 'welcome_vision' and (extract(month from resource_month) <> 12
  or resource_month <> (select h.first_paid_month from public.club_households h where h.id = household_id))), 'only an original first December is ever substituted');
select pg_temp.expect(not exists (select 1 from public.club_fulfillment_orders where fulfillment_type = 'welcome_vision' and status <> 'canceled' group by household_id having count(*) > 1), 'one welcome print per household');
select pg_temp.expect(not exists (select 1 from public.club_households h where h.first_paid_month is not null
  and exists (select 1 from public.club_entitlements e where e.household_id = h.id and e.source = 'invoice' and e.resource_month < h.first_paid_month)), 'no month before she joined is ever granted');

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
