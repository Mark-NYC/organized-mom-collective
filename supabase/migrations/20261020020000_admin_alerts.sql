-- /admin → Overview: actionable alerts and the business numbers. Requires 20261020010000_admin_pages.sql.
--
-- admin_alerts_refresh() re-checks every rule against the live data: an alert opens once per
-- problem (stable key), stays open while the problem exists, and resolves itself when it's gone.
-- The Overview runs it on every load; nothing else is needed for alerts to be correct.
-- Rules read live (real-money) orders only; test orders never raise alerts.
begin;

-- Returns: when each return reached its current state (for "approved 14 days ago, not received").
alter table public.support_requests add column return_status_at timestamptz;
update public.support_requests set return_status_at = coalesce(resolved_at, created_at) where return_status is not null;
create or replace function public.support_requests_touch() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved' then new.resolved_at := now();
  elsif new.status <> 'resolved' then new.resolved_at := null;
  end if;
  if new.return_status is distinct from old.return_status then new.return_status_at := now(); end if;
  return new;
end $$;

-- Low-stock alerts per product (physical only).
alter table public.shop_products add column low_stock_threshold int not null default 5 check (low_stock_threshold between 0 and 10000);

create table public.admin_alerts (
  key text primary key check (char_length(key) <= 300),
  severity text not null check (severity in ('critical', 'warning', 'info')),
  area text not null check (area in ('orders', 'payments', 'email', 'support', 'returns', 'inventory', 'website')),
  title text not null check (char_length(title) <= 200),
  detail text check (char_length(detail) <= 1000),
  -- Where to fix it (an /admin path or a documented place).
  link text check (char_length(link) <= 300),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  resolved_at timestamptz,
  acked_at timestamptz,
  acked_by uuid
);
create index admin_alerts_open on public.admin_alerts (resolved_at, severity);
alter table public.admin_alerts enable row level security;
revoke all on public.admin_alerts from public, anon, authenticated;
grant select on public.admin_alerts to authenticated;
create policy "Owners read alerts" on public.admin_alerts for select to authenticated using ((select public.is_admin('owner')));
grant select, insert, update, delete on public.admin_alerts to service_role;

-- Weekdays strictly after `a` up to and including `b` (no holiday calendar).
create function public.admin_business_days(a timestamptz, b timestamptz) returns int
language sql immutable set search_path = '' as $$
  select count(*)::int from generate_series((a at time zone 'America/New_York')::date + 1, (b at time zone 'America/New_York')::date, interval '1 day') d
   where extract(isodow from d) < 6;
$$;
revoke execute on function public.admin_business_days(timestamptz, timestamptz) from public, anon, authenticated;

