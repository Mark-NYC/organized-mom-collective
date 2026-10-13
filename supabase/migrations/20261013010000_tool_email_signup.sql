-- Download email collection. Requires the existing customer-survey migration.
begin;
create table public.tool_email_contacts (
  email text primary key check (char_length(email) <= 254),
  first_tool text not null,
  last_tool text not null,
  created_at timestamptz not null default now(),
  last_download_request_at timestamptz not null default now(),
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  consent_version text,
  check (not marketing_opt_in or (marketing_opt_in_at is not null and consent_version is not null))
);
alter table public.tool_email_contacts enable row level security;
revoke all on public.tool_email_contacts from anon, authenticated;
grant select on public.tool_email_contacts to authenticated;
create policy "Survey admins read download contacts" on public.tool_email_contacts
  for select to authenticated using ((select public.is_survey_admin()));

create function public.tool_email_signup(p_email text, p_marketing boolean, p_tool text, p_website text default '')
returns text language plpgsql security definer set search_path = '' as $$
declare
  e text := lower(btrim(p_email));
  client_key text;
begin
  if coalesce(p_website, '') <> '' then return 'invalid'; end if;
  if e is null or char_length(e) > 254 or e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_marketing is null or p_tool is distinct from 'chore-chart' then return 'invalid'; end if;
  client_key := public.survey_client_key();
  -- Serialize this IP's rate check to prevent concurrent request races.
  perform pg_advisory_xact_lock(hashtextextended('tool-email:' || client_key, 0));
  if not public.survey_allow(client_key, 'tool_email', 10, interval '1 hour') then return 'rate_limited'; end if;
  insert into public.tool_email_contacts(email, first_tool, last_tool, marketing_opt_in, marketing_opt_in_at, consent_version)
  values (e, p_tool, p_tool, p_marketing, case when p_marketing then now() end, case when p_marketing then 'family-tools-v1' end)
  on conflict(email) do update set
    last_tool = excluded.last_tool,
    last_download_request_at = now(),
    marketing_opt_in = tool_email_contacts.marketing_opt_in or excluded.marketing_opt_in,
    marketing_opt_in_at = coalesce(tool_email_contacts.marketing_opt_in_at, excluded.marketing_opt_in_at),
    consent_version = coalesce(tool_email_contacts.consent_version, excluded.consent_version);
  return 'ok';
end $$;
revoke execute on function public.tool_email_signup(text, boolean, text, text) from public;
grant execute on function public.tool_email_signup(text, boolean, text, text) to anon, authenticated;
commit;
