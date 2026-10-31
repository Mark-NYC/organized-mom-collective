-- Organized Family Club: the Welcome Kit, as agreed with the owner on Oct 31 2026 (docs/club/WELCOME_KIT.md).
-- Plan and decisions: docs/club/POST_CHECKOUT_JOURNEY.md.
--
--   * Explicit approval only. Her print and her first month's resource both need her own approval; the three-day rule
--     that counted her first resource as confirmed is retired (readiness stays 'needs_confirmation' until she
--     confirms, club_admin_set_welcome_kit no longer records an automatic confirmation). Reminders instead:
--     club_email_audience('kit_reminder') returns her kit two days and again seven days after she approved her print
--     (`reminder` 1 or 2; club-admin sends each once).
--   * Submitted and ship-by. The queue adds kit_submitted_at (both approvals in) and kit_ship_by (two business days
--     later, New York dates, weekends skipped; holidays aren't known). The owner is emailed when a kit is submitted
--     (email kind 'kit_submitted', sent by club-billing). Nothing is ever marked printed or mailed automatically.
--   * The Family Meeting guide. A standard one-page insert in every Welcome Kit (not personalized, no order row):
--     club_admin_welcome_queue lists the packing list. Her review of it is recorded (club_households
--     .meeting_guide_seen_at, club_meeting_guide_seen / club_meeting_guide_mark) and never holds the kit.
--
-- Existing orders, entitlements, claims, subscriptions and invoices are not changed. Stripe and prices are unchanged.

begin;

-- ---------------------------------------------------------------- her review of the Family Meeting guide

alter table public.club_households add column if not exists meeting_guide_seen_at timestamptz;

create or replace function public.club_meeting_guide_seen() returns timestamptz
language sql stable security definer set search_path = '' as $$
  select h.meeting_guide_seen_at from public.club_households h where h.owner_user_id = auth.uid();
$$;

create or replace function public.club_meeting_guide_mark() returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  t timestamptz;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  update public.club_households set meeting_guide_seen_at = coalesce(meeting_guide_seen_at, now())
   where owner_user_id = auth.uid() returning meeting_guide_seen_at into t;
  if t is null then raise exception 'no_household'; end if;
  return t;
end $$;

revoke execute on function public.club_meeting_guide_seen(), public.club_meeting_guide_mark() from public, anon;
grant execute on function public.club_meeting_guide_seen(), public.club_meeting_guide_mark() to authenticated;

-- ---------------------------------------------------------------- two business days

-- The New York date n business days (Monday to Friday) after a moment: Friday 3 pm + 2 → Tuesday.
create or replace function public.club_business_days_after(p_at timestamptz, p_days int) returns date
language plpgsql immutable set search_path = '' as $$
declare
  d date := (p_at at time zone 'America/New_York')::date;
  n int := 0;
begin
  while n < p_days loop
    d := d + 1;
    if extract(isodow from d) < 6 then n := n + 1; end if;
  end loop;
  return d;
end $$;
-- Read by the queue view (security invoker), so signed-in roles may call it; never anon.
revoke execute on function public.club_business_days_after(timestamptz, int) from public, anon;
grant execute on function public.club_business_days_after(timestamptz, int) to authenticated, service_role;

-- ---------------------------------------------------------------- the queue

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
           when kit.m_approved_at is null then 'needs_confirmation'
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
       -- Retired (20261110): nothing counts as confirmed without her. Kept, always null, for older readers.
       null::timestamptz as kit_auto_approve_at,
       -- Submitted: both of her approvals are in (print and first resource). The two-business-day target runs from here.
       case when kit.in_kit and kit.w_approved_at is not null and kit.m_approved_at is not null
            then greatest(kit.w_approved_at, kit.m_approved_at) end as kit_submitted_at,
       case when kit.in_kit and kit.w_approved_at is not null and kit.m_approved_at is not null
            then public.club_business_days_after(greatest(kit.w_approved_at, kit.m_approved_at), 2) end as kit_ship_by,
       h.meeting_guide_seen_at
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

-- ---------------------------------------------------------------- admin

-- The Welcome Kit's status: both orders together, or neither (as in 20261108, without the automatic confirmation).
create or replace function public.club_admin_set_welcome_kit(p_order uuid, p_status text, p_note text default null) returns jsonb
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
  perform public.admin_log('club.welcome_kit', 'club_order:' || w::text, jsonb_build_object('to', p_status, 'first_month_order', m));
  return (select to_jsonb(x) from public.club_fulfillment_queue x where x.id = w);
end $$;

-- Welcome Kits not yet mailed (and welcome prints that ship alone): submitted kits first, by ship-by date, then the
-- rest oldest first. Each row carries the packing list: the print, the Family Meeting guide, her first month.
create or replace function public.club_admin_welcome_queue() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(q) - 'personalization' || jsonb_build_object(
                     'vision_value', q.personalization ->> 'value', 'family_name', q.personalization ->> 'family_name',
                     'first_month', (select jsonb_build_object('id', p.id, 'resource_month', p.resource_month, 'kit_slug', p.kit_slug,
                        'kit_title', p.kit_title, 'status', p.status, 'pdf_status', p.pdf_status, 'member_approved_at', p.member_approved_at)
                        from public.club_fulfillment_queue p where p.id = q.kit_partner_id),
                     'packing_list', case when q.in_welcome_kit then jsonb_build_array(
                        'Family Vision print (personalized)', 'Family Meeting guide (standard insert)',
                        coalesce(to_char((select p.resource_month from public.club_fulfillment_queue p where p.id = q.kit_partner_id), 'FMMonth YYYY') || ' resource (personalized)', 'First month resource (personalized)'))
                        else jsonb_build_array('Family Vision print (personalized)') end)
                   order by q.kit_ship_by nulls last, q.created_at)
                     from public.club_fulfillment_queue q
                    where q.fulfillment_type = 'welcome_vision' and q.status not in ('mailed', 'canceled', 'skipped')), '[]');
