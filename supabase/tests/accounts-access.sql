-- Access tests for customer accounts (supabase/migrations/20261022000000_accounts.sql). Run by
-- scripts/test-admin-sql.sh on a throwaway local database after supabase-stub.sql and every
-- migration. Never run on the real project.
\set ON_ERROR_STOP 1
\set QUIET 1

create function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- True when the statement is refused: no privilege, or the function's own exception text.
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

-- Two customers (one not yet confirmed), an admin, and some orders.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000000a', 'Mia@Example.com', now()),
  ('00000000-0000-0000-0000-00000000000b', 'jo@example.com', now()),
  ('00000000-0000-0000-0000-00000000000c', 'unconfirmed@example.com', null),
  ('00000000-0000-0000-0000-0000000000ad', 'owner@example.com', now());
insert into public.admin_users (user_id, role) values ('00000000-0000-0000-0000-0000000000ad', 'owner');

insert into public.shop_products (id, slug, name, price_cents, active, kind, files)
values ('00000000-0000-0000-0000-0000000000f1', 'account-test-download', 'Account Test Download', 900, true, 'digital',
        '[{"path": "weekly-reset/guide.pdf", "label": "The guide"}]');
insert into public.shop_orders (id, order_number, reservation_expires_at, subtotal_cents, total_cents, email, payment_status, digital, paid_at, livemode)
values
  ('00000000-0000-0000-0000-0000000000e1', 1001, now(), 900, 900, 'mia@example.com', 'paid', true, now(), true),
  ('00000000-0000-0000-0000-0000000000e2', 1002, now(), 900, 900, 'jo@example.com', 'paid', true, now(), true),
  ('00000000-0000-0000-0000-0000000000e3', null, now(), 900, 900, 'mia@example.com', 'pending', true, null, true),
  ('00000000-0000-0000-0000-0000000000e4', 1004, now(), 900, 900, 'mia@example.com', 'refunded', true, now(), true);
insert into public.shop_order_items (order_id, product_id, product_slug, product_name, unit_price_cents, quantity)
select id, '00000000-0000-0000-0000-0000000000f1', 'account-test-download', 'Account Test Download', 900, 1
  from public.shop_orders;
insert into public.shop_entitlements (email, order_id, kind, token, expires_at) values
  ('mia@example.com', '00000000-0000-0000-0000-0000000000e1', 'download', repeat('a', 48), now() - interval '30 days'),
  ('jo@example.com', '00000000-0000-0000-0000-0000000000e2', 'download', repeat('b', 48), now() + interval '7 days');
insert into public.shop_entitlements (email, order_id, kind, token, expires_at, revoked_at) values
  ('mia@example.com', '00000000-0000-0000-0000-0000000000e4', 'download', repeat('c', 48), now(), now());

-- ------------------------------------------------------------ anon
select pg_temp.as_user('anon', null);
select pg_temp.expect(pg_temp.fails('select * from public.account_saves'), 'anon: saves table denied');
select pg_temp.expect(pg_temp.fails($q$select public.account_put('omc:x:v1', '{}')$q$), 'anon: account_put not callable');
select pg_temp.expect(pg_temp.fails('select public.account_orders()'), 'anon: account_orders not callable');
select pg_temp.expect(pg_temp.fails('select public.account_delete()'), 'anon: account_delete not callable');
select pg_temp.expect(pg_temp.fails($q$select public.shop_account_download('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000e1', 'x')$q$), 'anon: shop_account_download not callable');
reset role;

-- ------------------------------------------------------------ Mia saves and reads her own
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000a');
select pg_temp.expect(public.account_put('omc:organized-family-habits-builder:v1', '["After dinner, everyone clears their place."]', '/resources/organized-family-habits', 'Our habit stacks') is not null, 'Mia: saves a builder list');
select pg_temp.expect(public.account_put('omc:chore-chart:v1', '{"name": "Sam"}', '/chore-chart', 'Chore chart') is not null, 'Mia: saves a chore chart');
select pg_temp.expect(public.account_put('omc:chore-chart:v1', '{"name": "Sam and Ava"}') is not null, 'Mia: updates a save');
select pg_temp.expect((select data->>'name' from public.account_saves where key = 'omc:chore-chart:v1') = 'Sam and Ava', 'Mia: update replaced the data');
select pg_temp.expect((select page from public.account_saves where key = 'omc:chore-chart:v1') = '/chore-chart', 'Mia: update without a page keeps the page');
select pg_temp.expect((select count(*) from public.account_saves) = 2, 'Mia: sees only her two saves');
select pg_temp.expect(pg_temp.fails($q$select public.account_put('omc:v1:progress', '{}')$q$, 'invalid'), 'Mia: companion keys refused (step 2)');
select pg_temp.expect(pg_temp.fails($q$select public.account_put('omc:account:session', '{}')$q$, 'invalid'), 'Mia: account session key refused');
select pg_temp.expect(pg_temp.fails($q$select public.account_put('not-ours', '{}')$q$, 'invalid'), 'Mia: foreign keys refused');
select pg_temp.expect(pg_temp.fails($q$select public.account_put('omc:big:v1', to_jsonb(repeat('x', 70000)))$q$, 'invalid'), 'Mia: oversized save refused');
select pg_temp.expect(pg_temp.fails($q$select public.account_put('omc:x:v1', '{}', 'https://evil.example', null)$q$, 'invalid'), 'Mia: off-site page refused');
select pg_temp.expect(pg_temp.fails($q$insert into public.account_saves (user_id, key, data) values ('00000000-0000-0000-0000-00000000000b', 'omc:x:v1', '{}')$q$), 'Mia: direct insert denied');
select pg_temp.expect(pg_temp.fails($q$update public.account_saves set data = '{}'$q$), 'Mia: direct update denied');
select pg_temp.expect((public.account_profile()->>'email') = 'mia@example.com', 'Mia: profile shows her lowercased email');
reset role;

