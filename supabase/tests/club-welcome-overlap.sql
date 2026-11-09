-- Tests for the Welcome overlap rule (supabase/migrations/20261123000000_club_welcome_overlap.sql, Phase 2d). Run by
-- scripts/test-admin-sql.sh on a throwaway local database after every migration and the other suites (it relies on the
-- program dates club-membership.sql sets). Never run on the real project.
\set ON_ERROR_STOP 1
\set QUIET 1

create function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
create function pg_temp.as_user(p_role text, p_sub text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when p_sub is null then '{}' else jsonb_build_object('sub', p_sub)::text end, false);
  execute format('set role %I', p_role);
end $$;
create function pg_temp.u(p_n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000e20' || lpad(p_n::text, 2, '0'))::uuid $$;
create function pg_temp.link(p_n int) returns void language sql as $$
  select public.club_member_link(pg_temp.u(p_n), 'o' || p_n || '@example.com', 'cus_o' || p_n, false);
$$;
-- A paid month, as the webhook applies it (the first one sets her first_paid_month, then billing makes her orders).
create function pg_temp.pay(p_n int, p_paid timestamptz, p_k int default 1) returns jsonb language plpgsql as $$
declare e timestamptz := p_paid + interval '1 month';
begin
  perform pg_temp.link(p_n);
  perform public.club_subscription_sync(jsonb_build_object('id', 'sub_o' || p_n, 'customer', 'cus_o' || p_n, 'user_id', pg_temp.u(p_n), 'status', 'active',
    'plan', 'monthly', 'price_id', 'price_monthly', 'current_period_start', p_paid, 'current_period_end', e,
    'cancel_at_period_end', false, 'started_at', p_paid, 'livemode', false, 'event_at', now()));
  return public.club_invoice_apply(jsonb_build_object('id', 'in_o' || p_n || 'x' || p_k, 'subscription', 'sub_o' || p_n, 'status', 'paid', 'billing_reason', 'subscription_cycle',
    'amount_due_cents', 590, 'amount_paid_cents', 590, 'period_start', p_paid, 'period_end', e, 'paid_at', p_paid, 'livemode', false,
    'payment_intent', 'pi_o' || p_n || p_k, 'charge', 'ch_o' || p_n || p_k, 'plan', 'monthly'),
    jsonb_build_array(jsonb_build_object('start', p_paid, 'end', e, 'plan', 'monthly')));
end $$;
-- Her live orders as 'type:YYYY-MM', and her Welcome Kit as 'type:status:readiness'.
create function pg_temp.orders(p_n int) returns text language sql security definer as $$
  select string_agg(fulfillment_type || ':' || to_char(resource_month, 'YYYY-MM'), ',' order by fulfillment_type, resource_month)
    from public.club_fulfillment_orders where user_id = pg_temp.u(p_n) and status <> 'canceled';
$$;
create function pg_temp.kit(p_n int) returns text language sql security definer as $$
  select string_agg(q.fulfillment_type || ':' || q.status || ':' || q.readiness, ',' order by q.fulfillment_type)
    from public.club_fulfillment_queue q where q.user_id = pg_temp.u(p_n) and q.status <> 'canceled' and q.in_welcome_kit;
$$;
create function pg_temp.first(p_n int) returns uuid language sql security definer as $$
  select o.id from public.club_fulfillment_orders o join public.club_households h on h.id = o.household_id
   where o.user_id = pg_temp.u(p_n) and o.fulfillment_type = 'monthly_resource' and o.resource_month = h.first_paid_month and o.status <> 'canceled';
$$;
create function pg_temp.family(p_n int) returns void language plpgsql as $$
begin
  perform pg_temp.as_user('authenticated', pg_temp.u(p_n)::text);
  perform public.club_household_save('Family ' || p_n, '{}', '[{"first_name":"Pat","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Kim","kind":"child","role":"child","birth_year":2017,"birth_month":3}]');
  perform public.club_address_save('{"name":"Pat Doe","line1":"9 Oak St","city":"Town","state":"NJ","postal_code":"07001"}');
  reset role;
end $$;

insert into auth.users (id, email, email_confirmed_at) select pg_temp.u(n), 'o' || n || '@example.com', now() from generate_series(1, 8) n;
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000e2099', 'owner-o@example.com', now()) on conflict do nothing;
insert into public.admin_users (user_id, role) values ('00000000-0000-0000-0000-0000000e2099', 'owner') on conflict do nothing;
update public.club_kits set status = 'scheduled' where slug in ('2027-02-better-together', '2027-05-finish-the-school-year', '2027-08-school-year');

-- ---------------------------------------------------------------- the list

select pg_temp.expect((select array_agg(slug order by slug) from public.club_kits where establishes_daily_rhythm) = array['2027-05-finish-the-school-year', '2027-08-school-year'],
  'May''s Summer Day Rhythm and August''s School Day Routines are flagged, nothing else');

-- ---------------------------------------------------------------- switch off: today's behavior, May included

select pg_temp.pay(1, '2027-05-03 12:00-04');
select pg_temp.expect(pg_temp.orders(1) = 'monthly_resource:2027-05,welcome_vision:2027-05', 'switch off: a May joiner gets the Vision print and May, as today');
select pg_temp.expect(not (select welcome_kit_monthly_only from public.club_households where owner_user_id = pg_temp.u(1)), 'no first-month-only kit while the switch is off');

update public.club_settings set welcome_item = 'rhythm';

-- ---------------------------------------------------------------- not overlapping: the Family Rhythm

select pg_temp.pay(2, '2027-02-03 12:00-05');
select pg_temp.expect(pg_temp.orders(2) = 'monthly_resource:2027-02,welcome_rhythm:2027-02', 'a February joiner: her Family Rhythm and February, two orders');
select pg_temp.expect((select kit_welcome_type from public.club_fulfillment_queue where id = pg_temp.first(2)) = 'welcome_rhythm', 'her kit carries the Family Rhythm');

-- ---------------------------------------------------------------- overlapping: her first month is her Welcome win

select pg_temp.pay(3, '2027-05-03 12:00-04');
select pg_temp.expect(pg_temp.orders(3) = 'monthly_resource:2027-05', 'a May joiner: ONE order, her May resource; no Family Rhythm, no Vision print');
select pg_temp.expect((select welcome_kit_monthly_only from public.club_households where owner_user_id = pg_temp.u(3)), 'her Welcome Kit is her first month alone');
select pg_temp.pay(3, '2027-05-03 12:00-04');
select pg_temp.expect(pg_temp.orders(3) = 'monthly_resource:2027-05', 'a webhook retry adds nothing');
select pg_temp.expect((select in_welcome_kit and kit_partner_id is null and kit_welcome_type = 'none' and batch = 'welcome_kit' from public.club_fulfillment_queue where id = pg_temp.first(3)),
  'May is in a Welcome Kit of its own: no partner, no welcome item');
select pg_temp.expect(pg_temp.kit(3) = 'monthly_resource:pending:needs_profile', 'family first');
select pg_temp.family(3);
select pg_temp.expect(pg_temp.kit(3) = 'monthly_resource:pending:needs_confirmation', 'then only her May resource to confirm: no welcome item to approve');
select pg_temp.as_user('authenticated', pg_temp.u(3)::text);
select pg_temp.expect(public.club_me() -> 'welcome' ->> 'kind' = 'monthly' and (public.club_me() -> 'welcome' ->> 'approved')::boolean
  and public.club_me() -> 'welcome' ->> 'readiness' = 'needs_confirmation', 'club_me: kind monthly, nothing to approve but her first month');
select pg_temp.expect(public.club_welcome_plan_get() ->> 'can' = 'edit', 'her Family Rhythm is still hers, digitally');
reset role;
select pg_temp.expect(public.club_welcome_item_of(pg_temp.u(3)) = 'monthly' and public.club_welcome_item_of(pg_temp.u(2)) = 'rhythm', 'the emails can tell');

-- Two days on: the same Welcome Kit reminder, for her May resource.
update public.club_fulfillment_orders set created_at = now() - interval '2 days 1 hour' where id = pg_temp.first(3);
select pg_temp.expect((select x ->> 'kit_slug' from jsonb_array_elements(public.club_email_audience('kit_reminder')) x where x ->> 'user_id' = pg_temp.u(3)::text) = '2027-05-finish-the-school-year'
  and (select (x ->> 'reminder')::int from jsonb_array_elements(public.club_email_audience('kit_reminder')) x where x ->> 'user_id' = pg_temp.u(3)::text) = 1, 'reminder 1, about May');
select pg_temp.expect(not exists (select 1 from jsonb_array_elements(public.club_email_audience('review', '2027-05-01')) x where x ->> 'user_id' = pg_temp.u(3)::text), 'and not the monthly review email');

select pg_temp.as_user('authenticated', pg_temp.u(3)::text);
select public.club_fulfillment_approve('2027-05-finish-the-school-year');
reset role;
select pg_temp.expect(pg_temp.kit(3) = 'monthly_resource:pending:needs_pdf', 'her May approval submits the kit');
select pg_temp.expect((select kit_submitted_at is not null and kit_ship_by = public.club_business_days_after(kit_submitted_at, 2) from public.club_fulfillment_queue where id = pg_temp.first(3)), 'submitted, with a ship-by date');
select pg_temp.expect(public.club_kit_submitted(pg_temp.u(3)) ->> 'welcome_item' = 'none' and public.club_kit_submitted(pg_temp.u(3)) ->> 'first_month' = '2027-05-01', 'the owner email: no welcome item, May');

select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000e2099');
create temp table q3 as select x from jsonb_array_elements(public.club_admin_welcome_queue()) x where x ->> 'email' = 'o3@example.com';
select pg_temp.expect((select count(*) from q3) = 1 and (select x -> 'packing_list' from q3)
  = '["Family Meeting guide (standard insert)", "May 2027 resource (personalized; her Welcome win, no separate welcome print)"]'::jsonb, 'Welcome Kits list: one row, the guide and May');
select pg_temp.expect((select x -> 'first_month' ->> 'id' from q3)::uuid = pg_temp.first(3), 'its first month is her May order');
select pg_temp.expect(not exists (select 1 from jsonb_array_elements(public.club_admin_fulfillment('2027-05-01')) x where x ->> 'email' = 'o3@example.com'), 'never on May''s monthly list (no second print of May)');
select public.club_admin_set_fulfillment(pg_temp.first(3), null, null, 'ready');
select pg_temp.expect(pg_temp.kit(3) = 'monthly_resource:pending:ready', 'one PDF: ready');
select public.club_admin_set_welcome_kit(pg_temp.first(3), 'approved');
select public.club_admin_set_welcome_kit(pg_temp.first(3), 'printed');
select public.club_admin_set_welcome_kit(pg_temp.first(3), 'mailed');
select pg_temp.expect(pg_temp.kit(3) = 'monthly_resource:mailed:mailed', 'approved, printed and mailed as her Welcome Kit');
select pg_temp.expect((select x -> 'welcome' ->> 'welcome_item' from jsonb_array_elements(public.club_admin_members()) x where x ->> 'email' = 'o3@example.com') = 'monthly_resource', 'the member list shows her first-month kit');
reset role;

-- August too.
select pg_temp.pay(4, '2027-08-02 12:00-04');
select pg_temp.expect(pg_temp.orders(4) = 'monthly_resource:2027-08' and (select welcome_kit_monthly_only from public.club_households where owner_user_id = pg_temp.u(4)), 'an August joiner: August alone is her Welcome Kit');
-- The second month never joins a kit.
select pg_temp.pay(4, '2027-09-02 12:00-04', 2);
select pg_temp.expect(not (select in_welcome_kit from public.club_fulfillment_queue where user_id = pg_temp.u(4) and resource_month = '2027-09-01'), 'September is an ordinary monthly mailing');

-- ---------------------------------------------------------------- her first month learned after her Rhythm order

-- A Family Rhythm order made before her first month was known (billing knew no month yet).
select pg_temp.link(5);
select pg_temp.family(5);
insert into public.club_fulfillment_orders (user_id, household_id, resource_month, fulfillment_type, provider)
  select pg_temp.u(5), h.id, '2027-04-01', 'welcome_vision', 'manual' from public.club_households h where h.owner_user_id = pg_temp.u(5);
select pg_temp.expect(pg_temp.orders(5) = 'welcome_rhythm:2027-04', 'first month unknown: a Family Rhythm order');
select pg_temp.pay(5, '2027-05-03 12:00-04');
select pg_temp.expect(pg_temp.orders(5) = 'monthly_resource:2027-05', 'then May arrives: the unapproved Rhythm order is canceled; May alone');
select pg_temp.expect((select note from public.club_fulfillment_orders where user_id = pg_temp.u(5) and fulfillment_type = 'welcome_rhythm') like '%Welcome win%', 'with a note saying why');
select pg_temp.expect(pg_temp.kit(5) = 'monthly_resource:pending:needs_confirmation', 'and her kit is May alone');

-- The same, but she had already approved her Family Rhythm: never removed or replaced.
select pg_temp.link(6);
select pg_temp.family(6);
insert into public.club_fulfillment_orders (user_id, household_id, resource_month, fulfillment_type, provider)
  select pg_temp.u(6), h.id, '2027-04-01', 'welcome_vision', 'manual' from public.club_households h where h.owner_user_id = pg_temp.u(6);
update public.club_fulfillment_orders set member_approved_at = now() where user_id = pg_temp.u(6) and fulfillment_type = 'welcome_rhythm';
select pg_temp.pay(6, '2027-05-03 12:00-04');
select pg_temp.expect(pg_temp.orders(6) = 'monthly_resource:2027-05,welcome_rhythm:2027-04', 'an approved Family Rhythm order stays, with May');
select pg_temp.expect(not (select welcome_kit_monthly_only from public.club_households where owner_user_id = pg_temp.u(6))
  and (select kit_welcome_type from public.club_fulfillment_queue where id = pg_temp.first(6)) = 'welcome_rhythm', 'her kit keeps its Family Rhythm');

-- ---------------------------------------------------------------- existing Vision orders keep their promise

select pg_temp.link(7);
select pg_temp.family(7);
update public.club_settings set welcome_item = 'vision';
insert into public.club_fulfillment_orders (user_id, household_id, resource_month, fulfillment_type, provider)
  select pg_temp.u(7), h.id, '2027-04-01', 'welcome_vision', 'manual' from public.club_households h where h.owner_user_id = pg_temp.u(7);
update public.club_settings set welcome_item = 'rhythm';
select pg_temp.pay(7, '2027-05-03 12:00-04');
select pg_temp.expect(pg_temp.orders(7) = 'monthly_resource:2027-05,welcome_vision:2027-04', 'a Vision order made before the switch keeps its print, May joins her kit as before');
select pg_temp.expect((select kit_welcome_type from public.club_fulfillment_queue where id = pg_temp.first(7)) = 'welcome_vision', 'her kit: Vision print + May');
select pg_temp.expect(pg_temp.orders(1) = 'monthly_resource:2027-05,welcome_vision:2027-05', 'and the May member who joined with the switch off is untouched');

update public.club_settings set welcome_item = 'vision';
select pg_temp.expect(not has_function_privilege('authenticated', 'public.club_welcome_overlap_check()', 'execute'), 'the trigger function is internal');