-- Every rule, as rows (key, severity, area, title, detail, link). Add rules here.
create function public.admin_alert_conditions()
returns table (key text, severity text, area text, title text, detail text, link text)
language sql stable security definer set search_path = '' as $$
  -- Paid physical orders not shipped after 2 business days (critical after 4).
  select 'order.unshipped:' || o.id, case when public.admin_business_days(o.paid_at, now()) >= 4 then 'critical' else 'warning' end, 'orders',
         'Order #' || o.order_number || ' paid ' || public.admin_business_days(o.paid_at, now()) || ' business days ago, not shipped',
         'Ship it, or tell the customer when it will ship.', '/admin/orders'
    from public.shop_orders o
   where o.livemode and o.payment_status in ('paid', 'partially_refunded') and not o.digital
     and o.fulfillment_status in ('unfulfilled', 'packing') and o.paid_at is not null
     and public.admin_business_days(o.paid_at, now()) >= 2
  union all
  -- Orders the payment code flagged (oversold, amount mismatch, dispute, failed refund).
  select 'order.flag:' || o.id || ':' || f, 'critical', 'payments',
         'Order #' || coalesce(o.order_number::text, '(unpaid)') || ' flagged: ' || replace(f, '_', ' '),
         case f when 'disputed' then 'Respond to the dispute in Stripe before its deadline.'
                when 'oversold' then 'Paid after its stock ran out: contact the customer or restock.'
                when 'refund_failed' then 'Stripe couldn''t complete the refund. Check it in Stripe.'
                else 'The paid amount doesn''t match the order. Check it in Stripe.' end,
         '/admin/orders'
    from public.shop_orders o, unnest(o.flags) f
   where o.livemode
  union all
  -- Customer emails that failed or weren't sent (no provider) in the last 30 days.
  select 'email.order:' || e.id, case when e.status = 'skipped' then 'critical' else 'warning' end, 'email',
         'Order #' || coalesce(o.order_number::text, '?') || ': ' || e.kind || ' email ' || case when e.status = 'skipped' then 'not sent (no email provider)' else 'failed' end,
         left(e.error, 300), '/admin/orders'
    from public.shop_email_log e join public.shop_orders o on o.id = e.order_id
   where o.livemode and e.status in ('failed', 'skipped') and e.updated_at > now() - interval '30 days'
  union all
  -- Support requests that never reached the inbox: the owner may not know they exist.
  select 'support.notify:' || r.reference, 'critical', 'email',
         'Support request ' || r.reference || ' didn''t reach the support inbox (' || r.notify_status || ')',
         'Read it in Supabase → Table Editor → support_requests and answer from your inbox.', null
    from public.support_requests r
   where r.notify_status in ('failed', 'skipped') and r.status <> 'resolved'
  union all
  select 'support.ack:' || r.reference, 'warning', 'email',
         'Customer acknowledgment for ' || r.reference || ' failed',
         'She didn''t get the "we received your message" email. Reply to her directly.', null
    from public.support_requests r
   where r.ack_status = 'failed' and r.status <> 'resolved'
  union all
  -- Open requests waiting more than one business day.
  select 'support.waiting:' || r.reference, case when public.admin_business_days(r.created_at, now()) >= 3 then 'critical' else 'warning' end, 'support',
         r.reference || ' (' || r.topic || ') open ' || public.admin_business_days(r.created_at, now()) || ' business days',
         'Reply, then set status to waiting or resolved.', null
    from public.support_requests r
   where r.status = 'open' and public.admin_business_days(r.created_at, now()) >= 1
  union all
  select 'return.not_received:' || r.reference, 'warning', 'returns',
         'Return ' || r.reference || ' approved ' || (now()::date - r.return_status_at::date) || ' days ago, not received',
         'Follow up with the customer, or decline it.', null
    from public.support_requests r
   where r.return_status = 'approved' and r.return_status_at < now() - interval '14 days'
  union all
  select 'return.not_refunded:' || r.reference, 'warning', 'returns',
         'Return ' || r.reference || ' received, not refunded',
         'Refund it (website orders: Shop & Orders; Etsy orders: in Etsy), then mark it refunded.', '/admin/orders'
    from public.support_requests r
   where r.return_status = 'received' and public.admin_business_days(r.return_status_at, now()) >= 2
  union all
  -- Physical products on sale: out of stock or low.
  select case when p.stock = 0 then 'stock.out:' else 'stock.low:' end || p.slug, case when p.stock = 0 then 'critical' else 'warning' end, 'inventory',
         p.name || case when p.stock = 0 then ': out of stock but on sale' else ': ' || p.stock || ' left' end,
         'Restock it or switch it off in Inventory.', '/admin/orders?tab=inventory'
    from public.shop_products p
   where p.active and p.kind = 'physical' and p.stock <= p.low_stock_threshold
  union all
  -- Stripe hasn't reported back on checkouts started 2+ hours ago: the webhook is broken.
  select 'payments.webhook_silent', 'critical', 'payments',
         'Stripe webhook silent: ' || count(*) || ' checkout(s) with no Stripe event since they started',
         'Check Stripe → Developers → Webhooks for failed deliveries, and the stripe-webhook function logs.', '/admin/settings'
    from public.shop_orders o
   where o.stripe_session_id is not null and o.created_at between now() - interval '7 days' and now() - interval '2 hours'
     and not exists (select 1 from public.shop_stripe_events e where e.received_at > o.created_at)
  having count(*) > 0
  union all
  select 'payments.store_open_no_rate', 'critical', 'payments',
         'Store switch is Open but there is no real shipping rate',
         'Checkout stays closed for physical products until a real rate exists.', '/admin/orders?tab=settings'
    from public.shop_settings s
   where s.checkout_mode = 'live'
     and not exists (select 1 from public.shop_shipping_rates r where r.active and not r.test_only)
  union all
  -- Starter Kit emails that failed in the last 7 days.
  select 'email.starter_kit', 'warning', 'email',
         count(*) || ' Starter Kit email(s) not delivered in the last 7 days',
         'Check RESEND_API_KEY and the starter-kit-signup function logs.', null
    from public.tool_email_contacts c
   where c.starter_kit_email_status in ('failed', 'skipped') and c.starter_kit_requested_at > now() - interval '7 days'
  having count(*) > 0
  union all
  -- Website: CTAs pointing at pages that don't exist.
  select 'website.cta_missing:' || s.path || ':' || (c ->> 'href'), 'warning', 'website',
         'Broken button on ' || s.path || ': "' || left(c ->> 'label', 60) || '" goes to ' || (c ->> 'href'),
         'The destination page isn''t in the build. Ask Claude to fix the link.', '/admin/pages'
    from public.site_pages s, jsonb_array_elements(s.ctas) c
   where s.removed_at is null and c ? 'broken'
  union all
  -- External CTA destinations (Etsy listings…) that answered 404/410 in the latest run.
  select 'website.link_gone:' || (l ->> 'href'), 'warning', 'website',
         'Link target gone (' || (l ->> 'status') || '): ' || left(l ->> 'href', 120),
         'Used on ' || (select string_agg(p, ', ') from jsonb_array_elements_text(l -> 'pages') p) || '.', '/admin/pages'
    from (select links from public.site_inventory_runs order by at desc limit 1) r, jsonb_array_elements(r.links) l
   where (l ->> 'broken')::boolean
  union all
  select 'website.page_removed:' || s.path, 'info', 'website',
         'Page removed from the site: ' || s.path,
         'If people or Pins still link to it, add a redirect.', '/admin/pages'
    from public.site_pages s
   where s.removed_at > now() - interval '7 days'
  union all
  select 'website.inventory_stale', 'info', 'website',
         case when max(r.at) is null then 'Page inventory not connected yet' else 'Page inventory not updated in ' || (now()::date - max(r.at)::date) || ' days' end,
         'The GitHub Action updates it after every push to the default branch. Setup: supabase/ADMIN.md.', '/admin/settings'
    from public.site_inventory_runs r
  having max(r.at) is null or max(r.at) < now() - interval '8 days';
