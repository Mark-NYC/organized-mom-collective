-- Pilot measurement (docs/pilot/ANALYTICS.md): the few product moments that the app's own tables can't answer, and an
-- owner-only funnel that combines them with what the tables already know. Privacy first:
--   - An event is ONE allowlisted name per signed-in person per day (no counts, no props, no free text, no household
--     id, no children, no agreement words). Anonymous phone-only use isn't measured at all.
--   - Everything else in the funnel comes from existing tables, read in aggregate: accounts, households, the first
--     agreement, invitations sent and accepted, Club trials and subscriptions. Demo accounts (@example.com) are left out.
--   - Families can write their own events only (app_event, signed in) and read nothing; only an owner admin reads the
--     funnel, as numbers.
-- Additive: one new table and three functions. Nothing existing changes. NOT APPLIED: needs the owner's approval.
begin;

create table public.app_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  event text not null check (event in (
    'app_open',               -- opened Organized Family (once a day: day 1 / 7 / 30 return)
    'onboarding_started',     -- saw family setup with no family yet
    'onboarding_completed',   -- saved the family for the first time
    'cleaning_checked',       -- checked a cleaning task (a first meaningful action)
    'plan_added',             -- added a plan to the family calendar (a first meaningful action)
    'agreement_made',         -- the family agreed on a responsibility (a first meaningful action)
    'meeting_started',        -- moved past the first part of the weekly Family Meeting
    'meeting_completed',      -- tapped "Finish meeting"
    'club_preview_viewed',    -- saw the Club preview without having the Club
    'feedback_sent')),        -- sent pilot feedback from the app
  platform text not null check (platform in ('web', 'ios')),
  day date not null,
  at timestamptz not null default now(),
  primary key (user_id, event, day)
);
create index app_events_event_day on public.app_events (event, day);
alter table public.app_events enable row level security;
revoke all on public.app_events from public, anon, authenticated;

-- The app's only write: this person, this event, today (the first time today; repeats are ignored).
create function public.app_event(p_event text, p_platform text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.app_events (user_id, event, platform, day)
  values (auth.uid(), p_event, case when p_platform = 'ios' then 'ios' else 'web' end, (now() at time zone 'utc')::date)
  on conflict do nothing;
exception when check_violation then
  raise exception 'invalid';
end $$;
revoke execute on function public.app_event(text, text) from public, anon;
grant execute on function public.app_event(text, text) to authenticated;

-- People counted in the funnel: real accounts created in the window (not demo accounts).
create function public.pilot_cohort(p_since date) returns table (user_id uuid, created_on date)
language sql stable security definer set search_path = '' as $$
  -- created_at through to_jsonb: the local test stub of auth.users has no such column (Supabase's has).
  select u.id, (x.created_at at time zone 'utc')::date
    from auth.users u, lateral (select coalesce((to_jsonb(u) ->> 'created_at')::timestamptz, now()) as created_at) x
   where x.created_at >= p_since and lower(u.email) not like '%@example.com'
$$;
revoke execute on function public.pilot_cohort(date) from public, anon, authenticated;

-- The owner's pilot funnel since a date: numbers only, never a person.
create function public.pilot_funnel(p_since date default (current_date - 30)) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  with c as (select * from public.pilot_cohort(p_since)),
  ev as (select e.* from public.app_events e join c on c.user_id = e.user_id),
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
revoke execute on function public.pilot_funnel(date) from public, anon;
grant execute on function public.pilot_funnel(date) to authenticated;

-- ---------------------------------------------------------------- pilot feedback from the app

-- "Something's confusing / broken / an idea" from a signed-in grown-up, saved as an ordinary support request (topic
-- 'companion') so it sits with the rest of support. It works from the iPhone app too (the support Edge Function only
-- answers the website's origin). The app adds only where it was sent from (screen path, platform, width); nothing
-- about the family. No email is sent: the owner reads it in Admin → Club → Pilot (and support_open).
create function public.app_feedback(p_kind text, p_message text, p_screen text, p_platform text, p_width int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  e text;
  m text := btrim(coalesce(p_message, ''));
  screen text := coalesce(nullif(btrim(p_screen), ''), '/app');
  who text;
  ref text;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if p_kind not in ('confusing', 'broken', 'idea') or char_length(m) not between 10 and 3800
     or screen !~ '^/[a-z0-9/_-]{0,79}$' or p_platform not in ('web', 'ios') or p_width not between 200 and 4000 then
    raise exception 'invalid';
  end if;
  select lower(email) into e from auth.users where id = uid;
  if e is null then raise exception 'not_signed_in'; end if;
  perform pg_advisory_xact_lock(hashtextextended('app-feedback:' || uid::text, 0));
  if (select count(*) from public.support_requests where email = e and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'rate_limited';
  end if;
  select coalesce((select m2.first_name from public.club_family_members m2
                    where m2.household_id = public.household_id_for(uid) and m2.kind = 'adult' and m2.is_account_holder limit 1), 'Organized Family')
    into who;
  loop
    ref := 'OMC-';
    for i in 1..6 loop
      ref := ref || substr(alphabet, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.support_requests where reference = ref);
  end loop;
  insert into public.support_requests (reference, topic, name, email, message, notify_status, ack_status)
  values (ref, 'companion', left(who, 80), e,
          format('[Pilot · %s · %s · %s · %spx] %s', p_kind, screen, p_platform, p_width, m), 'skipped', 'skipped');
  insert into public.app_events (user_id, event, platform, day)
  values (uid, 'feedback_sent', p_platform, (now() at time zone 'utc')::date) on conflict do nothing;
  return jsonb_build_object('reference', ref);
end $$;
revoke execute on function public.app_feedback(text, text, text, text, int) from public, anon;
grant execute on function public.app_feedback(text, text, text, text, int) to authenticated;

-- The owner's pilot feedback: newest first, with where it came from.
create function public.pilot_feedback(p_since date default (current_date - 30)) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'reference', r.reference, 'at', r.created_at, 'status', r.status, 'email', r.email,
      'kind', x[1], 'screen', x[2], 'platform', x[3], 'width', x[4], 'message', left(x[5], 600)) order by r.created_at desc)
    from public.support_requests r,
         lateral (select regexp_match(r.message, '^\[Pilot · ([a-z]+) · ([^ ]+) · ([a-z]+) · ([0-9]+)px\] (.*)$', 's') as x) m(x)
   where r.topic = 'companion' and r.created_at >= p_since and m.x is not null
     and lower(r.email) not like '%@example.com'), '[]');
end $$;
revoke execute on function public.pilot_feedback(date) from public, anon;
grant execute on function public.pilot_feedback(date) to authenticated;

commit;
