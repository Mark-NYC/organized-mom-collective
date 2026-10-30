-- Organized Family Club: the Welcome Kit. A new member's Family Vision welcome print and her first month's printed
-- resource go out together, in ONE package, on their own new-member track. Plan: docs/club/MEMBERSHIP.md → Welcome
-- Kit. Tests: supabase/tests/club-membership.sql (Welcome Kit section), tests/club-billing-e2e.test.ts.
--
-- No new columns. The two orders a new household already gets stay two rows (each keeps its own entitlement,
-- refund and cancellation rules); this pairs them for fulfillment:
--   * The kit = her welcome_vision order + the monthly_resource order for her household's first_paid_month (the
--     free month or the first paid month; it never moves later). Derived in club_fulfillment_queue: batch
--     'welcome_kit', one shared readiness for both rows, in_welcome_kit, kit_partner_id, kit_auto_approve_at.
--   * One readiness for the package, in the order she onboards: needs_profile → needs_address → mail_paused →
--     needs_vision (she hasn't approved her print) → needs_resource (that month's kit is still a draft) → needs_confirmation (she
--     hasn't confirmed her first resource, and three days haven't passed since she approved her print) → needs_pdf
--     (either PDF) → ready. Not the monthly cutoff: the second-Sunday rule doesn't apply to a Welcome Kit.
--   * Three days after she approves her print, her prepared first resource counts as confirmed, but only once
--     everything above it is valid (profile, address, published resource). Approving the kit records it.
--   * Held, never shipped automatically: the first month's order was canceled (a refunded or disputed first invoice
--     cancels both; a membership that ended before its free month withdraws that month). The owner decides.
--     Cancelling future renewal changes nothing: the kit she earned ships.
--   * club_admin_set_welcome_kit moves both orders together (approved → printed → mailed, returned, on hold,
--     skipped). club_admin_set_fulfillment refuses to move one half of an unshipped kit alone. PDFs stay per item.
--   * Kit orders are left out of the monthly lists, the mail-house CSV and the "review before printing" email, so a
--     package can come from one place only. (The welcome print also stops appearing in the month she paid.)
--   * Her first resource locks once the kit is approved for print, like the welcome print.
--   * December: a new household whose first month is a December now gets that December's resource like any other
--     month, and the welcome print as the bonus beside it (the substitution is retired for new grants; rows it
--     already made keep working, and a welcome print that stands in for a December still ships alone).
--   * New email kind 'kit_reminder': one reminder to confirm her first resource, two days after she approved her print.
--
-- Stripe, prices, entitlements and the regular monthly batches are unchanged.

begin;

-- ---------------------------------------------------------------- the queue, with the Welcome Kit

