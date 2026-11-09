-- Email marketing foundation. Supabase retains consent and permanent suppression.
-- Apply before deploying the Resend webhook or contact sync.
begin;

create table if not exists public.marketing_suppressions (
  email text primary key check (email = lower(btrim(email)) and length(email) <= 254),
  reason text not null check (reason in ('unsubscribed','complained','bounced','manual')),
  created_at timestamptz not null default now()
);
alter table public.marketing_suppressions enable row level security;
revoke all on public.marketing_suppressions from public, anon, authenticated;

-- Covers ALL existing signup RPCs (tool_email_signup, v2, starter_kit_signup).
-- A later checked box can never override an explicit unsubscribe or suppression.
create or replace function public.marketing_enforce_suppression()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.email := lower(btrim(new.email));
  if exists (select 1 from public.marketing_suppressions s where s.email = new.email) then
    new.marketing_opt_in := false;
    new.marketing_opt_in_at := null;
  end if;
  return new;
end $$;
revoke all on function public.marketing_enforce_suppression() from public, anon, authenticated;
drop trigger if exists marketing_suppression_guard on public.tool_email_contacts;
create trigger marketing_suppression_guard
before insert or update on public.tool_email_contacts
for each row execute function public.marketing_enforce_suppression();

-- Invoked ONLY by the verified Resend webhook using service role.
create or replace function public.marketing_record_suppression(p_email text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare e text := lower(btrim(p_email));
begin
  if e is null or length(e) > 254 or e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or p_reason not in ('unsubscribed','complained','bounced','manual') then
    raise exception 'invalid marketing suppression';
  end if;
  insert into public.marketing_suppressions (email, reason)
  values (e, p_reason)
  on conflict (email) do nothing;
  update public.tool_email_contacts
     set marketing_opt_in = false, marketing_opt_in_at = null
   where email = e;
end $$;
revoke all on function public.marketing_record_suppression(text,text) from public, anon, authenticated;
grant execute on function public.marketing_record_suppression(text,text) to service_role;

commit;