$$;
revoke execute on function public.admin_alert_conditions() from public, anon, authenticated;

-- Opens, updates and resolves alerts. Returns open counts by severity.
create function public.admin_alerts_refresh() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  cur jsonb;
begin
  -- The owner (dashboard) or an Edge Function (service role), e.g. a future alert email.
  if not (public.is_admin('owner') or coalesce(auth.jwt() ->> 'role', '') = 'service_role') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- One refresh at a time.
  perform pg_advisory_xact_lock(hashtextextended('admin_alerts_refresh', 0));

  select coalesce(jsonb_agg(to_jsonb(c)), '[]') into cur from public.admin_alert_conditions() c;

  insert into public.admin_alerts as a (key, severity, area, title, detail, link)
  select c.key, c.severity, c.area, left(c.title, 200), left(c.detail, 1000), c.link
    from jsonb_to_recordset(cur) as c(key text, severity text, area text, title text, detail text, link text)
  on conflict (key) do update set
    severity = excluded.severity, title = excluded.title, detail = excluded.detail, link = excluded.link, last_seen = now(),
    -- A problem that comes back is new again.
    first_seen = case when a.resolved_at is not null then now() else a.first_seen end,
    acked_at = case when a.resolved_at is not null then null else a.acked_at end,
    acked_by = case when a.resolved_at is not null then null else a.acked_by end,
    resolved_at = null;

  update public.admin_alerts set resolved_at = now()
   where resolved_at is null and key not in (select c.key from jsonb_to_recordset(cur) as c(key text));
  delete from public.admin_alerts where resolved_at < now() - interval '90 days';

  return (select jsonb_build_object(
    'critical', count(*) filter (where severity = 'critical'),
    'warning', count(*) filter (where severity = 'warning'),
    'info', count(*) filter (where severity = 'info'))
    from public.admin_alerts where resolved_at is null);
