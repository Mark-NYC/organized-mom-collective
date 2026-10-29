-- Organized Family Club: founding enrollment before the 2027 program. Plan: docs/club/MEMBERSHIP.md → Founding members.
-- Tests: tests/club-billing-e2e.test.ts (founding scenarios), supabase/tests/club-membership.sql.
--
-- The monthly resources are the 2027 program (January–December 2027). Members can join before it starts:
--   * club_settings.program_start_month (2027-01-01): no paid period before it buys a month or a mailing, so a 2026
--     payment can never be handed a 2027 resource. Null = no program start (every paid month is granted).
--   * club-billing, before that month: checkout charges the one-time Family Vision welcome print ($5.90) now and
--     starts the $5.90/month subscription in a trial that ends at midnight New York on the program's first day.
--     The first membership invoice (January 1, 2027) buys January 2027.
--   * The welcome print and membership start with her first paid invoice even when it buys no month.
--   * January's mailing list stays open through January 1 (launch exception), so founding members' January 1
--     payments land in January's regular batch.
--   * Adds the November 2027 kit (draft), which the 2027 program was missing.

begin;

alter table public.club_settings
  add column program_start_month date check (extract(day from program_start_month) = 1);

-- pg-safeupdate: one-row table, so `where id`.
update public.club_settings
   set program_start_month = '2027-01-01',
       launch_exception_month = '2027-01-01',
       launch_exception_cutoff_at = '2027-01-02 04:59:59+00',
       updated_at = now()
 where id;

insert into public.club_kits (slug, month, title, status, release_at, mailer_cutoff_at)
values ('2027-11-family-ownership', '2027-11-01', 'Our Family, Our Team', 'draft', '2027-11-01 04:00:00+00', public.club_cutoff_at('2027-11-01'))
on conflict (slug) do nothing;

-- Kits' printed-list deadlines follow the rule (as club_admin_settings does on save); orders use the exception.
update public.club_kits set mailer_cutoff_at = public.club_cutoff_at(month) where mailer_cutoff_at is distinct from public.club_cutoff_at(month);

create or replace function public.club_checkout_state(p_user uuid, p_email text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'live_subscription', exists (select 1 from public.club_subscriptions s
       where s.user_id = coalesce(p_user, public.club_user_by_email(p_email))
         and s.status in ('trialing', 'active', 'past_due', 'unpaid', 'paused')),
    'customer', coalesce(
      (select c.stripe_customer_id from public.club_customers c where c.user_id = coalesce(p_user, public.club_user_by_email(p_email)) limit 1),
      (select c.stripe_customer_id from public.club_customers c where lower(c.email) = lower(btrim(p_email)) order by c.created_at limit 1)),
    'settings', (select jsonb_build_object('checkout_mode', s.checkout_mode, 'portal_configuration_id', s.portal_configuration_id,
                   -- Before the program starts: when membership billing begins (midnight New York on its first day).
                   'billing_starts_at', case when s.program_start_month > public.club_month_of(now())
                                             then s.program_start_month::timestamp at time zone 'America/New_York' end)
                   from public.club_settings s));
$$;

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
  was_paid boolean;
begin
  select * into st from public.club_settings;
  select * into sub from public.club_subscriptions where stripe_subscription_id = p ->> 'subscription';
  if not found then raise exception 'unknown_subscription'; end if;
  -- A replayed invoice.paid isn't her first payment again.
  was_paid := exists (select 1 from public.club_invoices where stripe_invoice_id = p ->> 'id' and status = 'paid');
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
  first_paid := not was_paid and inv.amount_paid_cents > 0 and not exists (
    select 1 from public.club_invoices i2 join public.club_subscriptions s2 on s2.id = i2.subscription_id
     where s2.user_id = sub.user_id and i2.status = 'paid' and i2.amount_paid_cents > 0 and i2.stripe_invoice_id <> inv.stripe_invoice_id);

  -- The household's original first paid month: the earliest month any paid period covers. Never moves later.
  select min(public.club_month_of((x ->> 'start')::timestamptz)) into first_month from jsonb_array_elements(p_periods) x
   where st.program_start_month is null or public.club_month_of((x ->> 'start')::timestamptz) >= st.program_start_month;
  if first_month is not null and (hh.first_paid_month is null or first_month < hh.first_paid_month) then
    update public.club_households set first_paid_month = first_month, enrolled_at = coalesce(enrolled_at, inv.paid_at, now())
     where id = hh.id returning * into hh;
  end if;

  -- A member from her first paid invoice, even one that buys no month yet (a founding member's welcome print).
  if hh.enrolled_at is null and inv.amount_paid_cents > 0 then
    update public.club_households set enrolled_at = coalesce(inv.paid_at, now()) where id = hh.id returning * into hh;
  end if;

  -- The welcome print: once per household, outside the monthly cutoff, pending until she personalizes and approves it.
  if jsonb_array_length(p_periods) > 0 or inv.amount_paid_cents > 0 then
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
    -- Nothing before the program starts: a paid period there buys no month and no mailing (the 2027 resources
    -- are never handed out as 2026 months). Founding checkouts don't create such periods; this is the backstop.
    if st.program_start_month is not null and public.club_month_of(p_start) < st.program_start_month then
      continue;
    end if;
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

  return jsonb_build_object('granted', granted, 'status', inv.status, 'first_paid', first_paid,
    'program_start', st.program_start_month,
    'months', to_jsonb(months), 'user_id', sub.user_id, 'household_id', hh.id, 'welcome_order', welcome,
    'mailings', (select coalesce(jsonb_agg(e.resource_month order by e.resource_month), '[]') from public.club_entitlements e
                  where e.invoice_id = inv.stripe_invoice_id and e.kind = 'physical' and e.revoked_at is null));
end $$;

create or replace function public.club_me() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  s public.club_subscriptions%rowtype;
  h public.club_households%rowtype;
  cur date := public.club_month_of(now());
  last_owned date;
  next_month date;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into s from public.club_subscriptions where user_id = uid order by (status in ('trialing', 'active', 'past_due', 'unpaid', 'paused')) desc, created_at desc limit 1;
  select * into h from public.club_households where owner_user_id = uid;
  select max(e.resource_month) into last_owned from public.club_entitlements e where e.user_id = uid and e.kind = 'digital' and e.revoked_at is null;
  next_month := coalesce((last_owned + interval '1 month')::date, public.club_month_of(s.current_period_end));
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
    -- A founding member who holds no month yet: the month her first membership payment buys.
    'next', case when s.status in ('trialing', 'active', 'past_due') and not s.cancel_at_period_end
                  and next_month is not null then
              jsonb_build_object('month', next_month, 'payment_on', s.current_period_end,
                'slug', (select k.slug from public.club_kits k where k.month = next_month),
                'title', (select k.title from public.club_kits k where k.month = next_month),
                'regular_cutoff_at', public.club_mailing_cutoff_at(next_month)) end,
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

commit;
