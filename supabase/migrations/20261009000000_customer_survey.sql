-- Customer discovery survey (/survey) and its admin view (/survey/admin).
--
-- Security model
--   * The site only ever holds the public anon (publishable) key.
--   * anon can't read or write any table. It can call two functions:
--       survey_track(session, step)   – progress beacon (starts + drop-off)
--       survey_submit(session, ...)   – the finished response
--     Both validate their input and rate-limit by a salted hash of the caller's IP.
--   * Reading responses needs a signed-in Supabase Auth user listed in survey_admins.
--     Add one in the SQL editor:
--       insert into public.survey_admins (user_id)
--       select id from auth.users where email = 'you@example.com';
--
-- Steps: 0 = saw the intro, 1–7 = reached question 1–7, 8 = submitted.
-- Answer ids and sources must match src/data/survey.ts (tests/survey.test.ts checks).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables

create table public.survey_sessions (
  id uuid primary key,
  survey text not null default 'discovery-2026',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  furthest_step smallint not null default 0 check (furthest_step between 0 and 8),
  completed_at timestamptz,
  -- Where the link was shared (?source=). Unknown values are stored as 'other'.
  source text not null default 'direct' check (source in ('website','instagram','customer-insert','direct','other'))
);
create index survey_sessions_created_at on public.survey_sessions (created_at);

create table public.survey_responses (
  session_id uuid primary key references public.survey_sessions (id) on delete cascade,
  survey text not null default 'discovery-2026',
  created_at timestamptz not null default now(),
  q1 text[] not null,
  q2 text not null,
  q3 text[] not null,
  q4 text not null,
  q5 text not null,
  q6 text not null,
  q7 text check (char_length(q7) <= 1000),
  -- Optional "Something else" text, kept only when that option was picked.
  q1_other text check (char_length(q1_other) <= 200),
  q2_other text check (char_length(q2_other) <= 200),
  q3_other text check (char_length(q3_other) <= 200),
  q5_other text check (char_length(q5_other) <= 200),
  q6_other text check (char_length(q6_other) <= 200),
  source text not null default 'direct' check (source in ('website','instagram','customer-insert','direct','other')),
  duration_seconds integer
);
create index survey_responses_created_at on public.survey_responses (created_at);

-- Admins: Supabase Auth users allowed to read responses.
create table public.survey_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Rate-limit ledger. Holds only a salted, daily-rotating hash; never readable through the API.
create table public.survey_throttle (
  key text not null,
  kind text not null,
  at timestamptz not null default now()
);
create index survey_throttle_lookup on public.survey_throttle (key, kind, at);

-- Salt for the IP hash. Generated once; never exposed.
create table public.survey_secret (
  id boolean primary key default true check (id),
  salt text not null default encode(extensions.gen_random_bytes(32), 'hex')
);
insert into public.survey_secret default values;

alter table public.survey_sessions enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_admins enable row level security;
alter table public.survey_throttle enable row level security;
alter table public.survey_secret enable row level security;

revoke all on public.survey_sessions, public.survey_responses, public.survey_admins,
  public.survey_throttle, public.survey_secret from anon, authenticated;

-- ---------------------------------------------------------------- admin read access

create function public.is_survey_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.survey_admins where user_id = auth.uid());
$$;
revoke execute on function public.is_survey_admin() from public, anon;
grant execute on function public.is_survey_admin() to authenticated;

grant select on public.survey_sessions, public.survey_responses to authenticated;
create policy "Survey admins read sessions" on public.survey_sessions
  for select to authenticated using ((select public.is_survey_admin()));
create policy "Survey admins read responses" on public.survey_responses
  for select to authenticated using ((select public.is_survey_admin()));

-- ---------------------------------------------------------------- helpers (not callable via the API)

