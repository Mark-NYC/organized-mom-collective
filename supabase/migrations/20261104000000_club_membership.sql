-- Organized Family Club, Phase 2–3: paid membership. Monthly ($5) and annual ($60) Stripe subscriptions, explicit
-- monthly entitlements, member resource versions, the fulfillment queue, emails, admin tools.
-- Plan: docs/club/MEMBERSHIP.md. Access tests: supabase/tests/club-membership.sql (npm run test:admin-sql).
--
-- Runs after 20261023000000_club_core.sql and the kit seeds. Additive: no existing customer data is changed or
-- dropped. club_kit_entitlements and club_mailing_recipients (Phase 1 drafts, never written by anything) are
-- replaced by club_entitlements and club_fulfillment_orders; the migration refuses to run if either holds rows.
--
-- The access model (each rule has a check in the tests):
--   * Stripe is the billing authority. club_subscriptions / club_invoices mirror Stripe, rewritten from fresh API
--     reads by club-webhook. Access is NOT computed from them, or from counting payments.
--   * Access comes from club_entitlements: one row per (member, calendar month, digital|physical), created from a
--     PAID invoice line's own period (monthly: that one month; annual: the twelve consecutive months starting with
--     it), or by an audited admin grant. Each row records the resource edition (kit), the membership year, the plan
--     and the invoice/period that granted it. Unique indexes make webhook retries harmless.
--   * A failed, open or voided invoice grants nothing. A full refund or a dispute revokes exactly the rows its
--     invoice granted and cancels their unmailed fulfillment orders. Cancelling keeps every row already granted.
--   * Digital: she opens a published kit whose month she holds an active digital entitlement for. With a live
--     membership she can edit and save it; after cancelling, read and print only.
--   * Physical: one fulfillment order per physical entitlement, and never two standard mailings for one household
--     and month. First mailing month and cutoff day are settings (club_settings), not code.

begin;

do $$ begin
  if exists (select 1 from public.club_kit_entitlements) or exists (select 1 from public.club_mailing_recipients) then
    raise exception 'club_kit_entitlements or club_mailing_recipients has rows: migrate them before replacing the tables';
  end if;
end $$;

-- Phase 1 helpers that depended on the replaced tables (redefined below).
drop function public.club_me();
drop function public.club_can_open(uuid, uuid);
drop function public.club_earned(uuid, uuid);
drop function public.club_mailing_eligible(uuid, uuid);
drop table public.club_mailing_recipients;
drop table public.club_kit_entitlements;

-- ---------------------------------------------------------------- settings

-- One row. Changed only through club_admin_settings (owner, audited).
create table public.club_settings (
  id boolean primary key default true check (id),
  -- off: nobody can start checkout. test: Stripe test keys only. live: live keys, and only with the deployment
  -- flag CLUB_LIVE_CHECKOUT=enabled as well (club-billing checks both).
  checkout_mode text not null default 'off' check (checkout_mode in ('off', 'test', 'live')),
  -- The first calendar month that has a printed mailing. Paid months before it are digital only.
  first_mailing_month date not null default '2026-11-01' check (extract(day from first_mailing_month) = 1),
  -- Default mailing cutoff: this day of the month BEFORE the delivery month, 23:59 New York time. A kit's own
  -- mailer_cutoff_at wins. Paid after the cutoff → the mailing is still owed, flagged "late" (catch-up batch).
  cutoff_day int not null default 15 check (cutoff_day between 1 and 28),
  -- Send "review your printable" emails and let members approve before printing.
  member_review boolean not null default true,
  -- Stripe Billing Portal configuration created by club-admin → stripe_setup (an id, not a secret).
  portal_configuration_id text check (portal_configuration_id ~ '^bpc_[A-Za-z0-9]+$'),
  updated_at timestamptz not null default now()
);
insert into public.club_settings default values;

