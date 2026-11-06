-- Shared email capture for free generators and guide PDFs.
-- V1 stays in place for existing clients. Deploy this migration BEFORE enabling the new frontend.
begin;
alter table public.tool_email_contacts
  add column if not exists first_utm_source text,
  add column if not exists first_utm_medium text,
  add column if not exists first_utm_campaign text,
  add column if not exists first_utm_content text;

create or replace function public.tool_email_signup_v2(
  p_email text, p_marketing boolean, p_tool text, p_website text default '',
  p_source text default '', p_medium text default '', p_campaign text default '', p_content text default ''
) returns text language plpgsql security definer set search_path = '' as $$
declare
  e text := lower(btrim(p_email));
  client_key text;
begin
  if coalesce(p_website, '') <> '' then return 'invalid'; end if;
  if e is null or char_length(e) > 254 or e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_marketing is null or p_tool is null or char_length(p_tool) > 90
    or p_tool !~ '^(chore-chart|responsibility-chart|routine-chart|planner|pantry|try-the-calendar|back-to-school-checklist|screen-time-contract|homeschool-rhythm|laundry-system|closet-reset|lunch-and-snack-station|command-center-setup|travel-checklist|fall-pantry-stock-up|gratitude-tracker|holiday-gift-planner|mental-load-worksheet|meal-planner|december-countdown|thanksgiving-plan|guide-[a-z0-9-]{1,60})$'
    or greatest(char_length(coalesce(p_source,'')), char_length(coalesce(p_medium,'')), char_length(coalesce(p_campaign,'')), char_length(coalesce(p_content,''))) > 160
  then return 'invalid'; end if;
  client_key := public.survey_client_key();
  perform pg_advisory_xact_lock(hashtextextended('tool-email:' || client_key, 0));
  if not public.survey_allow(client_key, 'tool_email', 10, interval '1 hour') then return 'rate_limited'; end if;
  insert into public.tool_email_contacts(
    email, first_tool, last_tool, marketing_opt_in, marketing_opt_in_at, consent_version,
    first_utm_source, first_utm_medium, first_utm_campaign, first_utm_content
  ) values (
    e, p_tool, p_tool, p_marketing, case when p_marketing then now() end,
    case when p_marketing then 'family-tools-v1' end,
    nullif(p_source,''), nullif(p_medium,''), nullif(p_campaign,''), nullif(p_content,'')
  )
  on conflict (email) do update set
    last_tool = excluded.last_tool,
    last_download_request_at = now(),
    -- A download without opt-in never silently re-subscribes an opted-out contact.
    marketing_opt_in = public.tool_email_contacts.marketing_opt_in or excluded.marketing_opt_in,
    marketing_opt_in_at = case when excluded.marketing_opt_in and not public.tool_email_contacts.marketing_opt_in then now() else public.tool_email_contacts.marketing_opt_in_at end,
    consent_version = case when excluded.marketing_opt_in then 'family-tools-v1' else public.tool_email_contacts.consent_version end,
    first_utm_source = coalesce(public.tool_email_contacts.first_utm_source, excluded.first_utm_source),
    first_utm_medium = coalesce(public.tool_email_contacts.first_utm_medium, excluded.first_utm_medium),
    first_utm_campaign = coalesce(public.tool_email_contacts.first_utm_campaign, excluded.first_utm_campaign),
    first_utm_content = coalesce(public.tool_email_contacts.first_utm_content, excluded.first_utm_content);
  return 'ok';
end $$;
revoke execute on function public.tool_email_signup_v2(text,boolean,text,text,text,text,text,text) from public;
grant execute on function public.tool_email_signup_v2(text,boolean,text,text,text,text,text,text) to anon, authenticated;
commit;
