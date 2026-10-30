-- ROLLBACK for the Club rollout: undoes 20261109000000_club_family_profile.sql and 20261108000000_club_welcome_kit.sql,
-- restoring production's definitions as of Oct 30 2026 (captured read-only from the live project; identical to the
-- repo's migrations through 20261107 except one comment in club_admin_set_fulfillment). One transaction.
-- Rehearsed by scripts/rehearse-club-rollout.sh. Only for a failed rollout, with the owner's go-ahead.
--
-- It refuses (and changes nothing) if members already saved profile answers or a kit_reminder email was logged:
-- then take a backup first and decide what to keep. Fulfillment order rows are never touched by either direction.
begin;
set local search_path = public;

do $$
begin
  if exists (select 1 from public.club_activities) or exists (select 1 from public.club_responsibilities)
     or exists (select 1 from public.club_households where cardinality(challenges) > 0 or challenge_note is not null
                  or priority is not null or priority_note is not null or cardinality(setup_done) > 0 or setup_completed_at is not null) then
    raise exception 'rollback refused: members have saved family profile answers';
  end if;
  if exists (select 1 from public.club_email_log where kind = 'kit_reminder') then
    raise exception 'rollback refused: kit_reminder emails are logged';
  end if;
end $$;

-- ---------------------------------------------------------------- 20261109 club_family_profile
drop function public.club_focus_save(text, text[], text, text, text);
drop function public.club_responsibilities_save(text, jsonb);
drop function public.club_activities_save(jsonb);
drop function public.club_family_profile();
drop function public.club_setup_mark(uuid, text);
drop function public.club_uuid_list(jsonb);
drop function public.club_members_belong(uuid, uuid[]);
drop function public.club_my_household();
drop table public.club_responsibilities;
drop table public.club_activities;
alter table public.club_households
  drop column challenges, drop column challenge_note, drop column priority, drop column priority_note,
  drop column setup_done, drop column setup_completed_at;

-- ---------------------------------------------------------------- 20261108 club_welcome_kit
drop function public.club_admin_set_welcome_kit(uuid, text, text);
alter table public.club_email_log drop constraint club_email_log_kind_check;
alter table public.club_email_log add constraint club_email_log_kind_check
  check (kind in ('welcome', 'profile_reminder', 'resource_ready', 'review', 'payment_failed', 'canceled'));

-- The view gained columns, so it's dropped and recreated (create or replace can't remove columns).
drop view public.club_fulfillment_queue;
create view public.club_fulfillment_queue with (security_invoker = true) as
 SELECT o.id,
    o.user_id,
    o.household_id,
    o.resource_month,
    o.kit_id,
    k.slug AS kit_slug,
    k.title AS kit_title,
    o.status,
    o.late,
    o.cutoff_at,
    o.pdf_status,
    o.member_approved_at,
    o.printed_at,
    o.mailed_at,
    o.provider,
    o.provider_ref,
    o.note,
    o.created_at,
    o.updated_at,
    h.display_name,
    u.email,
        CASE
            WHEN o.status <> ALL (ARRAY['pending'::text, 'approved'::text, 'on_hold'::text]) THEN o.status
            WHEN o.fulfillment_type = 'welcome_vision'::text AND (NOT club_vision_valid(o.personalization) OR o.member_approved_at IS NULL) THEN 'needs_vision'::text
            WHEN o.fulfillment_type = 'monthly_resource'::text AND h.onboarded_at IS NULL THEN 'needs_profile'::text
            WHEN a.user_id IS NULL THEN 'needs_address'::text
            WHEN a.paused THEN 'mail_paused'::text
            WHEN o.fulfillment_type = 'monthly_resource'::text AND (k.id IS NULL OR k.status = 'draft'::text) THEN 'needs_resource'::text
            WHEN o.pdf_status <> 'ready'::text THEN 'needs_pdf'::text
            ELSE 'ready'::text
        END AS readiness,
    COALESCE(o.address, l.address) AS address,
    l.address AS live_address,
    o.fulfillment_type,
    o.satisfies_month,
    o.personalization,
        CASE
            WHEN o.fulfillment_type = 'welcome_vision'::text THEN 'welcome'::text
            WHEN o.late THEN 'catch_up'::text
            ELSE 'regular'::text
        END AS batch,
    h.first_paid_month,
    h.enrolled_at
   FROM club_fulfillment_orders o
     JOIN club_households h ON h.id = o.household_id
     JOIN auth.users u ON u.id = o.user_id
     LEFT JOIN club_kits k ON k.id = o.kit_id
     LEFT JOIN club_mailing_addresses a ON a.user_id = o.user_id
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN a.user_id IS NOT NULL THEN jsonb_build_object('name', a.name, 'line1', a.line1, 'line2', a.line2, 'city', a.city, 'state', a.state, 'postal_code', a.postal_code, 'country', a.country)
                    ELSE NULL::jsonb
                END AS address) l ON true;
