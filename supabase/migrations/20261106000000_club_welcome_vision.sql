-- Organized Family Club: the Family Vision welcome print, the December substitution, and one regular resource
-- obligation per paid month. Plan: docs/club/MEMBERSHIP.md. Tests: supabase/tests/club-membership.sql.
--
-- The rules (each has a check in the tests):
--   * Every paid billing month is ONE resource obligation: the calendar month (New York) the paid period covers.
--     Monthly: one per paid cycle. Annual: twelve consecutive months per paid year. A renewal continues where the
--     subscription's previous paid period ended, and a month already held (e.g. monthly → annual mid-month) is never
--     sold twice: the twelve start with the first month not yet held. Months before she joined are never granted.
--   * Digital access to that month opens at payment. Its printed copy is that same month's resource, one
--     club_fulfillment_orders row (fulfillment_type 'monthly_resource'):
--       - paid by the month's cutoff (second Sunday of the month before, 23:59:59 New York; for November 2026 the
--         founding deadline, Sunday Nov 8) → the month's regular batch (late = false);
--       - paid after it → the same month's catch-up batch (late = true). Never dropped, never moved to another
--         month's content, never an extra mailing. The cutoff only decides the batch.
--   * The welcome print: every new paying household gets ONE personalized Family Vision print
--     (fulfillment_type 'welcome_vision'), whatever the month, outside the monthly cutoff. Created pending with the
--     first paid invoice; she personalizes and approves it on /club/family-vision; then it's printed. Not again on
--     renewal, plan change or a webhook retry (one live welcome order per household).
--   * December: when a household's ORIGINAL first paid month is a December, the welcome print IS that December's
--     resource. That month's entitlements are recorded with fulfilled_by = 'welcome_vision' (no Christmas kit opens,
--     no December monthly mailing) and the welcome order points at the December physical entitlement
--     (satisfies_month). A household that joined earlier gets the regular December resource.
--   * Refund or dispute of an invoice revokes exactly what it granted and cancels its unprinted orders, the welcome
--     print included when that invoice created it.
--
-- Replaces 20261105000000's physical assignment (earliest open month + launch-exception bonus mailing), which could
-- mail a paid month's resource in a different month and gave founding annual members 13 mailings. Production has no
-- entitlements or orders yet; existing rows would only gain defaults (fulfilled_by / fulfillment_type).

begin;

-- ---------------------------------------------------------------- schema (additive)

alter table public.club_entitlements
  add column fulfilled_by text not null default 'monthly_resource' check (fulfilled_by in ('monthly_resource', 'welcome_vision'));

alter table public.club_fulfillment_orders
  add column fulfillment_type text not null default 'monthly_resource' check (fulfillment_type in ('monthly_resource', 'welcome_vision')),
  -- welcome_vision only: the paid month it stands in for (a December first month), and the invoice that created it.
  add column satisfies_month date check (extract(day from satisfies_month) = 1),
  add column invoice_id text references public.club_invoices (stripe_invoice_id),
  -- welcome_vision only: { family_name, value } from /club/family-vision.
  add column personalization jsonb check (personalization is null or (jsonb_typeof(personalization) = 'object' and octet_length(personalization::text) <= 2000)),
  alter column entitlement_id drop not null,
  alter column cutoff_at drop not null,
  add constraint club_fulfillment_monthly_has_entitlement check (fulfillment_type <> 'monthly_resource' or (entitlement_id is not null and cutoff_at is not null)),
  add constraint club_fulfillment_satisfies_only_welcome check (satisfies_month is null or fulfillment_type = 'welcome_vision');

-- One standard monthly mailing per household and month; one live welcome print per household.
drop index public.club_fulfillment_one_per_month;
create unique index club_fulfillment_one_per_month on public.club_fulfillment_orders (household_id, resource_month)
  where status <> 'canceled' and fulfillment_type = 'monthly_resource';
create unique index club_fulfillment_one_welcome on public.club_fulfillment_orders (household_id)
  where status <> 'canceled' and fulfillment_type = 'welcome_vision';

-- The step that would have assigned mailings to other months is gone.
drop function public.club_next_mailing_month(uuid, timestamptz);

-- ---------------------------------------------------------------- helpers

