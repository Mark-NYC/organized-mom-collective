-- Sanity Saver Starter Kit signup (/starter-kit). Requires the tool email migration
-- (20261013010000_tool_email_signup.sql) and the customer-survey migration (salt + throttle).
--
-- Contacts share tool_email_contacts with the chore chart gate. Marketing consent works the same
-- way: optional, never set by default, and an unchecked box on a later signup never removes an
-- earlier yes (unsubscribes go through the sending provider once campaigns exist).
--
-- Only the starter-kit-signup Edge Function calls these (service role). It sends at most one
-- kit email per address per 24 hours, so the form can't be used to flood someone's inbox.
begin;

alter table public.tool_email_contacts
  add column starter_kit_requested_at timestamptz,
  add column starter_kit_email_claimed_at timestamptz,
  add column starter_kit_email_status text check (starter_kit_email_status in ('sent', 'failed', 'skipped')),
  add column starter_kit_email_id text;

-- Returns {"status": "ok" | "invalid" | "rate_limited", "send": boolean}.
create function public.starter_kit_signup(p_email text, p_marketing boolean, p_client text, p_website text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e text := lower(btrim(p_email));
  client_key text;
  claimed boolean;
begin
  if coalesce(p_website, '') <> '' then return jsonb_build_object('status', 'invalid', 'send', false); end if;
  if e is null or char_length(e) > 254 or e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_marketing is null then
    return jsonb_build_object('status', 'invalid', 'send', false);
  end if;
  client_key := encode(extensions.digest(coalesce(p_client, 'unknown') || current_date::text || (select salt from public.survey_secret), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('starter-kit:' || client_key, 0));
  if not public.survey_allow(client_key, 'starter_kit', 10, interval '1 hour') then
    return jsonb_build_object('status', 'rate_limited', 'send', false);
  end if;

  insert into public.tool_email_contacts(email, first_tool, last_tool, marketing_opt_in, marketing_opt_in_at, consent_version, starter_kit_requested_at)
  values (e, 'starter-kit', 'starter-kit', p_marketing, case when p_marketing then now() end, case when p_marketing then 'starter-kit-v1' end, now())
  on conflict(email) do update set
    last_tool = 'starter-kit',
    last_download_request_at = now(),
    starter_kit_requested_at = now(),
    marketing_opt_in = tool_email_contacts.marketing_opt_in or excluded.marketing_opt_in,
    marketing_opt_in_at = coalesce(tool_email_contacts.marketing_opt_in_at, excluded.marketing_opt_in_at),
    consent_version = coalesce(tool_email_contacts.consent_version, excluded.consent_version);

  -- Claim the kit email: once per address per 24 hours.
  update public.tool_email_contacts set starter_kit_email_claimed_at = now(), starter_kit_email_status = null, starter_kit_email_id = null
   where email = e and (starter_kit_email_claimed_at is null or starter_kit_email_claimed_at < now() - interval '24 hours')
  returning true into claimed;
  return jsonb_build_object('status', 'ok', 'send', coalesce(claimed, false));
end $$;

-- Records what happened to the kit email. A failed or skipped send releases the claim, so a retry can send.
create function public.starter_kit_email_result(p_email text, p_status text, p_provider_id text default null)
returns void language sql security definer set search_path = '' as $$
  update public.tool_email_contacts
     set starter_kit_email_status = p_status,
         starter_kit_email_id = left(p_provider_id, 200),
         starter_kit_email_claimed_at = case when p_status = 'sent' then starter_kit_email_claimed_at end
   where email = lower(btrim(p_email)) and p_status in ('sent', 'failed', 'skipped');
$$;

revoke execute on function public.starter_kit_signup(text, boolean, text, text) from public, anon, authenticated;
revoke execute on function public.starter_kit_email_result(text, text, text) from public, anon, authenticated;
grant execute on function public.starter_kit_signup(text, boolean, text, text) to service_role;
grant execute on function public.starter_kit_email_result(text, text, text) to service_role;
commit;
