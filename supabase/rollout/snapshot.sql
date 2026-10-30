-- Read-only. Row counts and checksums of the Club's member and fulfillment data, before and after the rollout.
-- Every line must be identical before and after (neither migration changes an existing row). Households are compared
-- on their columns from before 20261109, which adds columns.
select 'club_households' as t, count(*) as n, md5(coalesce(string_agg(r, '|' order by r), '')) as md5 from (
  select concat_ws(',', id, owner_user_id, display_name, preferences, profile_version, onboarded_at, created_at, enrolled_at, first_paid_month) r
    from public.club_households) x
union all select 'club_family_members', count(*), md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from public.club_family_members x
union all select 'club_fulfillment_orders', count(*), md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from public.club_fulfillment_orders x
union all select 'club_entitlements', count(*), md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from public.club_entitlements x
union all select 'club_resource_versions', count(*), md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from public.club_resource_versions x
union all select 'club_subscriptions', count(*), md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from public.club_subscriptions x
union all select 'club_mailing_addresses', count(*), md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from public.club_mailing_addresses x
union all select 'club_email_log', count(*), md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from public.club_email_log x
order by 1;