create or replace view public.club_fulfillment_queue with (security_invoker = true) as
select o.id, o.user_id, o.household_id, o.resource_month, o.kit_id, k.slug as kit_slug, k.title as kit_title,
       o.status, o.late, o.cutoff_at, o.pdf_status, o.member_approved_at, o.printed_at, o.mailed_at, o.provider,
       o.provider_ref, o.note, o.created_at, o.updated_at,
       h.display_name, u.email,
       case
         when o.status not in ('pending', 'approved', 'on_hold') then o.status
         when kit.in_kit then case
           when kit.m_id is null then 'first_month_canceled'
           when h.onboarded_at is null then 'needs_profile'
           when a.user_id is null then 'needs_address'
           when a.paused then 'mail_paused'
           when not public.club_vision_valid(kit.w_personalization) or kit.w_approved_at is null then 'needs_vision'
           when mk.id is null or mk.status = 'draft' then 'needs_resource'
           when kit.m_approved_at is null and now() < kit.w_approved_at + interval '3 days' then 'needs_confirmation'
           when kit.w_pdf <> 'ready' or kit.m_pdf <> 'ready' then 'needs_pdf'
           else 'ready' end
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
       case when kit.in_kit then 'welcome_kit' when o.fulfillment_type = 'welcome_vision' then 'welcome' when o.late then 'catch_up' else 'regular' end as batch,
       h.first_paid_month,
       h.enrolled_at,
       -- The Welcome Kit: whether this order ships in one, the other order in it, and when her first resource counts
       -- as confirmed without her (three days after she approved her print).
       kit.in_kit as in_welcome_kit,
       case when o.fulfillment_type = 'welcome_vision' then kit.m_id else kit.w_id end as kit_partner_id,
       case when kit.in_kit and kit.m_approved_at is null and kit.w_approved_at is not null then kit.w_approved_at + interval '3 days' end as kit_auto_approve_at
  from public.club_fulfillment_orders o
  join public.club_households h on h.id = o.household_id
  join auth.users u on u.id = o.user_id
  left join public.club_kits k on k.id = o.kit_id
  left join public.club_mailing_addresses a on a.user_id = o.user_id
  left join lateral (select case when a.user_id is not null then jsonb_build_object('name', a.name, 'line1', a.line1, 'line2', a.line2,
    'city', a.city, 'state', a.state, 'postal_code', a.postal_code, 'country', a.country) end as address) l on true
  -- The welcome order a first-month monthly order ships with.
  left join lateral (select w.* from public.club_fulfillment_orders w
     where o.fulfillment_type = 'monthly_resource' and o.resource_month = h.first_paid_month
       and w.household_id = o.household_id and w.fulfillment_type = 'welcome_vision' and w.status <> 'canceled' and w.satisfies_month is null
     limit 1) kw on true
  -- The first-month monthly order a welcome print ships with (none: canceled, so the kit is held).
  left join lateral (select m.* from public.club_fulfillment_orders m
     where o.fulfillment_type = 'welcome_vision' and o.satisfies_month is null
       and m.household_id = o.household_id and m.fulfillment_type = 'monthly_resource' and m.resource_month = h.first_paid_month
       and m.status <> 'canceled'
     limit 1) km on true
  left join lateral (select
       (o.fulfillment_type = 'welcome_vision' and o.satisfies_month is null) or kw.id is not null as in_kit,
       case when o.fulfillment_type = 'welcome_vision' then o.id else kw.id end as w_id,
       case when o.fulfillment_type = 'welcome_vision' then o.personalization else kw.personalization end as w_personalization,
       case when o.fulfillment_type = 'welcome_vision' then o.member_approved_at else kw.member_approved_at end as w_approved_at,
       case when o.fulfillment_type = 'welcome_vision' then o.pdf_status else kw.pdf_status end as w_pdf,
       case when o.fulfillment_type = 'monthly_resource' then o.id else km.id end as m_id,
       case when o.fulfillment_type = 'monthly_resource' then o.member_approved_at else km.member_approved_at end as m_approved_at,
       case when o.fulfillment_type = 'monthly_resource' then o.pdf_status else km.pdf_status end as m_pdf,
       case when o.fulfillment_type = 'monthly_resource' then o.kit_id else km.kit_id end as m_kit) kit on true
  left join public.club_kits mk on mk.id = kit.m_kit;

-- ---------------------------------------------------------------- admin: one package, moved together

