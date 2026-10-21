-- Customer accounts, step 1: sign in with an emailed code, save what she makes, see what she bought.
-- Runs after every shop and admin migration. Setup and launch checklist: supabase/ACCOUNTS.md.
--
--   * Sign-in is Supabase Auth email OTP (a 6-digit code, no password). Customers are ordinary
--     auth.users; nothing here grants admin rights (those stay in admin_users / shop_admins).
--   * account_saves: one row per saved browser key (a builder list, a chore chart, a planner).
--     She reads and deletes only her own rows; writes go through account_put, which caps size,
--     count and key shape and stamps the server time.
--   * Purchases are matched to her VERIFIED email (auth.users.email_confirmed_at), never to a typed
--     address. account_orders lists them; the shop-download Edge Function hands out files for a
--     digital order through shop_account_download (service role only), with no 7-day expiry.
--   * Marketing consent is separate from signing in and lands in tool_email_contacts, the one list.
--   * account_delete removes her saves and her sign-in. Orders stay: they're business records.
--
-- Supabase dashboard → SQL Editor → paste this whole file → Run, once.

begin;

-- ---------------------------------------------------------------- saves

create table public.account_saves (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- A browser storage key: omc:<name>:v<n>. Never the companion's own omc:v1:* keys (step 2),
  -- the account session or sync state, or the download-gate flag.
  key text not null check (
    key ~ '^omc:[a-z0-9][a-z0-9._-]*(:[a-z0-9][a-z0-9._-]*)*$' and char_length(key) <= 120
    and key !~ '^omc:(v1|account|tool-download-access)(:|$)'
  ),
  data jsonb not null check (octet_length(data::text) <= 65536),
  -- Where she made it, and what to call it on her account page.
  page text check (page ~ '^/[A-Za-z0-9/_.-]{0,200}$'),
  label text check (char_length(label) <= 160),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.account_saves enable row level security;
revoke all on public.account_saves from anon, authenticated;
grant select, delete on public.account_saves to authenticated;
create policy "Customers read their own saves" on public.account_saves
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Customers delete their own saves" on public.account_saves
  for delete to authenticated using (user_id = (select auth.uid()));

-- Most saves one account keeps. Each tool or article element is one key, so this is generous.
create function public.account_max_saves() returns int language sql immutable as $$ select 200 $$;

-- Save one key. Returns the server time it was saved at (the client's sync marker).
create function public.account_put(p_key text, p_data jsonb, p_page text default null, p_label text default null)
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  saved timestamptz;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if p_key is null or p_data is null then raise exception 'invalid'; end if;
  -- Serialize this account's writes so the count check can't race.
  perform pg_advisory_xact_lock(hashtextextended('account-put:' || uid::text, 0));
  if not exists (select 1 from public.account_saves where user_id = uid and key = p_key)
     and (select count(*) from public.account_saves where user_id = uid) >= public.account_max_saves() then
    raise exception 'too_many';
  end if;
  insert into public.account_saves (user_id, key, data, page, label, updated_at)
  values (uid, p_key, p_data, nullif(p_page, ''), nullif(left(p_label, 160), ''), now())
  on conflict (user_id, key) do update
    set data = excluded.data,
        page = coalesce(excluded.page, account_saves.page),
        label = coalesce(excluded.label, account_saves.label),
        updated_at = now()
  returning updated_at into saved;
  return saved;
exception
  when check_violation then raise exception 'invalid';
end $$;
revoke execute on function public.account_put(text, jsonb, text, text) from public;
grant execute on function public.account_put(text, jsonb, text, text) to authenticated;

-- ---------------------------------------------------------------- her verified email

-- The signed-in customer's email, only once Supabase has confirmed it (an OTP sign-in does).
create function public.account_email() returns text
language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u
   where u.id = auth.uid() and u.email is not null and u.email_confirmed_at is not null;
$$;
revoke execute on function public.account_email() from public;
grant execute on function public.account_email() to authenticated;

-- ---------------------------------------------------------------- profile and consent

create function public.account_profile() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e text := public.account_email();
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  return jsonb_build_object(
    'email', e,
    'marketing', coalesce((select c.marketing_opt_in from public.tool_email_contacts c where c.email = e), false),
    'saves', (select count(*) from public.account_saves s where s.user_id = auth.uid()));
end $$;
revoke execute on function public.account_profile() from public;
grant execute on function public.account_profile() to authenticated;

-- Opt in or out of marketing email. Separate from signing in; recorded with its own version.
create function public.account_set_marketing(p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e text := public.account_email();
begin
  if e is null then raise exception 'not_signed_in'; end if;
  if p_on is null then raise exception 'invalid'; end if;
  insert into public.tool_email_contacts (email, first_tool, last_tool, marketing_opt_in, marketing_opt_in_at, consent_version)
  values (e, 'account', 'account', p_on, case when p_on then now() end, case when p_on then 'account-v1' end)
  on conflict (email) do update set
    last_tool = 'account',
    marketing_opt_in = p_on,
    marketing_opt_in_at = case when p_on then now() else tool_email_contacts.marketing_opt_in_at end,
    consent_version = case when p_on then 'account-v1' else tool_email_contacts.consent_version end;
end $$;
revoke execute on function public.account_set_marketing(boolean) from public;
grant execute on function public.account_set_marketing(boolean) to authenticated;

-- ---------------------------------------------------------------- purchases

-- Her paid orders, matched to her verified email. No address, phone or payment details.
-- Also links her entitlements to her account (the column shop_entitlements.user_id waited for this).
create function public.account_orders() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e text := public.account_email();
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if e is null then return '[]'::jsonb; end if;
  update public.shop_entitlements set user_id = auth.uid()
   where lower(email) = e and user_id is null;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', o.id,
             'order_number', o.order_number,
             'paid_at', o.paid_at,
             'digital', o.digital,
             'payment_status', o.payment_status,
             'fulfillment_status', o.fulfillment_status,
             'carrier', o.carrier,
             'tracking_url', o.tracking_url,
             'total_cents', o.total_cents,
             'currency', o.currency,
             'test', o.livemode is false,
             'files', o.digital and o.payment_status in ('paid', 'partially_refunded')
                      and exists (select 1 from public.shop_entitlements d
                                   where d.order_id = o.id and d.kind = 'download' and d.revoked_at is null),
             'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.product_name, 'slug', i.product_slug, 'quantity', i.quantity) order by i.product_name), '[]')
                         from public.shop_order_items i where i.order_id = o.id))
           order by o.paid_at desc nulls last)
      from public.shop_orders o
     where lower(o.email) = e
       and o.order_number is not null
       and o.payment_status in ('paid', 'partially_refunded', 'refunded')), '[]'::jsonb);