-- The deadline for a month's regular batch: the rule, or the one-time launch exception for its month.
create function public.club_mailing_cutoff_at(p_month date) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select case when p_month = s.launch_exception_month then s.launch_exception_cutoff_at else public.club_cutoff_at(p_month) end
    from public.club_settings s;
$$;

-- The Family Vision choices (src/components/club/FamilyVisionPrint.astro).
create function public.club_vision_valid(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select p is not null and jsonb_typeof(p) = 'object'
     and char_length(btrim(coalesce(p ->> 'family_name', ''))) between 1 and 45
     and p ->> 'value' in ('Love', 'Faith', 'Joy', 'Peace', 'Adventure', 'Kindness', 'Courage', 'Gratitude', 'Togetherness',
                           'Hospitality', 'Growth', 'Creativity', 'Generosity', 'Wonder', 'Perseverance', 'Rest', 'Hope', 'Home',
                           'Service', 'Playfulness');
$$;

revoke execute on function public.club_mailing_cutoff_at(date), public.club_vision_valid(jsonb) from public, anon, authenticated;
grant execute on function public.club_mailing_cutoff_at(date), public.club_vision_valid(jsonb) to service_role;

-- A substituted December opens no kit and isn't the Christmas mailing.
create or replace function public.club_kits_link_entitlements() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.club_entitlements set kit_id = new.id where resource_month = new.month and kit_id is null and fulfilled_by = 'monthly_resource';
  update public.club_fulfillment_orders set kit_id = new.id where resource_month = new.month and kit_id is null and fulfillment_type = 'monthly_resource';
  return new;
end $$;

create or replace function public.club_earned(p_user uuid, p_kit uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.club_entitlements e join public.club_kits k on k.id = p_kit
     where e.user_id = p_user and e.resource_month = k.month and e.kind = 'digital' and e.revoked_at is null
       and e.fulfilled_by = 'monthly_resource');
$$;

-- ---------------------------------------------------------------- the queue (derived readiness)

create or replace view public.club_fulfillment_queue with (security_invoker = true) as
select o.id, o.user_id, o.household_id, o.resource_month, o.kit_id, k.slug as kit_slug, k.title as kit_title,
       o.status, o.late, o.cutoff_at, o.pdf_status, o.member_approved_at, o.printed_at, o.mailed_at, o.provider,
       o.provider_ref, o.note, o.created_at, o.updated_at,
       h.display_name, u.email,
       case
         when o.status not in ('pending', 'approved', 'on_hold') then o.status
         when o.fulfillment_type = 'welcome_vision' and (not public.club_vision_valid(o.personalization) or o.member_approved_at is null) then 'needs_vision'
         when o.fulfillment_type = 'monthly_resource' and h.onboarded_at is null then 'needs_profile'
         when a.user_id is null then 'needs_address'
         when a.paused then 'mail_paused'
         when o.fulfillment_type = 'monthly_resource' and (k.id is null or k.status = 'draft') then 'needs_resource'
         when o.pdf_status <> 'ready' then 'needs_pdf'
         else 'ready' end as readiness,
       coalesce(o.address, l.address) as address,
       l.address as live_address,
       o.fulfillment_type,
       o.satisfies_month,
       o.personalization,
       case when o.fulfillment_type = 'welcome_vision' then 'welcome' when o.late then 'catch_up' else 'regular' end as batch,
       h.first_paid_month,
       h.enrolled_at
  from public.club_fulfillment_orders o
  join public.club_households h on h.id = o.household_id
  join auth.users u on u.id = o.user_id
  left join public.club_kits k on k.id = o.kit_id
  left join public.club_mailing_addresses a on a.user_id = o.user_id
  left join lateral (select case when a.user_id is not null then jsonb_build_object('name', a.name, 'line1', a.line1, 'line2', a.line2,
    'city', a.city, 'state', a.state, 'postal_code', a.postal_code, 'country', a.country) end as address) l on true;

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
  p_start timestamptz;
  p_end timestamptz;
  m date;
  n int;
  have int;
  guard int;
  by_ text;
  paid_at timestamptz;
  ent uuid;
  welcome uuid;
  granted int := 0;
  months date[] := '{}';
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

  -- The household's original first paid month: the earliest month any paid period covers. Never moves later.
  select min(public.club_month_of((x ->> 'start')::timestamptz)) into first_month from jsonb_array_elements(p_periods) x;
  if first_month is not null and (hh.first_paid_month is null or first_month < hh.first_paid_month) then
    update public.club_households set first_paid_month = first_month, enrolled_at = coalesce(enrolled_at, inv.paid_at, now())
     where id = hh.id returning * into hh;
  end if;

  -- The welcome print: once per household, outside the monthly cutoff, pending until she personalizes and approves it.
  if jsonb_array_length(p_periods) > 0 then
    insert into public.club_fulfillment_orders (user_id, household_id, resource_month, fulfillment_type, invoice_id, provider, personalization)
    values (sub.user_id, hh.id, public.club_month_of(paid_at), 'welcome_vision', inv.stripe_invoice_id, 'manual', null)
    on conflict (household_id) where status <> 'canceled' and fulfillment_type = 'welcome_vision' do nothing;
  end if;
  select o.id into welcome from public.club_fulfillment_orders o
   where o.household_id = hh.id and o.fulfillment_type = 'welcome_vision' and o.status <> 'canceled';

  for per in select * from jsonb_array_elements(p_periods) loop
    n := case when per ->> 'plan' = 'annual' then 12 else 1 end;
    p_start := (per ->> 'start')::timestamptz;
    p_end := (per ->> 'end')::timestamptz;
    -- What this invoice's period already granted (a replay grants nothing new).
    select count(*) into have from public.club_entitlements e
     where e.invoice_id = inv.stripe_invoice_id and e.kind = 'digital' and e.period_start = p_start;
    -- A renewal continues right after the months its subscription's previous paid period bought; otherwise the
    -- month the period starts in. Months already held are skipped, so a month is never sold twice.
    m := coalesce((select (max(e.resource_month) + interval '1 month')::date from public.club_entitlements e
                    where e.subscription_id = sub.id and e.kind = 'digital' and e.revoked_at is null
                      and e.period_end = p_start and e.invoice_id <> inv.stripe_invoice_id),
                  public.club_month_of(p_start));
    guard := 0;
    while have < n and guard < 36 loop
      guard := guard + 1;
      if not exists (select 1 from public.club_entitlements e where e.user_id = sub.user_id and e.resource_month = m
                      and e.kind = 'digital' and e.revoked_at is null) then
        by_ := case when extract(month from m) = 12 and m = hh.first_paid_month then 'welcome_vision' else 'monthly_resource' end;
        insert into public.club_entitlements (user_id, household_id, resource_month, kit_id, kind, membership_year, plan, source,
          invoice_id, subscription_id, period_start, period_end, fulfilled_by)
        values (sub.user_id, hh.id, m, case when by_ = 'monthly_resource' then (select k.id from public.club_kits k where k.month = m) end,
          'digital', public.club_membership_year(hh.first_paid_month, m), per ->> 'plan', 'invoice', inv.stripe_invoice_id, sub.id,
          p_start, p_end, by_);
        have := have + 1;
        granted := granted + 1;
        months := months || m;
      end if;
      m := (m + interval '1 month')::date;
    end loop;

    -- The printed copy of each paid month from the first mailing month: that month's resource, in its regular batch
    -- when paid by its cutoff, else its catch-up batch. A substituted December is the welcome print instead.
    for m, by_ in select e.resource_month, e.fulfilled_by from public.club_entitlements e
                   where e.invoice_id = inv.stripe_invoice_id and e.kind = 'digital' and e.period_start = p_start and e.revoked_at is null
                     and e.resource_month >= st.first_mailing_month
                   order by e.resource_month loop
      insert into public.club_entitlements (user_id, household_id, resource_month, kit_id, kind, membership_year, plan, source,
        invoice_id, subscription_id, period_start, period_end, fulfilled_by)
      values (sub.user_id, hh.id, m, case when by_ = 'monthly_resource' then (select k.id from public.club_kits k where k.month = m) end,
        'physical', public.club_membership_year(hh.first_paid_month, m), per ->> 'plan', 'invoice', inv.stripe_invoice_id, sub.id,
        p_start, p_end, by_)
      on conflict (user_id, resource_month, kind) where revoked_at is null do nothing
      returning id into ent;
      if found then
        if by_ = 'welcome_vision' then
          update public.club_fulfillment_orders set entitlement_id = ent, satisfies_month = m, updated_at = now()
           where id = welcome and entitlement_id is null;
        else
          insert into public.club_fulfillment_orders (entitlement_id, user_id, household_id, resource_month, kit_id, late, cutoff_at, provider)
          values (ent, sub.user_id, hh.id, m, (select k.id from public.club_kits k where k.month = m),
            paid_at > public.club_mailing_cutoff_at(m), public.club_mailing_cutoff_at(m), 'manual')
          on conflict do nothing;
        end if;
      end if;
    end loop;
  end loop;

  -- A substituted December before the first mailing month (none today) still names the welcome print.
  update public.club_fulfillment_orders set satisfies_month = hh.first_paid_month, updated_at = now()
   where id = welcome and satisfies_month is null and extract(month from hh.first_paid_month) = 12
     and exists (select 1 from public.club_entitlements e where e.household_id = hh.id and e.resource_month = hh.first_paid_month
                  and e.fulfilled_by = 'welcome_vision' and e.revoked_at is null);

  return jsonb_build_object('granted', granted, 'status', inv.status, 'first_paid', first_paid and granted > 0,
    'months', to_jsonb(months), 'user_id', sub.user_id, 'household_id', hh.id, 'welcome_order', welcome,
    'mailings', (select coalesce(jsonb_agg(e.resource_month order by e.resource_month), '[]') from public.club_entitlements e
                  where e.invoice_id = inv.stripe_invoice_id and e.kind = 'physical' and e.revoked_at is null));
end $$;

-- Refund / dispute: revoke exactly the invoice's rows; cancel their unprinted orders and the welcome print it created.
create or replace function public.club_revoke_invoice(p_invoice text, p_reason text, out revoked int, out canceled int)
language plpgsql security definer set search_path = '' as $$
begin
  with r as (
    update public.club_entitlements set revoked_at = now(), revoked_reason = p_reason
     where invoice_id = p_invoice and revoked_at is null returning id)
  select count(*) into revoked from r;
  with c as (
    update public.club_fulfillment_orders o set status = 'canceled', note = left(coalesce(o.note || ' · ', '') || 'canceled: ' || p_reason, 300), updated_at = now()
     where o.status in ('pending', 'approved', 'on_hold')
       and (o.invoice_id = p_invoice
            or exists (select 1 from public.club_entitlements e where e.id = o.entitlement_id and e.invoice_id = p_invoice))
    returning o.id)
  select count(*) into canceled from c;
end $$;

-- ---------------------------------------------------------------- her monthly resource pages: monthly mailings only

create or replace function public.club_resource_get(p_kit text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  k public.club_kits%rowtype;
  can text;
  v public.club_resource_versions%rowtype;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into k from public.club_kits where slug = p_kit;
  if not found then raise exception 'not_found'; end if;
  can := public.club_can_open(uid, k.id);
  if can = 'none' then raise exception 'not_found'; end if;
  select v2.* into v from public.club_resource_versions v2 join public.club_households h on h.id = v2.household_id
   where h.owner_user_id = uid and v2.kit_id = k.id;
  return jsonb_build_object('can', can, 'month', k.month, 'state', coalesce(v.state, '{}'), 'revision', coalesce(v.revision, 0),
    'profile_version', v.profile_version, 'approved_at', v.approved_at,
    'mailing', (select jsonb_build_object('status', q.status, 'readiness', q.readiness, 'approved', q.member_approved_at is not null)
                  from public.club_fulfillment_queue q where q.user_id = uid and q.resource_month = k.month and q.status <> 'canceled'
                   and q.fulfillment_type = 'monthly_resource' limit 1));
end $$;

create or replace function public.club_resource_save(p_kit text, p_state jsonb, p_revision int) returns int
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  k public.club_kits%rowtype;
  h public.club_households%rowtype;
  rev int;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into k from public.club_kits where slug = p_kit;
  if not found or public.club_can_open(uid, k.id) <> 'edit' then raise exception 'read_only'; end if;
  select * into h from public.club_households where owner_user_id = uid;
  if not found then raise exception 'no_household'; end if;
  if exists (select 1 from public.club_fulfillment_orders o where o.household_id = h.id and o.resource_month = k.month
              and o.fulfillment_type = 'monthly_resource' and o.status in ('printed', 'mailed')) then
    raise exception 'already_printed';
  end if;
  if p_revision = 0 then
    insert into public.club_resource_versions (household_id, kit_id, state, profile_version)
    values (h.id, k.id, p_state, h.profile_version) on conflict (household_id, kit_id) do nothing returning revision into rev;
  else
    update public.club_resource_versions set state = p_state, profile_version = h.profile_version, revision = revision + 1,
           approved_at = null, updated_at = now()
     where household_id = h.id and kit_id = k.id and revision = p_revision returning revision into rev;
  end if;
  if rev is null then raise exception 'conflict'; end if;
  update public.club_fulfillment_orders set member_approved_at = null, pdf_status = 'not_ready', updated_at = now()
   where household_id = h.id and resource_month = k.month and fulfillment_type = 'monthly_resource' and status in ('pending', 'on_hold');
  return rev;
exception
  when check_violation or not_null_violation then raise exception 'invalid';
end $$;

create or replace function public.club_fulfillment_approve(p_kit text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  k public.club_kits%rowtype;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into k from public.club_kits where slug = p_kit;
  if not found or public.club_can_open(uid, k.id) <> 'edit' then raise exception 'read_only'; end if;
  update public.club_resource_versions v set approved_at = now()
    from public.club_households h where h.id = v.household_id and h.owner_user_id = uid and v.kit_id = k.id;
  update public.club_fulfillment_orders set member_approved_at = now(), updated_at = now()
   where user_id = uid and resource_month = k.month and fulfillment_type = 'monthly_resource' and status = 'pending';
  return found;
end $$;

-- ---------------------------------------------------------------- the welcome print (her browser)

-- Her welcome print: status, readiness, what she chose, and whether it stands in for her December.
create function public.club_welcome_get() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  return (select jsonb_build_object('status', q.status, 'readiness', q.readiness, 'personalization', q.personalization,
            'approved', q.member_approved_at is not null, 'satisfies_month', q.satisfies_month, 'printed_at', q.printed_at,
            'mailed_at', q.mailed_at, 'editable', q.status in ('pending', 'on_hold'), 'display_name', q.display_name)
            from public.club_fulfillment_queue q
           where q.user_id = uid and q.fulfillment_type = 'welcome_vision' and q.status <> 'canceled'
           order by q.created_at desc limit 1);
end $$;

-- Save her choices. Clears an earlier approval; refused once it's approved for print by us, printed or mailed.
create function public.club_welcome_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  o public.club_fulfillment_orders%rowtype;
  clean jsonb;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  clean := jsonb_build_object('family_name', btrim(coalesce(p ->> 'family_name', '')), 'value', p ->> 'value');
  if not public.club_vision_valid(clean) then raise exception 'invalid'; end if;
  select * into o from public.club_fulfillment_orders
   where user_id = uid and fulfillment_type = 'welcome_vision' and status <> 'canceled' for update;
  if not found then raise exception 'not_found'; end if;
  if o.status not in ('pending', 'on_hold') then raise exception 'locked'; end if;
  if o.personalization is distinct from clean then
    update public.club_fulfillment_orders set personalization = clean, member_approved_at = null, pdf_status = 'not_ready', updated_at = now()
     where id = o.id;
  end if;
  return public.club_welcome_get();
end $$;

-- "Looks good, print it." Idempotent: a second click changes nothing. Needs a complete personalization.
create function public.club_welcome_approve() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  o public.club_fulfillment_orders%rowtype;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into o from public.club_fulfillment_orders
   where user_id = uid and fulfillment_type = 'welcome_vision' and status <> 'canceled' for update;
  if not found then raise exception 'not_found'; end if;
  if not public.club_vision_valid(o.personalization) then raise exception 'incomplete'; end if;
  if o.status = 'pending' and o.member_approved_at is null then
    update public.club_fulfillment_orders set member_approved_at = now(), updated_at = now() where id = o.id;
  end if;
  return public.club_welcome_get();
end $$;

revoke execute on function public.club_welcome_get(), public.club_welcome_save(jsonb), public.club_welcome_approve() from public, anon;
grant execute on function public.club_welcome_get(), public.club_welcome_save(jsonb), public.club_welcome_approve() to authenticated;

-- ---------------------------------------------------------------- her dashboard

create or replace function public.club_me() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  s public.club_subscriptions%rowtype;
  h public.club_households%rowtype;
  cur date := public.club_month_of(now());
  last_owned date;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into s from public.club_subscriptions where user_id = uid order by (status in ('trialing', 'active', 'past_due', 'unpaid', 'paused')) desc, created_at desc limit 1;
  select * into h from public.club_households where owner_user_id = uid;
  select max(e.resource_month) into last_owned from public.club_entitlements e where e.user_id = uid and e.kind = 'digital' and e.revoked_at is null;
  return jsonb_build_object(
    'access', public.club_has_access(uid),
    'grant', (select g.reason from public.club_access_grants g
               where g.user_id = uid and g.revoked_at is null and (g.expires_at is null or g.expires_at > now())),
    'member', h.enrolled_at is not null,
    'plan', s.plan,
    'status', s.status,
    'payment_problem', s.status in ('past_due', 'unpaid', 'incomplete'),
    'renews', case when s.status in ('trialing', 'active', 'past_due') and not s.cancel_at_period_end then s.current_period_end end,
    'ends', case when s.cancel_at_period_end and s.status in ('trialing', 'active', 'past_due') then s.current_period_end end,
    'ended_at', s.ended_at,
    'revoked', s.access_revoked_at is not null,
    'onboarded', h.onboarded_at is not null,
    'has_address', exists (select 1 from public.club_mailing_addresses a where a.user_id = uid),
    'enrolled_at', h.enrolled_at,
    'first_paid_month', h.first_paid_month,
    'current_month', cur,
    'membership_year', case when h.first_paid_month is not null then public.club_membership_year(h.first_paid_month, greatest(cur, h.first_paid_month)) end,
    'kits', coalesce((
      select jsonb_agg(jsonb_build_object('slug', k.slug, 'title', k.title, 'month', k.month,
                                          'can', public.club_can_open(uid, k.id)) order by k.month desc)
        from public.club_kits k where public.club_can_open(uid, k.id) <> 'none'), '[]'),
    'welcome', (select jsonb_build_object('status', q.status, 'readiness', q.readiness, 'approved', q.member_approved_at is not null,
                  'personalized', public.club_vision_valid(q.personalization), 'satisfies_month', q.satisfies_month, 'mailed_at', q.mailed_at)
                  from public.club_fulfillment_queue q where q.user_id = uid and q.fulfillment_type = 'welcome_vision' and q.status <> 'canceled' limit 1),
    -- The next month she'd receive, and when it's paid for (only while the membership continues).
    'next', case when s.status in ('trialing', 'active', 'past_due') and not s.cancel_at_period_end and last_owned is not null then
              jsonb_build_object('month', (last_owned + interval '1 month')::date, 'payment_on', s.current_period_end,
                'slug', (select k.slug from public.club_kits k where k.month = (last_owned + interval '1 month')::date),
                'title', (select k.title from public.club_kits k where k.month = (last_owned + interval '1 month')::date),
                'regular_cutoff_at', public.club_mailing_cutoff_at((last_owned + interval '1 month')::date)) end,
    -- Only the months she has bought, each with what fulfills it and its printed copy.
    'months', coalesce((
      select jsonb_agg(r order by (r ->> 'month')) from (
        select jsonb_build_object(
          'month', d.resource_month,
          'fulfilled_by', d.fulfilled_by,
          'slug', k.slug, 'title', k.title,
          'published', coalesce(k.status in ('scheduled', 'retired'), false),
          'can', case when k.id is null or d.fulfilled_by <> 'monthly_resource' then 'none' else public.club_can_open(uid, k.id) end,
          'state', case
            when d.fulfilled_by = 'welcome_vision' then 'welcome_vision'
            when coalesce(k.status in ('scheduled', 'retired'), false) then 'available'
            else 'preparing' end,
          'membership_year', d.membership_year,
          'plan', d.plan,
          'mailing', (select jsonb_build_object('status', q.status, 'readiness', q.readiness, 'late', q.late, 'batch', q.batch,
                                                'approved', q.member_approved_at is not null, 'mailed_at', q.mailed_at)
                        from public.club_fulfillment_queue q where q.user_id = uid and q.resource_month = d.resource_month
                         and q.fulfillment_type = 'monthly_resource' and q.status <> 'canceled' limit 1)
        ) as r
        from public.club_entitlements d
        left join public.club_kits k on k.month = d.resource_month
        where d.user_id = uid and d.kind = 'digital' and d.revoked_at is null
      ) t), '[]'));
end $$;

-- ---------------------------------------------------------------- emails: monthly resources only

create or replace function public.club_email_audience(p_kind text, p_month date default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x), '[]') from (
    select h.owner_user_id as user_id, u.email, null::text as kit_slug, null::uuid as order_id
      from public.club_households h join auth.users u on u.id = h.owner_user_id
     where p_kind = 'profile_reminder' and h.onboarded_at is null and h.enrolled_at < now() - interval '1 day'
       and public.club_has_access(h.owner_user_id)
    union all
    select e.user_id, u.email, k.slug, null
      from public.club_entitlements e join auth.users u on u.id = e.user_id join public.club_kits k on k.month = e.resource_month
     where p_kind = 'resource_ready' and e.resource_month = p_month and e.kind = 'digital' and e.revoked_at is null
       and e.fulfilled_by = 'monthly_resource' and k.status in ('scheduled', 'retired')
    union all
    select q.user_id, q.email, q.kit_slug, q.id
      from public.club_fulfillment_queue q
     where p_kind = 'review' and q.resource_month = p_month and q.status = 'pending' and q.member_approved_at is null
       and q.fulfillment_type = 'monthly_resource' and q.readiness in ('ready', 'needs_pdf')
  ) x;
$$;

-- ---------------------------------------------------------------- admin

-- The bundle for printing one order: the queue row (with the welcome print's choices) and, for a monthly
-- resource, the household's names and saved version. Audited.
create or replace function public.club_admin_fulfillment_bundle(p_order uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.club_fulfillment_orders%rowtype;
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into o from public.club_fulfillment_orders where id = p_order;
  if not found then raise exception 'not_found'; end if;
  perform public.admin_log('club.fulfillment_open', 'club_order:' || p_order::text, jsonb_build_object('month', o.resource_month, 'type', o.fulfillment_type));
  return jsonb_build_object(
    'order', (select to_jsonb(q) from public.club_fulfillment_queue q where q.id = p_order),
    'household', (select jsonb_build_object('id', h.id, 'display_name', h.display_name, 'preferences', h.preferences,
        'profile_version', h.profile_version, 'onboarded', h.onboarded_at is not null,
        'members', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'first_name', m.first_name, 'kind', m.kind, 'role', m.role,
            'is_account_holder', m.is_account_holder, 'birth_year', m.birth_year, 'birth_month', m.birth_month, 'archived', false) order by m.sort, m.created_at)
          from public.club_family_members m where m.household_id = h.id and m.archived_at is null), '[]'))
      from public.club_households h where h.id = o.household_id),
    'state', (select v.state from public.club_resource_versions v where v.household_id = o.household_id and v.kit_id = o.kit_id));
