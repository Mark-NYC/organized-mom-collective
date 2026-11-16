-- READ-ONLY. Run right BEFORE applying 20261203 (after 20261121–20261129 are in) and save the one text value it returns
-- as restore-billing-functions.sql: the exact definition of every function 20261203 replaces or patches, so
-- rollback-billing.sql can put them back byte for byte.
select string_agg(pg_get_functiondef(p.oid) || ';', E'\n\n' order by p.sig) as restore_billing_functions_sql
  from (select to_regprocedure(s) as oid, s as sig from unnest(array[
    'public.household_billing_user(uuid)', 'public.household_partner_remove()', 'public.household_leave()',
    'public.club_me()', 'public.club_me_for(uuid)', 'public.club_address_save(jsonb)', 'public.club_member_link(uuid,text,text,boolean)',
    'public.club_admin_members(text,date)', 'public.club_email_audience(text,date)',
    'public.club_admin_entitlement_service(uuid,uuid,date,text,text,text)', 'public.club_customer_email(uuid,text)',
    'public.club_document_get(text)', 'public.club_document_save(text,text,jsonb,text,integer,integer,integer)',
    'public.club_fulfillment_approve(text)', 'public.club_intro_grant(text,text)', 'public.club_invoice_apply(jsonb,jsonb)',
    'public.club_meeting_guide_mark()', 'public.club_meeting_guide_seen()',
    'public.club_resource_get(text)', 'public.club_resource_save(text,jsonb,integer)',
    'public.club_welcome_item_of(uuid)', 'public.club_welcome_plan_access(uuid)',
    'public.club_welcome_plan_approve(integer,text,jsonb)', 'public.club_welcome_plan_get()',
    'public.club_welcome_plan_save(jsonb,integer)', 'public.club_welcome_plan_unapprove(integer)']) s) p
 where p.oid is not null;
