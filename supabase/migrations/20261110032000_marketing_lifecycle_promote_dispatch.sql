-- Promote staged customer coaching jobs and schedule guarded dispatcher.
-- All launch gates stay false by default. This migration cannot send customer email.
begin;
create or replace function marketing_private.promote_lifecycle_jobs()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer:=0;
begin
 if not exists(select 1 from public.marketing_lifecycle_settings
   where id=1 and enabled and approved_templates and deliverability_verified) then return 0; end if;
 -- No stale messages; no opted-out contacts. Keep historical rows held for review.
 update public.marketing_lifecycle_queue q
 set status='cancelled',error_code='opted_out',updated_at=now()
 where q.status in('held','ready')
 and (exists(select 1 from public.marketing_suppressions s where lower(s.email)=lower(q.email))
   or not exists(select 1 from public.tool_email_contacts c
     where lower(c.email)=lower(q.email) and c.marketing_opt_in=true));
 update public.marketing_lifecycle_queue
 set status='cancelled',error_code='stale',updated_at=now()
 where status in('held','ready') and due_at < now()-interval '30 days';
 -- Week-two message must come no earlier than seven days AFTER first week's actual send.
 update public.marketing_lifecycle_queue followup
 set due_at=greatest(followup.due_at,first.sent_at+interval '7 days'),updated_at=now()
 from public.marketing_lifecycle_queue first
 where followup.journey='calendar' and followup.step='week_two'
   and followup.source_id=first.source_id and first.journey='calendar'
   and first.step='first_week' and first.status='sent'
   and first.sent_at is not null and followup.status='held';
 update public.marketing_lifecycle_queue q
 set status='ready',updated_at=now()
 where q.status='held' and q.due_at<=now()
   and (q.journey <> 'calendar' or q.step <> 'week_two'
     or exists(select 1 from public.marketing_lifecycle_queue first
       where first.journey='calendar' and first.source_id=q.source_id
       and first.step='first_week' and first.status='sent'
       and first.sent_at <= now()-interval '7 days'));
 get diagnostics n=row_count;
 return n;
end $$;
revoke all on function marketing_private.promote_lifecycle_jobs() from public,anon,authenticated;

create or replace function marketing_private.run_lifecycle_dispatch()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_promoted integer; v_dispatched integer;
begin
 if not exists(select 1 from public.marketing_lifecycle_settings
   where id=1 and enabled and approved_templates and deliverability_verified) then
   return jsonb_build_object('status','disabled','promoted',0,'dispatched',0);
 end if;
 v_promoted:=marketing_private.promote_lifecycle_jobs();
 v_dispatched:=marketing_private.prepare_lifecycle_dispatch();
 return jsonb_build_object('status','running','promoted',v_promoted,'dispatched',v_dispatched);
end $$;
revoke all on function marketing_private.run_lifecycle_dispatch() from public,anon,authenticated;
select cron.schedule('omc-lifecycle-coaching-dispatch','*/10 * * * *',
 'select marketing_private.run_lifecycle_dispatch()');
commit;