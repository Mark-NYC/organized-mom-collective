-- Organized Family Club: the mailing cutoff becomes a recurring weekday rule, plus a one-time launch exception, and
-- the settings writes work through the API.
--
-- 1. "UPDATE requires a WHERE clause" on /admin/club → Setup. Supabase preloads pg-safeupdate for API connections
--    (role authenticator: session_preload_libraries = supautils, safeupdate), which rejects an UPDATE or DELETE
--    without a WHERE, even inside a security definer function. club_admin_settings (the Setup page) and
--    club_settings_set_portal (club-admin → stripe_setup) updated the one-row club_settings without one. Both now
--    say `where id`; supabase/tests/club-membership.sql fails on any WHERE-less UPDATE/DELETE in a public function.
--
-- 2. Cutoff rule. A month's printed mailing list closes at 23:59:59 New York time on the Nth weekday of the month
--    BEFORE it (default: the second Sunday; "last" is -1). Second Sunday of November → December's list closes, of
--    December → January's, and so on. It replaces the fixed day (cutoff_day, the 15th) and the kits' own seeded
--    mailer_cutoff_at values, so every month follows the one rule (kits' column is kept, synced, for reference).
--
-- 3. Mailing eligibility is decided by the cutoff, separately from digital access:
--      * Digital is unchanged: a paid invoice opens the months its period covers (monthly 1, annual 12).
--      * Physical: each paid month at or after first_mailing_month earns one printed mailing, assigned to the
--        earliest month whose list is still open when the invoice is paid and that she doesn't hold yet. Join on
--        Nov 2 (before Sunday Nov 8) → December's mailing; join Nov 20 → January's. Nothing is ever "late" for an
--        invoice, and a missed cutoff never touches digital access.
--      * Idempotent per invoice and period (a replayed invoice.paid assigns nothing new); a full refund or dispute
--        still revokes everything its invoice granted.
--
-- 4. Launch exception (one time, configurable, off when cleared). For one named month, families whose paid
--    invoice covers that month and is paid by launch_exception_cutoff_at also get that month's mailing, on top
--    of their normal assignment (so a founding monthly member gets November and December, not a December gap).
--    It never changes the rule for any other month, and lapses by itself once its deadline passes. Seeded:
--    November 2026, through Sunday November 8, 2026, 23:59:59 New York time (the founding-families week).
--
-- Existing entitlements and fulfillment orders are not changed (production has none yet; the migration doesn't
-- touch either table).

begin;

-- ---------------------------------------------------------------- settings

alter table public.club_settings
  add column cutoff_ordinal smallint not null default 2 check (cutoff_ordinal in (1, 2, 3, 4, -1)),
  -- 0 = Sunday … 6 = Saturday (extract(dow)).
  add column cutoff_weekday smallint not null default 0 check (cutoff_weekday between 0 and 6),
  add column launch_exception_month date check (extract(day from launch_exception_month) = 1),
  add column launch_exception_cutoff_at timestamptz,
  add constraint club_settings_launch_exception_pair
    check ((launch_exception_month is null) = (launch_exception_cutoff_at is null));
alter table public.club_settings drop column cutoff_day;

-- ---------------------------------------------------------------- the rule

-- The rule's cutoff for a delivery month: 23:59:59 New York time on the Nth (or last, -1) weekday of the month before.
create function public.club_rule_cutoff_at(p_month date, p_ordinal int, p_weekday int) returns timestamptz
language sql stable set search_path = '' as $$
  with b as (
    select date_trunc('month', p_month - interval '1 month')::date as first_day,
           (date_trunc('month', p_month) - interval '1 day')::date as last_day
  )
  select ((case when p_ordinal > 0
                then b.first_day + ((p_weekday - extract(dow from b.first_day)::int + 7) % 7) + (p_ordinal - 1) * 7
                else b.last_day - ((extract(dow from b.last_day)::int - p_weekday + 7) % 7) end)
          + time '23:59:59') at time zone 'America/New_York'
    from b;
$$;

-- A month's regular cutoff under the current settings (the kit's own column no longer overrides it).
create or replace function public.club_cutoff_at(p_month date) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select public.club_rule_cutoff_at(p_month, s.cutoff_ordinal, s.cutoff_weekday) from public.club_settings s;
$$;

-- The mailing a payment made at p_at earns: the earliest month from first_mailing_month whose list is still open
-- and that she doesn't already hold a live physical entitlement for.
create function public.club_next_mailing_month(p_user uuid, p_at timestamptz) returns date
language plpgsql stable security definer set search_path = '' as $$
declare
  m date := greatest((select s.first_mailing_month from public.club_settings s), public.club_month_of(p_at));