-- Webhook signing secret, when club-admin → stripe_setup created the endpoint (Stripe shows it only then).
-- service_role only; the CLUB_STRIPE_WEBHOOK_SECRET function secret takes precedence when set.
create table public.club_secret (
  name text primary key check (name in ('webhook_secret_test', 'webhook_secret_live')),
  value text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- households, customers, billing mirror: additions

alter table public.club_households
  add column billing_email text check (char_length(billing_email) <= 254),
  -- First paid invoice (never changes, survives cancel and resubscribe).
  add column enrolled_at timestamptz,
  -- First calendar month an invoice paid for: membership year 1 starts here.
  add column first_paid_month date check (first_paid_month is null or extract(day from first_paid_month) = 1);

alter table public.club_customers
  add column household_id uuid references public.club_households (id) on delete set null;
create index club_customers_email on public.club_customers (lower(email));

alter table public.club_subscriptions
  add column household_id uuid references public.club_households (id) on delete set null,
  add column plan text check (plan in ('monthly', 'annual')),
  -- Stripe's subscription.pause_collection, when set (no invoices are paid, so nothing is granted).
  add column pause_collection text;

alter table public.club_invoices
  add column user_id uuid references auth.users (id) on delete set null,
  add column stripe_payment_intent_id text,
  add column stripe_charge_id text,
  add column attempt_count int not null default 0,
  add column failure_message text check (char_length(failure_message) <= 300),
  add column disputed boolean not null default false,
  add column plan text check (plan in ('monthly', 'annual'));
create index club_invoices_payment_intent on public.club_invoices (stripe_payment_intent_id);

-- An abandoned 3-D Secure attempt (incomplete, expires after 23 hours by itself) must not block a new checkout,
-- so incomplete no longer counts as live here; club-billing still refuses while one is open.
drop index public.club_subscriptions_one_live;
create unique index club_subscriptions_one_live on public.club_subscriptions (user_id)
  where status in ('trialing', 'active', 'past_due', 'unpaid', 'paused') and user_id is not null;

-- Checkout sessions this site opened: reused while open, so a double click or a second tab can't start a
-- second subscription. Expired or completed rows stay as a record of abandoned checkouts.
create table public.club_checkout_sessions (
  stripe_session_id text primary key check (stripe_session_id ~ '^cs_(test|live)_[A-Za-z0-9]+$'),
  stripe_customer_id text not null,
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  plan text not null check (plan in ('monthly', 'annual')),
  url text not null,
  status text not null default 'open' check (status in ('open', 'complete', 'expired')),
  livemode boolean not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index club_checkout_sessions_customer on public.club_checkout_sessions (stripe_customer_id, status);

-- ---------------------------------------------------------------- entitlements

create table public.club_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid not null references public.club_households (id) on delete cascade,
  -- Calendar month and year of the resource (first day of the month).
  resource_month date not null check (extract(day from resource_month) = 1),
  -- The exact resource edition. Null until a kit row exists for that month (filled in by a trigger).
  kit_id uuid references public.club_kits (id),
  kind text not null check (kind in ('digital', 'physical')),
  -- Year 1 = the twelve months starting with the household's first paid month, Year 2 the next twelve, …
  membership_year int not null check (membership_year >= 1),
  plan text not null check (plan in ('monthly', 'annual', 'admin')),
  source text not null check (source in ('invoice', 'admin')),
  -- The paid period that granted it (source = invoice).
  invoice_id text references public.club_invoices (stripe_invoice_id),
  subscription_id uuid references public.club_subscriptions (id) on delete set null,
  period_start timestamptz,
  period_end timestamptz,
  granted_at timestamptz not null default now(),
  granted_by uuid,
  revoked_at timestamptz,
  revoked_reason text check (revoked_reason in ('refunded', 'disputed', 'admin')),
  note text check (char_length(note) <= 300),
  check (source <> 'invoice' or invoice_id is not null),
  check (source <> 'admin' or note is not null)
);
-- One live right per member, month and kind: duplicate and out-of-order webhooks can't add a second.
create unique index club_entitlements_one_live on public.club_entitlements (user_id, resource_month, kind) where revoked_at is null;
create index club_entitlements_invoice on public.club_entitlements (invoice_id);
create index club_entitlements_month on public.club_entitlements (resource_month);

-- A kit added later picks up the entitlements already granted for its month.
create function public.club_kits_link_entitlements() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.club_entitlements set kit_id = new.id where resource_month = new.month and kit_id is null;
  update public.club_fulfillment_orders set kit_id = new.id where resource_month = new.month and kit_id is null;
  return new;
end $$;
revoke execute on function public.club_kits_link_entitlements() from public, anon, authenticated;

-- ---------------------------------------------------------------- personalized resource versions

-- Her version of a month's printable: the printable's own saved state (the keys it keeps in the browser, mirrored
-- here by the member page), the profile version it was made with, and her approval for printing.
create table public.club_resource_versions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.club_households (id) on delete cascade,
  kit_id uuid not null references public.club_kits (id) on delete cascade,
  state jsonb not null default '{}' check (jsonb_typeof(state) = 'object' and octet_length(state::text) <= 65536),
  profile_version int not null,
  revision int not null default 1,
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (household_id, kit_id)
);

-- ---------------------------------------------------------------- fulfillment

