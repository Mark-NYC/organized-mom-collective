-- Households shaped like production's (5 households, 2 onboarded, 1 with legacy priorities), created through the
-- pre-migration functions exactly as customers did.
insert into auth.users (id, email, email_confirmed_at) values
 ('aaaaaaaa-0000-4000-8000-000000000001','p1@example.com',now()),('aaaaaaaa-0000-4000-8000-000000000002','p2@example.com',now()),
 ('aaaaaaaa-0000-4000-8000-000000000003','p3@example.com',now()),('aaaaaaaa-0000-4000-8000-000000000004','p4@example.com',now()),
 ('aaaaaaaa-0000-4000-8000-000000000005','p5@example.com',now());
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-000000000001"}',false);
set role authenticated;
select public.club_household_save('The Rivera Family','{"pets":true,"priorities":["mornings","shared-load"]}','[{"first_name":"Ana","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Sofia","kind":"child","role":"child","birth_year":2018,"birth_month":4}]') \g /dev/null
reset role;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-000000000002"}',false);
set role authenticated;
select public.club_household_save(null,'{"palette":"blue-green"}','[{"first_name":"Jess","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Max","kind":"child","role":"child","birth_year":2017,"birth_month":9}]') \g /dev/null
reset role;
-- Three enrolled at checkout but not onboarded: household row, no family (as the webhook leaves it).
insert into public.club_households (owner_user_id) values ('aaaaaaaa-0000-4000-8000-000000000003'),('aaaaaaaa-0000-4000-8000-000000000004'),('aaaaaaaa-0000-4000-8000-000000000005');
