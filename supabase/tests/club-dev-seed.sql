-- A local development copy of the Club for scripts/club-onboarding-e2e.mjs (--db): settings and kit statuses like the
-- live project on 2026-10-30, one owner admin, and one founding member right after Stripe Checkout (her trial, her
-- free January, her welcome print, the address Checkout collected), made with the same functions the webhook calls.
-- Never run on the real project.
\set ON_ERROR_STOP 1

update public.club_settings set checkout_mode = 'test', program_start_month = '2027-01-01', intro_offer = true,
  launch_exception_month = null, launch_exception_cutoff_at = null, updated_at = now() where id;
update public.club_kits set status = case when slug = '2027-01-fresh-start-together' then 'scheduled' else 'draft' end where slug is not null;

-- The owner.
insert into auth.users (id, email, email_confirmed_at) values ('22222222-2222-4222-8222-222222222222', 'owner@example.com', now());
insert into public.admin_users (user_id, role) values ('22222222-2222-4222-8222-222222222222', 'owner');

-- Ana, a founding member: joined today, free January 2027, first charge February 1, 2027.
insert into auth.users (id, email, email_confirmed_at) values ('11111111-1111-4111-8111-111111111111', 'ana@example.com', now());
select public.club_member_link('11111111-1111-4111-8111-111111111111', 'ana@example.com', 'cus_ana', false);
select public.club_subscription_sync(jsonb_build_object('id', 'sub_ana', 'customer', 'cus_ana', 'user_id', '11111111-1111-4111-8111-111111111111',
  'status', 'trialing', 'plan', 'monthly', 'price_id', 'price_monthly', 'current_period_start', now(), 'current_period_end', '2027-02-01 05:00:00+00',
  'cancel_at_period_end', false, 'started_at', now(), 'livemode', false, 'event_at', now()));
select public.club_address_from_checkout('11111111-1111-4111-8111-111111111111',
  '{"name":"Ana Rivera","line1":"14 Oak St","line2":"","city":"Austin","state":"TX","postal_code":"78701","country":"US"}');
select public.club_intro_grant('sub_ana', 'fp_ana');