end $$;

-- ---------------------------------------------------------------- emails

alter table public.club_email_log drop constraint club_email_log_kind_check;
alter table public.club_email_log add constraint club_email_log_kind_check
  check (kind in ('welcome', 'profile_reminder', 'resource_ready', 'review', 'payment_failed', 'canceled', 'kit_reminder', 'kit_submitted'));

-- As in 20261108, except kit_reminder: two days after she approved her print (reminder 1) and seven days after
-- (reminder 2), while her first resource waits for her. Nothing is confirmed for her.
create or replace function public.club_email_audience(p_kind text, p_month date default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x), '[]') from (
    select h.owner_user_id as user_id, u.email, null::text as kit_slug, null::uuid as order_id, null::int as reminder
      from public.club_households h join auth.users u on u.id = h.owner_user_id
     where p_kind = 'profile_reminder' and h.onboarded_at is null and h.enrolled_at < now() - interval '1 day'
       and public.club_has_access(h.owner_user_id)
    union all
    select e.user_id, u.email, k.slug, null, null
      from public.club_entitlements e join auth.users u on u.id = e.user_id join public.club_kits k on k.month = e.resource_month
     where p_kind = 'resource_ready' and e.resource_month = p_month and e.kind = 'digital' and e.revoked_at is null
       and e.fulfilled_by = 'monthly_resource' and k.status in ('scheduled', 'retired')
    union all
    select q.user_id, q.email, q.kit_slug, q.id, null
      from public.club_fulfillment_queue q
     where p_kind = 'review' and q.resource_month = p_month and q.status = 'pending' and q.member_approved_at is null
       and q.fulfillment_type = 'monthly_resource' and not q.in_welcome_kit and q.readiness in ('ready', 'needs_pdf')
    union all
    select q.user_id, q.email, p.kit_slug, q.id, case when now() >= q.member_approved_at + interval '7 days' then 2 else 1 end
      from public.club_fulfillment_queue q join public.club_fulfillment_queue p on p.id = q.kit_partner_id
     where p_kind = 'kit_reminder' and q.fulfillment_type = 'welcome_vision' and q.status = 'pending'
       and q.readiness = 'needs_confirmation' and now() >= q.member_approved_at + interval '2 days'
  ) x;
$$;

-- What club-billing needs to email the owner once she submits her kit (her own order only; null if not submitted).
create or replace function public.club_kit_submitted(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('order_id', q.id, 'email', q.email, 'family_name', coalesce(q.personalization ->> 'family_name', q.display_name),
           'first_month', (select p.resource_month from public.club_fulfillment_queue p where p.id = q.kit_partner_id),
           'submitted_at', q.kit_submitted_at, 'ship_by', q.kit_ship_by)
    from public.club_fulfillment_queue q
   where q.user_id = p_user and q.fulfillment_type = 'welcome_vision' and q.in_welcome_kit and q.kit_submitted_at is not null
     and q.status in ('pending', 'approved') and q.readiness in ('needs_pdf', 'ready')
   order by q.created_at limit 1;
$$;
revoke execute on function public.club_kit_submitted(uuid) from public, anon, authenticated;
grant execute on function public.club_kit_submitted(uuid) to service_role;

commit;
