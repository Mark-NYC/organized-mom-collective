-- Household Intelligence Engine, Stage B: observation and memory (docs/intelligence/STAGE_B_REPORT.md).
-- NOT APPLIED: needs the owner's approval and a verified backup first.
--
-- Additive. Nothing existing changes.
--   intel_settings            per household: learning on/off, AI consent (off by default), budget cap, pseudonym salt
--   intel_member_consent      per adult: may their personal (private) calendars inform the household's intelligence
--   household_signals         the one behavioral log (replaces the retired app_events proposal): ids and enums only
--   household_memory          evidence-backed beliefs: confirmed > observed > tentative; recurrence-aware review
--   household_memory_evidence why a memory exists (capped)
--   intel_interpretations     cached event interpretations (rules or model)
--   intel_pseudonyms          stable household-scoped tokens for people, series and places (no names stored)
--   intel_budget_scopes       caps: global monthly (real households), synthetic evaluation cumulative ($5 total)
--   intel_usage               every model reservation and its settled cost (no prompts, no outputs)
--   calendar_feed_descriptions a sanitized description (≤280) per connected-calendar series; untrusted; never auto-sent
-- Families reach all of it through SECURITY DEFINER functions that check membership; the engine (service role)
-- through the intel_private schema. Row-level security on every table; nothing granted to anon or authenticated.
begin;

create schema if not exists intel_private;
revoke all on schema intel_private from public, anon, authenticated;
grant usage on schema intel_private to service_role;

-- ---------------------------------------------------------------- settings and consent

create table public.intel_settings (
  household_id uuid primary key references public.club_households (id) on delete cascade,
  -- Learn from how the family uses the app (first-party, deterministic). On by default, disclosed in Account.
  learning_enabled boolean not null default true,
  -- Use an AI service. OFF until an adult explicitly agrees (onboarding or Account).
  ai_enabled boolean not null default false,
  ai_consent_version int,
  ai_consented_by uuid references auth.users (id) on delete set null,
  ai_consented_at timestamptz,
  ai_withdrawn_at timestamptz,
  -- Engineering test households (simulator, internal testers): spend from the synthetic budget, never real data.
  synthetic boolean not null default false,
  monthly_budget_micro_usd bigint not null default 400000 check (monthly_budget_micro_usd between 0 and 5000000),
  -- Keys household pseudonyms (intel_pseudonyms). Never leaves the database.
  pseudonym_salt bytea not null default extensions.gen_random_bytes(32),
  updated_at timestamptz not null default now()
);

