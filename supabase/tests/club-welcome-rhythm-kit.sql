-- Tests for the Family Rhythm in the Welcome Kit (supabase/migrations/20261122000000_club_welcome_rhythm_kit.sql). Run
-- by scripts/test-admin-sql.sh on a throwaway local database after every migration and the other suites. Never run on
-- the real project. Runs after club-membership.sql, which sets the program dates and kits it relies on.
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
create function pg_temp.u(p_n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000d10' || lpad(p_n::text, 2, '0'))::uuid $$;
create function pg_temp.join_(p_n int, p_paid timestamptz, p_k int default 1) returns jsonb language plpgsql as $$
declare e timestamptz := p_paid + interval '1 month';
begin
  perform public.club_member_link(pg_temp.u(p_n), 'r' || p_n || '@example.com', 'cus_r' || p_n, false);
  perform public.club_subscription_sync(jsonb_build_object('id', 'sub_r' || p_n, 'customer', 'cus_r' || p_n, 'user_id', pg_temp.u(p_n), 'status', 'active',
    'plan', 'monthly', 'price_id', 'price_monthly', 'current_period_start', p_paid, 'current_period_end', e,
    'cancel_at_period_end', false, 'started_at', p_paid, 'livemode', false, 'event_at', now()));
  return public.club_invoice_apply(jsonb_build_object('id', 'in_r' || p_n || 'x' || p_k, 'subscription', 'sub_r' || p_n, 'status', 'paid', 'billing_reason', 'subscription_cycle',
    'amount_due_cents', 500, 'amount_paid_cents', 500, 'period_start', p_paid, 'period_end', e, 'paid_at', p_paid, 'livemode', false,
    'payment_intent', 'pi_r' || p_n || p_k, 'charge', 'ch_r' || p_n || p_k, 'plan', 'monthly'),
    jsonb_build_array(jsonb_build_object('start', p_paid, 'end', e, 'plan', 'monthly')));
end $$;
-- Her kit as 'type:status:readiness' for both orders.
create function pg_temp.kit(p_n int) returns text language sql security definer as $$
  select string_agg(q.fulfillment_type || ':' || q.status || ':' || q.readiness, ',' order by q.fulfillment_type)
    from public.club_fulfillment_queue q where q.user_id = pg_temp.u(p_n) and q.status <> 'canceled' and q.in_welcome_kit;
$$;
create function pg_temp.rhythm(p_n int) returns public.club_fulfillment_orders language sql security definer as $$
  select * from public.club_fulfillment_orders where user_id = pg_temp.u(p_n) and fulfillment_type = 'welcome_rhythm' and status <> 'canceled';
$$;

insert into auth.users (id, email, email_confirmed_at)
select pg_temp.u(n), 'r' || n || '@example.com', now() from generate_series(1, 4) n;
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000d1099', 'owner-r@example.com', now()) on conflict do nothing;
insert into public.admin_users (user_id, role) values ('00000000-0000-0000-0000-0000000d1099', 'owner') on conflict do nothing;
update public.club_kits set status = 'scheduled' where slug = '2026-12-christmas-mission';

-- ---------------------------------------------------------------- the switch ships off: today's behavior

select pg_temp.expect((select welcome_item from public.club_settings limit 1) = 'vision', 'the switch ships off (vision)');
select pg_temp.join_(1, '2026-12-05 12:00-05');
select pg_temp.expect(exists (select 1 from public.club_fulfillment_orders where user_id = pg_temp.u(1) and fulfillment_type = 'welcome_vision')
  and not exists (select 1 from public.club_fulfillment_orders where user_id = pg_temp.u(1) and fulfillment_type = 'welcome_rhythm'), 'switch off: a new member gets the Vision print, as today');
select pg_temp.expect((select kit_welcome_type from public.club_fulfillment_queue where user_id = pg_temp.u(1) and fulfillment_type = 'monthly_resource' limit 1) = 'welcome_vision', 'the queue names the kit''s item');

-- ---------------------------------------------------------------- switched on: new enrollments only

update public.club_settings set welcome_item = 'rhythm';
-- An existing member's next invoice (or a webhook retry) never adds or converts anything (D3).
select pg_temp.join_(1, '2027-01-05 12:00-05', 2);
select pg_temp.expect((select count(*) from public.club_fulfillment_orders where user_id = pg_temp.u(1) and fulfillment_type in ('welcome_vision', 'welcome_rhythm') and status <> 'canceled') = 1
  and exists (select 1 from public.club_fulfillment_orders where user_id = pg_temp.u(1) and fulfillment_type = 'welcome_vision'), 'an existing Vision order keeps its print; no second welcome order');

select pg_temp.join_(2, '2026-12-05 12:00-05');
select pg_temp.expect((pg_temp.rhythm(2)).id is not null and not exists (select 1 from public.club_fulfillment_orders where user_id = pg_temp.u(2) and fulfillment_type = 'welcome_vision'), 'switch on: a new member''s welcome order is the Family Rhythm');
select pg_temp.join_(2, '2026-12-05 12:00-05');
select pg_temp.expect((select count(*) from public.club_fulfillment_orders where user_id = pg_temp.u(2) and fulfillment_type in ('welcome_vision', 'welcome_rhythm')) = 1, 'a webhook retry adds nothing');
select pg_temp.expect(pg_temp.kit(2) = 'monthly_resource:pending:needs_profile,welcome_rhythm:pending:needs_profile', 'paired with her first month, one readiness: family first');
select pg_temp.expect((select kit_partner_id from public.club_fulfillment_queue where id = (pg_temp.rhythm(2)).id) = (select id from public.club_fulfillment_orders where user_id = pg_temp.u(2) and fulfillment_type = 'monthly_resource' and resource_month = '2026-12-01'), 'each order names the other');

select pg_temp.as_user('authenticated', pg_temp.u(2)::text);
select public.club_household_save('The Rhythms', '{}', '[{"first_name":"Ro","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Kai","kind":"child","role":"child","birth_year":2018,"birth_month":3}]');
select public.club_address_save('{"name":"Ro Rhythm","line1":"7 Elm St","city":"Town","state":"NJ","postal_code":"07001"}');
select pg_temp.expect(public.club_me() -> 'welcome' ->> 'kind' = 'rhythm' and public.club_me() -> 'welcome' ->> 'readiness' = 'needs_rhythm'
  and (public.club_me() -> 'welcome' ->> 'approved')::boolean = false, 'club_me: her kit''s item is the Family Rhythm, waiting for her approval');
select pg_temp.expect(pg_temp.fails($$select public.club_welcome_approve()$$, 'not_found'), 'there is no Vision print to approve');
reset role;
select pg_temp.expect(pg_temp.kit(2) = 'monthly_resource:pending:needs_rhythm,welcome_rhythm:pending:needs_rhythm', 'readiness: needs her Family Rhythm');

\set P1 '''{"omc:club:welcome-family-rhythm:v1":{"s":"s","v":"{\\"current\\":\\"null:x\\",\\"state\\":{\\"v\\":3,\\"context\\":\\"welcome\\",\\"month\\":\\"2026-12\\"}}"}}'''
\set P2 '''{"omc:club:welcome-family-rhythm:v1":{"s":"s","v":"{\\"current\\":\\"null:x\\",\\"state\\":{\\"v\\":3,\\"context\\":\\"welcome\\",\\"month\\":\\"2026-12\\",\\"plan\\":{}}}"}}'''

-- She approves her plan: it goes onto her order, exactly.
select pg_temp.as_user('authenticated', pg_temp.u(2)::text);
select public.club_welcome_plan_approve(0, 'FP-1', :P1::jsonb);
reset role;
select pg_temp.expect((pg_temp.rhythm(2)).personalization -> 'state' = :P1::jsonb and (pg_temp.rhythm(2)).personalization ->> 'fingerprint' = 'FP-1'
  and (pg_temp.rhythm(2)).member_approved_at is not null, 'her approved plan and its fingerprint are on the order');
select pg_temp.expect(pg_temp.kit(2) = 'monthly_resource:pending:needs_confirmation,welcome_rhythm:pending:needs_confirmation', 'then her first month, as with the Vision print');
select pg_temp.expect(public.club_rhythm_valid((pg_temp.rhythm(2)).personalization), 'a complete Rhythm on the order');

-- Two days later: the same Welcome Kit reminder as the Vision kit (and nothing about the Rhythm itself, ever).
update public.club_fulfillment_orders set member_approved_at = now() - interval '2 days 1 hour' where id = (pg_temp.rhythm(2)).id;
select pg_temp.expect((select (x ->> 'reminder')::int from jsonb_array_elements(public.club_email_audience('kit_reminder')) x where x ->> 'user_id' = pg_temp.u(2)::text) = 1, 'the kit''s first reminder, as before');
update public.club_fulfillment_orders set member_approved_at = now() where id = (pg_temp.rhythm(2)).id;

-- A change before she submits: the kit waits for her approval again, and the order holds no stale plan.
select pg_temp.as_user('authenticated', pg_temp.u(2)::text);
select public.club_welcome_plan_save(:P2::jsonb, 1);
reset role;
select pg_temp.expect((pg_temp.rhythm(2)).personalization is null and (pg_temp.rhythm(2)).member_approved_at is null, 'a later change clears the order''s copy and approval');
select pg_temp.expect(pg_temp.kit(2) like '%needs_rhythm%needs_rhythm', 'and the kit waits for her Family Rhythm again');
select pg_temp.as_user('authenticated', pg_temp.u(2)::text);
select public.club_welcome_plan_approve(2, 'FP-2');
select public.club_welcome_plan_unapprove(2);
reset role;
select pg_temp.expect((pg_temp.rhythm(2)).member_approved_at is null, 'undo takes it off the order too');
select pg_temp.as_user('authenticated', pg_temp.u(2)::text);
select public.club_welcome_plan_approve(2, 'FP-2');
select pg_temp.expect((public.club_fulfillment_approve('2026-12-christmas-mission'))::boolean, 'she confirms her first month');
reset role;
select pg_temp.expect(pg_temp.kit(2) = 'monthly_resource:pending:needs_pdf,welcome_rhythm:pending:needs_pdf', 'both approvals in: submitted, needs PDFs');
select pg_temp.expect(public.club_kit_submitted(pg_temp.u(2)) ->> 'welcome_item' = 'welcome_rhythm'
  and public.club_kit_submitted(pg_temp.u(2)) ->> 'family_name' = 'The Rhythms'
  and (select kit_ship_by is not null from public.club_fulfillment_queue where id = (pg_temp.rhythm(2)).id), 'the owner''s notification names the Family Rhythm and a ship-by date');

-- The owner: the list, the print bundle (her approved copy, never the live plan), the package moved together.
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000d1099');
create temp table rq as select x from jsonb_array_elements(public.club_admin_welcome_queue()) x where x ->> 'email' = 'r2@example.com';
select pg_temp.expect((select x ->> 'welcome_item' from rq) = 'welcome_rhythm' and (select x ->> 'vision_value' from rq) is null
  and (select x ->> 'family_name' from rq) = 'The Rhythms' and not (select x ? 'personalization' from rq), 'Welcome Kits list: the Family Rhythm, her family name, no plan payload');
select pg_temp.expect((select x -> 'packing_list' from rq) = '["Family Rhythm (personalized)", "Family Meeting guide (standard insert)", "December 2026 resource (personalized)"]'::jsonb, 'packing list: Family Rhythm, the guide, her first month');
select pg_temp.expect(public.club_admin_fulfillment_bundle((pg_temp.rhythm(2)).id) -> 'state' = :P2::jsonb, 'the print view gets the plan she approved');
select public.club_admin_set_fulfillment((pg_temp.rhythm(2)).id, null, null, 'ready');
select public.club_admin_set_fulfillment((select id from public.club_fulfillment_orders where user_id = pg_temp.u(2) and fulfillment_type = 'monthly_resource' and resource_month = '2026-12-01'), null, null, 'ready');
select pg_temp.expect(pg_temp.fails(format($$select public.club_admin_set_fulfillment(%L, 'approved')$$, (pg_temp.rhythm(2)).id), 'use_welcome_kit'), 'half a Rhythm kit can''t be approved alone');
select public.club_admin_set_welcome_kit((pg_temp.rhythm(2)).id, 'approved');
select pg_temp.expect(pg_temp.kit(2) = 'monthly_resource:approved:ready,welcome_rhythm:approved:ready', 'approved together');
select pg_temp.expect((select x -> 'welcome' ->> 'welcome_item' from jsonb_array_elements(public.club_admin_members()) x where x ->> 'email' = 'r2@example.com') = 'welcome_rhythm'
  and public.club_admin_member_months(pg_temp.u(2)) -> 'welcome' ->> 'welcome_item' = 'welcome_rhythm', 'the member lists name it');
reset role;

-- Approved for print: her own copy stays hers to change (evergreen); the mailing keeps what she approved.
create temp table before_print as select personalization, member_approved_at from public.club_fulfillment_orders where id = (pg_temp.rhythm(2)).id;
select pg_temp.as_user('authenticated', pg_temp.u(2)::text);
select pg_temp.expect(public.club_welcome_plan_save(:P1::jsonb, 2) = 3, 'she can still change her Family Rhythm');
reset role;
select pg_temp.expect((select personalization = (select personalization from before_print) and member_approved_at = (select member_approved_at from before_print)
  from public.club_fulfillment_orders where id = (pg_temp.rhythm(2)).id), 'the approved mailing copy is untouched');
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000d1099');
select pg_temp.expect(public.club_admin_fulfillment_bundle((pg_temp.rhythm(2)).id) -> 'state' = :P2::jsonb, 'a reprint prints the same approved plan');
reset role;

-- ---------------------------------------------------------------- switched back off: nothing converted either way

update public.club_settings set welcome_item = 'vision';
select pg_temp.join_(2, '2027-01-05 12:00-05', 2);
select pg_temp.expect((select count(*) from public.club_fulfillment_orders where user_id = pg_temp.u(2) and fulfillment_type in ('welcome_vision', 'welcome_rhythm') and status <> 'canceled') = 1
  and (pg_temp.rhythm(2)).id is not null, 'switch off again: her Rhythm order stays, no Vision order added');
select pg_temp.join_(3, '2026-12-06 12:00-05');
select pg_temp.expect(exists (select 1 from public.club_fulfillment_orders where user_id = pg_temp.u(3) and fulfillment_type = 'welcome_vision'), 'and the next new member gets the Vision print again');

-- ---------------------------------------------------------------- refunds and constraints

update public.club_settings set welcome_item = 'rhythm';
select pg_temp.join_(4, '2026-12-07 12:00-05');
select public.club_revoke_invoice('in_r4x1', 'refunded');
select pg_temp.expect(not exists (select 1 from public.club_fulfillment_orders where user_id = pg_temp.u(4) and fulfillment_type = 'welcome_rhythm' and status <> 'canceled'), 'a refunded first invoice cancels the Rhythm order like the Vision print');
update public.club_settings set welcome_item = 'vision';
do $$ begin
  update public.club_settings set welcome_item = 'both';
  raise exception 'FAIL: the switch accepted ''both''';
exception when check_violation then raise notice 'ok - the switch takes only vision or rhythm';
end $$;
select pg_temp.expect(not has_function_privilege('authenticated', 'public.club_welcome_rhythm_order_set(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.club_welcome_rhythm_order_clear(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.club_rhythm_valid(jsonb)', 'execute'), 'the order helpers are internal');
