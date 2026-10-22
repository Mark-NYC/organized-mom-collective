-- Organized Family Club, Phase 1: households, family members, kits, member documents, preview/beta access grants,
-- and the billing and mailing tables Phase 2 will write. Runs after the accounts migration (it reuses that sign-in
-- and changes two account functions). Plan: docs/club/IMPLEMENTATION_PLAN.md. Access tests: supabase/tests/club-access.sql
-- (npm run test:admin-sql).
--
-- NOT APPLIED to the live project. Apply only to a Supabase branch or a local stack until the owner approves; the
-- site's Club pages stay behind PUBLIC_CLUB_ENABLED (off) either way.
--
-- Rules:
--   * Every table has RLS on and every grant revoked from anon/authenticated first.
--   * Customers read only their own rows; every customer write goes through a security definer function that
--     checks auth.uid(), size limits and access. Billing, entitlement, grant and mailing state is written only by
--     the service role (Edge Functions) or an admin, never by a browser.
--   * Children have no accounts. A family member is a first name (or nickname), a birth year/month and a role.
--     No last names, photos, schools, gender or full birth dates. Admins can't read family members.
--   * Stripe is the billing authority (Phase 2). club_subscriptions mirrors Stripe and is rewritten from a fresh
--     API read on every webhook, so duplicate or out-of-order events can't leave it wrong.
--   * Digital access and mailing eligibility are separate functions with separate rules.
--   * Until billing exists, access comes only from club_access_grants (preview and private beta), added by an admin.

begin;

-- ---------------------------------------------------------------- household and family

create table public.club_households (
  id uuid primary key default gen_random_uuid(),
  -- One household per account. Deleting the account deletes the household, its family and its documents.
  owner_user_id uuid not null unique references auth.users (id) on delete cascade,
  -- Optional, shown on printables: "The Rivera Family", "Team Rivera". Never required.
  display_name text check (char_length(display_name) <= 60),
  -- Optional household preferences, a closed set of keys (club_household_save checks them):
  -- { "palette": "warm-neutrals", "week_starts": "sunday"|"monday", "faith_content": true|false,
  --   "pets": true|false, "school": "public"|"homeschool"|"mixed", "weekday_dinner": "17:30",
  --   "priorities": ["mornings", …] (ids from src/data/club/onboarding.ts) }
  preferences jsonb not null default '{}' check (jsonb_typeof(preferences) = 'object' and octet_length(preferences::text) <= 2000),
  -- Bumped on every family or preference change. Documents remember the version they were generated from.
  profile_version int not null default 1,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.club_family_members (
  -- Stable id: assignments in saved documents point at it, so renaming a child never breaks a chart.
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.club_households (id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 30),
  kind text not null check (kind in ('adult', 'child')),
  -- How the printables name them. Adults: parent, partner, grandparent, caregiver, other. Children: child.
  role text not null check (role in ('parent', 'partner', 'grandparent', 'caregiver', 'child', 'other')),
  -- Children only. Year and month, never a day: enough for age bands that move up on their own.
  birth_year smallint check (birth_year between 1990 and 2100),
  birth_month smallint check (birth_month between 1 and 12),
  -- The adult who holds the account (usually the buyer). The generators never give this person more than an
  -- even share, so the chart doesn't quietly hand the house back to her.
  is_account_holder boolean not null default false,
  sort int not null default 0,
  -- Removing someone archives them: documents that assigned them work keep the id and show "needs an owner".
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind = 'adult' or birth_year is not null)
);
create index club_family_members_household on public.club_family_members (household_id);

-- ---------------------------------------------------------------- billing (Stripe mirror)

-- One Stripe Customer per account, reused on every resubscribe so she never ends up with two.
create table public.club_customers (
  stripe_customer_id text primary key check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  -- Null after account deletion; the Stripe customer and its invoices stay as billing records.
  user_id uuid unique references auth.users (id) on delete set null,
  email text not null,
  livemode boolean not null,
  created_at timestamptz not null default now()
);