end $$;
revoke execute on function public.account_orders() from public;
grant execute on function public.account_orders() to authenticated;

-- The shop-download Edge Function calls this for a signed-in customer (it verifies her token with
-- Supabase Auth first). Same answer as shop_download, but proven by her verified email instead of
-- an emailed token, so it never expires. Raises: invalid_link, access_revoked, rate_limited.
create function public.shop_account_download(p_user uuid, p_order uuid, p_client text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e text;
  o public.shop_orders%rowtype;
  d public.shop_entitlements%rowtype;
  client_key text;
begin
  client_key := encode(extensions.digest(coalesce(p_client, 'unknown') || current_date::text || (select salt from public.shop_secret), 'sha256'), 'hex');
  if not public.shop_allow(client_key, 'account_download', 60, interval '1 hour') then
    raise exception 'rate_limited';
  end if;
  select lower(u.email) into e from auth.users u
   where u.id = p_user and u.email is not null and u.email_confirmed_at is not null;
  if e is null or p_order is null then raise exception 'invalid_link'; end if;
  select * into o from public.shop_orders where id = p_order and lower(email) = e and digital;
  if not found then raise exception 'invalid_link'; end if;
  select * into d from public.shop_entitlements where order_id = o.id and kind = 'download' for update;
  if not found or d.revoked_at is not null or o.payment_status not in ('paid', 'partially_refunded') then
    raise exception 'access_revoked';
  end if;
  update public.shop_entitlements set downloads = downloads + 1, user_id = coalesce(user_id, p_user) where id = d.id;
  if d.downloads = 0 then
    perform public.shop_event(o.id, 'downloaded', jsonb_build_object('via', 'account'), 'customer');
  end if;
  return jsonb_build_object(
    'order_number', o.order_number,
    'livemode', o.livemode,
    'expires_at', null,
    'files', coalesce((select jsonb_agg(x.value || jsonb_build_object('product', i.product_name) order by i.product_name, x.ordinality)
                         from public.shop_order_items i
                         join public.shop_products p on p.id = i.product_id and p.kind = 'digital'
                         cross join lateral jsonb_array_elements(p.files) with ordinality x
                        where i.order_id = o.id), '[]'));
end $$;
revoke execute on function public.shop_account_download(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.shop_account_download(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------- deleting the account

-- Removes her saves and her sign-in, unlinks her entitlements and turns off marketing email.
-- Orders and receipts stay (business and tax records). Admin accounts can't delete themselves here.
create function public.account_delete() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  e text := public.account_email();
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from public.admin_users where user_id = uid)
     or exists (select 1 from public.shop_admins where user_id = uid)
     or exists (select 1 from public.survey_admins where user_id = uid) then
    raise exception 'admin_account';
  end if;
  delete from public.account_saves where user_id = uid;
  update public.shop_entitlements set user_id = null where user_id = uid;
  if e is not null then
    update public.tool_email_contacts set marketing_opt_in = false where email = e;
  end if;
  delete from auth.users where id = uid;
end $$;
revoke execute on function public.account_delete() from public;
grant execute on function public.account_delete() to authenticated;

commit;
