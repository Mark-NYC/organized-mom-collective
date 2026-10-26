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
select pg_temp.expect(public.club_cutoff_at('2027-02-01') = (select mailer_cutoff_at from public.club_kits where month = '2027-02-01'), 'a kit''s own cutoff wins');
select pg_temp.expect(public.club_cutoff_at('2028-03-01') = '2028-02-15 23:59:59 America/New_York'::timestamptz, 'a month with no kit uses the cutoff day');

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
select pg_temp.expect((select array_agg(resource_month::text || ':' || kind order by kind) from public.club_entitlements where user_id = :M) = '{2026-11-01:digital,2026-11-01:physical}', 'a November joiner gets November, digital and physical, not January–October');
select pg_temp.expect((select membership_year from public.club_entitlements where user_id = :M and kind = 'digital') = 1, 'membership year 1');
select pg_temp.expect((select invoice_id from public.club_entitlements where user_id = :M and kind = 'digital') = 'in_M1', 'the entitlement records the paid invoice that granted it');
select pg_temp.expect((select kit_id from public.club_entitlements where user_id = :M and kind = 'digital') = (select id from public.club_kits where slug = '2026-11-family-ownership'), 'and the exact resource edition');
select pg_temp.expect((select first_paid_month from public.club_households where owner_user_id = :M) = '2026-11-01' and (select enrolled_at from public.club_households where owner_user_id = :M) is not null, 'enrollment date and first paid month recorded');
select pg_temp.expect((select late from public.club_fulfillment_orders where user_id = :M) = true, 'paid after November''s cutoff: the mailing is still owed, flagged late');
drop table r;

-- Duplicate and out-of-order deliveries
select pg_temp.inv('in_M1', 'sub_M', 'paid', 500, '2026-11-02 15:00:00+00', '2026-12-02 15:00:00+00', 'monthly');
select pg_temp.inv('in_M1', 'sub_M', 'paid', 500, '2026-11-02 15:00:00+00', '2026-12-02 15:00:00+00', 'monthly');
select pg_temp.expect((select count(*) from public.club_entitlements where user_id = :M) = 2, 'replayed invoice.paid: no duplicate access');
select pg_temp.expect((select count(*) from public.club_fulfillment_orders where user_id = :M) = 1, 'and no duplicate mailing order');
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
select pg_temp.expect((select r ->> 'state' from me, jsonb_array_elements(j -> 'months') r where r ->> 'month' = '2026-12-01') = 'locked', 'December locked');
select pg_temp.expect((select r -> 'mailing' ->> 'readiness' from me, jsonb_array_elements(j -> 'months') r where r ->> 'month' = '2026-11-01') = 'needs_profile', 'mailing waits for her family profile');
select pg_temp.expect((select (j ->> 'onboarded')::boolean from me) = false, 'account without completed onboarding is reported as such');
drop table me;
reset role;

-- ---------------------------------------------------------------- recurring payment, failure, cancellation

select pg_temp.sub('sub_M', 'cus_M', :M, 'active', 'monthly', '2026-12-02 15:00:00+00', '2027-01-02 15:00:00+00');
select pg_temp.expect((pg_temp.inv('in_M2', 'sub_M', 'paid', 500, '2026-12-02 15:00:00+00', '2027-01-02 15:00:00+00', 'monthly') ->> 'granted')::int = 1, 'December''s payment unlocks December');
select pg_temp.expect((select membership_year from public.club_entitlements where user_id = :M and resource_month = '2026-12-01' and kind = 'digital') = 1, 'still year 1');

select pg_temp.sub('sub_M', 'cus_M', :M, 'past_due', 'monthly', '2027-01-02 15:00:00+00', '2027-02-02 15:00:00+00');
select pg_temp.expect((pg_temp.inv('in_M3', 'sub_M', 'open', 500, '2027-01-02 15:00:00+00', '2027-02-02 15:00:00+00', 'monthly') ->> 'granted')::int = 0, 'a failed January payment grants nothing');
select pg_temp.expect(not exists (select 1 from public.club_entitlements where user_id = :M and resource_month = '2027-01-01'), 'no January access, no January mailing');
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
select pg_temp.expect((select count(*) from public.club_fulfillment_orders where user_id = :Y) = 12, 'twelve consecutive mailings queued');
select pg_temp.expect((select count(*) from public.club_fulfillment_orders where user_id = :Y and late) = 1, 'only the first (November) is late');
select pg_temp.as_user('authenticated', :Y);
select pg_temp.expect(public.club_resource_get('2026-12-christmas-mission') ->> 'can' = 'edit', 'annual opens December now (published)');
select pg_temp.expect(pg_temp.fails($$select public.club_resource_get('2027-01-fresh-start-together')$$, 'not_found'), 'but not a kit that is still a draft');
select pg_temp.expect((select count(*) from jsonb_array_elements(public.club_me() -> 'months') r where r ->> 'state' in ('available', 'preparing')) = 12, 'her dashboard shows all twelve months as hers');
reset role;

select pg_temp.sub('sub_Y', 'cus_Y', :Y, 'active', 'annual', '2027-11-03 12:00:00+00', '2028-11-03 12:00:00+00');
select pg_temp.expect((pg_temp.inv('in_Y2', 'sub_Y', 'paid', 6000, '2027-11-03 12:00:00+00', '2028-11-03 12:00:00+00', 'annual') ->> 'granted')::int = 12, 'annual renewal grants the next collection');
select pg_temp.expect((select array_agg(distinct membership_year) from public.club_entitlements where user_id = :Y and resource_month >= '2027-11-01') = '{2}', 'as year 2');
select pg_temp.expect((select kit_id from public.club_entitlements where user_id = :Y and resource_month = '2027-12-01' and kind = 'digital') = (select id from public.club_kits where slug = '2027-12-christmas-family-affair'), 'year 2 December is the year 2 edition');

-- Refund: the renewal is refunded in full → its twelve months go, year 1 stays.
select pg_temp.expect((public.club_invoice_refund('in_Y2', 1000) ->> 'full')::boolean = false, 'a partial refund is recorded');
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
select pg_temp.expect(public.club_admin_settings('{"cutoff_day": 10}') ->> 'cutoff_day' = '10', 'admin changes the cutoff day');
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

select pg_temp.expect(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'club\_%' and has_function_privilege('anon', p.oid, 'execute')),
  'anon can execute no club_ function');
