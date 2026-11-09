-- Stages the two welcome emails for net-new opt-ins. Both are HELD, never sent.
begin;
create table if not exists public.marketing_welcome_queue (
 email text not null,
 step smallint not null check (step in (2,6)),
 due_at timestamptz not null,
 status text not null default 'held' check (status in ('held','ready','sending','sent','cancelled','failed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 sent_at timestamptz,
 provider_message_id text,
 primary key (email, step)
);
alter table public.marketing_welcome_queue enable row level security;
revoke all on public.marketing_welcome_queue from public, anon, authenticated;
create index if not exists marketing_welcome_queue_due_idx on public.marketing_welcome_queue(status, due_at);
create or replace function marketing_private.stage_welcome_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_first_consent timestamptz;
begin
 if new.marketing_opt_in is distinct from true then
   if tg_op='UPDATE' and old.marketing_opt_in is true then
     update public.marketing_welcome_queue
        set status='cancelled', updated_at=now()
      where email=new.email and status in ('held','ready','failed');
   end if;
   return new;
 end if;
 if tg_op='UPDATE' and old.marketing_opt_in is true then return new; end if;
 if exists(select 1 from public.marketing_suppressions where email=new.email) then return new; end if;
 v_first_consent := coalesce(new.marketing_opt_in_at,now());
 insert into public.marketing_welcome_queue(email,step,due_at,status)
 values(new.email,2,v_first_consent+interval '2 days','held'),
       (new.email,6,v_first_consent+interval '6 days','held')
 on conflict(email,step) do nothing;
 return new;
end $$;
revoke all on function marketing_private.stage_welcome_signup() from public,anon,authenticated;
drop trigger if exists marketing_welcome_signup on public.tool_email_contacts;
create trigger marketing_welcome_signup
after insert or update of marketing_opt_in on public.tool_email_contacts
for each row execute function marketing_private.stage_welcome_signup();
commit;