end $$;

-- The member list: as before, plus her welcome print's status.
create or replace function public.club_admin_members(p_status text default null, p_month date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x order by x ->> 'enrolled_at' desc nulls last) from (
    select jsonb_build_object(
      'user_id', h.owner_user_id, 'household_id', h.id, 'email', u.email, 'display_name', h.display_name,
      'enrolled_at', h.enrolled_at, 'first_paid_month', h.first_paid_month, 'onboarded', h.onboarded_at is not null,
      'adults', (select count(*) from public.club_family_members m where m.household_id = h.id and m.archived_at is null and m.kind = 'adult'),
      'children', (select count(*) from public.club_family_members m where m.household_id = h.id and m.archived_at is null and m.kind = 'child'),
      'child_birth_years', (select coalesce(jsonb_agg(m.birth_year order by m.birth_year), '[]') from public.club_family_members m where m.household_id = h.id and m.archived_at is null and m.kind = 'child'),
      'plan', s.plan, 'status', s.status, 'cancel_at_period_end', s.cancel_at_period_end, 'current_period_end', s.current_period_end,
      'ended_at', s.ended_at, 'livemode', s.livemode, 'flags', s.flags, 'revoked', s.access_revoked_at is not null,
      'stripe_customer_id', s.stripe_customer_id, 'stripe_subscription_id', s.stripe_subscription_id,
      'payment_problem', s.status in ('past_due', 'unpaid', 'incomplete') or exists (
        select 1 from public.club_invoices i where i.subscription_id = s.id and i.status = 'open' and i.attempt_count > 0),
      'months', (select coalesce(jsonb_agg(distinct e.resource_month order by e.resource_month), '[]') from public.club_entitlements e
                  where e.user_id = h.owner_user_id and e.kind = 'digital' and e.revoked_at is null),
      'welcome', (select jsonb_build_object('status', q.status, 'readiness', q.readiness, 'satisfies_month', q.satisfies_month, 'mailed_at', q.mailed_at)
                    from public.club_fulfillment_queue q where q.user_id = h.owner_user_id and q.fulfillment_type = 'welcome_vision' and q.status <> 'canceled' limit 1),
      'address', (select jsonb_build_object('name', a.name, 'line1', a.line1, 'line2', a.line2, 'city', a.city, 'state', a.state,
                                            'postal_code', a.postal_code, 'paused', a.paused) from public.club_mailing_addresses a where a.user_id = h.owner_user_id)
    ) as x
      from public.club_households h
      join auth.users u on u.id = h.owner_user_id
      left join lateral (select * from public.club_subscriptions s2 where s2.user_id = h.owner_user_id
                          order by (s2.status in ('trialing', 'active', 'past_due', 'unpaid', 'paused')) desc, s2.created_at desc limit 1) s on true
     where (p_status is null
            or (p_status = 'active' and s.status in ('active', 'trialing') and not s.cancel_at_period_end)
            or (p_status = 'canceling' and s.cancel_at_period_end and s.status in ('active', 'trialing', 'past_due'))
            or (p_status = 'problem' and s.status in ('past_due', 'unpaid', 'incomplete'))
            or (p_status = 'canceled' and s.status in ('canceled', 'incomplete_expired'))
            or (p_status = 'monthly' and s.plan = 'monthly') or (p_status = 'annual' and s.plan = 'annual')
            or (p_status = 'no_profile' and h.onboarded_at is null and h.enrolled_at is not null))
       and (p_month is null or exists (select 1 from public.club_entitlements e where e.user_id = h.owner_user_id
                                        and e.resource_month = p_month and e.revoked_at is null))
  ) t), '[]');
