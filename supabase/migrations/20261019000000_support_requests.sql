-- Customer support requests from the /support form. Requires the customer-survey migration
-- (survey_secret salt + survey_allow throttle). Setup and daily use: supabase/SUPPORT.md.
--
-- Only the support-request Edge Function (service role) writes here. The browser never touches
-- the table: anon and signed-in users have no access at all. The owner reads and updates requests
-- in the Supabase dashboard (Table Editor → support_requests, or the support_open view).
--
-- Kept to what's needed to answer: name, email, optional order number, topic, message. Photos are
-- emailed to the support inbox as an attachment and never stored here. Support contacts are not
-- marketing contacts: nothing here feeds an email list.
begin;

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  -- "OMC-7K3QX9": quoted in both emails so a reply can be matched to the request.
  reference text not null unique check (reference ~ '^OMC-[A-Z0-9]{6}$'),
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'waiting', 'resolved')),
  topic text not null check (topic in ('orders', 'returns', 'damaged', 'calendar', 'companion', 'other')),
  name text not null check (char_length(name) between 1 and 80),
  email text not null check (char_length(email) <= 254),
  order_number text check (char_length(order_number) <= 40),
  message text not null check (char_length(message) between 10 and 4000),
  has_photo boolean not null default false,
  -- The email to the support inbox and the acknowledgment to the customer.
  notify_status text check (notify_status in ('sent', 'failed', 'skipped')),
  ack_status text check (ack_status in ('sent', 'failed', 'skipped', 'limited')),
  -- Owner's own notes and the date it was resolved.
  notes text,
  resolved_at timestamptz
);
create index support_requests_status_idx on public.support_requests (status, created_at);
create index support_requests_email_idx on public.support_requests (email, created_at);

alter table public.support_requests enable row level security;
revoke all on public.support_requests from public, anon, authenticated;

-- Unresolved requests, oldest first: the owner's to-do list.
create view public.support_open with (security_invoker = true) as
  select reference, created_at, status, topic, name, email, order_number, has_photo, notify_status, left(message, 200) as message_start, notes
    from public.support_requests
   where status <> 'resolved'
   order by created_at;
revoke all on public.support_open from public, anon, authenticated;

-- Stamps resolved_at when the owner sets status = 'resolved' (and clears it if reopened).
create function public.support_requests_touch() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved' then new.resolved_at := now();
  elsif new.status <> 'resolved' then new.resolved_at := null;
  end if;
  return new;
end $$;
create trigger support_requests_touch before update on public.support_requests
  for each row execute function public.support_requests_touch();

-- Validates, throttles (5 per connection per hour, 5 per email address per day) and saves a request.
-- Returns {"status": "ok", "id", "reference", "ack": boolean} | {"status": "invalid" | "rate_limited"}.
-- "ack" is false once an address has had 3 acknowledgments today, so the form can't flood an inbox.
create function public.support_submit(
  p_name text, p_email text, p_order text, p_topic text, p_message text, p_has_photo boolean, p_client text, p_website text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e text := lower(btrim(p_email));
  n text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  o text := nullif(btrim(regexp_replace(coalesce(p_order, ''), '\s+', ' ', 'g')), '');
  m text := btrim(coalesce(p_message, ''));
  client_key text;
  ref text;
  new_id uuid;
  today int;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  if coalesce(p_website, '') <> '' then return jsonb_build_object('status', 'invalid'); end if;
  if char_length(n) not between 1 and 80
    or e is null or char_length(e) > 254 or e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(coalesce(o, '')) > 40 or coalesce(o, '') ~ '[<>]'
    or p_topic is null or p_topic not in ('orders', 'returns', 'damaged', 'calendar', 'companion', 'other')
    or char_length(m) not between 10 and 4000 then
    return jsonb_build_object('status', 'invalid');
  end if;

  client_key := encode(extensions.digest(coalesce(p_client, 'unknown') || current_date::text || (select salt from public.survey_secret), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('support:' || client_key, 0));
  perform pg_advisory_xact_lock(hashtextextended('support-email:' || e, 0));
  select count(*) into today from public.support_requests where email = e and created_at > now() - interval '24 hours';
  if today >= 5 or not public.survey_allow(client_key, 'support', 5, interval '1 hour') then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  loop
    ref := 'OMC-';
    for i in 1..6 loop
      ref := ref || substr(alphabet, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.support_requests where reference = ref);
  end loop;

  insert into public.support_requests (reference, topic, name, email, order_number, message, has_photo)
  values (ref, p_topic, n, e, o, m, coalesce(p_has_photo, false))
  returning id into new_id;
  return jsonb_build_object('status', 'ok', 'id', new_id, 'reference', ref, 'ack', today < 3);
end $$;

-- Records what happened to the two emails. p_kind: 'notify' (support inbox) or 'ack' (customer).
create function public.support_email_result(p_id uuid, p_kind text, p_status text)
returns void language sql security definer set search_path = '' as $$
  update public.support_requests
     set notify_status = case when p_kind = 'notify' then p_status else notify_status end,
         ack_status = case when p_kind = 'ack' then p_status else ack_status end
   where id = p_id
     and ((p_kind = 'notify' and p_status in ('sent', 'failed', 'skipped'))
       or (p_kind = 'ack' and p_status in ('sent', 'failed', 'skipped', 'limited')));
$$;

revoke execute on function public.support_submit(text, text, text, text, text, boolean, text, text) from public, anon, authenticated;
revoke execute on function public.support_email_result(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.support_requests_touch() from public, anon, authenticated;
grant execute on function public.support_submit(text, text, text, text, text, boolean, text, text) to service_role;
grant execute on function public.support_email_result(uuid, text, text) to service_role;
grant select, update on public.support_requests to service_role;
grant select on public.support_open to service_role;
commit;