revoke all on public.club_fulfillment_queue from public, anon, authenticated;
grant all on public.club_fulfillment_queue to service_role;

CREATE OR REPLACE FUNCTION public.club_admin_fulfillment(p_month date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(q) order by q.late, q.created_at)
                     from public.club_fulfillment_queue q where q.resource_month = p_month), '[]');
end $function$

;

CREATE OR REPLACE FUNCTION public.club_admin_welcome_queue()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(q) - 'personalization' || jsonb_build_object('vision_value', q.personalization ->> 'value',
                     'family_name', q.personalization ->> 'family_name') order by q.created_at)
                     from public.club_fulfillment_queue q where q.fulfillment_type = 'welcome_vision' and q.status not in ('mailed', 'canceled', 'skipped')), '[]');
end $function$

;

CREATE OR REPLACE FUNCTION public.club_resource_save(p_kit text, p_state jsonb, p_revision integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$

;

CREATE OR REPLACE FUNCTION public.club_email_audience(p_kind text, p_month date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$

;

CREATE OR REPLACE FUNCTION public.club_intro_grant(p_sub text, p_card text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  sub public.club_subscriptions%rowtype;
  hh public.club_households%rowtype;
  st public.club_settings%rowtype;
  claim public.club_intro_claims%rowtype;
  m date;
  v_email text;
  v_addr text;
  by_ text;
  ent uuid;
  welcome uuid;
begin
  select * into st from public.club_settings;
  select * into sub from public.club_subscriptions where stripe_subscription_id = p_sub;
  if not found then raise exception 'unknown_subscription'; end if;
  select * into claim from public.club_intro_claims where subscription_id = sub.id;
  if found then
    return jsonb_build_object('granted', claim.revoked_at is null, 'month', claim.intro_month, 'first_charge_at', sub.current_period_end, 'replay', true);
  end if;
  if sub.status <> 'trialing' or sub.user_id is null or 'duplicate' = any (sub.flags) or sub.access_revoked_at is not null then
    return jsonb_build_object('granted', false, 'reason', 'not_trialing');
  end if;
  select * into hh from public.club_households where owner_user_id = sub.user_id for update;
  if not found then raise exception 'no_household'; end if;
  m := case when st.program_start_month > public.club_month_of(sub.started_at) then st.program_start_month else public.club_month_of(sub.started_at) end;
  select public.club_email_hash(u.email) into v_email from auth.users u where u.id = sub.user_id;
  select public.club_address_hash(a.line1, a.postal_code) into v_addr from public.club_mailing_addresses a where a.user_id = sub.user_id;

  -- One free month per household: this account, its email, its mailing address, its card; or a member before.
  if exists (select 1 from public.club_intro_claims i
              where i.household_id = hh.id or i.user_id = sub.user_id or i.email_hash = v_email
                 or (v_addr is not null and i.address_hash = v_addr) or (p_card is not null and i.card_fingerprint = p_card))
     or exists (select 1 from public.club_subscriptions s where s.user_id = sub.user_id and s.id <> sub.id
                 and s.status not in ('incomplete', 'incomplete_expired')) then
    return jsonb_build_object('granted', false, 'reason', 'already_claimed',
      'fallback_trial_end', case when st.program_start_month > public.club_month_of(now())
                                 then st.program_start_month::timestamp at time zone 'America/New_York' end);
  end if;

  insert into public.club_intro_claims (subscription_id, user_id, household_id, email_hash, address_hash, card_fingerprint, intro_month)
  values (sub.id, sub.user_id, hh.id, v_email, v_addr, p_card, m);
  update public.club_households set enrolled_at = coalesce(enrolled_at, now()),
         first_paid_month = least(coalesce(first_paid_month, m), m), updated_at = now()
   where id = hh.id returning * into hh;

  -- The welcome print: free, right away, once per household.
  insert into public.club_fulfillment_orders (user_id, household_id, resource_month, fulfillment_type, invoice_id, provider, personalization)
  values (sub.user_id, hh.id, public.club_month_of(now()), 'welcome_vision', null, 'manual', null)
  on conflict (household_id) where status <> 'canceled' and fulfillment_type = 'welcome_vision' do nothing;
  select o.id into welcome from public.club_fulfillment_orders o
   where o.household_id = hh.id and o.fulfillment_type = 'welcome_vision' and o.status <> 'canceled';

  -- The free month, like a paid one. A first month that's a December is the welcome print (no Christmas mailing).
  by_ := case when extract(month from m) = 12 and m = hh.first_paid_month then 'welcome_vision' else 'monthly_resource' end;
  insert into public.club_entitlements (user_id, household_id, resource_month, kit_id, kind, membership_year, plan, source,
    invoice_id, subscription_id, period_start, period_end, fulfilled_by)
  values (sub.user_id, hh.id, m, case when by_ = 'monthly_resource' then (select k.id from public.club_kits k where k.month = m) end,
    'digital', public.club_membership_year(hh.first_paid_month, m), coalesce(sub.plan, 'monthly'), 'intro', null, sub.id,
    sub.current_period_start, sub.current_period_end, by_)
  on conflict (user_id, resource_month, kind) where revoked_at is null do nothing;
  if m >= st.first_mailing_month then
    insert into public.club_entitlements (user_id, household_id, resource_month, kit_id, kind, membership_year, plan, source,
      invoice_id, subscription_id, period_start, period_end, fulfilled_by)
    values (sub.user_id, hh.id, m, case when by_ = 'monthly_resource' then (select k.id from public.club_kits k where k.month = m) end,
      'physical', public.club_membership_year(hh.first_paid_month, m), coalesce(sub.plan, 'monthly'), 'intro', null, sub.id,
      sub.current_period_start, sub.current_period_end, by_)
    on conflict (user_id, resource_month, kind) where revoked_at is null do nothing
    returning id into ent;
    if ent is not null and by_ = 'welcome_vision' then
      update public.club_fulfillment_orders set entitlement_id = ent, satisfies_month = m, updated_at = now() where id = welcome and entitlement_id is null;
    elsif ent is not null then
      -- Its regular batch when she joined by that month's second-Sunday cutoff, else its catch-up batch.
      insert into public.club_fulfillment_orders (entitlement_id, user_id, household_id, resource_month, kit_id, late, cutoff_at, provider)
      values (ent, sub.user_id, hh.id, m, (select k.id from public.club_kits k where k.month = m),
        now() > public.club_mailing_cutoff_at(m), public.club_mailing_cutoff_at(m), 'manual')
      on conflict do nothing;
    end if;
  end if;
  return jsonb_build_object('granted', true, 'month', m, 'first_charge_at', sub.current_period_end, 'welcome_order', welcome);
end $function$

;

CREATE OR REPLACE FUNCTION public.club_invoice_apply(p jsonb, p_periods jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$

;

CREATE OR REPLACE FUNCTION public.club_admin_set_fulfillment(p_order uuid, p_status text, p_note text DEFAULT NULL::text, p_pdf text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  o public.club_fulfillment_orders%rowtype;
  q record;
  allowed text[];
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into o from public.club_fulfillment_orders where id = p_order for update;
  if not found then raise exception 'not_found'; end if;
  select * into q from public.club_fulfillment_queue where id = p_order;
  if p_pdf is not null then
    if p_pdf not in ('ready', 'not_ready') then raise exception 'invalid'; end if;
    update public.club_fulfillment_orders set pdf_status = p_pdf, pdf_ready_at = case when p_pdf = 'ready' then now() end, updated_at = now() where id = p_order;
  end if;
  if p_status is not null and p_status <> o.status then
    allowed := case o.status
      when 'pending' then '{approved,on_hold,skipped,canceled}'
      when 'on_hold' then '{pending,skipped,canceled}'
      when 'approved' then '{pending,printed,on_hold,skipped,canceled}'
      when 'printed' then '{mailed,approved}'
      when 'mailed' then '{returned}'
      when 'returned' then '{approved,skipped}'
      when 'skipped' then '{pending}'
      else '{}' end;
    if not (p_status = any (allowed)) then raise exception 'invalid_transition'; end if;
    if p_status in ('approved', 'printed') and o.status <> 'returned' and q.readiness <> 'ready' then
      raise exception 'not_ready';
    end if;
    if p_status = 'approved' and q.live_address is null then raise exception 'not_ready'; end if;
    update public.club_fulfillment_orders set status = p_status,
      address = case when p_status = 'approved' then q.live_address when p_status = 'pending' then null else address end,
      printed_at = case when p_status = 'printed' then now() else printed_at end,
      mailed_at = case when p_status = 'mailed' then now() else mailed_at end,
      updated_at = now()
     where id = p_order;
  end if;
  if p_note is not null then
    update public.club_fulfillment_orders set note = left(p_note, 300), updated_at = now() where id = p_order;
  end if;
  perform public.admin_log('club.fulfillment', 'club_order:' || p_order::text,
    jsonb_build_object('from', o.status, 'to', coalesce(p_status, o.status), 'pdf', p_pdf));
  return (select to_jsonb(x) from public.club_fulfillment_queue x where x.id = p_order);
end $function$
;

commit;