end $$;

-- Welcome prints not yet mailed, oldest first (they don't wait for a monthly cutoff).
create function public.club_admin_welcome_queue() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(q) - 'personalization' || jsonb_build_object('vision_value', q.personalization ->> 'value',
                     'family_name', q.personalization ->> 'family_name') order by q.created_at)
                     from public.club_fulfillment_queue q where q.fulfillment_type = 'welcome_vision' and q.status not in ('mailed', 'canceled', 'skipped')), '[]');
end $$;

-- One household's purchased months: which resource fulfills each, which invoice paid it, its printed copy and batch.
create function public.club_admin_member_months(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'welcome', (select jsonb_build_object('id', q.id, 'status', q.status, 'readiness', q.readiness, 'satisfies_month', q.satisfies_month,
                  'created_at', q.created_at, 'mailed_at', q.mailed_at, 'vision_value', q.personalization ->> 'value')
                  from public.club_fulfillment_queue q where q.user_id = p_user and q.fulfillment_type = 'welcome_vision'
                 order by (q.status = 'canceled'), q.created_at desc limit 1),
    'months', coalesce((select jsonb_agg(jsonb_build_object(
        'month', d.resource_month, 'fulfilled_by', d.fulfilled_by, 'kit_slug', k.slug, 'plan', d.plan, 'invoice', d.invoice_id,
        'source', d.source, 'membership_year', d.membership_year, 'revoked', d.revoked_at is not null, 'revoked_reason', d.revoked_reason,
        'mailing', (select jsonb_build_object('id', q.id, 'status', q.status, 'batch', q.batch, 'cutoff_at', q.cutoff_at, 'mailed_at', q.mailed_at)
                      from public.club_fulfillment_queue q where q.user_id = p_user and q.resource_month = d.resource_month
                       and q.fulfillment_type = 'monthly_resource' and q.status <> 'canceled' limit 1))
        order by d.resource_month, d.granted_at)
      from public.club_entitlements d left join public.club_kits k on k.id = d.kit_id
     where d.user_id = p_user and d.kind = 'digital'), '[]'));
end $$;

revoke execute on function public.club_admin_welcome_queue(), public.club_admin_member_months(uuid) from public, anon;
grant execute on function public.club_admin_welcome_queue(), public.club_admin_member_months(uuid) to authenticated;

commit;
