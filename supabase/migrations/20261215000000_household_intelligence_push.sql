-- V20 in production (docs/ios/V20_LAUNCH.md): the household's intelligence state, Web Push subscriptions and the
-- notification queue. Additive only: nothing existing is altered, so the previous app ignores all of it and a rollback
-- is `drop` of these objects (see the end of this file).
--
-- 1. household_intelligence  one JSON document per household (memory, feedback, reports, completion history, what was
--    shown, meeting topics, claims, notification preferences, V20 part details). Written with the revision the device
--    last saw; a stale write gets the current copy back and the device merges (src/lib/v20/intel-sync.ts).
--    It never holds private calendar text: only keys, fingerprints and the family's own words.
-- 2. household_push_subscriptions  one row per browser/device that turned notifications on, for its signed-in adult.
-- 3. household_notifications  the queue: one row per (household, dedupe key), so two phones computing the same
--    notification insert it once. A scheduled dispatcher hands due rows to the push-delivery Edge Function by token.

-- ------------------------------------------------------------------ 1. intelligence state
create table public.household_intelligence (
  household_id uuid primary key references public.club_households (id) on delete cascade,
  revision bigint not null default 0,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.household_intelligence enable row level security;
revoke all on public.household_intelligence from public, anon, authenticated;

create function public.household_intelligence(p_household uuid, p_base bigint default null, p_state jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  hid uuid := public.household_id_for(auth.uid());
  r public.household_intelligence;
begin
  if hid is null or hid is distinct from p_household then raise exception 'no_household'; end if;
  if p_state is not null then
    if jsonb_typeof(p_state) <> 'object' or pg_column_size(p_state) > 262144 or p_base is null or p_base < 0 then
      raise exception 'invalid_state';
    end if;
    perform 1 from public.club_households where id = hid for update;
    select * into r from public.household_intelligence where household_id = hid;
    if coalesce(r.revision, 0) <> p_base then
      return jsonb_build_object('conflict', true, 'revision', coalesce(r.revision, 0), 'state', coalesce(r.state, '{}'::jsonb));
    end if;
    insert into public.household_intelligence as cur (household_id, revision, state, updated_at)
      values (hid, 1, p_state, now())
      on conflict (household_id) do update set revision = cur.revision + 1, state = excluded.state, updated_at = now();
  end if;
  select * into r from public.household_intelligence where household_id = hid;
  return jsonb_build_object('conflict', false, 'revision', coalesce(r.revision, 0), 'state', coalesce(r.state, '{}'::jsonb));
end $$;
revoke all on function public.household_intelligence(uuid, bigint, jsonb) from public, anon;
grant execute on function public.household_intelligence(uuid, bigint, jsonb) to authenticated;

-- ------------------------------------------------------------------ 2. push subscriptions (Web Push)
create table public.household_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.club_households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid references public.club_family_members (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 40 and 200),
  auth text not null check (char_length(auth) between 10 and 100),
  created_at timestamptz not null default now(),
  last_sent_at timestamptz,
  failures integer not null default 0
);
create index household_push_subscriptions_member on public.household_push_subscriptions (household_id, member_id);
alter table public.household_push_subscriptions enable row level security;
revoke all on public.household_push_subscriptions from public, anon, authenticated;

-- Subscribe this device for the signed-in adult (re-subscribing moves the endpoint to this adult).
create function public.household_push_subscribe(p_endpoint text, p_p256dh text, p_auth text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.household_adults;
begin
  select * into a from public.household_adults where user_id = auth.uid();
  if a.household_id is null then raise exception 'no_household'; end if;
  if (select count(*) from public.household_push_subscriptions where user_id = auth.uid()) >= 10
     and not exists (select 1 from public.household_push_subscriptions where endpoint = p_endpoint) then
    raise exception 'too_many_devices';
  end if;
  insert into public.household_push_subscriptions as s (household_id, user_id, member_id, endpoint, p256dh, auth)
    values (a.household_id, a.user_id, a.member_id, p_endpoint, p_p256dh, p_auth)
    on conflict (endpoint) do update set household_id = excluded.household_id, user_id = excluded.user_id,
      member_id = excluded.member_id, p256dh = excluded.p256dh, auth = excluded.auth, failures = 0;
  return jsonb_build_object('ok', true, 'member_id', a.member_id);
end $$;
create function public.household_push_unsubscribe(p_endpoint text)
returns boolean language sql security definer set search_path = '' as $$
  with d as (delete from public.household_push_subscriptions where endpoint = p_endpoint and user_id = auth.uid() returning 1)
  select exists (select 1 from d)
$$;
-- How many of the signed-in adult's devices can receive notifications (Account shows it).
create function public.household_push_devices()
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.household_push_subscriptions where user_id = auth.uid()
$$;
revoke all on function public.household_push_subscribe(text, text, text), public.household_push_unsubscribe(text), public.household_push_devices() from public, anon;
grant execute on function public.household_push_subscribe(text, text, text), public.household_push_unsubscribe(text), public.household_push_devices() to authenticated;

-- ------------------------------------------------------------------ 3. the notification queue
create table public.household_notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.club_households (id) on delete cascade,
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 300),
  to_member uuid not null references public.club_family_members (id) on delete cascade,
  purpose text not null check (purpose in ('needs-you', 'changed', 'handled', 'meeting')),
  kind text not null check (kind in ('help', 'handoff', 'conflict', 'agreement', 'handled', 'declined', 'meeting')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 240),
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 2048),
  deliver_after timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued', 'sent', 'no_device', 'failed', 'cancelled')),
  dispatch_token text,
  dispatch_attempts integer not null default 0,
  last_dispatched_at timestamptz,
  sent_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (household_id, dedupe_key)
);
create index household_notifications_due on public.household_notifications (status, deliver_after);
alter table public.household_notifications enable row level security;
revoke all on public.household_notifications from public, anon, authenticated;