-- One row per Stripe subscription (a resubscribe after cancelling is a new row). Written only by club-webhook
-- and club-checkout, always from a fresh GET /v1/subscriptions/{id}.
create table public.club_subscriptions (
  id uuid primary key default gen_random_uuid(),
  stripe_subscription_id text not null unique check (stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  stripe_customer_id text not null,
  -- Null after account deletion; the row stays as a billing record.
  user_id uuid references auth.users (id) on delete set null,
  status text not null check (status in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  price_id text not null,
  -- From the subscription item (Stripe API 2025-03-31.basil moved the period fields there).
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  ended_at timestamptz,
  started_at timestamptz not null,
  livemode boolean not null,
  -- Set by a full refund or a dispute: ends digital access at once whatever Stripe's status says.
  access_revoked_at timestamptz,
  access_revoked_reason text check (access_revoked_reason in ('refunded', 'disputed', 'admin')),
  -- Stripe's event.created of the newest event applied; only for the admin's "last synced" line.
  last_event_at timestamptz,
  synced_at timestamptz not null default now(),
  flags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index club_subscriptions_user on public.club_subscriptions (user_id);
-- Never two live subscriptions for one account (club-checkout also refuses; this is the backstop).
create unique index club_subscriptions_one_live on public.club_subscriptions (user_id)
  where status in ('trialing', 'active', 'past_due', 'incomplete', 'unpaid', 'paused') and user_id is not null;

-- Paid, failed and refunded invoices: the facts mailing eligibility and refunds are decided from.
create table public.club_invoices (
  stripe_invoice_id text primary key check (stripe_invoice_id ~ '^in_[A-Za-z0-9]+$'),
  subscription_id uuid not null references public.club_subscriptions (id) on delete cascade,
  status text not null check (status in ('draft', 'open', 'paid', 'uncollectible', 'void')),
  billing_reason text,
  amount_due_cents int not null,
  amount_paid_cents int not null default 0,
  amount_refunded_cents int not null default 0,
  period_start timestamptz not null,
  period_end timestamptz not null,
  paid_at timestamptz,
  livemode boolean not null,
  updated_at timestamptz not null default now()
);
create index club_invoices_subscription on public.club_invoices (subscription_id);

-- Event ids this endpoint has processed. Separate from shop_stripe_events on purpose: both endpoints can
-- receive the same event (checkout.session.completed, charge.refunded), and a shared table would make the
-- second endpoint skip it.
create table public.club_stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts int not null default 1
);

-- ---------------------------------------------------------------- kits and entitlements

-- One row per monthly kit. Content lives in the repo (src/data/club/kits/<slug>.ts, reviewed in pull requests);
-- the database holds only what decides access and the mailing.
create table public.club_kits (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[0-9]{4}-[0-9]{2}-[a-z0-9]+(-[a-z0-9]+)*$'),
  -- First day of the kit's month.
  month date not null unique check (extract(day from month) = 1),
  title text not null check (char_length(title) between 1 and 120),
  -- draft → scheduled (owner, in /admin/club) → it opens by itself at release_at; no cron job.
  -- retired: hidden from new members, still readable by anyone who earned it.
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'retired')),
  release_at timestamptz not null,
  -- Who gets this month's mailer is decided at this moment (club_mailing_snapshot).
  mailer_cutoff_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Kits granted outside the invoice rule (club_earned): the kit that was current when she joined (her first
-- invoice starts after its release), or an admin's goodwill grant. Kept after cancelling.
create table public.club_kit_entitlements (
  user_id uuid not null references auth.users (id) on delete cascade,
  kit_id uuid not null references public.club_kits (id) on delete cascade,
  subscription_id uuid references public.club_subscriptions (id) on delete set null,
  source text not null check (source in ('join', 'admin')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text check (revoked_reason in ('refunded', 'disputed', 'admin')),
  primary key (user_id, kit_id)
);

-- Membership access without a subscription: development previews and the private beta (docs/club → D2).
-- Added and ended by an admin (SQL Editor, or /admin/club later); never by the customer.
create table public.club_access_grants (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text not null check (reason in ('preview', 'beta')),
  note text check (char_length(note) <= 200),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

-- ---------------------------------------------------------------- member-generated content

-- One row per printable in a kit (the ownership chart, the conversation card, …). The generator's output is
-- never stored as the truth: the page regenerates it from the profile and the kit's rules, then applies
-- `edits` on top. Edits are keyed by stable item ids, so a profile change can't overwrite them.
create table public.club_documents (
  household_id uuid not null references public.club_households (id) on delete cascade,
  kit_id uuid not null references public.club_kits (id) on delete cascade,
  -- The printable within the kit, e.g. 'ownership-chart'.
  doc text not null check (doc ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(doc) <= 60),
  -- Generator rules version the edits were made against (kit config `engineVersion`).
  engine_version int not null,
  -- household.profile_version when she last accepted suggestions. Older than the current one → the page
  -- offers "New suggestions for your family" instead of changing anything by itself.
  profile_version int not null,
  -- { assign: {itemId: memberId}, frequency: {itemId: 'daily'|'weekly'|…}, text: {itemId: '…'},
  --   hidden: [itemId], added: [{id, title, …}], order: [itemId], dismissed: [itemId] }
  edits jsonb not null default '{}' check (jsonb_typeof(edits) = 'object' and octet_length(edits::text) <= 32768),
  palette text not null default 'warm-neutrals' check (palette in ('rose-lavender', 'blue-green', 'warm-neutrals')),
  -- Optimistic concurrency: a save from a stale tab (a second device) is refused, not silently merged.
  revision int not null default 1,
  updated_at timestamptz not null default now(),
  primary key (household_id, kit_id, doc)
);

-- ---------------------------------------------------------------- mailing

-- Where the mailer goes. Collected by Stripe Checkout (shipping address), editable in /club/settings.
create table public.club_mailing_addresses (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  line1 text not null check (char_length(line1) between 1 and 120),
  line2 text check (char_length(line2) <= 120),
  city text not null check (char_length(city) between 1 and 80),
  state text not null check (state ~ '^[A-Z]{2}$'),
  postal_code text not null check (postal_code ~ '^[0-9]{5}(-[0-9]{4})?$'),
  country text not null default 'US' check (country = 'US'),
  -- She can skip the printed mailer (digital access unchanged).
  paused boolean not null default false,
  updated_at timestamptz not null default now()
);

-- One batch per kit month, snapshotted at the cutoff. Recipients are a frozen list with a frozen address:
-- a later address change or cancellation doesn't rewrite who was in a batch already exported to the printer.
create table public.club_mailings (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null unique references public.club_kits (id),
  status text not null default 'open' check (status in ('open', 'snapshotted', 'exported', 'mailed')),
  snapshotted_at timestamptz,
  exported_at timestamptz,
  mailed_at timestamptz,
  recipient_count int
);

create table public.club_mailing_recipients (
  mailing_id uuid not null references public.club_mailings (id) on delete cascade,
  subscription_id uuid not null references public.club_subscriptions (id),
  -- The paid invoice whose period covered the cutoff: the reason she's on the list.
  invoice_id text not null references public.club_invoices (stripe_invoice_id),
  address jsonb not null,
  status text not null default 'queued' check (status in ('queued', 'exported', 'mailed', 'returned', 'removed')),
  note text check (char_length(note) <= 300),
  primary key (mailing_id, subscription_id)
);

-- ---------------------------------------------------------------- access rules

-- A live subscription: Stripe says trialing, active or past_due (still retrying the card), not revoked by a
-- refund or dispute. A cancel-at-period-end subscription stays active until Stripe ends it, so access runs to
-- the end of the paid period on its own.
create function public.club_has_paid_access(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.club_subscriptions s
     where s.user_id = p_user
       and s.status in ('trialing', 'active', 'past_due')
       and s.access_revoked_at is null);
$$;
revoke execute on function public.club_has_paid_access(uuid) from public, anon, authenticated;
grant execute on function public.club_has_paid_access(uuid) to service_role;

-- Digital access right now: a live subscription, or an unexpired preview/beta grant.
create function public.club_has_access(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.club_has_paid_access(p_user)
      or exists (
        select 1 from public.club_access_grants g
         where g.user_id = p_user and g.revoked_at is null and (g.expires_at is null or g.expires_at > now()));
$$;
revoke execute on function public.club_has_access(uuid) from public, anon, authenticated;
grant execute on function public.club_has_access(uuid) to service_role;

-- Released: scheduled and its release time has passed.
create function public.club_kit_released(p_kit uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.club_kits k where k.id = p_kit and k.status in ('scheduled', 'retired') and k.release_at <= now());
$$;
revoke execute on function public.club_kit_released(uuid) from public, anon, authenticated;
grant execute on function public.club_kit_released(uuid) to service_role;

-- Earned: she paid for the month the kit came out in (a paid, not fully refunded invoice whose period covers
-- its release), or it was granted on joining or by an admin. Derived from invoices, so there's no grant job
-- to miss and a refund un-earns it by itself.
create function public.club_earned(p_user uuid, p_kit uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
      select 1 from public.club_invoices i
        join public.club_subscriptions s on s.id = i.subscription_id
        join public.club_kits k on k.id = p_kit
       where s.user_id = p_user and s.access_revoked_at is null
         and i.status = 'paid' and i.amount_refunded_cents < i.amount_paid_cents
         and i.period_start <= k.release_at and i.period_end > k.release_at)
    or exists (
      select 1 from public.club_kit_entitlements e
       where e.user_id = p_user and e.kit_id = p_kit and e.revoked_at is null);
$$;
revoke execute on function public.club_earned(uuid, uuid) from public, anon, authenticated;
grant execute on function public.club_earned(uuid, uuid) to service_role;

-- May she open this kit? With access: every released kit (the library grows with her membership). After
-- cancelling, or with access revoked: the kits she earned, read-only (club_document_save refuses).
create function public.club_can_open(p_user uuid, p_kit uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when not public.club_kit_released(p_kit) then 'none'
    when public.club_has_access(p_user) and exists (select 1 from public.club_kits k where k.id = p_kit and k.status <> 'retired') then 'edit'
    when public.club_earned(p_user, p_kit) then 'read'
    else 'none' end;
$$;
revoke execute on function public.club_can_open(uuid, uuid) from public, anon, authenticated;
grant execute on function public.club_can_open(uuid, uuid) to service_role;

-- Mailing eligibility for a kit, decided independently of digital access: a PAID invoice whose period covers
-- the cutoff (past_due doesn't count, a fully refunded invoice doesn't count), an address on file, not paused.
create function public.club_mailing_eligible(p_subscription uuid, p_kit uuid) returns text
language sql stable security definer set search_path = '' as $$
  select i.stripe_invoice_id
    from public.club_invoices i
    join public.club_subscriptions s on s.id = i.subscription_id
    join public.club_kits k on k.id = p_kit
    join public.club_mailing_addresses a on a.user_id = s.user_id and not a.paused
   where i.subscription_id = p_subscription
     and i.status = 'paid'
     and i.amount_refunded_cents < i.amount_paid_cents
     and i.period_start <= k.mailer_cutoff_at and i.period_end > k.mailer_cutoff_at
     and s.access_revoked_at is null
   order by i.paid_at desc
   limit 1;
$$;
revoke execute on function public.club_mailing_eligible(uuid, uuid) from public, anon, authenticated;
grant execute on function public.club_mailing_eligible(uuid, uuid) to service_role;

-- ---------------------------------------------------------------- what the browser may call

-- Everything /club pages need about the signed-in account in one call. No Stripe ids, no card details.
create function public.club_me() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  s public.club_subscriptions%rowtype;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into s from public.club_subscriptions where user_id = uid order by created_at desc limit 1;
  return jsonb_build_object(
    'access', public.club_has_access(uid),
    'grant', (select g.reason from public.club_access_grants g
               where g.user_id = uid and g.revoked_at is null and (g.expires_at is null or g.expires_at > now())),
    'status', s.status,
    'renews', case when s.cancel_at_period_end then null else s.current_period_end end,
    'ends', case when s.cancel_at_period_end then s.current_period_end end,
    'revoked', s.access_revoked_at is not null,
    'onboarded', exists (select 1 from public.club_households h where h.owner_user_id = uid and h.onboarded_at is not null),
    'kits', coalesce((
      select jsonb_agg(jsonb_build_object('slug', k.slug, 'title', k.title, 'month', k.month,
                                          'can', public.club_can_open(uid, k.id)) order by k.month desc)
        from public.club_kits k where public.club_kit_released(k.id) and public.club_can_open(uid, k.id) <> 'none'), '[]'));
end $$;
revoke execute on function public.club_me() from public, anon;
grant execute on function public.club_me() to authenticated;

-- Her household and family (members archived more than a year ago are left out).
create function public.club_household() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  h public.club_households%rowtype;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into h from public.club_households where owner_user_id = uid;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', h.id, 'display_name', h.display_name, 'preferences', h.preferences, 'profile_version', h.profile_version,
    'onboarded', h.onboarded_at is not null,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'first_name', m.first_name, 'kind', m.kind, 'role', m.role,
                                          'is_account_holder', m.is_account_holder,
                                          'birth_year', m.birth_year, 'birth_month', m.birth_month,
                                          'archived', m.archived_at is not null) order by m.sort, m.created_at)
        from public.club_family_members m
       where m.household_id = h.id and (m.archived_at is null or m.archived_at > now() - interval '1 year')), '[]'));
