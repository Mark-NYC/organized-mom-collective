-- Pilot feedback from the app (docs/pilot/ANALYTICS.md): what testers tell us from inside Organized Family, and the
-- cohort the owner's pilot funnel counts. NOT APPLIED in production.
--
-- History: this migration first also created a per-day product event table (app_events, the app_event write and
-- pilot_funnel). That was never applied in production and is RETIRED (2026-11-28, docs/intelligence/STAGE_B_REPORT.md):
-- behavioral observation is consolidated into household_signals (20261216000000_household_intelligence_engine.sql),
-- which also defines the pilot funnel. What remains here is the feedback form and the cohort.
begin;

-- People counted in the funnel: real accounts created in the window (not demo accounts).
create function public.pilot_cohort(p_since date) returns table (user_id uuid, created_on date)
language sql stable security definer set search_path = '' as $$
  -- created_at through to_jsonb: the local test stub of auth.users has no such column (Supabase's has).
  select u.id, (x.created_at at time zone 'utc')::date
    from auth.users u, lateral (select coalesce((to_jsonb(u) ->> 'created_at')::timestamptz, now()) as created_at) x
   where x.created_at >= p_since and lower(u.email) not like '%@example.com'
$$;
revoke execute on function public.pilot_cohort(date) from public, anon, authenticated;

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
