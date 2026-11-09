-- Enable due-job promotion only after all three launch settings are verified.
-- Expire stale jobs and recheck suppression. No production sending is enabled.
begin;
create or replace function marketing_private.dispatch_welcome_jobs()
returns integer language plpgsql security invoker set search_path = '' as $$
declare r record; n integer := 0; v_token text;
begin
 if not exists (select 1 from public.marketing_delivery_settings
    where id=1 and enabled and postal_address_verified and broadcasts_coordinated)
 then return 0; end if;

 update public.marketing_welcome_queue
    set status='cancelled',error_code='stale_welcome',updated_at=now()
  where status='held' and due_at < now()-interval '14 days';

 update public.marketing_welcome_queue q
    set status='cancelled',error_code='opted_out',updated_at=now()
  where q.status in ('held','ready')
    and (exists(select 1 from public.marketing_suppressions s where s.email=q.email)
      or not exists(select 1 from public.tool_email_contacts c
                    where c.email=q.email and c.marketing_opt_in=true));

 update public.marketing_welcome_queue q
    set status='ready',updated_at=now()
  where q.status='held' and q.due_at <= now()
    and (q.step=2 or exists(
       select 1 from public.marketing_welcome_queue previous
       where previous.email=q.email and previous.step=2 and previous.status='sent'));

 for r in
   select email,step,dispatch_token from public.marketing_welcome_queue
    where status='ready' and due_at<=now() and dispatch_attempts<5
      and (last_dispatched_at is null or last_dispatched_at<=now()-interval '10 minutes')
    order by due_at limit 25 for update skip locked
 loop
   v_token:=coalesce(r.dispatch_token,
      replace(pg_catalog.gen_random_uuid()::text,'-','') ||
      replace(pg_catalog.gen_random_uuid()::text,'-',''));
   update public.marketing_welcome_queue
      set dispatch_token=v_token,dispatch_attempts=dispatch_attempts+1,
          last_dispatched_at=now(),updated_at=now()
    where email=r.email and step=r.step;
   perform net.http_post(
     url:='https://uvqhmlqwmgnohhduttip.supabase.co/functions/v1/resend-welcome-delivery',
     body:=pg_catalog.jsonb_build_object('token',v_token),
     headers:='{"Content-Type":"application/json"}'::jsonb,
     timeout_milliseconds:=5000
   );
   n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function marketing_private.dispatch_welcome_jobs() from public,anon,authenticated;
commit;