end $$;
revoke execute on function public.admin_alerts_refresh() from public, anon;
grant execute on function public.admin_alerts_refresh() to authenticated, service_role;

-- "Seen it": hides the alert from the top of the list until the problem changes or comes back.
create function public.admin_alert_ack(p_key text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.admin_alerts set acked_at = now(), acked_by = auth.uid() where key = p_key and resolved_at is null;
  if found then perform public.admin_log_service(auth.uid(), 'alert.ack', left(p_key, 200), '{}'); end if;
end $$;
revoke execute on function public.admin_alert_ack(text) from public, anon;
grant execute on function public.admin_alert_ack(text) to authenticated;

-- The Overview's numbers. Live (real-money) orders only; test orders are counted separately.
-- Visitors and conversion rates are not here: they need GA4 (Phase 5), and the page says so.
create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  paid constant text[] := array['paid', 'partially_refunded', 'refunded'];
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'checkout_mode', (select checkout_mode from public.shop_settings),
    'orders', (select jsonb_build_object(
        'paid_30d', count(*) filter (where o.livemode and o.payment_status = any (paid) and o.paid_at > now() - interval '30 days'),
        'paid_all', count(*) filter (where o.livemode and o.payment_status = any (paid)),
        'revenue_30d_cents', coalesce(sum(o.total_cents - o.refunded_cents) filter (where o.livemode and o.payment_status = any (paid) and o.paid_at > now() - interval '30 days'), 0),
        'revenue_all_cents', coalesce(sum(o.total_cents - o.refunded_cents) filter (where o.livemode and o.payment_status = any (paid)), 0),
        'refunded_30d_cents', coalesce(sum(o.refunded_cents) filter (where o.livemode and o.paid_at > now() - interval '30 days'), 0),
        'to_ship', count(*) filter (where o.livemode and o.payment_status in ('paid', 'partially_refunded') and not o.digital and o.fulfillment_status in ('unfulfilled', 'packing')),
        'checkouts_started_30d', count(*) filter (where o.livemode is not false and o.created_at > now() - interval '30 days' and o.stripe_session_id is not null),
        'test_orders', count(*) filter (where o.livemode is false))
      from public.shop_orders o),
    'support', (select jsonb_build_object(
        'open', count(*) filter (where status = 'open'),
        'waiting', count(*) filter (where status = 'waiting'),
        'oldest_open_at', min(created_at) filter (where status = 'open'),
        'returns_in_progress', count(*) filter (where return_status in ('requested', 'approved', 'received')))
      from public.support_requests),
    'inventory', (select jsonb_build_object(
        'active_products', count(*) filter (where active),
        'low_stock', count(*) filter (where active and kind = 'physical' and stock <= low_stock_threshold))
      from public.shop_products),
    'leads', (select jsonb_build_object(
        'total', count(*),
        'last_30d', count(*) filter (where created_at > now() - interval '30 days'),
        'marketing_opt_in', count(*) filter (where marketing_opt_in))
      from public.tool_email_contacts),
    -- Recent activity: what happened, never customer emails or messages.
    'recent', (select coalesce(jsonb_agg(x order by x.at desc), '[]') from (
        (select e.at, 'order' as kind, 'Order #' || coalesce(o.order_number::text, '–') || ': ' || replace(e.kind, '_', ' ') as text, o.livemode as live
           from public.shop_order_events e join public.shop_orders o on o.id = e.order_id
          where e.kind not in ('checkout_created') order by e.at desc limit 15)
        union all
        (select r.created_at, 'support', 'Support request ' || r.reference || ' (' || r.topic || ')', true
           from public.support_requests r order by r.created_at desc limit 10)
        union all
        (select c.created_at, 'lead', 'New email signup from ' || c.first_tool || case when c.marketing_opt_in then ' (opted in)' else '' end, true
           from public.tool_email_contacts c order by c.created_at desc limit 10)
        union all
        (select l.at, 'admin', l.action || coalesce(' ' || l.target, ''), true
           from public.admin_audit_log l where l.action not like 'admin.sign_in' order by l.at desc limit 10)
        order by 1 desc limit 20) x)
  );
end $$;
revoke execute on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

commit;