create table public.intel_member_consent (
  user_id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.club_households (id) on delete cascade,
  -- May events from MY private (personal) calendars inform the household's intelligence? Only ever for me.
  personal_calendars boolean not null default false,
  version int,
  decided_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- the behavioral log

create table public.household_signals (
  id bigint generated always as identity primary key,
  -- Null before a family exists (onboarding_started).
  household_id uuid references public.club_households (id) on delete cascade,
  -- Null for engine-made observations (event_occurred).
  user_id uuid references auth.users (id) on delete cascade,
  member_id uuid references public.club_family_members (id) on delete set null,
  kind text not null check (kind in (
    -- product moments (once per person per day; app_open once per hour band): the pilot funnel reads these
    'app_open', 'onboarding_started', 'onboarding_completed', 'cleaning_checked', 'plan_added', 'agreement_made',
    'meeting_started', 'meeting_completed', 'club_preview_viewed', 'feedback_sent',
    -- learning signals (only while learning is on)
    'rec_presented', 'rec_response', 'request_asked', 'request_answered', 'agreement_saved', 'agreement_changed',
    'agreement_removed', 'task_done', 'task_undone', 'meeting_decision', 'intent_chosen', 'priority_chosen',
    'development_decided', 'report_made', 'memory_confirmed', 'memory_corrected', 'memory_forgotten',
    'event_occurred', 'event_changed', 'handoff_covered')),
  -- What it's about, as an opaque id or pseudonymous key. Never free text.
  subject_kind text check (subject_kind in ('agreement', 'series', 'event', 'task', 'request', 'recommendation', 'memory',
    'meeting', 'cleaning', 'priority', 'intent', 'development', 'category', 'person', 'need', 'pattern')),
  subject_ref text check (subject_ref ~ '^[A-Za-z0-9:_@.-]{1,96}$'),
  value text check (value ~ '^[a-z0-9-]{1,32}$'),
  -- Set when it came from someone's private calendar: only they (and the engine, for them) may use it.
  visible_to uuid references auth.users (id) on delete cascade,
  platform text not null default 'web' check (platform in ('web', 'ios', 'engine')),
  at timestamptz not null default now(),
  local_day date not null,
  local_hour smallint not null check (local_hour between 0 and 23),
  local_dow smallint not null check (local_dow between 0 and 6),
  synthetic boolean not null default false,
  check ((subject_kind is null) = (subject_ref is null))
);
create index household_signals_household on public.household_signals (household_id, kind, at);
create index household_signals_user_day on public.household_signals (user_id, kind, local_day);

-- ---------------------------------------------------------------- memory

create table public.household_memory (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.club_households (id) on delete cascade,
  category text not null check (category in ('event-meaning', 'occasion', 'routine', 'responsibility', 'collaboration',
    'timing', 'preference', 'temporary', 'pattern')),
  -- Pseudonymous or normalized key ('series:S4', 'need:pickup', 'person:P2:occasion:birthday'), never a name.
  subject_key text not null check (subject_key ~ '^[a-z0-9:_@.-]{1,120}$'),
  member_scope uuid references public.club_family_members (id) on delete cascade,
  -- Null: the household's. A user id: only that adult sees it (it came from their private calendar).
  visible_to uuid references auth.users (id) on delete cascade,
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 4096),
  status text not null check (status in ('confirmed', 'observed', 'tentative', 'temporary', 'retired', 'forgotten')),
  source text not null check (source in ('family', 'rules', 'stats', 'model')),
  origin text not null default 'household' check (origin in ('household', 'personal-calendar')),
  cadence text check (cadence in ('daily', 'weekly', 'biweekly', 'monthly', 'seasonal', 'annual', 'irregular')),
  confidence real not null default 0 check (confidence between 0 and 1),
  support int not null default 0 check (support >= 0),
  contradict int not null default 0 check (contradict >= 0),
  first_seen timestamptz,
  last_seen timestamptz,
  review_after timestamptz,
  expires_at timestamptz,
  confirmed_by uuid references auth.users (id) on delete set null,
  confirmed_at timestamptz,
  forgotten_at timestamptz,
  synthetic boolean not null default false,
  revision int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'confirmed' or source = 'family'),
  check (origin = 'household' or visible_to is not null)
);
create unique index household_memory_identity on public.household_memory (household_id, category, subject_key,
  coalesce(member_scope, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(visible_to, '00000000-0000-0000-0000-000000000000'::uuid));
create index household_memory_review on public.household_memory (household_id, status, review_after);

create table public.household_memory_evidence (
  id bigint generated always as identity primary key,
  memory_id uuid not null references public.household_memory (id) on delete cascade,
  household_id uuid not null references public.club_households (id) on delete cascade,
  signal_id bigint references public.household_signals (id) on delete set null,
  ref text check (ref ~ '^[A-Za-z0-9:_@.-]{1,96}$'),
  polarity smallint not null check (polarity in (-1, 1)),
  weight real not null default 1 check (weight > 0 and weight <= 5),
  at timestamptz not null
);
create index household_memory_evidence_memory on public.household_memory_evidence (memory_id, at);

create table public.intel_interpretations (
  household_id uuid not null references public.club_households (id) on delete cascade,
  fingerprint text not null check (fingerprint ~ '^[a-z0-9:_.-]{8,96}$'),
  result jsonb not null check (jsonb_typeof(result) = 'object' and pg_column_size(result) <= 4096),
  source text not null check (source in ('rules', 'model')),
  model text,
  prompt_version text,
  visible_to uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  primary key (household_id, fingerprint)
);

create table public.intel_pseudonyms (
  household_id uuid not null references public.club_households (id) on delete cascade,
  kind text not null check (kind in ('member', 'person', 'series', 'place', 'category')),
  key_hash bytea not null,
  token text not null check (token ~ '^[MPSLC][0-9]{1,5}$'),
  created_at timestamptz not null default now(),
  primary key (household_id, kind, key_hash),
  unique (household_id, token)
);

-- ---------------------------------------------------------------- budgets and usage (enforced here, server-side)

create table public.intel_budget_scopes (
  scope text primary key check (scope in ('global', 'synthetic')),
  -- A cap per calendar month, and/or a cap for all time (cumulative, never resets). At least one.
  monthly_cap_micro_usd bigint check (monthly_cap_micro_usd >= 0),
  lifetime_cap_micro_usd bigint check (lifetime_cap_micro_usd >= 0),
  -- The most one call may reserve in this scope (a runaway prompt can't take the budget in one go).
  per_call_max_micro_usd bigint not null default 2000000 check (per_call_max_micro_usd between 1 and 2000000),
  -- Who approved the current caps and why (raising a cap is an owner decision, recorded here).
  approved_note text check (char_length(approved_note) <= 300),
  updated_at timestamptz not null default now(),
  check (monthly_cap_micro_usd is not null or lifetime_cap_micro_usd is not null)
);
-- Defaults: $50/month across all real households (each also capped at $0.40/month in intel_settings), and $5.00 IN TOTAL
-- for synthetic evaluation, at most $0.05 per call. Raising either is an owner decision (docs/intelligence/EVALUATION_PLAN.md).
insert into public.intel_budget_scopes (scope, monthly_cap_micro_usd, lifetime_cap_micro_usd, per_call_max_micro_usd, approved_note) values
  ('global', 50000000, null, 2000000, 'Stage B default'),
  ('synthetic', null, 5000000, 50000, 'Owner, 2026-11-28: $5 total for AI evaluation; more needs a results report and approval');

create table public.intel_usage (
  id bigint generated always as identity primary key,
  household_id uuid references public.club_households (id) on delete set null,
  scope text not null check (scope in ('household', 'synthetic')),
  month date not null,
  request_key text not null check (char_length(request_key) between 8 and 96),
  attempt smallint not null default 1 check (attempt between 1 and 3),
  status text not null default 'reserved' check (status in ('reserved', 'settled', 'released', 'expired')),
  reserved_micro_usd bigint not null check (reserved_micro_usd between 1 and 2000000),
  actual_micro_usd bigint check (actual_micro_usd >= 0),
  job text not null check (job ~ '^[a-z-]{3,32}$'),
  model text check (char_length(model) <= 64),
  prompt_version text check (char_length(prompt_version) <= 32),
  input_tokens int, cached_tokens int, output_tokens int, reasoning_tokens int, latency_ms int,
  outcome text check (outcome ~ '^[a-z0-9-]{2,32}$'), -- ok, http-503, timeout, status-incomplete, not-sent…
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (request_key, attempt)
);
create index intel_usage_month on public.intel_usage (month, scope, household_id);

-- Synthetic evaluation only: every model answer, keyed by a fingerprint of (task, prompt version, model, the exact
-- minimized input). The same request is answered from here at no cost, even if a developer's local cache is lost.
-- Real households never use this table (their interpretations live in intel_interpretations, per household).
create table public.intel_inference_cache (
  fingerprint text primary key check (fingerprint ~ '^[a-z0-9:_.-]{16,96}$'),
  task text not null check (task ~ '^[a-z-]{3,32}$'),
  model text not null check (char_length(model) <= 64),
  prompt_version text not null check (char_length(prompt_version) <= 32),
  output jsonb not null check (jsonb_typeof(output) = 'object' and pg_column_size(output) <= 8192),
  usage jsonb not null default '{}'::jsonb check (pg_column_size(usage) <= 1024),
  cost_micro_usd bigint not null default 0 check (cost_micro_usd >= 0),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- calendar descriptions (sanitized, untrusted)

-- One description per event series of a connected calendar, at most 280 characters, sanitized by the importer
-- (supabase/functions/_shared/calendar/sanitize.ts: no links, emails, phone numbers, join codes or addresses).
-- Untrusted text: stored only. Never returned to the app, never sent to an AI provider automatically, and usable by the
-- engine only within the calendar's own visibility (its owner; the household only when the calendar is shared).
-- Removed with its calendar.
create table public.calendar_feed_descriptions (
  feed_id uuid not null references public.calendar_feeds (id) on delete cascade,
  household_id uuid not null references public.club_households (id) on delete cascade,
  uid text not null check (char_length(uid) between 1 and 255),
  description text not null check (char_length(description) between 1 and 280),
  updated_at timestamptz not null default now(),
  primary key (feed_id, uid)
);

-- ---------------------------------------------------------------- lock everything down

alter table public.intel_settings enable row level security;
alter table public.intel_member_consent enable row level security;
alter table public.household_signals enable row level security;
alter table public.household_memory enable row level security;
alter table public.household_memory_evidence enable row level security;
alter table public.intel_interpretations enable row level security;
alter table public.intel_pseudonyms enable row level security;
alter table public.intel_budget_scopes enable row level security;
alter table public.intel_usage enable row level security;
alter table public.intel_inference_cache enable row level security;
alter table public.calendar_feed_descriptions enable row level security;
revoke all on public.calendar_feed_descriptions from public, anon, authenticated;
grant all on public.calendar_feed_descriptions to service_role;
revoke all on public.intel_settings, public.intel_member_consent, public.household_signals, public.household_memory,
  public.household_memory_evidence, public.intel_interpretations, public.intel_pseudonyms, public.intel_budget_scopes,
  public.intel_usage, public.intel_inference_cache from public, anon, authenticated;
grant all on public.intel_settings, public.intel_member_consent, public.household_signals, public.household_memory,
  public.household_memory_evidence, public.intel_interpretations, public.intel_pseudonyms, public.intel_budget_scopes,
  public.intel_usage, public.intel_inference_cache to service_role;

-- ---------------------------------------------------------------- helpers

-- The household's settings row (made on first use).
create function intel_private.settings(p_household uuid) returns public.intel_settings
language plpgsql security definer set search_path = '' as $$
declare r public.intel_settings;
begin
  insert into public.intel_settings (household_id) values (p_household) on conflict (household_id) do nothing;
  select * into r from public.intel_settings where household_id = p_household;
  return r;
end $$;

create function intel_private.product_kind(p_kind text) returns boolean language sql immutable as $$
  select p_kind in ('app_open', 'onboarding_started', 'onboarding_completed', 'cleaning_checked', 'plan_added',
    'agreement_made', 'meeting_started', 'meeting_completed', 'club_preview_viewed', 'feedback_sent')
$$;

create function intel_private.memory_json(m public.household_memory) returns jsonb language sql stable as $$
  select jsonb_build_object('id', m.id, 'category', m.category, 'subject_key', m.subject_key, 'member_id', m.member_scope,
    'private', m.visible_to is not null, 'content', m.content, 'status', m.status, 'source', m.source, 'cadence', m.cadence,
    'confidence', round(m.confidence::numeric, 2), 'support', m.support, 'contradict', m.contradict,
    'first_seen', m.first_seen, 'last_seen', m.last_seen, 'review_after', m.review_after, 'expires_at', m.expires_at,
    'confirmed_at', m.confirmed_at, 'revision', m.revision)
$$;

-- ---------------------------------------------------------------- the app's functions (signed-in adults)

-- Log what happened. p_signals: [{kind, subject_kind?, subject_ref?, value?, member_id?, private?, at?, local_day,
-- local_hour, local_dow, platform?}] (at most 50). Returns how many were kept. Never throws for a dropped signal:
-- unknown kinds, learning switched off, duplicates of a once-a-day moment and over-limit calls are skipped.
create function public.household_signal_log(p_signals jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  st public.intel_settings;
  s jsonb;
  k text; sk text; sr text; v text; mid uuid; pv uuid; d date; h int; w int; ts timestamptz; plat text;
  kept int := 0;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if jsonb_typeof(p_signals) <> 'array' or jsonb_array_length(p_signals) > 50 then raise exception 'invalid'; end if;
  hid := public.household_id_for(uid);
  if hid is not null then st := intel_private.settings(hid); end if;
  perform pg_advisory_xact_lock(hashtextextended('household-signals:' || uid::text, 0));
  if (select count(*) from public.household_signals where user_id = uid and at > now() - interval '1 day') >= 2000 then return 0; end if;
  for s in select * from jsonb_array_elements(p_signals) loop
    begin
      k := s ->> 'kind'; sk := s ->> 'subject_kind'; sr := s ->> 'subject_ref'; v := s ->> 'value';
      d := (s ->> 'local_day')::date; h := (s ->> 'local_hour')::int; w := (s ->> 'local_dow')::int;
      plat := case when s ->> 'platform' = 'ios' then 'ios' else 'web' end;
      ts := least(greatest(coalesce((s ->> 'at')::timestamptz, now()), now() - interval '3 days'), now());
      mid := nullif(s ->> 'member_id', '')::uuid;
      pv := case when (s ->> 'private')::boolean then uid end;
      if d is null or abs(d - (ts at time zone 'utc')::date) > 1 then continue; end if;
      if not intel_private.product_kind(k) then
        -- Learning signals need a family, learning switched on, and (for private ones) this adult's own consent.
        if hid is null or not st.learning_enabled then continue; end if;
        if pv is not null and not coalesce((select personal_calendars from public.intel_member_consent where user_id = uid), false) then continue; end if;
      else
        sk := null; sr := null; v := null; pv := null; -- product moments carry nothing but the moment
        if exists (select 1 from public.household_signals x where x.user_id = uid and x.kind = k and x.local_day = d
                     and (k <> 'app_open' or x.local_hour = h)) then continue; end if;
      end if;
      if mid is not null and (hid is null or not exists (select 1 from public.club_family_members m where m.id = mid and m.household_id = hid)) then mid := null; end if;
      insert into public.household_signals (household_id, user_id, member_id, kind, subject_kind, subject_ref, value, visible_to,
        platform, at, local_day, local_hour, local_dow, synthetic)
      values (hid, uid, mid, k, sk, sr, v, pv, plat, ts, d, h, w, coalesce(st.synthetic, false));
      kept := kept + 1;
    exception when check_violation or invalid_text_representation or invalid_datetime_format or datetime_field_overflow
                   or numeric_value_out_of_range or foreign_key_violation then
      continue; -- a malformed signal is dropped, never an error for the family
    end;
  end loop;
  return kept;
end $$;
revoke all on function public.household_signal_log(jsonb) from public, anon;
grant execute on function public.household_signal_log(jsonb) to authenticated;

-- Read (and change) this household's intelligence settings and my own consent.
-- p_patch keys: learning_enabled, ai_enabled (+ ai_consent_version when turning on), personal_calendars (mine).
-- Turning AI off removes what the AI derived; withdrawing my personal calendars removes what came from them.
create function public.household_intel_settings(p_household uuid, p_patch jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid := public.household_id_for(uid);
  st public.intel_settings;
  mine boolean;
begin
  if hid is null or hid is distinct from p_household then raise exception 'no_household'; end if;
  st := intel_private.settings(hid);
  if p_patch is not null then
    if jsonb_typeof(p_patch) <> 'object' then raise exception 'invalid'; end if;
    perform 1 from public.intel_settings where household_id = hid for update;
    if p_patch ? 'learning_enabled' then
      update public.intel_settings set learning_enabled = (p_patch ->> 'learning_enabled')::boolean, updated_at = now() where household_id = hid;
    end if;
    if p_patch ? 'ai_enabled' then
      if (p_patch ->> 'ai_enabled')::boolean then
        if coalesce((p_patch ->> 'ai_consent_version')::int, 0) < 1 then raise exception 'consent_required'; end if;
        update public.intel_settings set ai_enabled = true, ai_consent_version = (p_patch ->> 'ai_consent_version')::int,
          ai_consented_by = uid, ai_consented_at = now(), ai_withdrawn_at = null, updated_at = now() where household_id = hid;
      elsif st.ai_enabled or st.ai_consented_at is not null then
        update public.intel_settings set ai_enabled = false, ai_withdrawn_at = now(), updated_at = now() where household_id = hid;
        delete from public.household_memory where household_id = hid and source = 'model';
        delete from public.intel_interpretations where household_id = hid and source = 'model';
        update public.intel_usage set status = 'released', settled_at = now() where household_id = hid and status = 'reserved';
      end if;
    end if;
    if p_patch ? 'personal_calendars' then
      mine := (p_patch ->> 'personal_calendars')::boolean;
      insert into public.intel_member_consent as c (user_id, household_id, personal_calendars, version, decided_at)
        values (uid, hid, mine, nullif(p_patch ->> 'consent_version', '')::int, now())
        on conflict (user_id) do update set household_id = hid, personal_calendars = mine, version = excluded.version, decided_at = now();
      if not mine then
        delete from public.household_memory where household_id = hid and visible_to = uid;
        delete from public.household_signals where household_id = hid and visible_to = uid;
        delete from public.intel_interpretations where household_id = hid and visible_to = uid;
      end if;
    end if;
    st := intel_private.settings(hid);
  end if;
  return jsonb_build_object('learning_enabled', st.learning_enabled, 'ai_enabled', st.ai_enabled,
    'ai_consent_version', st.ai_consent_version, 'ai_consented_at', st.ai_consented_at, 'ai_consented_by_me', st.ai_consented_by = uid,
    'ai_withdrawn_at', st.ai_withdrawn_at,
    'personal_calendars', coalesce((select personal_calendars from public.intel_member_consent where user_id = uid), false),
    'budget_micro_usd', st.monthly_budget_micro_usd);
end $$;
revoke all on function public.household_intel_settings(uuid, jsonb) from public, anon;
grant execute on function public.household_intel_settings(uuid, jsonb) to authenticated;

-- What we've learned, as this adult may see it (the household's, plus their own private ones). Forgotten ones never.
create function public.household_memory(p_household uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); hid uuid := public.household_id_for(uid);
begin
  if hid is null or hid is distinct from p_household then raise exception 'no_household'; end if;
  return coalesce((select jsonb_agg(intel_private.memory_json(m) order by m.status = 'confirmed' desc, m.confidence desc, m.updated_at desc)
    from public.household_memory m
   where m.household_id = hid and m.status not in ('forgotten', 'retired') and (m.visible_to is null or m.visible_to = uid)
     and (m.expires_at is null or m.expires_at > now())), '[]'::jsonb);
end $$;
revoke all on function public.household_memory(uuid) from public, anon;
grant execute on function public.household_memory(uuid) to authenticated;

-- The family says so: a confirmed memory (an explicit preference, "we decide this each time", "make it the usual").
-- p: {category, subject_key, member_id?, content, expires_at?, private?}. Replaces an inferred one with the same identity.
create function public.household_memory_confirm(p_household uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); hid uuid := public.household_id_for(uid);
  mid uuid := nullif(p ->> 'member_id', '')::uuid;
  pv uuid := case when (p ->> 'private')::boolean then uid end;
  r public.household_memory;
begin
  if hid is null or hid is distinct from p_household then raise exception 'no_household'; end if;
  if mid is not null and not exists (select 1 from public.club_family_members m where m.id = mid and m.household_id = hid) then raise exception 'invalid'; end if;
  insert into public.household_memory as cur (household_id, category, subject_key, member_scope, visible_to, content, status, source,
      origin, confidence, support, first_seen, last_seen, confirmed_by, confirmed_at, expires_at, cadence)
    values (hid, p ->> 'category', p ->> 'subject_key', mid, pv, coalesce(p -> 'content', '{}'::jsonb), 'confirmed', 'family',
      case when pv is null then 'household' else 'personal-calendar' end, 1, 1, now(), now(), uid, now(),
      nullif(p ->> 'expires_at', '')::timestamptz, nullif(p ->> 'cadence', ''))
    on conflict (household_id, category, subject_key, coalesce(member_scope, '00000000-0000-0000-0000-000000000000'::uuid),
                 coalesce(visible_to, '00000000-0000-0000-0000-000000000000'::uuid))
    do update set content = excluded.content, status = 'confirmed', source = 'family', confidence = 1, confirmed_by = uid,
      confirmed_at = now(), forgotten_at = null, expires_at = excluded.expires_at, cadence = coalesce(excluded.cadence, cur.cadence),
      last_seen = now(), revision = cur.revision + 1, updated_at = now()
    returning * into r;
  insert into public.household_signals (household_id, user_id, kind, subject_kind, subject_ref, platform, local_day, local_hour, local_dow)
    values (hid, uid, 'memory_confirmed', 'memory', r.id::text, 'web', (now() at time zone 'utc')::date,
            extract(hour from now() at time zone 'utc')::int, extract(dow from now() at time zone 'utc')::int);
  return intel_private.memory_json(r);
exception when check_violation or invalid_text_representation then raise exception 'invalid' using detail = sqlerrm;
end $$;
revoke all on function public.household_memory_confirm(uuid, jsonb) from public, anon;
grant execute on function public.household_memory_confirm(uuid, jsonb) to authenticated;

-- Correct a memory in the family's own words: it becomes confirmed.
create function public.household_memory_correct(p_household uuid, p_id uuid, p_content jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); hid uuid := public.household_id_for(uid); r public.household_memory;
begin
  if hid is null or hid is distinct from p_household then raise exception 'no_household'; end if;
  if jsonb_typeof(p_content) <> 'object' or pg_column_size(p_content) > 4096 then raise exception 'invalid'; end if;
  update public.household_memory set content = p_content, status = 'confirmed', source = 'family', confidence = 1,
      confirmed_by = uid, confirmed_at = now(), forgotten_at = null, revision = revision + 1, updated_at = now()
   where id = p_id and household_id = hid and (visible_to is null or visible_to = uid) and status <> 'forgotten'
   returning * into r;
  if r.id is null then raise exception 'not_found'; end if;
  insert into public.household_signals (household_id, user_id, kind, subject_kind, subject_ref, platform, local_day, local_hour, local_dow)
    values (hid, uid, 'memory_corrected', 'memory', r.id::text, 'web', (now() at time zone 'utc')::date,
            extract(hour from now() at time zone 'utc')::int, extract(dow from now() at time zone 'utc')::int);
  return intel_private.memory_json(r);
end $$;
revoke all on function public.household_memory_correct(uuid, uuid, jsonb) from public, anon;
grant execute on function public.household_memory_correct(uuid, uuid, jsonb) to authenticated;

-- Forget a memory: its evidence is deleted, and it can only come back from NEW evidence after today.
create function public.household_memory_forget(p_household uuid, p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); hid uuid := public.household_id_for(uid); n int;
begin
  if hid is null or hid is distinct from p_household then raise exception 'no_household'; end if;
  update public.household_memory set status = 'forgotten', forgotten_at = now(), confidence = 0, support = 0, contradict = 0,
      content = jsonb_build_object('forgotten', true), revision = revision + 1, updated_at = now()
   where id = p_id and household_id = hid and (visible_to is null or visible_to = uid);
  get diagnostics n = row_count;
  if n = 0 then raise exception 'not_found'; end if;
  delete from public.household_memory_evidence where memory_id = p_id;
  insert into public.household_signals (household_id, user_id, kind, subject_kind, subject_ref, platform, local_day, local_hour, local_dow)
    values (hid, uid, 'memory_forgotten', 'memory', p_id::text, 'web', (now() at time zone 'utc')::date,
            extract(hour from now() at time zone 'utc')::int, extract(dow from now() at time zone 'utc')::int);
  return true;
end $$;
revoke all on function public.household_memory_forget(uuid, uuid) from public, anon;
grant execute on function public.household_memory_forget(uuid, uuid) to authenticated;

-- Erase what we've learned: every signal, memory, interpretation and pseudonym of this household. Settings, consent
-- choices and agreements stay. (Deleting the household or the account removes everything by cascade.)
create function public.household_intel_erase(p_household uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); hid uuid := public.household_id_for(uid); a int; b int;
begin
  if hid is null or hid is distinct from p_household then raise exception 'no_household'; end if;
  delete from public.household_memory where household_id = hid; get diagnostics a = row_count;
  delete from public.household_signals where household_id = hid; get diagnostics b = row_count;
  delete from public.intel_interpretations where household_id = hid;
  delete from public.intel_pseudonyms where household_id = hid;
  update public.intel_settings set pseudonym_salt = extensions.gen_random_bytes(32), updated_at = now() where household_id = hid;
  return jsonb_build_object('memories', a, 'signals', b);
end $$;
revoke all on function public.household_intel_erase(uuid) from public, anon;
grant execute on function public.household_intel_erase(uuid) to authenticated;

-- ---------------------------------------------------------------- the engine's functions (service role only)

-- Apply learned memory (from src/lib/intel/learn.ts, run by the engine). p_rows: [{category, subject_key, member_id?,
-- visible_to?, origin?, content, status ('observed'|'tentative'|'temporary'|'retired'), source ('rules'|'stats'|'model'),
-- cadence?, confidence, support, contradict, first_seen, last_seen, review_after, expires_at?, evidence: [{signal_id?,
-- ref?, polarity, weight?, at}]}]. Rules enforced here, whatever the caller sends:
--   - learning must be on; model-sourced memory needs AI consent; personal-calendar memory needs that adult's consent
--   - a confirmed memory is never overwritten by inference (its counters may record new evidence)
--   - a forgotten memory comes back only from evidence after it was forgotten
--   - evidence is capped at the newest 40 per memory
create function intel_private.memory_apply(p_household uuid, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  st public.intel_settings := intel_private.settings(p_household);
  r jsonb; e jsonb; cur public.household_memory; mid uuid; pv uuid; applied int := 0; skipped int := 0; fresh int;
begin
  if not st.learning_enabled then return jsonb_build_object('applied', 0, 'skipped', jsonb_array_length(p_rows), 'reason', 'learning_off'); end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    mid := nullif(r ->> 'member_id', '')::uuid; pv := nullif(r ->> 'visible_to', '')::uuid;
    if r ->> 'source' = 'model' and not st.ai_enabled then skipped := skipped + 1; continue; end if;
    if pv is not null and not coalesce((select personal_calendars from public.intel_member_consent c where c.user_id = pv and c.household_id = p_household), false) then
      skipped := skipped + 1; continue;
    end if;
    if r ->> 'status' not in ('observed', 'tentative', 'temporary', 'retired') or r ->> 'source' not in ('rules', 'stats', 'model') then skipped := skipped + 1; continue; end if;
    select * into cur from public.household_memory m where m.household_id = p_household and m.category = r ->> 'category' and m.subject_key = r ->> 'subject_key'
      and m.member_scope is not distinct from mid and m.visible_to is not distinct from pv;
    if cur.id is not null and cur.status = 'forgotten' then
      select count(*) into fresh from jsonb_array_elements(coalesce(r -> 'evidence', '[]')) x where (x ->> 'polarity')::int = 1 and (x ->> 'at')::timestamptz > cur.forgotten_at;
      if fresh < 2 then skipped := skipped + 1; continue; end if;
    end if;
    if cur.id is not null and cur.status = 'confirmed' then
      update public.household_memory set support = greatest(support, (r ->> 'support')::int), contradict = (r ->> 'contradict')::int,
          last_seen = greatest(last_seen, (r ->> 'last_seen')::timestamptz), updated_at = now() where id = cur.id;
    elsif cur.id is not null then
      update public.household_memory set content = coalesce(r -> 'content', content), status = r ->> 'status', source = r ->> 'source',
          cadence = nullif(r ->> 'cadence', ''), confidence = (r ->> 'confidence')::real, support = (r ->> 'support')::int,
          contradict = (r ->> 'contradict')::int, first_seen = coalesce(first_seen, (r ->> 'first_seen')::timestamptz),
          last_seen = (r ->> 'last_seen')::timestamptz, review_after = nullif(r ->> 'review_after', '')::timestamptz,
          expires_at = nullif(r ->> 'expires_at', '')::timestamptz, forgotten_at = null, revision = revision + 1, updated_at = now()
       where id = cur.id;
    else
      insert into public.household_memory (household_id, category, subject_key, member_scope, visible_to, content, status, source, origin,
          cadence, confidence, support, contradict, first_seen, last_seen, review_after, expires_at, synthetic)
        values (p_household, r ->> 'category', r ->> 'subject_key', mid, pv, coalesce(r -> 'content', '{}'::jsonb), r ->> 'status', r ->> 'source',
          case when pv is null then 'household' else 'personal-calendar' end, nullif(r ->> 'cadence', ''), (r ->> 'confidence')::real,
          (r ->> 'support')::int, (r ->> 'contradict')::int, (r ->> 'first_seen')::timestamptz, (r ->> 'last_seen')::timestamptz,
          nullif(r ->> 'review_after', '')::timestamptz, nullif(r ->> 'expires_at', '')::timestamptz, st.synthetic)
        returning * into cur;
    end if;
    for e in select * from jsonb_array_elements(coalesce(r -> 'evidence', '[]')) loop
      insert into public.household_memory_evidence (memory_id, household_id, signal_id, ref, polarity, weight, at)
        values (cur.id, p_household, nullif(e ->> 'signal_id', '')::bigint, nullif(e ->> 'ref', ''), (e ->> 'polarity')::smallint,
                coalesce((e ->> 'weight')::real, 1), (e ->> 'at')::timestamptz);
    end loop;
    delete from public.household_memory_evidence where memory_id = cur.id and id not in
      (select id from public.household_memory_evidence where memory_id = cur.id order by at desc limit 40);
    applied := applied + 1;
    cur := null;
  end loop;
  return jsonb_build_object('applied', applied, 'skipped', skipped);
end $$;

-- A stable household-scoped token for a person, series, place, member or category key (normalized, then HMAC'd with
-- the household's salt: no name is stored, and the same key always gets the same token).
create function intel_private.pseudonym(p_household uuid, p_kind text, p_key text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  st public.intel_settings := intel_private.settings(p_household);
  h bytea := extensions.hmac(convert_to(lower(regexp_replace(btrim(p_key), '\s+', ' ', 'g')), 'UTF8'), st.pseudonym_salt, 'sha256');
  t text; n int;
  prefix text := case p_kind when 'member' then 'M' when 'person' then 'P' when 'series' then 'S' when 'place' then 'L' else 'C' end;
begin
  select token into t from public.intel_pseudonyms where household_id = p_household and kind = p_kind and key_hash = h;
  if t is not null then return t; end if;
  perform pg_advisory_xact_lock(hashtextextended('pseudonym:' || p_household::text || ':' || p_kind, 0));
  select token into t from public.intel_pseudonyms where household_id = p_household and kind = p_kind and key_hash = h;
  if t is not null then return t; end if;
  select count(*) + 1 into n from public.intel_pseudonyms where household_id = p_household and kind = p_kind;
  t := prefix || n;
  insert into public.intel_pseudonyms (household_id, kind, key_hash, token) values (p_household, p_kind, h, t);
  return t;
end $$;

-- Reserve inference budget before a model call (server-side, the only way to spend). Serialized per scope, so
-- concurrent calls can't overspend. Each retry is its own attempt (max 3) and is counted. The same (request_key,
-- attempt) returns the same reservation (idempotent). A reservation older than 10 minutes is marked expired but STILL
-- COUNTS at its reserved amount until it is settled: a call that was sent and never reported back is assumed to have
-- cost its estimate, so a crash can't hide spending. Only a call that never left ('released') stops counting.
-- Caps: the household's monthly cap; the scope's monthly cap; the scope's lifetime cap (all months); the per-call max.
create function intel_private.budget_reserve(p_household uuid, p_scope text, p_request_key text, p_attempt int,
  p_estimate_micro_usd bigint, p_job text, p_model text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  mo date := date_trunc('month', now())::date;
  st public.intel_settings;
  existing public.intel_usage;
  spent_h bigint; spent_scope bigint; spent_all bigint; cap_h bigint; caps public.intel_budget_scopes; id_ bigint;
begin
  if p_scope not in ('household', 'synthetic') or p_attempt not between 1 and 3 or p_estimate_micro_usd not between 1 and 2000000 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  select * into existing from public.intel_usage where request_key = p_request_key and attempt = p_attempt;
  if existing.id is not null then return jsonb_build_object('ok', existing.status in ('reserved', 'settled'), 'id', existing.id, 'reason', 'existing'); end if;
  if p_household is not null then
    st := intel_private.settings(p_household);
    if p_scope = 'household' and st.synthetic then return jsonb_build_object('ok', false, 'reason', 'wrong_scope'); end if;
    if p_scope = 'synthetic' and not st.synthetic then return jsonb_build_object('ok', false, 'reason', 'wrong_scope'); end if;
    if p_scope = 'household' and not st.ai_enabled then return jsonb_build_object('ok', false, 'reason', 'no_consent'); end if;
  elsif p_scope = 'household' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('intel-budget:' || p_scope, 0));
  update public.intel_usage set status = 'expired' where status = 'reserved' and created_at < now() - interval '10 minutes';
  select * into caps from public.intel_budget_scopes where scope = case p_scope when 'household' then 'global' else 'synthetic' end;
  if caps.scope is null then return jsonb_build_object('ok', false, 'reason', 'scope_budget'); end if;
  if p_estimate_micro_usd > caps.per_call_max_micro_usd then return jsonb_build_object('ok', false, 'reason', 'per_call_max'); end if;
  select coalesce(sum(coalesce(actual_micro_usd, reserved_micro_usd)) filter (where month = mo), 0),
         coalesce(sum(coalesce(actual_micro_usd, reserved_micro_usd)), 0)
    into spent_scope, spent_all from public.intel_usage where scope = p_scope and status in ('reserved', 'settled', 'expired');
  if caps.monthly_cap_micro_usd is not null and spent_scope + p_estimate_micro_usd > caps.monthly_cap_micro_usd then
    return jsonb_build_object('ok', false, 'reason', 'scope_budget');
  end if;
  if caps.lifetime_cap_micro_usd is not null and spent_all + p_estimate_micro_usd > caps.lifetime_cap_micro_usd then
    return jsonb_build_object('ok', false, 'reason', 'lifetime_budget', 'spent_micro_usd', spent_all, 'cap_micro_usd', caps.lifetime_cap_micro_usd);
  end if;
  if p_household is not null and p_scope = 'household' then
    select coalesce(sum(coalesce(actual_micro_usd, reserved_micro_usd)), 0) into spent_h from public.intel_usage
     where month = mo and household_id = p_household and status in ('reserved', 'settled', 'expired');
    cap_h := st.monthly_budget_micro_usd;
    if spent_h + p_estimate_micro_usd > cap_h then return jsonb_build_object('ok', false, 'reason', 'household_budget'); end if;
  end if;
  if p_attempt > 1 and not exists (select 1 from public.intel_usage where request_key = p_request_key and attempt = p_attempt - 1) then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  insert into public.intel_usage (household_id, scope, month, request_key, attempt, reserved_micro_usd, job, model)
    values (p_household, p_scope, mo, p_request_key, p_attempt, p_estimate_micro_usd, p_job, p_model) returning id into id_;
  return jsonb_build_object('ok', true, 'id', id_);
end $$;

-- After the call: the real cost and token counts (never the prompt or the output). Released if the call never ran.
create function intel_private.budget_settle(p_id bigint, p_actual_micro_usd bigint, p_usage jsonb default '{}'::jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.intel_usage set status = case when p_actual_micro_usd is null then 'released' else 'settled' end,
      actual_micro_usd = p_actual_micro_usd, settled_at = now(),
      input_tokens = (p_usage ->> 'input_tokens')::int, cached_tokens = (p_usage ->> 'cached_tokens')::int,
      output_tokens = (p_usage ->> 'output_tokens')::int, reasoning_tokens = (p_usage ->> 'reasoning_tokens')::int,
      latency_ms = (p_usage ->> 'latency_ms')::int, outcome = nullif(p_usage ->> 'outcome', ''), prompt_version = nullif(p_usage ->> 'prompt_version', '')
   where id = p_id and status in ('reserved', 'expired');
  return found;
end $$;

-- Where a scope stands (the evaluation runner shows this before and after every phase).
create function intel_private.budget_status(p_scope text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('scope', p_scope,
    'lifetime_cap_micro_usd', (select lifetime_cap_micro_usd from public.intel_budget_scopes where scope = case p_scope when 'household' then 'global' else p_scope end),
    'monthly_cap_micro_usd', (select monthly_cap_micro_usd from public.intel_budget_scopes where scope = case p_scope when 'household' then 'global' else p_scope end),
    'settled_micro_usd', coalesce(sum(actual_micro_usd) filter (where status = 'settled'), 0),
    'held_micro_usd', coalesce(sum(reserved_micro_usd) filter (where status in ('reserved', 'expired')), 0),
    'spent_micro_usd', coalesce(sum(coalesce(actual_micro_usd, reserved_micro_usd)) filter (where status in ('reserved', 'settled', 'expired')), 0),
    'this_month_micro_usd', coalesce(sum(coalesce(actual_micro_usd, reserved_micro_usd)) filter (where status in ('reserved', 'settled', 'expired') and month = date_trunc('month', now())::date), 0),
    'calls', count(*) filter (where status in ('settled', 'expired', 'reserved')),
    'retries', count(*) filter (where attempt > 1))
  from public.intel_usage where scope = p_scope
$$;

-- The importer's descriptions for one calendar after a successful refresh (replaces them). p: [{uid, description}].
-- Server-side length cap and a second, coarse scrub (links, emails) in case an importer forgot.
create function public.calendar_feed_descriptions_store(p_feed uuid, p jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare f public.calendar_feeds%rowtype; n int;
begin
  select * into f from public.calendar_feeds where id = p_feed;
  if not found then return 0; end if;
  delete from public.calendar_feed_descriptions where feed_id = p_feed;
  insert into public.calendar_feed_descriptions (feed_id, household_id, uid, description)
  select p_feed, f.household_id, u, d from (
    select left(e ->> 'uid', 255) as u,
           left(btrim(regexp_replace(regexp_replace(coalesce(e ->> 'description', ''), 'https?://\S+|www\.\S+', '', 'gi'), '[\w.+-]+@[\w-]+\.[\w.]+', '', 'g')), 280) as d
      from (select e from jsonb_array_elements(coalesce(p, '[]')) e limit 2000) x) y
   where coalesce(u, '') <> '' and d <> ''
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.calendar_feed_descriptions_store(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.calendar_feed_descriptions_store(uuid, jsonb) to service_role;

-- Retention: learning signals 180 days; product moments 400 days (day-30 returns, a year of seasons); event
-- occurrences and event choices 800 days (annual occasions need two years). Expired temporary memories go.
create function intel_private.prune() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a int; b int;
begin
  delete from public.household_signals where
    (kind in ('event_occurred', 'intent_chosen') and at < now() - interval '800 days')
    or (intel_private.product_kind(kind) and at < now() - interval '400 days')
    or (kind not in ('event_occurred', 'intent_chosen') and not intel_private.product_kind(kind) and at < now() - interval '180 days');
  get diagnostics a = row_count;
  delete from public.household_memory where (status = 'temporary' and expires_at < now()) or (status = 'retired' and updated_at < now() - interval '180 days');
  get diagnostics b = row_count;
  delete from public.intel_interpretations where expires_at < now();
  return jsonb_build_object('signals', a, 'memories', b);
end $$;

revoke all on all functions in schema intel_private from public, anon, authenticated;
grant execute on all functions in schema intel_private to service_role;


-- The inference function's door to the budget and the evaluation cache (supabase/functions/intel-infer). PostgREST
-- can't reach intel_private, so these thin wrappers are public but executable by the service role ONLY.
create function public.intel_budget_reserve(p_household uuid, p_scope text, p_request_key text, p_attempt int,
  p_estimate_micro_usd bigint, p_job text, p_model text) returns jsonb
language sql security definer set search_path = '' as $$
  select intel_private.budget_reserve(p_household, p_scope, p_request_key, p_attempt, p_estimate_micro_usd, p_job, p_model)
$$;
create function public.intel_budget_settle(p_id bigint, p_actual_micro_usd bigint, p_usage jsonb default '{}'::jsonb) returns boolean
language sql security definer set search_path = '' as $$ select intel_private.budget_settle(p_id, p_actual_micro_usd, p_usage) $$;
create function public.intel_budget_status(p_scope text) returns jsonb
language sql stable security definer set search_path = '' as $$ select intel_private.budget_status(p_scope) $$;
create function public.intel_cache_get(p_fingerprint text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('output', output, 'usage', usage, 'model', model, 'prompt_version', prompt_version, 'cost_micro_usd', cost_micro_usd, 'created_at', created_at)
    from public.intel_inference_cache where fingerprint = p_fingerprint
$$;
create function public.intel_cache_put(p_fingerprint text, p jsonb) returns boolean
language sql security definer set search_path = '' as $$
  insert into public.intel_inference_cache (fingerprint, task, model, prompt_version, output, usage, cost_micro_usd)
    values (p_fingerprint, p ->> 'task', p ->> 'model', p ->> 'prompt_version', p -> 'output', coalesce(p -> 'usage', '{}'::jsonb), coalesce((p ->> 'cost_micro_usd')::bigint, 0))
    on conflict (fingerprint) do nothing
  returning true
$$;
revoke all on function public.intel_budget_reserve(uuid, text, text, int, bigint, text, text), public.intel_budget_settle(bigint, bigint, jsonb),
  public.intel_budget_status(text), public.intel_cache_get(text), public.intel_cache_put(text, jsonb) from public, anon, authenticated;
grant execute on function public.intel_budget_reserve(uuid, text, text, int, bigint, text, text), public.intel_budget_settle(bigint, bigint, jsonb),
  public.intel_budget_status(text), public.intel_cache_get(text), public.intel_cache_put(text, jsonb) to service_role;

-- ---------------------------------------------------------------- the pilot funnel, now from the behavioral log

create function public.pilot_funnel(p_since date default (current_date - 30)) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  with c as (select * from public.pilot_cohort(p_since)),
  ev as (select s.user_id, s.kind as event, s.local_day as day, s.platform from public.household_signals s join c on c.user_id = s.user_id
          where intel_private.product_kind(s.kind) and not s.synthetic),
  hh as (select c.user_id, public.household_id_for(c.user_id) as hid from c),
  firsts as (select user_id, min(day) as first_day from ev where event = 'app_open' group by user_id)
  select jsonb_build_object(
    'since', p_since,
    'accounts_created', (select count(*) from c),
    'onboarding_started', (select count(distinct user_id) from ev where event = 'onboarding_started'),
    'onboarding_completed', (select count(*) from hh where hid is not null),
    'first_meaningful_action', (select count(distinct user_id) from ev where event in ('cleaning_checked', 'plan_added', 'agreement_made')),
    'first_responsibility', (select count(*) from hh where exists (select 1 from public.club_responsibilities r where r.household_id = hh.hid and r.status = 'confirmed')),
    'meeting_started', (select count(distinct user_id) from ev where event = 'meeting_started'),
    'meeting_completed', (select count(distinct user_id) from ev where event = 'meeting_completed'),
    'second_adult_invited', (select count(distinct i.household_id) from public.household_invites i join hh on hh.hid = i.household_id),
    'second_adult_joined', (select count(distinct a.household_id) from public.household_adults a join hh on hh.hid = a.household_id where a.role = 'partner'),
    'returned_day_1', (select count(*) from firsts f where exists (select 1 from ev where ev.user_id = f.user_id and ev.event = 'app_open' and ev.day = f.first_day + 1)),
    'returned_day_7', (select count(*) from firsts f where exists (select 1 from ev where ev.user_id = f.user_id and ev.event = 'app_open' and ev.day between f.first_day + 7 and f.first_day + 13)),
    'returned_day_30', (select count(*) from firsts f where exists (select 1 from ev where ev.user_id = f.user_id and ev.event = 'app_open' and ev.day between f.first_day + 30 and f.first_day + 36)),
    'club_preview_viewed', (select count(distinct user_id) from ev where event = 'club_preview_viewed'),
    'club_trial_started', (select count(distinct s.user_id) from public.club_subscriptions s join c on c.user_id = s.user_id where s.status = 'trialing' or exists (select 1 from public.club_entitlements e where e.user_id = s.user_id and e.source = 'intro')),
    'club_subscribed', (select count(distinct s.user_id) from public.club_subscriptions s join c on c.user_id = s.user_id where s.status in ('active', 'past_due') or exists (select 1 from public.club_invoices i where i.subscription_id = s.id and i.status = 'paid' and i.amount_paid_cents > 0)),
    'feedback_sent', (select count(distinct user_id) from ev where event = 'feedback_sent'),
    'platforms', coalesce((select jsonb_object_agg(platform, n) from (select platform, count(distinct user_id) n from ev group by platform) p), '{}'))
  into r;
  return r;
end $$;
revoke all on function public.pilot_funnel(date) from public, anon;
grant execute on function public.pilot_funnel(date) to authenticated;

-- Retention runs daily where pg_cron exists.
do $$
begin
  if exists (select 1 from pg_catalog.pg_extension where extname = 'pg_cron') and to_regclass('cron.job') is not null then
    perform cron.schedule('omc-intel-prune', '17 3 * * *', 'select intel_private.prune()');
  end if;
end $$;

commit;

-- Rollback (app first; then, only if required):
--   select cron.unschedule(jobid) from cron.job where jobname = 'omc-intel-prune';
--   drop function public.intel_budget_reserve(uuid, text, text, int, bigint, text, text), public.intel_budget_settle(bigint, bigint, jsonb), public.intel_budget_status(text), public.intel_cache_get(text), public.intel_cache_put(text, jsonb);
--   drop function public.calendar_feed_descriptions_store(uuid, jsonb), public.pilot_funnel(date), public.household_intel_erase(uuid), public.household_memory_forget(uuid, uuid),
--     public.household_memory_correct(uuid, uuid, jsonb), public.household_memory_confirm(uuid, jsonb), public.household_memory(uuid),
--     public.household_intel_settings(uuid, jsonb), public.household_signal_log(jsonb);
--   drop schema intel_private cascade;
--   drop table public.intel_inference_cache;
--   drop table public.intel_usage, public.intel_budget_scopes, public.intel_pseudonyms, public.intel_interpretations,
--     public.household_memory_evidence, public.household_memory, public.household_signals, public.intel_member_consent,
--     public.intel_settings;
--   drop table public.calendar_feed_descriptions;