begin
  for i in 1 .. 240 loop
    if public.club_cutoff_at(m) >= p_at
       and not exists (select 1 from public.club_entitlements e
                        where e.user_id = p_user and e.resource_month = m and e.kind = 'physical' and e.revoked_at is null) then
      return m;
    end if;
    m := (m + interval '1 month')::date;
  end loop;
  raise exception 'no_mailing_month';
end $$;

-- The cutoffs from a month on, for the admin (and the tests): rule cutoff, and the launch exception where it applies.
create function public.club_cutoff_schedule(p_from date, p_count int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'month', m,
           'cutoff_at', public.club_cutoff_at(m),
           'cutoff_date', (public.club_cutoff_at(m) at time zone 'America/New_York')::date,
           'launch_exception_cutoff_at', case when m = s.launch_exception_month then s.launch_exception_cutoff_at end)
         order by m), '[]')
    from public.club_settings s,
         generate_series(date_trunc('month', p_from)::date, (date_trunc('month', p_from) + make_interval(months => greatest(least(p_count, 36), 1) - 1))::date, interval '1 month') g,
         lateral (select g::date as m) x;
$$;

revoke execute on function public.club_rule_cutoff_at(date, int, int), public.club_next_mailing_month(uuid, timestamptz),
  public.club_cutoff_schedule(date, int) from public, anon, authenticated;
grant execute on function public.club_rule_cutoff_at(date, int, int), public.club_next_mailing_month(uuid, timestamptz),
  public.club_cutoff_schedule(date, int) to service_role;

-- ---------------------------------------------------------------- granting

create or replace function public.club_invoice_apply(p jsonb, p_periods jsonb default '[]') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  sub public.club_subscriptions%rowtype;
  inv public.club_invoices%rowtype;
  hh public.club_households%rowtype;
  st public.club_settings%rowtype;
  first_month date;
  per jsonb;
  m date;
  n int;
  i int;
  owed int;
  paid_at timestamptz;
  ent uuid;
  granted int := 0;
  months date[] := '{}';
  covers_launch boolean := false;
  first_paid boolean := false;