-- ------------------------------------------------------------ Jo can't see or touch Mia's
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000b');
select pg_temp.expect((select count(*) from public.account_saves) = 0, 'Jo: sees none of Mia''s saves');
delete from public.account_saves where key = 'omc:chore-chart:v1';
reset role;
select pg_temp.expect((select count(*) from public.account_saves where user_id = '00000000-0000-0000-0000-00000000000a') = 2, 'Jo: delete of Mia''s save did nothing');

-- ------------------------------------------------------------ the save cap
insert into public.account_saves (user_id, key, data)
select '00000000-0000-0000-0000-00000000000b', 'omc:filler-' || g || ':v1', '{}' from generate_series(1, 200) g;
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000b');
select pg_temp.expect(pg_temp.fails($q$select public.account_put('omc:one-more:v1', '{}')$q$, 'too_many'), 'cap: a 201st save is refused');
select pg_temp.expect(public.account_put('omc:filler-1:v1', '{"a": 1}') is not null, 'cap: updating an existing save still works');
reset role;

-- ------------------------------------------------------------ purchases by verified email
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000a');
select pg_temp.expect(jsonb_array_length(public.account_orders()) = 2, 'Mia: two paid or refunded orders, pending left out');
select pg_temp.expect((select bool_and((x->>'order_number')::int in (1001, 1004)) from jsonb_array_elements(public.account_orders()) x), 'Mia: only her own orders, matched case-insensitively');
select pg_temp.expect((select (x->>'files')::boolean from jsonb_array_elements(public.account_orders()) x where (x->>'order_number')::int = 1001), 'Mia: paid download order offers files');
select pg_temp.expect(not (select (x->>'files')::boolean from jsonb_array_elements(public.account_orders()) x where (x->>'order_number')::int = 1004), 'Mia: refunded order offers no files');
select pg_temp.expect(not (public.account_orders()::text like '%token%'), 'Mia: no download tokens in the list');
reset role;
select pg_temp.expect((select user_id from public.shop_entitlements where order_id = '00000000-0000-0000-0000-0000000000e1') = '00000000-0000-0000-0000-00000000000a', 'Mia: her entitlement is now linked to her account');

select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000c');
select pg_temp.expect(public.account_orders() = '[]'::jsonb, 'unconfirmed email: sees no orders');
select pg_temp.expect(pg_temp.fails('select public.account_set_marketing(true)', 'not_signed_in'), 'unconfirmed email: can''t opt in to marketing');
reset role;

-- ------------------------------------------------------------ downloads from the account (service role)
set role service_role;
select pg_temp.expect(jsonb_array_length(public.shop_account_download('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000e1', '1.1.1.1')->'files') = 1, 'download: Mia gets her files although the emailed link expired');
select pg_temp.expect(pg_temp.fails($q$select public.shop_account_download('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000e2', '1.1.1.1')$q$, 'invalid_link'), 'download: Mia can''t download Jo''s order');
select pg_temp.expect(pg_temp.fails($q$select public.shop_account_download('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000e4', '1.1.1.1')$q$, 'access_revoked'), 'download: refunded order refused');
select pg_temp.expect(pg_temp.fails($q$select public.shop_account_download('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000e1', '1.1.1.1')$q$, 'invalid_link'), 'download: unconfirmed account refused');
reset role;
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000a');
select pg_temp.expect(pg_temp.fails($q$select public.shop_account_download('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000e1', 'x')$q$), 'download: not callable from the browser');
reset role;

-- ------------------------------------------------------------ marketing consent
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000a');
select public.account_set_marketing(true);
reset role;
select pg_temp.expect((select marketing_opt_in and consent_version = 'account-v1' from public.tool_email_contacts where email = 'mia@example.com'), 'marketing: opt-in recorded with its version');
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000a');
select public.account_set_marketing(false);
select pg_temp.expect(not (public.account_profile()->>'marketing')::boolean, 'marketing: opt-out shows on the profile');
select pg_temp.expect((select count(*) from public.tool_email_contacts) = 0, 'marketing: the contact list stays admin-only (row-level security hides every row)');
reset role;

-- ------------------------------------------------------------ deleting the account
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000ad');
select pg_temp.expect(pg_temp.fails('select public.account_delete()', 'admin_account'), 'delete: admins can''t delete themselves here');
reset role;
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000a');
select public.account_delete();
reset role;
select pg_temp.expect(not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000a'), 'delete: her sign-in is gone');
select pg_temp.expect(not exists (select 1 from public.account_saves where user_id = '00000000-0000-0000-0000-00000000000a'), 'delete: her saves are gone');
select pg_temp.expect(exists (select 1 from public.shop_orders where id = '00000000-0000-0000-0000-0000000000e1'), 'delete: her order record stays');
select pg_temp.expect((select user_id is null from public.shop_entitlements where order_id = '00000000-0000-0000-0000-0000000000e1'), 'delete: her entitlement is unlinked');