-- Returns false once `key` has made `max_count` calls of `kind` in `window`; otherwise records this one.
create function public.survey_allow(key text, kind text, max_count int, win interval) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.survey_throttle t
      where t.key = survey_allow.key and t.kind = survey_allow.kind and t.at > now() - win) >= max_count then
    return false;
  end if;
  insert into public.survey_throttle (key, kind) values (survey_allow.key, survey_allow.kind);
  -- Keep the ledger small.
  if random() < 0.02 then
    delete from public.survey_throttle where at < now() - interval '2 days';
  end if;
  return true;
end $$;

-- Salted hash of the caller's IP (Supabase forwards it in request.headers), rotated daily.
create function public.survey_client_key() returns text
language sql stable security definer set search_path = '' as $$
  select encode(extensions.digest(
    coalesce(
      split_part(coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-forwarded-for', ',', 1),
      coalesce(current_setting('request.headers', true), '{}')::json ->> 'cf-connecting-ip',
      'unknown'
    ) || current_date::text || (select salt from public.survey_secret),
    'sha256'), 'hex');
$$;

-- Allowed answer ids per question (keep in sync with src/data/survey.ts).
create function public.survey_allowed(q text) returns text[]
language sql immutable set search_path = '' as $$
  select case q
    when 'q1' then array['paper','digital_calendar','school_sports_apps','phone_notes','in_my_head','other']
    when 'q2' then array['phone_calendar','paper_calendar','save_flag','remember','share','other']
    when 'q3' then array['email','text','school_apps','team_apps','paper','other','na']
    when 'q4' then array['every_week','most_weeks','occasionally','rarely']
    when 'q5' then array['routine','app','as_noticed','weekends','someone_else','other']
    when 'q6' then array['tracking','messages','cleaning','planning','last_minute','other']
  end;
$$;

-- ?source= values; anything else becomes 'other', nothing becomes 'direct'.
create function public.survey_source(raw text) returns text
language sql immutable set search_path = '' as $$
  select case
    when nullif(btrim(coalesce(raw, '')), '') is null then 'direct'
    when lower(btrim(raw)) = any (array['website','instagram','customer-insert','direct','other']) then lower(btrim(raw))
    else 'other'
  end;
$$;

revoke execute on function public.survey_allow(text, text, int, interval) from public, anon, authenticated;
revoke execute on function public.survey_client_key() from public, anon, authenticated;
revoke execute on function public.survey_allowed(text) from public, anon, authenticated;
revoke execute on function public.survey_source(text) from public, anon, authenticated;

-- ---------------------------------------------------------------- public API

-- Progress beacon: records how far a visit got. Never moves backwards; ignored after submit.
create function public.survey_track(p_session uuid, p_step int, p_source text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  exists_already boolean;
begin
  if p_session is null or p_step is null or p_step < 0 or p_step > 7 then
    return;
  end if;
  select true into exists_already from public.survey_sessions where id = p_session;
  if exists_already then
    update public.survey_sessions
       set furthest_step = greatest(furthest_step, p_step), updated_at = now()
     where id = p_session and completed_at is null and furthest_step < p_step;
  elsif public.survey_allow(public.survey_client_key(), 'session', 60, interval '1 hour') then
    insert into public.survey_sessions (id, furthest_step, source)
    values (p_session, p_step, public.survey_source(left(p_source, 64)))
    on conflict (id) do nothing;
  end if;
end $$;

-- The finished response. Returns 'ok' (also for a repeat of the same session, and,
-- silently, for spam so bots learn nothing) or 'rate_limited' / 'invalid'.
create function public.survey_submit(p_session uuid, p_answers jsonb, p_website text default '', p_source text default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  s public.survey_sessions%rowtype;
  had_session boolean;
  q1 text[]; q3 text[];
  q7 text;
  q text;
  other jsonb := '{}';
  other_text text;
  src text;
begin
  if p_session is null or p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    return 'invalid';
  end if;

  -- Honeypot: a hidden field people never see.
  if coalesce(p_website, '') <> '' then
    return 'ok';
  end if;

  select * into s from public.survey_sessions where id = p_session;
  had_session := found;
  if had_session and s.completed_at is not null then
    return 'ok'; -- duplicate submit (double tap, retry): already saved
  end if;
  -- Six questions in under 6 seconds isn't a person.
  if had_session and now() - s.created_at < interval '6 seconds' then
    return 'ok';
  end if;

  -- Validate answers.
  if coalesce(jsonb_typeof(p_answers -> 'q1'), '') <> 'array' or coalesce(jsonb_typeof(p_answers -> 'q3'), '') <> 'array' then
    return 'invalid';
  end if;
  select coalesce(array_agg(distinct v), '{}') into q1 from jsonb_array_elements_text(p_answers -> 'q1') v;
  select coalesce(array_agg(distinct v), '{}') into q3 from jsonb_array_elements_text(p_answers -> 'q3') v;
  if cardinality(q1) = 0 or not q1 <@ public.survey_allowed('q1')
     or cardinality(q3) = 0 or not q3 <@ public.survey_allowed('q3')
     or ('na' = any (q3) and cardinality(q3) > 1) then
    return 'invalid';
  end if;
  foreach q in array array['q2','q4','q5','q6'] loop
    if coalesce(jsonb_typeof(p_answers -> q), '') <> 'string' or not coalesce((p_answers ->> q) = any (public.survey_allowed(q)), false) then
      return 'invalid';
    end if;
  end loop;
  q7 := nullif(btrim(coalesce(p_answers ->> 'q7', '')), '');
  if char_length(q7) > 1000 then
    return 'invalid';
  end if;

  -- "Something else" text: optional, short, and kept only if that option was picked.
  foreach q in array array['q1','q2','q3','q5','q6'] loop
    if p_answers ? (q || '_other') and coalesce(jsonb_typeof(p_answers -> (q || '_other')), '') not in ('string', 'null') then
      return 'invalid';
    end if;
    other_text := nullif(btrim(coalesce(p_answers ->> (q || '_other'), '')), '');
    if char_length(other_text) > 200 then
      return 'invalid';
    end if;
    if other_text is not null and (
      (q in ('q1','q3') and 'other' = any (case q when 'q1' then q1 else q3 end))
      or (q not in ('q1','q3') and p_answers ->> q = 'other')
    ) then
      other := other || jsonb_build_object(q, other_text);
    end if;
  end loop;

  -- The session's source wins (it was recorded at the start); else what was sent now.
  src := coalesce(s.source, public.survey_source(left(p_source, 64)));

  if not public.survey_allow(public.survey_client_key(), 'submit', 5, interval '1 day') then
    return 'rate_limited';
  end if;

  if not had_session then
    -- The start beacon never arrived (flaky signal); keep the response anyway.
    insert into public.survey_sessions (id, furthest_step, source) values (p_session, 7, src)
    on conflict (id) do nothing;
  end if;

  insert into public.survey_responses
    (session_id, q1, q2, q3, q4, q5, q6, q7, q1_other, q2_other, q3_other, q5_other, q6_other, source, duration_seconds)
  values (
    p_session, q1, p_answers ->> 'q2', q3, p_answers ->> 'q4', p_answers ->> 'q5', p_answers ->> 'q6', q7,
    other ->> 'q1', other ->> 'q2', other ->> 'q3', other ->> 'q5', other ->> 'q6', src,
    case when s.created_at is not null then extract(epoch from now() - s.created_at)::int end
  )
  on conflict (session_id) do nothing;

  update public.survey_sessions
     set furthest_step = 8, completed_at = coalesce(completed_at, now()), updated_at = now()
   where id = p_session;
  return 'ok';
end $$;

revoke execute on function public.survey_track(uuid, int, text) from public;
revoke execute on function public.survey_submit(uuid, jsonb, text, text) from public;
grant execute on function public.survey_track(uuid, int, text) to anon, authenticated;
grant execute on function public.survey_submit(uuid, jsonb, text, text) to anon, authenticated;
