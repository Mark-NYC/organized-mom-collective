-- READ-ONLY. Run BEFORE applying 20261124 (docs/ios/MIGRATION_DEPLOYMENT_PLAN.md → step 0) and save the one text value
-- it returns as restore-functions.sql. It is the exact current definition of every function 20261124–20261203
-- replace or patch, so rollback.sql can put them back byte for byte. Functions that don't exist yet are left out.
select string_agg(pg_get_functiondef(p.oid) || ';', E'\n\n' order by p.sig) as restore_functions_sql
  from (select to_regprocedure(s) as oid, s as sig from unnest(array[
    'public.club_my_household()', 'public.club_household()', 'public.club_household_save(text,jsonb,jsonb)',
    'public.club_family_profile()', 'public.club_activities_save(jsonb)', 'public.club_responsibilities_save(text,jsonb)',
    'public.club_resource_get(text)', 'public.club_resource_save(text,jsonb,integer)',
    'public.club_document_get(text)', 'public.club_document_save(text,text,jsonb,text,integer,integer,integer)',
    'public.club_welcome_plan_get()', 'public.club_welcome_plan_save(jsonb,integer)',
    'public.club_me()', 'public.club_address_save(jsonb)', 'public.account_delete()',
    -- patched by 20261203 (billing for either adult):
    'public.club_admin_entitlement_service(uuid,uuid,date,text,text,text)', 'public.club_customer_email(uuid,text)',
    'public.club_fulfillment_approve(text)', 'public.club_intro_grant(text,text)', 'public.club_invoice_apply(jsonb,jsonb)',
    'public.club_meeting_guide_mark()', 'public.club_meeting_guide_seen()', 'public.club_welcome_item_of(uuid)',
    'public.club_welcome_plan_access(uuid)', 'public.club_welcome_plan_approve(integer,text,jsonb)',
    'public.club_welcome_plan_unapprove(integer)', 'public.club_admin_members(text,date)',
    'public.club_email_audience(text,date)', 'public.club_member_link(uuid,text,text,boolean)']) s) p
 where p.oid is not null;