-- One order's status. Half of an unshipped Welcome Kit moves only with the other half (club_admin_set_welcome_kit).
create or replace function public.club_admin_set_fulfillment(p_order uuid, p_status text, p_note text default null, p_pdf text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.club_fulfillment_orders%rowtype;
  q record;
  allowed text[];
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into o from public.club_fulfillment_orders where id = p_order for update;
  if not found then raise exception 'not_found'; end if;
  select * into q from public.club_fulfillment_queue where id = p_order;
  if p_status is not null and p_status <> o.status and q.in_welcome_kit and q.kit_partner_id is not null
     and coalesce(current_setting('club.kit_move', true), '') <> 'on' then
    raise exception 'use_welcome_kit';
  end if;
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
    -- A held kit's print going out alone is the owner's explicit decision (club_admin_set_welcome_kit, with a note).
    if p_status in ('approved', 'printed') and o.status <> 'returned' and q.readiness <> 'ready'
       and not (q.readiness = 'first_month_canceled' and coalesce(current_setting('club.kit_print_alone', true), '') = 'on') then
      raise exception 'not_ready';
    end if;
    if p_status = 'approved' and q.live_address is null then raise exception 'not_ready'; end if;
    update public.club_fulfillment_orders set status = p_status,
      -- Approving freezes the current address (a returned mailing picks up the corrected one); back to pending unfreezes it.
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
end $$;

-- The Welcome Kit's status: both orders together, or neither. p_order is either order of the kit. A kit held because
-- its first month was canceled can only send the print alone with a note saying why (the owner's decision).
create function public.club_admin_set_welcome_kit(p_order uuid, p_status text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  q record;
  w uuid;
  m uuid;
  ws text;
  ms text;
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into q from public.club_fulfillment_queue where id = p_order;
  if not found then raise exception 'not_found'; end if;
  if not q.in_welcome_kit then raise exception 'not_a_kit'; end if;
  w := case when q.fulfillment_type = 'welcome_vision' then q.id else q.kit_partner_id end;
  m := case when q.fulfillment_type = 'welcome_vision' then q.kit_partner_id else q.id end;
  -- Lock both, in a fixed order.
  perform 1 from public.club_fulfillment_orders where id in (w, m) order by id for update;
  select status into ws from public.club_fulfillment_orders where id = w;
  if m is null then
    if p_status in ('approved', 'printed', 'mailed') and nullif(btrim(coalesce(p_note, '')), '') is null then raise exception 'note_required'; end if;
    perform set_config('club.kit_print_alone', 'on', true);
    perform public.club_admin_set_fulfillment(w, p_status, p_note, null);
    perform set_config('club.kit_print_alone', '', true);
    return (select to_jsonb(x) from public.club_fulfillment_queue x where x.id = w);
  end if;
  select status into ms from public.club_fulfillment_orders where id = m;
  if ws <> ms then raise exception 'kit_out_of_sync'; end if;
  perform set_config('club.kit_move', 'on', true);
  perform public.club_admin_set_fulfillment(w, p_status, p_note, null);
  perform public.club_admin_set_fulfillment(m, p_status, p_note, null);
  perform set_config('club.kit_move', '', true);
  -- Approving the kit records her first resource as confirmed: by her, or by the three-day rule.
  if p_status = 'approved' then
    update public.club_fulfillment_orders mo
       set member_approved_at = wo.member_approved_at + interval '3 days',
           note = left(coalesce(mo.note || ' · ', '') || 'confirmed automatically 3 days after the welcome print', 300), updated_at = now()
      from public.club_fulfillment_orders wo
     where mo.id = m and wo.id = w and mo.member_approved_at is null;
  end if;
  perform public.admin_log('club.welcome_kit', 'club_order:' || w::text, jsonb_build_object('to', p_status, 'first_month_order', m));
  return (select to_jsonb(x) from public.club_fulfillment_queue x where x.id = w);
end $$;

revoke execute on function public.club_admin_set_welcome_kit(uuid, text, text) from public, anon;
grant execute on function public.club_admin_set_welcome_kit(uuid, text, text) to authenticated;

-- A month's regular and catch-up mailings. Welcome prints and Welcome Kit orders are on their own list.
create or replace function public.club_admin_fulfillment(p_month date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(q) order by q.late, q.created_at)
                     from public.club_fulfillment_queue q
                    where q.resource_month = p_month and q.fulfillment_type = 'monthly_resource' and not q.in_welcome_kit), '[]');
end $$;

-- Welcome Kits not yet mailed (and welcome prints that ship alone), oldest first: one row per package, with both items.
create or replace function public.club_admin_welcome_queue() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(q) - 'personalization' || jsonb_build_object(
                     'vision_value', q.personalization ->> 'value', 'family_name', q.personalization ->> 'family_name',
                     'first_month', (select jsonb_build_object('id', p.id, 'resource_month', p.resource_month, 'kit_slug', p.kit_slug,
                        'kit_title', p.kit_title, 'status', p.status, 'pdf_status', p.pdf_status, 'member_approved_at', p.member_approved_at)
                        from public.club_fulfillment_queue p where p.id = q.kit_partner_id))
                   order by q.created_at)
                     from public.club_fulfillment_queue q
                    where q.fulfillment_type = 'welcome_vision' and q.status not in ('mailed', 'canceled', 'skipped')), '[]');
end $$;

-- ---------------------------------------------------------------- her first resource locks with the kit

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
  if exists (select 1 from public.club_fulfillment_queue q where q.household_id = h.id and q.resource_month = k.month
              and q.fulfillment_type = 'monthly_resource'
              and (q.status in ('printed', 'mailed') or (q.in_welcome_kit and q.status = 'approved'))) then
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

-- ---------------------------------------------------------------- emails

alter table public.club_email_log drop constraint club_email_log_kind_check;
alter table public.club_email_log add constraint club_email_log_kind_check
  check (kind in ('welcome', 'profile_reminder', 'resource_ready', 'review', 'payment_failed', 'canceled', 'kit_reminder'));

-- As before, plus 'kit_reminder' (two days after she approved her print, her first resource still unconfirmed), and
-- the monthly 'review' email leaves out Welcome Kit orders (the kit has its own confirmation).
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
       and q.fulfillment_type = 'monthly_resource' and not q.in_welcome_kit and q.readiness in ('ready', 'needs_pdf')
    union all
    select q.user_id, q.email, p.kit_slug, q.id
      from public.club_fulfillment_queue q join public.club_fulfillment_queue p on p.id = q.kit_partner_id
     where p_kind = 'kit_reminder' and q.fulfillment_type = 'welcome_vision' and q.status = 'pending'
       and q.readiness = 'needs_confirmation' and now() >= q.kit_auto_approve_at - interval '1 day'
  ) x;
$$;

-- ---------------------------------------------------------------- December: her December resource, plus the print
-- club_intro_grant and club_invoice_apply as in 20261107000000, with one change each: a first month that's a
-- December is fulfilled by that December's resource (fulfilled_by 'monthly_resource'), not by the welcome print.

create or replace function public.club_intro_grant(p_sub text, p_card text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
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
  by_ := 'monthly_resource';  -- 20261108: a first December gets its December resource too (no substitution).
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
end $$;

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
        by_ := 'monthly_resource';  -- 20261108: a first December gets its December resource too (no substitution).
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

commit;
