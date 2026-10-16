-- Access tests for /admin (supabase/migrations/20261020*_admin_*.sql). Run by scripts/test-admin-sql.sh
-- on a throwaway local database after supabase-stub.sql and every migration. Never run on the real project.
\set ON_ERROR_STOP 1
\set QUIET 1

create function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- True when the statement is refused (no privilege, or an admin function's own "forbidden").
create function pg_temp.denied(q text) returns boolean language plpgsql as $$
begin
  execute q;
  return false;
exception when insufficient_privilege then
  return true;
end $$;

create function pg_temp.count_of(q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || q || ') x' into n;
  return n;
end $$;

-- Acts as an API caller: role plus the token claims PostgREST would set.
create function pg_temp.as_user(p_role text, p_sub text, p_aal text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_sub is null then '{}' else jsonb_build_object('sub', p_sub, 'aal', p_aal)::text end, false);
  execute format('set role %I', p_role);
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'helper@example.com'),
  ('00000000-0000-0000-0000-0000000000c3', 'stranger@example.com');
insert into public.admin_users (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-0000000000b2', 'helper');
insert into public.shop_orders (reservation_expires_at, subtotal_cents, email, payment_status)
  values (now(), 3400, 'buyer@example.com', 'paid');

-- ------------------------------------------------------------ anon
select pg_temp.as_user('anon', null, null);
select pg_temp.expect(pg_temp.denied('select * from public.admin_users'), 'anon: admin_users denied');
select pg_temp.expect(pg_temp.denied('select * from public.admin_audit_log'), 'anon: audit log denied');
select pg_temp.expect(pg_temp.denied('select public.is_admin()'), 'anon: is_admin() not callable');
select pg_temp.expect(pg_temp.denied('select public.admin_whoami()'), 'anon: admin_whoami() not callable');
select pg_temp.expect(pg_temp.denied($q$select public.admin_log('x.y')$q$), 'anon: admin_log() not callable');
select pg_temp.expect(pg_temp.denied($q$select public.admin_log_service(null, 'x.y')$q$), 'anon: admin_log_service() not callable');
select pg_temp.expect(pg_temp.denied('select * from public.shop_orders'), 'anon: shop_orders denied');
reset role;

-- ------------------------------------------------------------ signed in, not an admin
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000c3', 'aal1');
select pg_temp.expect(pg_temp.denied('select * from public.admin_users'), 'stranger: admin_users denied');
select pg_temp.expect(public.is_admin() is false, 'stranger: is_admin() false');
select pg_temp.expect((public.admin_whoami() ->> 'admin')::boolean is false, 'stranger: whoami says not admin');
select pg_temp.expect(pg_temp.count_of('select 1 from public.shop_orders') = 0, 'stranger: sees no orders');
select pg_temp.expect(pg_temp.count_of('select 1 from public.admin_audit_log') = 0, 'stranger: sees no audit log');
select pg_temp.expect(pg_temp.denied($q$select public.admin_log('test.stranger')$q$), 'stranger: cannot write the audit log');
select pg_temp.expect(pg_temp.denied($q$select public.admin_log_service('00000000-0000-0000-0000-0000000000c3', 'x.y')$q$), 'stranger: admin_log_service() not callable');
reset role;

-- ------------------------------------------------------------ the owner, signed in with a password
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000a1', 'aal1');
select pg_temp.expect(public.is_admin('owner'), 'owner: is_admin(owner)');
select pg_temp.expect(public.is_shop_admin(), 'owner: is_shop_admin');
select pg_temp.expect(pg_temp.count_of('select 1 from public.shop_orders') = 1, 'owner: sees orders');
select public.admin_log('test.sign_in', 'admin', '{"ok": true}');
select pg_temp.expect(pg_temp.count_of($q$select 1 from public.admin_audit_log where action = 'test.sign_in' and actor_email = 'owner@example.com'$q$) = 1, 'owner: audit entry written and readable');
select pg_temp.expect(pg_temp.denied('update public.admin_audit_log set action = $$x.y$$'), 'owner: audit log not updatable');
select pg_temp.expect(pg_temp.denied('delete from public.admin_audit_log'), 'owner: audit log not deletable');
select pg_temp.expect(pg_temp.denied('insert into public.admin_audit_log (action) values ($$x.y$$)'), 'owner: audit log not directly insertable');
select pg_temp.expect(pg_temp.denied('select * from public.admin_users'), 'owner: admin_users not readable through the API');
reset role;

-- ------------------------------------------------------------ helper: survey yes, shop no
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000b2', 'aal1');
select pg_temp.expect(public.is_survey_admin(), 'helper: survey admin');
select pg_temp.expect(public.is_shop_admin() is false, 'helper: not a shop admin');
select pg_temp.expect(pg_temp.count_of('select 1 from public.shop_orders') = 0, 'helper: sees no orders');
select pg_temp.expect(pg_temp.count_of('select 1 from public.admin_audit_log') = 0, 'helper: cannot read the audit log');
reset role;

-- ------------------------------------------------------------ append-only even for the service role
select pg_temp.as_user('service_role', null, null);
select public.admin_log_service('00000000-0000-0000-0000-0000000000a1', 'shop.refund', 'order:1001', '{"amount_cents": 500}');
select pg_temp.expect(public.shop_is_admin_user('00000000-0000-0000-0000-0000000000a1'), 'service: owner is a shop admin user');
select pg_temp.expect(public.shop_is_admin_user('00000000-0000-0000-0000-0000000000b2') is false, 'service: helper is not a shop admin user');
reset role;
do $$ begin
  begin
    delete from public.admin_audit_log;
    raise exception 'FAIL: audit log delete was allowed';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok - audit log refuses delete (trigger)';
  end;
end $$;

-- ============================================================ page inventory (20261020010000_admin_pages.sql)
select pg_temp.as_user('anon', null, null);
select pg_temp.expect(public.site_pages_sync(repeat('a', 64), 'abc1234', '[{"path":"/","type":"home","indexable":true}]') ->> 'status' = 'unauthorized', 'sync: refused before a token exists');
select pg_temp.expect(pg_temp.denied('select * from public.site_pages'), 'anon: site_pages denied');
select pg_temp.expect(pg_temp.denied('select * from public.admin_secret'), 'anon: admin_secret denied');
select pg_temp.expect(pg_temp.denied('select public.admin_rotate_inventory_token()'), 'anon: cannot rotate the token');
reset role;

select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000b2', 'aal1');
select pg_temp.expect(pg_temp.denied('select public.admin_rotate_inventory_token()'), 'helper: cannot rotate the token');
reset role;

select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000a1', 'aal1');
select set_config('test.token', public.admin_rotate_inventory_token(), false);
select pg_temp.expect(current_setting('test.token') ~ '^[0-9a-f]{64}$', 'owner: rotate returns a 64-hex token');
select pg_temp.expect(public.admin_inventory_token_set_at() is not null, 'owner: token set time readable');
reset role;
select pg_temp.expect((select inventory_token_hash from public.admin_secret) <> current_setting('test.token'), 'only the hash is stored');

select pg_temp.as_user('anon', null, null);
select pg_temp.expect(public.site_pages_sync(repeat('b', 64), null, '[{"path":"/","type":"home","indexable":true}]') ->> 'status' = 'unauthorized', 'sync: wrong token refused');
select pg_temp.expect(public.site_pages_sync(current_setting('test.token'), null, '[]') ->> 'status' = 'invalid', 'sync: empty inventory refused');
select pg_temp.expect(public.site_pages_sync(current_setting('test.token'), 'abc1234', $j$[
  {"path":"/","title":"Home","type":"home","indexable":true,"in_nav":true,"inbound_links":3,"ctas":[]},
  {"path":"/calendar","title":"Calendar","type":"offer","indexable":true,"inbound_links":2,"ctas":[{"placement":"buy","label":"Buy on Etsy","href":"https://www.etsy.com/listing/1"}]},
  {"path":"/real-life-reset-kit","type":"offer","indexable":false,"orphan":true,"ctas":[{"placement":"x","label":"Get it","href":"/nowhere","broken":"missing page"}]}
]$j$, $j$[{"href":"https://www.etsy.com/listing/1","status":404,"broken":true,"pages":["/calendar"]}]$j$) ->> 'added' = '3', 'sync: three pages added');
select pg_temp.expect(pg_temp.denied('select * from public.site_pages'), 'anon: still cannot read site_pages after sync');
reset role;

select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000b2', 'aal1');
select pg_temp.expect(pg_temp.count_of('select 1 from public.site_pages') = 3, 'helper: reads the inventory');
reset role;
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000c3', 'aal1');
select pg_temp.expect(pg_temp.count_of('select 1 from public.site_pages') = 0, 'stranger: reads no pages');
reset role;

-- ============================================================ alerts + overview (20261020020000_admin_alerts.sql)
-- Fixtures: a live order paid 6 business days ago and not shipped; a test order in the same state
-- (must not alert); an open support request from last week whose inbox email failed; an out-of-stock
-- physical product on sale; a live order whose confirmation email was skipped.
insert into public.shop_products (slug, name, price_cents, active, stock, kind) values ('test-mug', 'Test Mug', 2300, true, 0, 'physical');
insert into public.shop_orders (id, order_number, reservation_expires_at, subtotal_cents, total_cents, email, payment_status, fulfillment_status, livemode, paid_at)
values ('00000000-0000-0000-0000-00000000d001', 2001, now(), 3400, 3400, 'a@example.com', 'paid', 'unfulfilled', true, now() - interval '9 days'),
       ('00000000-0000-0000-0000-00000000d002', null, now(), 3400, 3400, 'b@example.com', 'paid', 'unfulfilled', false, now() - interval '9 days');
insert into public.shop_email_log (order_id, kind, dedupe_key, to_email, status) values
  ('00000000-0000-0000-0000-00000000d001', 'confirmation', 'test-confirm-1', 'a@example.com', 'skipped'),
  ('00000000-0000-0000-0000-00000000d002', 'confirmation', 'test-confirm-2', 'b@example.com', 'failed');
insert into public.support_requests (reference, created_at, topic, name, email, message, notify_status, ack_status)
values ('OMC-TEST01', now() - interval '8 days', 'orders', 'Test', 't@example.com', 'Where is my calendar please?', 'failed', 'sent');

select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000b2', 'aal1');
select pg_temp.expect(pg_temp.denied('select public.admin_alerts_refresh()'), 'helper: cannot refresh alerts');
select pg_temp.expect(pg_temp.denied('select public.admin_overview()'), 'helper: no business numbers');
reset role;
select pg_temp.as_user('anon', null, null);
select pg_temp.expect(pg_temp.denied('select public.admin_alert_conditions()'), 'anon: rules not callable');
select pg_temp.expect(pg_temp.denied('select * from public.admin_alerts'), 'anon: alerts denied');
reset role;

select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000a1', 'aal1');
select public.admin_alerts_refresh();
select pg_temp.expect(pg_temp.count_of($q$select 1 from public.admin_alerts where key = 'order.unshipped:00000000-0000-0000-0000-00000000d001' and severity = 'critical' and resolved_at is null$q$) = 1, 'alert: live order unshipped 6 business days → critical');
select pg_temp.expect(pg_temp.count_of($q$select 1 from public.admin_alerts where key like '%00000000d002%'$q$) = 0, 'alert: test-mode order raises nothing');
select pg_temp.expect(pg_temp.count_of($q$select 1 from public.admin_alerts where key like 'email.order:%' and severity = 'critical'$q$) = 1, 'alert: skipped live confirmation email → critical (test order''s failure ignored)');
select pg_temp.expect(pg_temp.count_of($q$select 1 from public.admin_alerts where key = 'support.notify:OMC-TEST01' and severity = 'critical'$q$) = 1, 'alert: support request that missed the inbox');
select pg_temp.expect(pg_temp.count_of($q$select 1 from public.admin_alerts where key = 'support.waiting:OMC-TEST01' and severity = 'critical'$q$) = 1, 'alert: support request open 3+ business days');
select pg_temp.expect(pg_temp.count_of($q$select 1 from public.admin_alerts where key = 'stock.out:test-mug'$q$) = 1, 'alert: physical product on sale with no stock');
select pg_temp.expect(pg_temp.count_of($q$select 1 from public.admin_alerts where key = 'website.cta_missing:/real-life-reset-kit:/nowhere'$q$) = 1, 'alert: CTA to a missing page');
select pg_temp.expect(pg_temp.count_of($q$select 1 from public.admin_alerts where key = 'website.link_gone:https://www.etsy.com/listing/1'$q$) = 1, 'alert: external link 404');
select pg_temp.expect(pg_temp.count_of($q$select 1 from public.admin_alerts where key = 'website.inventory_stale'$q$) = 0, 'alert: fresh inventory is not stale');
select pg_temp.expect((public.admin_overview() -> 'orders' ->> 'to_ship')::int = 1, 'overview: one live order to ship');
select pg_temp.expect((public.admin_overview() -> 'orders' ->> 'revenue_all_cents')::int = 3400, 'overview: revenue counts live orders only');
select pg_temp.expect((public.admin_overview() -> 'orders' ->> 'test_orders')::int = 1, 'overview: test orders counted separately');
select pg_temp.expect((public.admin_overview() -> 'support' ->> 'open')::int = 1, 'overview: open support request');
select public.admin_alert_ack('stock.out:test-mug');
select pg_temp.expect(pg_temp.count_of($q$select 1 from public.admin_alerts where key = 'stock.out:test-mug' and acked_at is not null$q$) = 1, 'ack: recorded');
select pg_temp.expect(pg_temp.count_of($q$select 1 from public.admin_audit_log where action = 'alert.ack'$q$) = 1, 'ack: audit-logged');
reset role;

-- Fix the problems; the next refresh resolves them.
update public.shop_orders set fulfillment_status = 'shipped', carrier = 'USPS' where id = '00000000-0000-0000-0000-00000000d001';
update public.support_requests set status = 'resolved' where reference = 'OMC-TEST01';
update public.shop_products set stock = 20 where slug = 'test-mug';
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000a1', 'aal1');
select public.admin_alerts_refresh();
select pg_temp.expect(pg_temp.count_of($q$select 1 from public.admin_alerts where key in ('order.unshipped:00000000-0000-0000-0000-00000000d001', 'support.notify:OMC-TEST01', 'support.waiting:OMC-TEST01', 'stock.out:test-mug') and resolved_at is not null$q$) = 4, 'resolve: fixed problems close themselves');
reset role;

-- A problem that comes back opens fresh (un-acknowledged).
update public.shop_products set stock = 0 where slug = 'test-mug';
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000a1', 'aal1');
select public.admin_alerts_refresh();
select pg_temp.expect(pg_temp.count_of($q$select 1 from public.admin_alerts where key = 'stock.out:test-mug' and resolved_at is null and acked_at is null$q$) = 1, 'reopen: a returning problem is new again');
reset role;

-- Returns: approved 15 days ago and never received.
insert into public.support_requests (reference, topic, name, email, message, return_status) values ('OMC-TEST02', 'returns', 'R', 'r@example.com', 'I would like to return it.', 'requested');
update public.support_requests set return_status = 'approved' where reference = 'OMC-TEST02';
select pg_temp.expect((select return_status_at from public.support_requests where reference = 'OMC-TEST02') is not null, 'returns: status change stamps return_status_at');
update public.support_requests set return_status_at = now() - interval '15 days' where reference = 'OMC-TEST02';
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000a1', 'aal1');
select public.admin_alerts_refresh();
select pg_temp.expect(pg_temp.count_of($q$select 1 from public.admin_alerts where key = 'return.not_received:OMC-TEST02'$q$) = 1, 'alert: approved return not received in 14 days');
reset role;

-- Removing a page from the build.
select pg_temp.as_user('anon', null, null);
select pg_temp.expect(public.site_pages_sync(current_setting('test.token'), 'def5678', '[{"path":"/","type":"home","indexable":true},{"path":"/calendar","type":"offer","indexable":true}]') ->> 'removed' = '1', 'sync: a page missing from the build is marked removed');
reset role;
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000a1', 'aal1');
select public.admin_alerts_refresh();
select pg_temp.expect(pg_temp.count_of($q$select 1 from public.admin_alerts where key = 'website.page_removed:/real-life-reset-kit' and severity = 'info'$q$) = 1, 'alert: removed page (info)');
select pg_temp.expect(pg_temp.count_of($q$select 1 from public.admin_alerts where key like 'website.cta_missing:%' and resolved_at is null$q$) = 0, 'resolve: a removed page''s broken CTA closes');
reset role;

-- The browser roles can execute exactly the intended functions.
select pg_temp.expect(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'admin%' and has_function_privilege('authenticated', p.oid, 'execute'))
  = array['admin_alert_ack', 'admin_alerts_refresh', 'admin_inventory_token_set_at', 'admin_log', 'admin_overview', 'admin_rotate_inventory_token', 'admin_whoami'],
  'grants: authenticated may call only the dashboard''s admin functions');
select pg_temp.expect(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'admin%' or p.proname like 'is_admin%') and has_function_privilege('anon', p.oid, 'execute')),
  'grants: anon may call no admin function');
select pg_temp.expect(
  not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and (c.relname like 'admin%' or c.relname like 'site_%') and not c.relrowsecurity),
  'every admin table has row-level security on');
select pg_temp.expect(
  not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and (c.relname like 'admin%' or c.relname like 'site_%')
      and (has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate') or has_table_privilege('authenticated', c.oid, 'insert,update,delete,truncate'))),
  'admin tables: anon nothing, authenticated read-only');