create schema if not exists push_private;
revoke all on schema push_private from public, anon, authenticated;

-- Hand due notifications to the Edge Function (by token, like the email workers). Optionally one household only.
create function push_private.dispatch(p_household uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0; v_token text;
begin
  if not exists (select 1 from pg_catalog.pg_extension where extname = 'pg_net') then return 0; end if;
  -- Nobody to deliver to (the adult has no device with notifications on): settle it, never retry forever.
  update public.household_notifications q set status = 'no_device'
   where q.status = 'queued' and q.deliver_after <= now() and (p_household is null or q.household_id = p_household)
     and not exists (select 1 from public.household_push_subscriptions s where s.household_id = q.household_id and s.member_id = q.to_member);
  update public.household_notifications set status = 'failed'
   where status = 'queued' and dispatch_attempts >= 5;
  update public.household_notifications set status = 'cancelled'
   where status = 'queued' and deliver_after < now() - interval '2 days';
  for r in
    select id from public.household_notifications
     where status = 'queued' and deliver_after <= now() and dispatch_attempts < 5
       and (p_household is null or household_id = p_household)
       and (last_dispatched_at is null or last_dispatched_at <= now() - interval '2 minutes')
     order by deliver_after limit 50 for update skip locked
  loop
    v_token := replace(pg_catalog.gen_random_uuid()::text, '-', '') || replace(pg_catalog.gen_random_uuid()::text, '-', '');
    update public.household_notifications
       set dispatch_token = v_token, dispatch_attempts = dispatch_attempts + 1, last_dispatched_at = now() where id = r.id;
    execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 8000)'
      using 'https://uvqhmlqwmgnohhduttip.supabase.co/functions/v1/push-delivery',
            pg_catalog.jsonb_build_object('token', v_token), '{"Content-Type":"application/json"}'::jsonb;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function push_private.dispatch(uuid) from public, anon, authenticated;

-- A device queues what the household's rules decided (src/lib/v20/notify.ts). The database checks it is about this
-- household, to one of its adults, within limits; the same key twice is the same notification.
create function public.household_notify(p_household uuid, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  hid uuid := public.household_id_for(auth.uid());
  it jsonb; added integer := 0; v_to uuid; v_after timestamptz;
begin
  if hid is null or hid is distinct from p_household then raise exception 'no_household'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 20 then raise exception 'invalid_items'; end if;
  if (select count(*) from public.household_notifications where household_id = hid and created_at > now() - interval '1 day') > 200 then
    raise exception 'too_many';
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    v_to := (it->>'to')::uuid;
    -- Only adults of this household who have their own sign-in receive notifications.
    if not exists (select 1 from public.household_adults a where a.household_id = hid and a.member_id = v_to) then continue; end if;
    v_after := coalesce((it->>'deliver_after')::timestamptz, now());
    if v_after > now() + interval '8 days' then continue; end if;
    insert into public.household_notifications (household_id, dedupe_key, to_member, purpose, kind, title, body, data, deliver_after, created_by)
      values (hid, it->>'key', v_to, it->>'purpose', it->>'kind', left(it->>'title', 120), left(coalesce(it->>'body', ''), 240),
              coalesce(it->'data', '{}'::jsonb), v_after, auth.uid())
      on conflict (household_id, dedupe_key) do nothing;
    if found then added := added + 1; end if;
  end loop;
  if added > 0 then perform push_private.dispatch(hid); end if;
  return jsonb_build_object('added', added);
end $$;
revoke all on function public.household_notify(uuid, jsonb) from public, anon;
grant execute on function public.household_notify(uuid, jsonb) to authenticated;

-- What a notification tapped on this adult's phone was about (for "I've got it" when the app opens).
create function public.household_notification(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', n.id, 'kind', n.kind, 'purpose', n.purpose, 'title', n.title, 'body', n.body, 'data', n.data, 'to', n.to_member)
    from public.household_notifications n
    join public.household_adults a on a.household_id = n.household_id and a.member_id = n.to_member
   where n.id = p_id and a.user_id = auth.uid()
$$;
revoke all on function public.household_notification(uuid) from public, anon;
grant execute on function public.household_notification(uuid) to authenticated;

-- Held (quiet hours) and scheduled (meeting reminder) notifications go out on time.
do $$
begin
  if exists (select 1 from pg_catalog.pg_extension where extname = 'pg_cron') then
    perform cron.schedule('omc-household-push-dispatch', '* * * * *', 'select push_private.dispatch()');
  end if;
end $$;

-- Rollback (app first, then data):
--   select cron.unschedule('omc-household-push-dispatch');
--   drop function public.household_notification(uuid), public.household_notify(uuid, jsonb), push_private.dispatch(uuid),
--     public.household_push_devices(), public.household_push_unsubscribe(text), public.household_push_subscribe(text, text, text),
--     public.household_intelligence(uuid, bigint, jsonb);
--   drop table public.household_notifications, public.household_push_subscriptions, public.household_intelligence;
--   drop schema push_private;