end $$;
revoke execute on function public.club_household() from public, anon;
grant execute on function public.club_household() to authenticated;

-- Save the whole family in one call (onboarding and /club/family). Members not in p_members are archived,
-- never deleted, so documents that assigned them keep working. Anyone signed in may keep a profile; kits are
-- what membership unlocks.
create function public.club_household_save(p_display_name text, p_preferences jsonb, p_members jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  m jsonb;
  keep uuid[] := '{}';
  mid uuid;
  i int := 0;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if p_members is null or jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) not between 1 and 12 then
    raise exception 'invalid';
  end if;
  if p_preferences is null or jsonb_typeof(p_preferences) <> 'object'
     or exists (select 1 from jsonb_object_keys(p_preferences) k
                 where k not in ('palette', 'week_starts', 'faith_content', 'pets', 'school', 'weekday_dinner', 'priorities')) then
    raise exception 'invalid';
  end if;
  if p_preferences ? 'priorities' and (
       jsonb_typeof(p_preferences -> 'priorities') <> 'array'
       or jsonb_array_length(p_preferences -> 'priorities') > 8
       or exists (select 1 from jsonb_array_elements(p_preferences -> 'priorities') x
                   where jsonb_typeof(x) <> 'string' or x #>> '{}' !~ '^[a-z]+(-[a-z]+)*$' or char_length(x #>> '{}') > 40)) then
    raise exception 'invalid';
  end if;
  if exists (select 1 from jsonb_array_elements(p_members) x where btrim(coalesce(x ->> 'first_name', '')) = '') then
    raise exception 'invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('club-household:' || uid::text, 0));
  insert into public.club_households (owner_user_id, display_name, preferences, onboarded_at)
  values (uid, nullif(btrim(p_display_name), ''), p_preferences, now())
  on conflict (owner_user_id) do update
    set display_name = excluded.display_name, preferences = excluded.preferences,
        profile_version = club_households.profile_version + 1, updated_at = now(),
        onboarded_at = coalesce(club_households.onboarded_at, now())
  returning id into hid;
  for m in select * from jsonb_array_elements(p_members) loop
    i := i + 1;
    mid := nullif(m ->> 'id', '')::uuid;
    if mid is not null and not exists (select 1 from public.club_family_members where id = mid and household_id = hid) then
      raise exception 'invalid';
    end if;
    insert into public.club_family_members as f (id, household_id, first_name, kind, role, birth_year, birth_month, is_account_holder, sort)
    values (coalesce(mid, gen_random_uuid()), hid, btrim(m ->> 'first_name'), m ->> 'kind', m ->> 'role',
            (m ->> 'birth_year')::smallint, (m ->> 'birth_month')::smallint,
            coalesce((m ->> 'is_account_holder')::boolean, false) and m ->> 'kind' = 'adult', i)
    on conflict (id) do update
      set first_name = excluded.first_name, kind = excluded.kind, role = excluded.role,
          is_account_holder = excluded.is_account_holder,
          birth_year = excluded.birth_year, birth_month = excluded.birth_month, sort = excluded.sort,
          archived_at = null, updated_at = now()
    returning f.id into mid;
    keep := keep || mid;
  end loop;
  update public.club_family_members set archived_at = now(), updated_at = now()
   where household_id = hid and archived_at is null and not (id = any (keep));
  if (select count(*) from public.club_family_members where household_id = hid and archived_at is null and is_account_holder) > 1 then
    raise exception 'invalid';
  end if;
  return public.club_household();
exception
  when check_violation or invalid_text_representation or not_null_violation or numeric_value_out_of_range
       or invalid_parameter_value then
    raise exception 'invalid';
end $$;
revoke execute on function public.club_household_save(text, jsonb, jsonb) from public, anon;
grant execute on function public.club_household_save(text, jsonb, jsonb) to authenticated;

-- A kit's saved edits for her household ('none' → not found).
create function public.club_document_get(p_kit text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  k public.club_kits%rowtype;
  can text;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into k from public.club_kits where slug = p_kit;
  if not found then raise exception 'not_found'; end if;
  can := public.club_can_open(uid, k.id);
  if can = 'none' then raise exception 'not_found'; end if;
  return jsonb_build_object('can', can, 'documents', coalesce((
    select jsonb_object_agg(d.doc, jsonb_build_object('edits', d.edits, 'palette', d.palette, 'revision', d.revision,
                                                      'engine_version', d.engine_version, 'profile_version', d.profile_version))
      from public.club_documents d join public.club_households h on h.id = d.household_id
     where h.owner_user_id = uid and d.kit_id = k.id), '{}'));
end $$;
revoke execute on function public.club_document_get(text) from public, anon;
grant execute on function public.club_document_get(text) to authenticated;

-- Save one document's edits. Members with access only; a lapsed member's earned kits are read-only.
-- p_revision is the revision she loaded: a stale save raises 'conflict' and the page reloads the newer copy.
create function public.club_document_save(p_kit text, p_doc text, p_edits jsonb, p_palette text,
                                          p_engine_version int, p_profile_version int, p_revision int) returns int
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  kid uuid;
  rev int;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select id into kid from public.club_kits where slug = p_kit;
  if kid is null or public.club_can_open(uid, kid) <> 'edit' then raise exception 'read_only'; end if;
  select id into hid from public.club_households where owner_user_id = uid;
  if hid is null then raise exception 'no_household'; end if;
  insert into public.club_documents as d (household_id, kit_id, doc, engine_version, profile_version, edits, palette)
  values (hid, kid, p_doc, p_engine_version, p_profile_version, p_edits, p_palette)
  on conflict (household_id, kit_id, doc) do update
    set edits = excluded.edits, palette = excluded.palette, engine_version = excluded.engine_version,
        profile_version = excluded.profile_version, revision = d.revision + 1, updated_at = now()
    where d.revision = p_revision
  returning d.revision into rev;
  if rev is null then raise exception 'conflict'; end if;
  return rev;
exception
  when check_violation or not_null_violation then raise exception 'invalid';
end $$;
revoke execute on function public.club_document_save(text, text, jsonb, text, int, int, int) from public, anon;
grant execute on function public.club_document_save(text, text, jsonb, text, int, int, int) to authenticated;

-- ---------------------------------------------------------------- RLS

alter table public.club_households enable row level security;
alter table public.club_family_members enable row level security;
alter table public.club_customers enable row level security;
alter table public.club_subscriptions enable row level security;
alter table public.club_invoices enable row level security;
alter table public.club_stripe_events enable row level security;
alter table public.club_kits enable row level security;
alter table public.club_kit_entitlements enable row level security;
alter table public.club_documents enable row level security;
alter table public.club_mailing_addresses enable row level security;
alter table public.club_mailings enable row level security;
alter table public.club_mailing_recipients enable row level security;
alter table public.club_access_grants enable row level security;

revoke all on public.club_households, public.club_family_members, public.club_customers, public.club_subscriptions,
  public.club_invoices, public.club_stripe_events, public.club_kits, public.club_kit_entitlements,
  public.club_documents, public.club_mailing_addresses, public.club_mailings, public.club_mailing_recipients,
  public.club_access_grants
  from public, anon, authenticated;
grant all on public.club_households, public.club_family_members, public.club_customers, public.club_subscriptions,
  public.club_invoices, public.club_stripe_events, public.club_kits, public.club_kit_entitlements,
  public.club_documents, public.club_mailing_addresses, public.club_mailings, public.club_mailing_recipients,
  public.club_access_grants
  to service_role;

-- Customers: read-only, own rows, and only the tables a page reads directly. Everything else goes through
-- the functions above. Writes: none (no insert/update/delete grant to authenticated on any club table).
grant select on public.club_households, public.club_family_members, public.club_mailing_addresses to authenticated;
create policy "Members read their household" on public.club_households
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy "Members read their family" on public.club_family_members
  for select to authenticated using (household_id in (select id from public.club_households where owner_user_id = (select auth.uid())));
create policy "Members read their address" on public.club_mailing_addresses
  for select to authenticated using (user_id = (select auth.uid()));

-- Owner admins: read everything for /admin/club; changes go through the club-admin Edge Function.
grant select on public.club_households, public.club_family_members, public.club_customers, public.club_subscriptions,
  public.club_invoices, public.club_kits, public.club_kit_entitlements, public.club_mailing_addresses,
  public.club_mailings, public.club_mailing_recipients, public.club_access_grants to authenticated;
create policy "Admins read households" on public.club_households for select to authenticated using ((select public.is_admin('owner')));
create policy "Admins read customers" on public.club_customers for select to authenticated using ((select public.is_admin('owner')));
create policy "Admins read subscriptions" on public.club_subscriptions for select to authenticated using ((select public.is_admin('owner')));
create policy "Admins read invoices" on public.club_invoices for select to authenticated using ((select public.is_admin('owner')));
create policy "Admins read kits" on public.club_kits for select to authenticated using ((select public.is_admin('owner')));
create policy "Admins read entitlements" on public.club_kit_entitlements for select to authenticated using ((select public.is_admin('owner')));
create policy "Admins read addresses" on public.club_mailing_addresses for select to authenticated using ((select public.is_admin('owner')));
create policy "Admins read mailings" on public.club_mailings for select to authenticated using ((select public.is_admin('owner')));
create policy "Admins read recipients" on public.club_mailing_recipients for select to authenticated using ((select public.is_admin('owner')));
create policy "Admins read grants" on public.club_access_grants for select to authenticated using ((select public.is_admin('owner')));
-- Family members' names are not in the admin's read policies on purpose: support never needs a child's name.
-- (club_family_members has only the member policy.)

-- ---------------------------------------------------------------- accounts: two changes for the Club

-- Club data lives in its own tables, never in account_saves (no omc:club… browser keys are synced).
alter table public.account_saves drop constraint account_saves_key_check;
alter table public.account_saves add constraint account_saves_key_check check (
  key ~ '^omc:[a-z0-9][a-z0-9._-]*(:[a-z0-9][a-z0-9._-]*)*$' and char_length(key) <= 120
  and key !~ '^omc:(v1|account|tool-download-access|club[a-z0-9._-]*)(:|$)'
);

-- Deleting an account with a live paid membership would leave Stripe charging her: refuse, and let club-billing
-- (Phase 2) cancel first. Everything else is unchanged from 20261022000000_accounts.sql; her household, family,
-- documents, grant and address go with her sign-in (on delete cascade).
create or replace function public.account_delete() returns void
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
  if public.club_has_paid_access(uid) then raise exception 'active_membership'; end if;
  delete from public.account_saves where user_id = uid;
  update public.shop_entitlements set user_id = null where user_id = uid;
  if e is not null then
    update public.tool_email_contacts set marketing_opt_in = false where email = e;
  end if;
  delete from auth.users where id = uid;
end $$;
revoke execute on function public.account_delete() from public, anon;
grant execute on function public.account_delete() to authenticated;

-- The accounts migration revoked its functions from PUBLIC only, and Supabase also grants new functions to anon
-- directly, so signed-out visitors could call them (each refused without a sign-in, but the browser roles should
-- get only the intended entry points; tests/shop-e2e.test.ts checks the list).
revoke execute on function public.account_put(text, jsonb, text, text), public.account_email(), public.account_profile(),
  public.account_set_marketing(boolean), public.account_orders(), public.account_max_saves() from anon;
-- account_max_saves is an internal constant: account_put (security definer) calls it, nobody else needs to.
revoke execute on function public.account_max_saves() from public, anon, authenticated;

-- ---------------------------------------------------------------- the November kit

-- A draft: it opens for nobody until an admin schedules it (status 'scheduled') after Megan's letter is in.
insert into public.club_kits (slug, month, title, status, release_at, mailer_cutoff_at)
values ('2026-11-family-ownership', '2026-11-01', 'Our Family, Our Team', 'draft', '2026-11-01 04:00:00+00', '2026-10-15 04:00:00+00');

commit;