-- Paid membership → eligible mailing month → family profile → personalized PDF → queue → review → mailed.
-- Readiness (profile, address, published kit, PDF) is derived in club_fulfillment_queue; status here is only what
-- a person decided. Compatible with a print-and-mail API later (provider, provider_ref).
create table public.club_fulfillment_orders (
  id uuid primary key default gen_random_uuid(),
  -- One standard mailing per physical entitlement.
  entitlement_id uuid not null unique references public.club_entitlements (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid not null references public.club_households (id) on delete cascade,
  resource_month date not null,
  kit_id uuid references public.club_kits (id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'printed', 'mailed', 'returned', 'on_hold', 'skipped', 'canceled')),
  -- Paid after the month's cutoff: still owed, goes in a catch-up batch.
  late boolean not null default false,
  cutoff_at timestamptz not null,
  -- Frozen when it's approved for print: a later address change doesn't move a mailing already in production.
  address jsonb,
  member_approved_at timestamptz,
  pdf_status text not null default 'not_ready' check (pdf_status in ('not_ready', 'ready')),
  pdf_ready_at timestamptz,
  printed_at timestamptz,
  mailed_at timestamptz,
  provider text check (provider in ('manual', 'postgrid', 'letterstream')),
  provider_ref text check (char_length(provider_ref) <= 120),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Never two standard mailings for one household and month (a replacement after a return reuses the order).
create unique index club_fulfillment_one_per_month on public.club_fulfillment_orders (household_id, resource_month) where status <> 'canceled';
create index club_fulfillment_month on public.club_fulfillment_orders (resource_month, status);

create trigger club_kits_link_entitlements after insert on public.club_kits
  for each row execute function public.club_kits_link_entitlements();

-- ---------------------------------------------------------------- email log

-- One row per email the Club sends, keyed so a webhook retry or a second click can't send it twice.
create table public.club_email_log (
  dedupe_key text primary key check (char_length(dedupe_key) <= 200),
  kind text not null check (kind in ('welcome', 'profile_reminder', 'resource_ready', 'review', 'payment_failed', 'canceled')),
  user_id uuid references auth.users (id) on delete set null,
  to_email text not null,
  status text not null default 'sending' check (status in ('sending', 'sent', 'skipped', 'failed')),
  resend_id text,
  error text check (char_length(error) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS: every new table closed, then opened narrowly

alter table public.club_settings enable row level security;
alter table public.club_secret enable row level security;
alter table public.club_checkout_sessions enable row level security;
alter table public.club_entitlements enable row level security;
alter table public.club_resource_versions enable row level security;
alter table public.club_fulfillment_orders enable row level security;
alter table public.club_email_log enable row level security;
revoke all on public.club_settings, public.club_secret, public.club_checkout_sessions, public.club_entitlements,
  public.club_resource_versions, public.club_fulfillment_orders, public.club_email_log from public, anon, authenticated;
grant all on public.club_settings, public.club_secret, public.club_checkout_sessions, public.club_entitlements,
  public.club_resource_versions, public.club_fulfillment_orders, public.club_email_log to service_role;

-- Members read their own entitlements and mailings (the dashboard also gets them through club_me).
grant select on public.club_entitlements, public.club_fulfillment_orders to authenticated;
create policy "Members read their entitlements" on public.club_entitlements
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Members read their mailings" on public.club_fulfillment_orders
  for select to authenticated using (user_id = (select auth.uid()));
-- Owner admins read billing and fulfillment state for /admin/club (never club_secret or resource state).
grant select on public.club_settings, public.club_checkout_sessions, public.club_email_log to authenticated;
create policy "Admins read entitlements" on public.club_entitlements for select to authenticated using ((select public.is_admin('owner')));
create policy "Admins read mailings" on public.club_fulfillment_orders for select to authenticated using ((select public.is_admin('owner')));
create policy "Admins read settings" on public.club_settings for select to authenticated using ((select public.is_admin('owner')));
create policy "Admins read checkouts" on public.club_checkout_sessions for select to authenticated using ((select public.is_admin('owner')));
create policy "Admins read emails" on public.club_email_log for select to authenticated using ((select public.is_admin('owner')));

-- ---------------------------------------------------------------- date helpers

-- The calendar month (New York time) a moment falls in.
create function public.club_month_of(p_at timestamptz) returns date
language sql stable set search_path = '' as $$
  select date_trunc('month', p_at at time zone 'America/New_York')::date;
$$;

-- When a month's mailing list closes: the kit's own cutoff, else the setting's day of the month before.
create function public.club_cutoff_at(p_month date) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select k.mailer_cutoff_at from public.club_kits k where k.month = p_month),
    ((p_month - interval '1 month' + ((select s.cutoff_day from public.club_settings s) - 1) * interval '1 day' + time '23:59:59')
       at time zone 'America/New_York'));
$$;

-- Year 1, 2, … of her membership for a month, counted from the household's first paid month.
create function public.club_membership_year(p_first date, p_month date) returns int
language sql immutable set search_path = '' as $$
  select greatest(1, ((extract(year from p_month)::int * 12 + extract(month from p_month)::int)
                    - (extract(year from p_first)::int * 12 + extract(month from p_first)::int)) / 12 + 1);
$$;

revoke execute on function public.club_month_of(timestamptz), public.club_cutoff_at(date), public.club_membership_year(date, date)
  from public, anon, authenticated;
grant execute on function public.club_month_of(timestamptz), public.club_cutoff_at(date), public.club_membership_year(date, date) to service_role;

-- ---------------------------------------------------------------- access rules

-- A kit is published once the owner schedules it (draft kits open for nobody, whatever she paid for).
create function public.club_kit_published(p_kit uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.club_kits k where k.id = p_kit and k.status in ('scheduled', 'retired'));
$$;

-- Digital right to a month: an active entitlement. Never derived from payment counts.
create function public.club_earned(p_user uuid, p_kit uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.club_entitlements e join public.club_kits k on k.id = p_kit
     where e.user_id = p_user and e.resource_month = k.month and e.kind = 'digital' and e.revoked_at is null);
$$;

-- 'edit' (entitled, membership live), 'read' (entitled, membership ended: keeps what she bought), or 'none'.
-- Preview and beta grants (no payment) open released kits, as in Phase 1.
create function public.club_can_open(p_user uuid, p_kit uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when not public.club_kit_published(p_kit) then 'none'
    when public.club_earned(p_user, p_kit) then case when public.club_has_access(p_user) then 'edit' else 'read' end
    when public.club_kit_released(p_kit) and exists (
      select 1 from public.club_access_grants g
       where g.user_id = p_user and g.revoked_at is null and (g.expires_at is null or g.expires_at > now())) then 'edit'
    else 'none' end;
$$;

revoke execute on function public.club_kit_published(uuid), public.club_earned(uuid, uuid), public.club_can_open(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.club_kit_published(uuid), public.club_earned(uuid, uuid), public.club_can_open(uuid, uuid) to service_role;

-- ---------------------------------------------------------------- fulfillment queue (derived readiness)

create view public.club_fulfillment_queue with (security_invoker = true) as
select o.id, o.user_id, o.household_id, o.resource_month, o.kit_id, k.slug as kit_slug, k.title as kit_title,
       o.status, o.late, o.cutoff_at, o.pdf_status, o.member_approved_at, o.printed_at, o.mailed_at, o.provider,
       o.provider_ref, o.note, o.created_at, o.updated_at,
       h.display_name, u.email,
       case
         when o.status not in ('pending', 'approved', 'on_hold') then o.status
         when h.onboarded_at is null then 'needs_profile'
         when a.user_id is null then 'needs_address'
         when a.paused then 'mail_paused'
         when k.id is null or k.status = 'draft' then 'needs_resource'
         when o.pdf_status <> 'ready' then 'needs_pdf'
         else 'ready' end as readiness,
       coalesce(o.address, l.address) as address,
       l.address as live_address
  from public.club_fulfillment_orders o
  join public.club_households h on h.id = o.household_id
  join auth.users u on u.id = o.user_id
  left join public.club_kits k on k.id = o.kit_id
  left join public.club_mailing_addresses a on a.user_id = o.user_id
  left join lateral (select case when a.user_id is not null then jsonb_build_object('name', a.name, 'line1', a.line1, 'line2', a.line2,
    'city', a.city, 'state', a.state, 'postal_code', a.postal_code, 'country', a.country) end as address) l on true;
revoke all on public.club_fulfillment_queue from public, anon, authenticated;
grant select on public.club_fulfillment_queue to service_role;

-- ---------------------------------------------------------------- service role: membership, billing, grants

create function public.club_user_by_email(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select u.id from auth.users u where lower(u.email) = lower(btrim(p_email)) order by u.email_confirmed_at nulls last limit 1;
$$;

-- Ties a Stripe customer to her account and household (created here if it doesn't exist yet, before onboarding).
-- Stable ids from then on: household.id ↔ owner user id ↔ Stripe customer id.
create function public.club_member_link(p_user uuid, p_email text, p_customer text, p_livemode boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  hid uuid;
  existing uuid;
begin
  if p_user is null or p_customer !~ '^cus_[A-Za-z0-9]+$' then raise exception 'invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('club-household:' || p_user::text, 0));
  insert into public.club_households (owner_user_id, billing_email) values (p_user, lower(btrim(p_email)))
  on conflict (owner_user_id) do update set billing_email = coalesce(club_households.billing_email, excluded.billing_email)
  returning id into hid;
  select user_id into existing from public.club_customers where stripe_customer_id = p_customer;
  if existing is not null and existing <> p_user then raise exception 'customer_user_mismatch'; end if;
  -- A second Stripe customer for the same account (another mode, or a race): keep the first one as hers.
  if exists (select 1 from public.club_customers where user_id = p_user and stripe_customer_id <> p_customer) then
    insert into public.club_customers (stripe_customer_id, user_id, email, livemode, household_id)
    values (p_customer, null, lower(btrim(p_email)), p_livemode, hid)
    on conflict (stripe_customer_id) do update set household_id = excluded.household_id;
  else
    insert into public.club_customers (stripe_customer_id, user_id, email, livemode, household_id)
    values (p_customer, p_user, lower(btrim(p_email)), p_livemode, hid)
    on conflict (stripe_customer_id) do update set user_id = excluded.user_id, household_id = excluded.household_id;
  end if;
  return jsonb_build_object('household_id', hid);
end $$;

-- A Stripe subscription, as just read from the API. Returns what changed (the webhook decides emails from it).
-- p: { id, customer, user_id, status, plan, price_id, current_period_start, current_period_end, cancel_at_period_end,
--      canceled_at, ended_at, started_at, livemode, pause_collection, event_at }
create function public.club_subscription_sync(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  old public.club_subscriptions%rowtype;
  hid uuid;
  sid uuid;
begin
  select household_id into hid from public.club_customers where stripe_customer_id = p ->> 'customer';
  select * into old from public.club_subscriptions where stripe_subscription_id = p ->> 'id' for update;
  begin
    insert into public.club_subscriptions as s (stripe_subscription_id, stripe_customer_id, user_id, household_id, status, plan, price_id,
      current_period_start, current_period_end, cancel_at_period_end, canceled_at, ended_at, started_at, livemode,
      pause_collection, last_event_at, synced_at)
    values (p ->> 'id', p ->> 'customer', (p ->> 'user_id')::uuid, hid, p ->> 'status', p ->> 'plan', p ->> 'price_id',
      (p ->> 'current_period_start')::timestamptz, (p ->> 'current_period_end')::timestamptz,
      coalesce((p ->> 'cancel_at_period_end')::boolean, false), (p ->> 'canceled_at')::timestamptz, (p ->> 'ended_at')::timestamptz,
      (p ->> 'started_at')::timestamptz, (p ->> 'livemode')::boolean, p ->> 'pause_collection', (p ->> 'event_at')::timestamptz, now())
    on conflict (stripe_subscription_id) do update set
      user_id = coalesce(s.user_id, excluded.user_id), household_id = coalesce(excluded.household_id, s.household_id),
      status = excluded.status, plan = coalesce(excluded.plan, s.plan), price_id = excluded.price_id,
      current_period_start = excluded.current_period_start, current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end, canceled_at = excluded.canceled_at, ended_at = excluded.ended_at,
      pause_collection = excluded.pause_collection,
      last_event_at = greatest(s.last_event_at, excluded.last_event_at), synced_at = now()
    returning id into sid;
  exception when unique_violation then
    -- She already has another live subscription (two checkouts finished). The webhook cancels and refunds this one.
    return jsonb_build_object('duplicate', true, 'existing', (
      select s.stripe_subscription_id from public.club_subscriptions s
       where s.user_id = (p ->> 'user_id')::uuid and s.stripe_subscription_id <> p ->> 'id'
         and s.status in ('trialing', 'active', 'past_due', 'unpaid', 'paused') limit 1));
  end;
  return jsonb_build_object('id', sid, 'duplicate', false,
    'previous_status', old.status, 'status', p ->> 'status',
    'previous_cancel_at_period_end', old.cancel_at_period_end,
    'cancel_at_period_end', coalesce((p ->> 'cancel_at_period_end')::boolean, false));
end $$;

-- A Stripe invoice, as just read from the API, plus the paid periods its lines cover (computed by the webhook
-- from the invoice lines: [{ "start": ts, "end": ts, "plan": "monthly"|"annual" }]). A paid, not refunded,
-- not disputed invoice grants: monthly → the month the period starts in; annual → twelve consecutive months from
-- it. Every grant is idempotent (one live row per member, month and kind).
-- p: { id, subscription, status, billing_reason, amount_due_cents, amount_paid_cents, period_start, period_end,
--      paid_at, livemode, payment_intent, charge, attempt_count, failure_message, plan }
create function public.club_invoice_apply(p jsonb, p_periods jsonb default '[]') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  sub public.club_subscriptions%rowtype;
  inv public.club_invoices%rowtype;
  hh public.club_households%rowtype;
  first_month date;
  per jsonb;
  m date;
  n int;
  i int;
  ent uuid;
  granted int := 0;
  months date[] := '{}';
  first_paid boolean := false;
  mail_from date := (select s.first_mailing_month from public.club_settings s);
begin
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
     or inv.disputed or sub.access_revoked_at is not null or sub.user_id is null then
    return jsonb_build_object('granted', 0, 'status', inv.status, 'first_paid', false, 'months', '[]'::jsonb);
  end if;

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
    for i in 0 .. n - 1 loop
      m := (public.club_month_of((per ->> 'start')::timestamptz) + make_interval(months => i))::date;
      insert into public.club_entitlements (user_id, household_id, resource_month, kit_id, kind, membership_year, plan, source,
        invoice_id, subscription_id, period_start, period_end)
      values (sub.user_id, hh.id, m, (select k.id from public.club_kits k where k.month = m), 'digital',
        public.club_membership_year(hh.first_paid_month, m), per ->> 'plan', 'invoice', inv.stripe_invoice_id, sub.id,
        (per ->> 'start')::timestamptz, (per ->> 'end')::timestamptz)
      on conflict (user_id, resource_month, kind) where revoked_at is null do nothing;
      if found then granted := granted + 1; months := months || m; end if;
      if m >= mail_from then
        insert into public.club_entitlements (user_id, household_id, resource_month, kit_id, kind, membership_year, plan, source,
          invoice_id, subscription_id, period_start, period_end)
        values (sub.user_id, hh.id, m, (select k.id from public.club_kits k where k.month = m), 'physical',
          public.club_membership_year(hh.first_paid_month, m), per ->> 'plan', 'invoice', inv.stripe_invoice_id, sub.id,
          (per ->> 'start')::timestamptz, (per ->> 'end')::timestamptz)
        on conflict (user_id, resource_month, kind) where revoked_at is null do nothing
        returning id into ent;
        if found then
          insert into public.club_fulfillment_orders (entitlement_id, user_id, household_id, resource_month, kit_id, late, cutoff_at, provider)
          values (ent, sub.user_id, hh.id, m, (select k.id from public.club_kits k where k.month = m),
            coalesce(inv.paid_at, now()) > public.club_cutoff_at(m), public.club_cutoff_at(m), 'manual')
          on conflict do nothing;
        end if;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('granted', granted, 'status', inv.status, 'first_paid', first_paid and granted > 0,
    'months', to_jsonb(months), 'user_id', sub.user_id, 'household_id', hh.id);
end $$;

-- Refund totals from Stripe. A full refund revokes exactly what the invoice granted and cancels its unmailed
-- mailings; a partial (goodwill) refund changes no access. Idempotent.
create function public.club_invoice_refund(p_invoice text, p_refunded_cents int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  inv public.club_invoices%rowtype;
  revoked int := 0;
  canceled int := 0;
begin
  update public.club_invoices set amount_refunded_cents = greatest(amount_refunded_cents, p_refunded_cents), updated_at = now()
   where stripe_invoice_id = p_invoice returning * into inv;
  if not found then return jsonb_build_object('found', false); end if;
  if inv.amount_paid_cents > 0 and inv.amount_refunded_cents >= inv.amount_paid_cents then
    select r.revoked, r.canceled into revoked, canceled from public.club_revoke_invoice(p_invoice, 'refunded') r;
  end if;
  return jsonb_build_object('found', true, 'full', inv.amount_paid_cents > 0 and inv.amount_refunded_cents >= inv.amount_paid_cents,
    'revoked', revoked, 'canceled_mailings', canceled, 'user_id', inv.user_id);
end $$;

-- A dispute (chargeback): the invoice grants nothing from now on and its subscription loses access.
create function public.club_invoice_dispute(p_invoice text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  inv public.club_invoices%rowtype;
  revoked int;
  canceled int;
begin
  update public.club_invoices set disputed = true, updated_at = now() where stripe_invoice_id = p_invoice returning * into inv;
  if not found then return jsonb_build_object('found', false); end if;
  update public.club_subscriptions set access_revoked_at = coalesce(access_revoked_at, now()),
         access_revoked_reason = coalesce(access_revoked_reason, 'disputed'), flags = array(select distinct unnest(flags || '{disputed}'))
   where id = inv.subscription_id;
  select r.revoked, r.canceled into revoked, canceled from public.club_revoke_invoice(p_invoice, 'disputed') r;
  return jsonb_build_object('found', true, 'revoked', revoked, 'canceled_mailings', canceled, 'user_id', inv.user_id);
end $$;

create function public.club_revoke_invoice(p_invoice text, p_reason text, out revoked int, out canceled int)
language plpgsql security definer set search_path = '' as $$
begin
  with r as (
    update public.club_entitlements set revoked_at = now(), revoked_reason = p_reason
     where invoice_id = p_invoice and revoked_at is null returning id)
  select count(*) into revoked from r;
  with c as (
    update public.club_fulfillment_orders o set status = 'canceled', note = left(coalesce(o.note || ' · ', '') || 'canceled: ' || p_reason, 300), updated_at = now()
      from public.club_entitlements e
     where e.id = o.entitlement_id and e.invoice_id = p_invoice and o.status in ('pending', 'approved', 'on_hold') returning o.id)
  select count(*) into canceled from c;
end $$;

-- Every Stripe event this endpoint processed, once.
create function public.club_stripe_event_begin(p_id text, p_type text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  done_at timestamptz;
begin
  insert into public.club_stripe_events (id, type) values (p_id, p_type) on conflict (id) do nothing;
  if found then return 'new'; end if;
  update public.club_stripe_events set attempts = attempts + 1 where id = p_id returning processed_at into done_at;
  return case when done_at is null then 'retry' else 'done' end;
end $$;

create function public.club_stripe_event_done(p_id text) returns void
language sql security definer set search_path = '' as $$
  update public.club_stripe_events set processed_at = coalesce(processed_at, now()) where id = p_id;
$$;

-- Emails: 'new' → send it; 'done' → already sent (or skipped); a failed one may be retried.
create function public.club_email_begin(p_key text, p_kind text, p_user uuid, p_to text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  st text;
begin
  insert into public.club_email_log (dedupe_key, kind, user_id, to_email) values (p_key, p_kind, p_user, lower(p_to))
  on conflict (dedupe_key) do nothing;
  if found then return 'new'; end if;
  update public.club_email_log set status = 'sending', updated_at = now()
   where dedupe_key = p_key and (status = 'failed' or (status = 'sending' and updated_at < now() - interval '10 minutes'))
  returning status into st;
  return case when st is null then 'done' else 'new' end;
end $$;

create function public.club_email_finish(p_key text, p_status text, p_resend_id text default null, p_error text default null) returns void
language sql security definer set search_path = '' as $$
  update public.club_email_log set status = p_status, resend_id = p_resend_id, error = left(p_error, 300), updated_at = now()
   where dedupe_key = p_key;
$$;

-- Checkout: what club-billing needs to decide whether she may start one.
create function public.club_checkout_state(p_user uuid, p_email text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'live_subscription', exists (select 1 from public.club_subscriptions s
       where s.user_id = coalesce(p_user, public.club_user_by_email(p_email))
         and s.status in ('trialing', 'active', 'past_due', 'unpaid', 'paused')),
    'customer', coalesce(
      (select c.stripe_customer_id from public.club_customers c where c.user_id = coalesce(p_user, public.club_user_by_email(p_email)) limit 1),
      (select c.stripe_customer_id from public.club_customers c where lower(c.email) = lower(btrim(p_email)) order by c.created_at limit 1)),
    'settings', (select jsonb_build_object('checkout_mode', s.checkout_mode, 'portal_configuration_id', s.portal_configuration_id) from public.club_settings s));
$$;

create function public.club_checkout_open_session(p_customer text, p_plan text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(c) from public.club_checkout_sessions c
   where c.stripe_customer_id = p_customer and c.plan = p_plan and c.status = 'open' and c.expires_at > now() + interval '5 minutes'
   order by c.created_at desc limit 1;
$$;

create function public.club_checkout_record(p jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.club_checkout_sessions (stripe_session_id, stripe_customer_id, user_id, email, plan, url, livemode, expires_at)
  values (p ->> 'id', p ->> 'customer', (p ->> 'user_id')::uuid, lower(p ->> 'email'), p ->> 'plan', p ->> 'url',
          (p ->> 'livemode')::boolean, (p ->> 'expires_at')::timestamptz)
  on conflict (stripe_session_id) do nothing;
$$;

create function public.club_checkout_ended(p_session text, p_status text) returns void
language sql security definer set search_path = '' as $$
  update public.club_checkout_sessions set status = p_status where stripe_session_id = p_session and status = 'open';
$$;

-- Admins changed on the server (club-admin): the member's email, after she confirmed a new one in Supabase Auth.
create function public.club_customer_email(p_user uuid, p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  cus text;
begin
  update public.club_customers set email = lower(btrim(p_email)) where user_id = p_user returning stripe_customer_id into cus;
  update public.club_households set billing_email = lower(btrim(p_email)), updated_at = now() where owner_user_id = p_user;
  return cus;
end $$;

-- Recipients for an email batch (club-admin). kind: profile_reminder | resource_ready | review.
create function public.club_email_audience(p_kind text, p_month date default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x), '[]') from (
    -- Paid, not onboarded, joined more than a day ago.
    select h.owner_user_id as user_id, u.email, null::text as kit_slug, null::uuid as order_id
      from public.club_households h join auth.users u on u.id = h.owner_user_id
     where p_kind = 'profile_reminder' and h.onboarded_at is null and h.enrolled_at < now() - interval '1 day'
       and public.club_has_access(h.owner_user_id)
    union all
    -- Everyone with an active digital entitlement for that month, once its kit is published.
    select e.user_id, u.email, k.slug, null
      from public.club_entitlements e join auth.users u on u.id = e.user_id join public.club_kits k on k.month = e.resource_month
     where p_kind = 'resource_ready' and e.resource_month = p_month and e.kind = 'digital' and e.revoked_at is null
       and k.status in ('scheduled', 'retired')
    union all
    -- Pending mailings for that month whose household is ready to review.
    select q.user_id, q.email, q.kit_slug, q.id
      from public.club_fulfillment_queue q
     where p_kind = 'review' and q.resource_month = p_month and q.status = 'pending' and q.member_approved_at is null
       and q.readiness in ('ready', 'needs_pdf')
  ) x;
$$;

-- Admin entitlement override, audited. Grants or revokes one month for one member. A physical grant creates its
-- mailing; a revoke cancels an unmailed one.
create function public.club_admin_entitlement_service(p_actor uuid, p_user uuid, p_month date, p_kind text, p_action text, p_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  hh public.club_households%rowtype;
  ent uuid;
  n int := 0;
begin
  if p_kind not in ('digital', 'physical') or p_action not in ('grant', 'revoke') or extract(day from p_month) <> 1
     or btrim(coalesce(p_note, '')) = '' then raise exception 'invalid'; end if;
  select * into hh from public.club_households where owner_user_id = p_user;
  if not found then raise exception 'no_household'; end if;
  if p_action = 'grant' then
    insert into public.club_entitlements (user_id, household_id, resource_month, kit_id, kind, membership_year, plan, source, granted_by, note)
    values (p_user, hh.id, p_month, (select k.id from public.club_kits k where k.month = p_month), p_kind,
      public.club_membership_year(coalesce(hh.first_paid_month, p_month), p_month), 'admin', 'admin', p_actor, left(p_note, 300))
    on conflict (user_id, resource_month, kind) where revoked_at is null do nothing
    returning id into ent;
    if found then
      n := 1;
      if p_kind = 'physical' then
        insert into public.club_fulfillment_orders (entitlement_id, user_id, household_id, resource_month, kit_id, late, cutoff_at, provider)
        values (ent, p_user, hh.id, p_month, (select k.id from public.club_kits k where k.month = p_month),
                now() > public.club_cutoff_at(p_month), public.club_cutoff_at(p_month), 'manual')
        on conflict do nothing;
      end if;
    end if;
  else
    with r as (update public.club_entitlements set revoked_at = now(), revoked_reason = 'admin', note = left(p_note, 300)
                where user_id = p_user and resource_month = p_month and kind = p_kind and revoked_at is null returning id)
    select count(*) into n from r;
    update public.club_fulfillment_orders o set status = 'canceled', note = left('canceled by admin: ' || p_note, 300), updated_at = now()
      from public.club_entitlements e
     where e.id = o.entitlement_id and e.user_id = p_user and e.resource_month = p_month and e.kind = 'physical'
       and e.revoked_reason = 'admin' and o.status in ('pending', 'approved', 'on_hold');
  end if;
  perform public.admin_log_service(p_actor, 'club.entitlement_' || p_action, 'user:' || p_user::text,
    jsonb_build_object('month', p_month, 'kind', p_kind, 'changed', n));
  return jsonb_build_object('changed', n);
end $$;

revoke execute on function public.club_user_by_email(text), public.club_member_link(uuid, text, text, boolean),
  public.club_subscription_sync(jsonb), public.club_invoice_apply(jsonb, jsonb), public.club_invoice_refund(text, int),
  public.club_invoice_dispute(text), public.club_revoke_invoice(text, text), public.club_stripe_event_begin(text, text),
  public.club_stripe_event_done(text), public.club_email_begin(text, text, uuid, text), public.club_email_finish(text, text, text, text),
  public.club_checkout_state(uuid, text), public.club_checkout_open_session(text, text), public.club_checkout_record(jsonb),
  public.club_checkout_ended(text, text), public.club_customer_email(uuid, text), public.club_email_audience(text, date),
  public.club_admin_entitlement_service(uuid, uuid, date, text, text, text)
  from public, anon, authenticated;
grant execute on function public.club_user_by_email(text), public.club_member_link(uuid, text, text, boolean),
  public.club_subscription_sync(jsonb), public.club_invoice_apply(jsonb, jsonb), public.club_invoice_refund(text, int),
  public.club_invoice_dispute(text), public.club_revoke_invoice(text, text), public.club_stripe_event_begin(text, text),
  public.club_stripe_event_done(text), public.club_email_begin(text, text, uuid, text), public.club_email_finish(text, text, text, text),
  public.club_checkout_state(uuid, text), public.club_checkout_open_session(text, text), public.club_checkout_record(jsonb),
  public.club_checkout_ended(text, text), public.club_customer_email(uuid, text), public.club_email_audience(text, date),
  public.club_admin_entitlement_service(uuid, uuid, date, text, text, text)
  to service_role;

-- ---------------------------------------------------------------- what the member's browser may call

-- Everything the dashboard needs in one call. No Stripe ids, no card details, no other household.
create function public.club_me() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  s public.club_subscriptions%rowtype;
  h public.club_households%rowtype;
  cur date := public.club_month_of(now());
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into s from public.club_subscriptions where user_id = uid order by (status in ('trialing', 'active', 'past_due', 'unpaid', 'paused')) desc, created_at desc limit 1;
  select * into h from public.club_households where owner_user_id = uid;
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
    -- Every catalog month and every month she holds, with its state for the dashboard.
    'months', coalesce((
      select jsonb_agg(r order by (r ->> 'month')) from (
        select jsonb_build_object(
          'month', m.month,
          'slug', k.slug, 'title', k.title,
          'published', coalesce(k.status in ('scheduled', 'retired'), false),
          'can', case when k.id is null then 'none' else public.club_can_open(uid, k.id) end,
          'state', case
            when d.id is not null and coalesce(k.status in ('scheduled', 'retired'), false) then 'available'
            when d.id is not null then 'preparing'
            when h.first_paid_month is null or m.month < h.first_paid_month then 'before_enrollment'
            else 'locked' end,
          'membership_year', d.membership_year,
          'plan', d.plan,
          'mailing', (select jsonb_build_object('status', q.status, 'readiness', q.readiness, 'late', q.late,
                                                'approved', q.member_approved_at is not null, 'mailed_at', q.mailed_at)
                        from public.club_fulfillment_queue q where q.user_id = uid and q.resource_month = m.month and q.status <> 'canceled' limit 1)
        ) as r
        from (select k2.month from public.club_kits k2
              union select e.resource_month from public.club_entitlements e where e.user_id = uid and e.revoked_at is null) m
        left join public.club_kits k on k.month = m.month
        left join public.club_entitlements d on d.user_id = uid and d.resource_month = m.month and d.kind = 'digital' and d.revoked_at is null
      ) t), '[]'));
end $$;
revoke execute on function public.club_me() from public, anon;
grant execute on function public.club_me() to authenticated;

-- Her mailing address (the welcome form and the dashboard). US only, as the shop.
create function public.club_address_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'invalid'; end if;
  insert into public.club_mailing_addresses as a (user_id, name, line1, line2, city, state, postal_code, paused, updated_at)
  values (uid, btrim(p ->> 'name'), btrim(p ->> 'line1'), nullif(btrim(coalesce(p ->> 'line2', '')), ''), btrim(p ->> 'city'),
          upper(btrim(p ->> 'state')), btrim(p ->> 'postal_code'), coalesce((p ->> 'paused')::boolean, false), now())
  on conflict (user_id) do update set name = excluded.name, line1 = excluded.line1, line2 = excluded.line2, city = excluded.city,
    state = excluded.state, postal_code = excluded.postal_code, paused = excluded.paused, updated_at = now();
  return (select to_jsonb(a) - 'user_id' from public.club_mailing_addresses a where a.user_id = uid);
exception
  when check_violation or not_null_violation or invalid_text_representation then raise exception 'invalid';
end $$;
revoke execute on function public.club_address_save(jsonb) from public, anon;
grant execute on function public.club_address_save(jsonb) to authenticated;

-- Her saved version of a month's printable ('none' → not_found, the same as a kit she can't open).
create function public.club_resource_get(p_kit text) returns jsonb
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
                  from public.club_fulfillment_queue q where q.user_id = uid and q.resource_month = k.month and q.status <> 'canceled' limit 1));
end $$;
revoke execute on function public.club_resource_get(text) from public, anon;
grant execute on function public.club_resource_get(text) to authenticated;

-- Save her version (edit access only; a stale tab gets 'conflict'). Changing it after approval clears the approval,
-- unless the mailing is already printed.
create function public.club_resource_save(p_kit text, p_state jsonb, p_revision int) returns int
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
  if exists (select 1 from public.club_fulfillment_orders o where o.household_id = h.id and o.resource_month = k.month and o.status in ('printed', 'mailed')) then
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
   where household_id = h.id and resource_month = k.month and status in ('pending', 'on_hold');
  return rev;
exception
  when check_violation or not_null_violation then raise exception 'invalid';
end $$;
revoke execute on function public.club_resource_save(text, jsonb, int) from public, anon;
grant execute on function public.club_resource_save(text, jsonb, int) to authenticated;

-- "This looks right, print it." Only her own pending mailing for that month.
create function public.club_fulfillment_approve(p_kit text) returns boolean
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
   where user_id = uid and resource_month = k.month and status = 'pending';
  return found;
end $$;
revoke execute on function public.club_fulfillment_approve(text) from public, anon;
grant execute on function public.club_fulfillment_approve(text) to authenticated;

-- ---------------------------------------------------------------- owner admin (browser, is_admin('owner'), audited)

create function public.club_admin_members(p_status text default null, p_month date default null) returns jsonb
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

create function public.club_admin_fulfillment(p_month date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(q) order by q.late, q.created_at)
                     from public.club_fulfillment_queue q where q.resource_month = p_month), '[]');
end $$;

-- Manual fulfillment changes. Allowed moves only; the address is frozen when it's approved or printed.
create function public.club_admin_set_fulfillment(p_order uuid, p_status text, p_note text default null, p_pdf text default null) returns jsonb
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

-- Everything needed to print one household's mailing (names included), for that one order. Audited: support never
-- browses children's names; fulfillment opens them one mailing at a time.
create function public.club_admin_fulfillment_bundle(p_order uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.club_fulfillment_orders%rowtype;
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into o from public.club_fulfillment_orders where id = p_order;
  if not found then raise exception 'not_found'; end if;
  perform public.admin_log('club.fulfillment_open', 'club_order:' || p_order::text, jsonb_build_object('month', o.resource_month));
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

-- Owner override of one member's month (grant or revoke), with a required note. Audited.
create function public.club_admin_entitlement(p_user uuid, p_month date, p_kind text, p_action text, p_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.club_admin_entitlement_service(auth.uid(), p_user, p_month, p_kind, p_action, p_note);
end $$;

-- Publish a kit (draft → scheduled) or take it back. Audited.
create function public.club_admin_kit_status(p_slug text, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('draft', 'scheduled', 'retired') then raise exception 'invalid'; end if;
  update public.club_kits set status = p_status where slug = p_slug;
  if not found then raise exception 'not_found'; end if;
  perform public.admin_log('club.kit_status', 'club_kit:' || p_slug, jsonb_build_object('status', p_status));
end $$;

create function public.club_admin_settings(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (select 1 from jsonb_object_keys(p) k where k not in ('checkout_mode', 'first_mailing_month', 'cutoff_day', 'member_review')) then
    raise exception 'invalid';
  end if;
  update public.club_settings set
    checkout_mode = coalesce(p ->> 'checkout_mode', checkout_mode),
    first_mailing_month = coalesce((p ->> 'first_mailing_month')::date, first_mailing_month),
    cutoff_day = coalesce((p ->> 'cutoff_day')::int, cutoff_day),
    member_review = coalesce((p ->> 'member_review')::boolean, member_review),
    updated_at = now();
  perform public.admin_log('club.settings', 'club_settings', p);
  return (select to_jsonb(s) - 'id' from public.club_settings s);
exception
  when check_violation or invalid_text_representation or invalid_datetime_format then raise exception 'invalid';
end $$;

revoke execute on function public.club_admin_members(text, date), public.club_admin_fulfillment(date),
  public.club_admin_set_fulfillment(uuid, text, text, text), public.club_admin_fulfillment_bundle(uuid),
  public.club_admin_entitlement(uuid, date, text, text, text), public.club_admin_kit_status(text, text),
  public.club_admin_settings(jsonb) from public, anon;
grant execute on function public.club_admin_members(text, date), public.club_admin_fulfillment(date),
  public.club_admin_set_fulfillment(uuid, text, text, text), public.club_admin_fulfillment_bundle(uuid),
  public.club_admin_entitlement(uuid, date, text, text, text), public.club_admin_kit_status(text, text),
  public.club_admin_settings(jsonb) to authenticated;

-- ---------------------------------------------------------------- the December 2026 kit (missing from the seeds)

insert into public.club_kits (slug, month, title, status, release_at, mailer_cutoff_at)
values ('2026-12-christmas-mission', '2026-12-01', 'Your Christmas Mission', 'draft', '2026-12-01 05:00:00+00', '2026-11-15 05:00:00+00')
on conflict do nothing;

commit;