begin
  select * into st from public.club_settings;
  select * into sub from public.club_subscriptions where stripe_subscription_id = p ->> 'subscription';
  if not found then raise exception 'unknown_subscription'; end if;
  insert into public.club_invoices as x (stripe_invoice_id, subscription_id, user_id, status, billing_reason, amount_due_cents,
    amount_paid_cents, period_start, period_end, paid_at, livemode, stripe_payment_intent_id, stripe_charge_id, attempt_count,
    failure_message, plan, updated_at)
  values (p ->> 'id', sub.id, sub.user_id, p ->> 'status', p ->> 'billing_reason', coalesce((p ->> 'amount_due_cents')::int, 0),
    coalesce((p ->> 'amount_paid_cents')::int, 0), (p ->> 'period_start')::timestamptz, (p ->> 'period_end')::timestamptz,
    (p ->> 'paid_at')::timestamptz, (p ->> 'livemode')::boolean, p ->> 'payment_intent', p ->> 'charge',
    coalesce((p ->> 'attempt_count')::int, 0), left(p ->> 'failure_message', 300), p ->> 'plan', now())
  on conflict (stripe_invoice_id) do update set
    status = excluded.status, amount_due_cents = excluded.amount_due_cents, amount_paid_cents = excluded.amount_paid_cents,
    period_start = excluded.period_start, period_end = excluded.period_end, paid_at = coalesce(excluded.paid_at, x.paid_at),
    stripe_payment_intent_id = coalesce(excluded.stripe_payment_intent_id, x.stripe_payment_intent_id),
    stripe_charge_id = coalesce(excluded.stripe_charge_id, x.stripe_charge_id),
    attempt_count = greatest(x.attempt_count, excluded.attempt_count), failure_message = excluded.failure_message,
    plan = coalesce(excluded.plan, x.plan), updated_at = now()
  returning * into inv;

  if inv.status <> 'paid' or inv.amount_refunded_cents >= greatest(inv.amount_paid_cents, 1) and inv.amount_paid_cents > 0
     or inv.disputed or sub.access_revoked_at is not null or sub.user_id is null or 'duplicate' = any (sub.flags) then
    return jsonb_build_object('granted', 0, 'status', inv.status, 'first_paid', false, 'months', '[]'::jsonb);
  end if;
  paid_at := coalesce(inv.paid_at, now());

  select * into hh from public.club_households where owner_user_id = sub.user_id for update;
  if not found then raise exception 'no_household'; end if;
  first_paid := not exists (select 1 from public.club_entitlements e where e.user_id = sub.user_id and e.source = 'invoice' and e.invoice_id <> inv.stripe_invoice_id);

  -- The household's first paid month: the earliest month any paid period covers.
  select min(public.club_month_of((x ->> 'start')::timestamptz)) into first_month from jsonb_array_elements(p_periods) x;
  if first_month is not null and (hh.first_paid_month is null or first_month < hh.first_paid_month) then
    update public.club_households set first_paid_month = first_month, enrolled_at = coalesce(enrolled_at, inv.paid_at, now())
     where id = hh.id returning * into hh;
  end if;

  for per in select * from jsonb_array_elements(p_periods) loop
    n := case when per ->> 'plan' = 'annual' then 12 else 1 end;
    owed := 0;
    -- Digital: the months the period covers.
    for i in 0 .. n - 1 loop
      m := (public.club_month_of((per ->> 'start')::timestamptz) + make_interval(months => i))::date;
      insert into public.club_entitlements (user_id, household_id, resource_month, kit_id, kind, membership_year, plan, source,
        invoice_id, subscription_id, period_start, period_end)
      values (sub.user_id, hh.id, m, (select k.id from public.club_kits k where k.month = m), 'digital',
        public.club_membership_year(hh.first_paid_month, m), per ->> 'plan', 'invoice', inv.stripe_invoice_id, sub.id,
        (per ->> 'start')::timestamptz, (per ->> 'end')::timestamptz)
      on conflict (user_id, resource_month, kind) where revoked_at is null do nothing;
      if found then granted := granted + 1; months := months || m; end if;
      if m >= st.first_mailing_month then owed := owed + 1; end if;
      if m = st.launch_exception_month then covers_launch := true; end if;
    end loop;
    -- Physical: one mailing per paid month from the first mailing month, each to the earliest month still open.
    -- What this period already earned (a replay) counts, so it never assigns twice.
    owed := owed - (select count(*) from public.club_entitlements e
                     where e.invoice_id = inv.stripe_invoice_id and e.kind = 'physical'
                       and e.period_start = (per ->> 'start')::timestamptz and e.note is distinct from 'launch_exception');
    for i in 1 .. owed loop
      m := public.club_next_mailing_month(sub.user_id, paid_at);
      insert into public.club_entitlements (user_id, household_id, resource_month, kit_id, kind, membership_year, plan, source,
        invoice_id, subscription_id, period_start, period_end)
      values (sub.user_id, hh.id, m, (select k.id from public.club_kits k where k.month = m), 'physical',
        -- The membership year that paid for it, not the year its delivery month falls in.
        public.club_membership_year(hh.first_paid_month, public.club_month_of((per ->> 'start')::timestamptz)), per ->> 'plan', 'invoice', inv.stripe_invoice_id, sub.id,
        (per ->> 'start')::timestamptz, (per ->> 'end')::timestamptz)
      returning id into ent;
      insert into public.club_fulfillment_orders (entitlement_id, user_id, household_id, resource_month, kit_id, late, cutoff_at, provider)
      values (ent, sub.user_id, hh.id, m, (select k.id from public.club_kits k where k.month = m), false, public.club_cutoff_at(m), 'manual')
      on conflict do nothing;
    end loop;
  end loop;

  -- The one-time launch exception: that month's mailing as well, for an invoice covering it, paid by its deadline.
  if covers_launch and st.launch_exception_month >= st.first_mailing_month and paid_at <= st.launch_exception_cutoff_at then
    insert into public.club_entitlements (user_id, household_id, resource_month, kit_id, kind, membership_year, plan, source,
      invoice_id, subscription_id, period_start, period_end, note)
    select sub.user_id, hh.id, st.launch_exception_month, (select k.id from public.club_kits k where k.month = st.launch_exception_month),
      'physical', public.club_membership_year(hh.first_paid_month, public.club_month_of(inv.period_start)), coalesce(inv.plan, 'monthly'), 'invoice',
      inv.stripe_invoice_id, sub.id, inv.period_start, inv.period_end, 'launch_exception'
    on conflict (user_id, resource_month, kind) where revoked_at is null do nothing
    returning id into ent;
    if found then
      insert into public.club_fulfillment_orders (entitlement_id, user_id, household_id, resource_month, kit_id, late, cutoff_at, provider, note)
      values (ent, sub.user_id, hh.id, st.launch_exception_month, (select k.id from public.club_kits k where k.month = st.launch_exception_month),
        false, st.launch_exception_cutoff_at, 'manual', 'Launch exception')
      on conflict do nothing;
    end if;
  end if;

  return jsonb_build_object('granted', granted, 'status', inv.status, 'first_paid', first_paid and granted > 0,
    'months', to_jsonb(months), 'user_id', sub.user_id, 'household_id', hh.id,
    'mailings', (select coalesce(jsonb_agg(e.resource_month order by e.resource_month), '[]') from public.club_entitlements e
                  where e.invoice_id = inv.stripe_invoice_id and e.kind = 'physical' and e.revoked_at is null));
