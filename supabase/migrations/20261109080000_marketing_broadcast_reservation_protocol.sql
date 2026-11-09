-- Production schema mirror, already applied via Supabase migration.
begin;
alter table public.marketing_broadcast_calendar
 add column if not exists scheduled_at timestamptz,
 add column if not exists resend_status text,
 add column if not exists last_error text;
create unique index if not exists marketing_broadcast_calendar_broadcast_unique
 on public.marketing_broadcast_calendar(broadcast_id)
 where broadcast_id is not null and status <> 'cancelled';
CREATE OR REPLACE FUNCTION marketing_private.reserve_broadcast(p_broadcast_id text, p_title text, p_scheduled_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_day date; v_existing record;
begin
 if p_broadcast_id is null or p_broadcast_id !~ '^[0-9a-f-]{36}$'
    or length(btrim(coalesce(p_title,''))) < 3
    or p_scheduled_at is null
    or p_scheduled_at < now() + interval '10 minutes' then
   return jsonb_build_object('status','invalid');
 end if;
 v_day := (p_scheduled_at at time zone 'America/New_York')::date;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('broadcast:' || v_day::text,0));
 if exists(select 1 from public.marketing_broadcast_calendar
   where broadcast_id=p_broadcast_id and status <> 'cancelled') then
   return jsonb_build_object('status','already_registered');
 end if;
 if exists(select 1 from public.marketing_broadcast_calendar
   where local_day=v_day and status <> 'cancelled') then
   return jsonb_build_object('status','date_reserved');
 end if;

 -- Fail closed if this broadcast day has already been used for welcome mail.
 if exists(select 1 from public.marketing_send_ledger
   where local_day=v_day and status in ('claimed','sent','uncertain','blocked')) then
   return jsonb_build_object('status','welcome_send_exists');
 end if;
 insert into public.marketing_broadcast_calendar(
    local_day,broadcast_id,title,status,scheduled_at,resend_status,last_error)
 values(v_day,p_broadcast_id,btrim(p_title),'reserved',p_scheduled_at,'pending',null)
 on conflict(local_day) do update
   set broadcast_id=excluded.broadcast_id,title=excluded.title,
       status='reserved',scheduled_at=excluded.scheduled_at,
       resend_status='pending',last_error=null,updated_at=now()
   where public.marketing_broadcast_calendar.status='cancelled';
 if not found then return jsonb_build_object('status','date_reserved'); end if;
 return jsonb_build_object('status','reserved','local_day',v_day);
end $function$

CREATE OR REPLACE FUNCTION marketing_private.record_broadcast_schedule(p_broadcast_id text, p_status text, p_error text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_day date;
begin
 if p_status not in ('scheduled','sent','failed','uncertain','cancelled') then
   return jsonb_build_object('status','invalid');
 end if;
 select local_day into v_day from public.marketing_broadcast_calendar
  where broadcast_id=p_broadcast_id and status in ('reserved','scheduled','sent')
  for update;
 if not found then return jsonb_build_object('status','not_registered'); end if;
 update public.marketing_broadcast_calendar
  set status=case
    when p_status in ('scheduled','sent') then p_status
    when p_status='cancelled' then 'cancelled'
    else 'reserved' end,
    resend_status=p_status,
    last_error=left(p_error,300),updated_at=now()
  where local_day=v_day;
 return jsonb_build_object('status','recorded','local_day',v_day);
end $function$

CREATE OR REPLACE FUNCTION public.marketing_reserve_broadcast(p_broadcast_id text, p_title text, p_scheduled_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select marketing_private.reserve_broadcast(p_broadcast_id,p_title,p_scheduled_at)
$function$

CREATE OR REPLACE FUNCTION public.marketing_record_broadcast_schedule(p_broadcast_id text, p_status text, p_error text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select marketing_private.record_broadcast_schedule(p_broadcast_id,p_status,p_error)
$function$

revoke all on function marketing_private.reserve_broadcast(text,text,timestamptz) from public,anon,authenticated;
revoke all on function marketing_private.record_broadcast_schedule(text,text,text) from public,anon,authenticated;
grant execute on function marketing_private.reserve_broadcast(text,text,timestamptz) to service_role;
grant execute on function marketing_private.record_broadcast_schedule(text,text,text) to service_role;
revoke all on function public.marketing_reserve_broadcast(text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.marketing_record_broadcast_schedule(text,text,text) from public,anon,authenticated;
grant execute on function public.marketing_reserve_broadcast(text,text,timestamptz) to service_role;
grant execute on function public.marketing_record_broadcast_schedule(text,text,text) to service_role;
commit;
