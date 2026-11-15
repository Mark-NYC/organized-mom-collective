-- DRAFT, NOT A MIGRATION. Do not copy into supabase/migrations/ or apply to any project without the owner's approval.
-- Design for Milestones 3–5 of docs/ios/OMC_APP_ROADMAP.md: household members, synced cleaning progress, the family
-- calendar and the Smart Family Inbox. Follows the project's patterns (supabase/migrations/20261023000000_club_core.sql):
-- RLS on every table, reads by policy, writes only through checked security definer functions, `where` on every
-- update/delete (pg-safeupdate). Needs cross-household tests in supabase/tests/ before it's applied anywhere.

-- ── M3: more than one adult per household ─────────────────────────────────────────────────────────────────────
create table public.household_members (
  household_id uuid not null references public.club_households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null check (role in ('owner', 'partner')),
  created_at   timestamptz not null default now(),
  primary key (household_id, user_id)
);
-- Backfill: every club_households.owner_user_id becomes an 'owner' row. Billing stays with the owner.
-- insert into public.household_members (household_id, user_id, role) select id, owner_user_id, 'owner' from public.club_households;

create or replace function public.my_household_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select household_id from public.household_members where user_id = (select auth.uid())
$$;

alter table public.household_members enable row level security;
create policy household_members_read on public.household_members for select to authenticated
  using (household_id in (select public.my_household_ids()));

-- Partner invites: a code emailed to the partner, accepted after they sign in with that email.
create table public.household_invites (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.club_households (id) on delete cascade,
  email        text not null,
  token_hash   text not null,             -- never the token itself
  expires_at   timestamptz not null,
  accepted_at  timestamptz,
  created_by   uuid not null references auth.users (id)
);
alter table public.household_invites enable row level security; -- no direct access; functions only

-- ── M3: cleaning companion progress, synced (today's omc:v1:* localStorage keys) ─────────────────────────────────
create table public.household_progress (
  household_id uuid not null references public.club_households (id) on delete cascade,
  key          text not null check (key ~ '^(daily|focus|weekend|active):\d{4}-\d{2}-\d{2}$|^monthly:\d{4}-\d{2}$|^onboarded$'),
  value        jsonb not null,            -- the same JSON list of stable task ids the browser stores
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users (id),
  primary key (household_id, key)
);
alter table public.household_progress enable row level security;
create policy household_progress_read on public.household_progress for select to authenticated
  using (household_id in (select public.my_household_ids()));

-- ── M4: the family calendar ───────────────────────────────────────────────────────────────────────────────────
create table public.calendar_events (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.club_households (id) on delete cascade,
  title         text not null check (length(title) between 1 and 200),
  notes         text check (length(notes) <= 2000),
  location      text check (length(location) <= 300),
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  all_day       boolean not null default false,
  timezone      text not null default 'America/New_York',
  rrule         text,                     -- RFC 5545 recurrence, validated in the write function
  member_ids    uuid[] not null default '{}',  -- club_family_members ids (colors come from the household)
  source        text not null default 'manual' check (source in ('manual', 'google', 'inbox')),
  external_id   text,                     -- Google event id, for round-trips
  external_etag text,
  deleted_at    timestamptz,
  created_by    uuid references auth.users (id),
  updated_at    timestamptz not null default now()
);
create unique index calendar_events_external on public.calendar_events (household_id, source, external_id) where external_id is not null;
alter table public.calendar_events enable row level security;
create policy calendar_events_read on public.calendar_events for select to authenticated
  using (household_id in (select public.my_household_ids()));

-- Google connection: tokens live in Supabase Vault, never in a column the browser can read.
create table public.calendar_connections (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references public.club_households (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  provider         text not null check (provider = 'google'),
  scopes           text[] not null,       -- expected: calendar.events.readonly, calendar.app.created
  vault_secret_id  uuid not null,         -- refresh token in vault.secrets
  imported_calendar_ids text[] not null default '{}',
  app_calendar_id  text,                  -- the one calendar the app created and may write to
  created_at       timestamptz not null default now(),
  revoked_at       timestamptz
);
alter table public.calendar_connections enable row level security;
create policy calendar_connections_read on public.calendar_connections for select to authenticated
  using (user_id = (select auth.uid()));   -- vault_secret_id is useless without the service role

-- ── M5: Smart Family Inbox (forwarding only; no mailbox access) ─────────────────────────────────────────────────
create table public.inbox_addresses (
  household_id uuid primary key references public.club_households (id) on delete cascade,
  local_part   text not null unique check (local_part ~ '^[a-z0-9]{20,40}$'), -- random, unguessable
  created_at   timestamptz not null default now(),
  disabled_at  timestamptz
);

create table public.inbox_messages (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.club_households (id) on delete cascade,
  received_at   timestamptz not null default now(),
  from_address  text not null,
  subject       text,
  body_text     text,                      -- raw text; purged after 30 days (retention job), never logged
  purge_after   timestamptz not null default now() + interval '30 days',
  status        text not null default 'received' check (status in ('received', 'processed', 'failed', 'ignored'))
);
alter table public.inbox_messages enable row level security;
create policy inbox_messages_read on public.inbox_messages for select to authenticated
  using (household_id in (select public.my_household_ids()));

create table public.inbox_suggestions (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.club_households (id) on delete cascade,
  message_id      uuid not null references public.inbox_messages (id) on delete cascade,
  kind            text not null check (kind in ('add', 'change', 'cancel')),
  proposed        jsonb not null,          -- event fields as extracted
  target_event_id uuid references public.calendar_events (id) on delete set null,
  evidence        text not null,           -- the sentence it came from, shown beside Approve
  confidence      numeric(3,2) not null check (confidence between 0 and 1),
  status          text not null default 'pending' check (status in ('pending', 'approved', 'edited', 'dismissed')),
  decided_by      uuid references auth.users (id),
  decided_at      timestamptz
);
alter table public.inbox_suggestions enable row level security;
create policy inbox_suggestions_read on public.inbox_suggestions for select to authenticated
  using (household_id in (select public.my_household_ids()));
-- The ONLY path from a suggestion to the calendar: inbox_suggestion_decide(id, 'approve'|'edit'|'dismiss', edited jsonb),
-- security definer, checks membership, writes calendar_events and the decision in one transaction. The Edge Function
-- that calls Claude can insert suggestions (service role) but has no code path that writes calendar_events.