end $$;

-- ---------------------------------------------------------------- settings writes (WHERE: pg-safeupdate)

create or replace function public.club_settings_set_portal(p_id text) returns void
language sql security definer set search_path = '' as $$
  update public.club_settings set portal_configuration_id = p_id, updated_at = now() where id;
$$;

create or replace function public.club_admin_settings(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s public.club_settings%rowtype;
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p is null or jsonb_typeof(p) <> 'object' or exists (select 1 from jsonb_object_keys(p) k where k not in ('checkout_mode',
     'first_mailing_month', 'cutoff_ordinal', 'cutoff_weekday', 'member_review', 'launch_exception_month', 'launch_exception_cutoff_at')) then
    raise exception 'invalid';
  end if;
  update public.club_settings set
    checkout_mode = coalesce(p ->> 'checkout_mode', checkout_mode),
    first_mailing_month = coalesce((p ->> 'first_mailing_month')::date, first_mailing_month),
    cutoff_ordinal = coalesce((p ->> 'cutoff_ordinal')::smallint, cutoff_ordinal),
    cutoff_weekday = coalesce((p ->> 'cutoff_weekday')::smallint, cutoff_weekday),
    member_review = coalesce((p ->> 'member_review')::boolean, member_review),
    -- Present and null clears the exception.
    launch_exception_month = case when p ? 'launch_exception_month' then (p ->> 'launch_exception_month')::date else launch_exception_month end,
    launch_exception_cutoff_at = case when p ? 'launch_exception_cutoff_at' then (p ->> 'launch_exception_cutoff_at')::timestamptz else launch_exception_cutoff_at end,
    updated_at = now()
   where id
  returning * into s;
  -- An exception only ever extends its own month: after that month's regular cutoff, before the month ends.
  if s.launch_exception_month is not null and (s.launch_exception_cutoff_at <= public.club_cutoff_at(s.launch_exception_month)
     or s.launch_exception_cutoff_at >= ((s.launch_exception_month + interval '1 month')::timestamp at time zone 'America/New_York')) then
    raise exception 'invalid';
  end if;
  update public.club_kits set mailer_cutoff_at = public.club_cutoff_at(month) where mailer_cutoff_at is distinct from public.club_cutoff_at(month);
  perform public.admin_log('club.settings', 'club_settings', p);
  return to_jsonb(s) - 'id';
exception
  when check_violation or invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
    raise exception 'invalid';
end $$;

-- The same guard elsewhere. shop_update_settings: exactly the definition already live in production (it was fixed
-- there directly; the repo still had the WHERE-less one), so the shop doesn't change. admin_rotate_inventory_token
-- (/admin → Products & Inventory) was still WHERE-less in production.
create or replace function public.shop_update_settings(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p ->> 'tax_mode' = 'manual' then
    raise exception 'manual_tax_disabled';
  end if;
  update public.shop_settings set
    checkout_mode = coalesce(p ->> 'checkout_mode', checkout_mode),
    tax_mode = coalesce(p ->> 'tax_mode', tax_mode),
    tax_reviewed = tax_reviewed or p ? 'tax_mode',
    product_tax_code = coalesce(p ->> 'product_tax_code', product_tax_code),
    checkout_minutes = coalesce((p ->> 'checkout_minutes')::int, checkout_minutes),
    max_checkouts_per_hour = coalesce((p ->> 'max_checkouts_per_hour')::int, max_checkouts_per_hour),
    updated_at = now()
  where id;
  if not found then
    raise exception 'settings_missing';
  end if;
end $$;

create or replace function public.admin_rotate_inventory_token() returns text
language plpgsql security definer set search_path = '' as $$
declare
  t text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.admin_secret set inventory_token_hash = encode(extensions.digest(t, 'sha256'), 'hex'), inventory_token_set_at = now() where id;
  perform public.admin_log_service(auth.uid(), 'admin.inventory_token_rotated', null, '{}');
  return t;
end $$;

-- The Setup page's cutoff table.
create function public.club_admin_cutoffs(p_from date, p_count int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.club_cutoff_schedule(p_from, p_count);
end $$;
revoke execute on function public.club_admin_cutoffs(date, int) from public, anon;
grant execute on function public.club_admin_cutoffs(date, int) to authenticated;

-- ---------------------------------------------------------------- data: the rule and the launch week

update public.club_kits set mailer_cutoff_at = public.club_cutoff_at(month) where mailer_cutoff_at is distinct from public.club_cutoff_at(month);
update public.club_settings set launch_exception_month = '2026-11-01',
  launch_exception_cutoff_at = '2026-11-08 23:59:59 America/New_York' where id;

commit;
