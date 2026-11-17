-- Session E feature test. One statement that always ends by raising an exception, so everything it wrote is rolled
-- back: throwaway sign-ins (@example.invalid), two throwaway families, test-mode subscriptions (livemode = false, so the
-- subscription trigger queues nothing). Prints pass/fail only.
do $t$
declare
  o1 uuid := gen_random_uuid(); p1 uuid := gen_random_uuid();   -- family 1: owner still chargeable (trialing)
  o2 uuid := gen_random_uuid(); p2 uuid := gen_random_uuid();   -- family 2: owner canceled
  u uuid := gen_random_uuid();                                    -- alone, unpaid (the old gap)
  c uuid := gen_random_uuid();                                    -- alone, canceled
  h1 uuid; h2 uuid; m1 int; m2 int; pm uuid; inv jsonb; r jsonb; e text;
  res text[] := '{}'; fails int := 0;
begin
  insert into auth.users (id, email, email_confirmed_at)
  select id, 'session-e-' || id || '@example.invalid', now() from unnest(array[o1, p1, o2, p2, u, c]) id;
  insert into public.club_subscriptions (stripe_subscription_id, stripe_customer_id, user_id, status, price_id, started_at, livemode)
  select 'sub_sessione' || replace(gen_random_uuid()::text, '-', ''), 'cus_sessione' || replace(gen_random_uuid()::text, '-', ''), x.id, x.st, 'price_test', now(), false
    from (values (o1, 'trialing'), (o2, 'canceled'), (u, 'unpaid'), (c, 'canceled')) x(id, st);

  -- Two families, each with a second adult who joined by invitation.
  perform set_config('request.jwt.claims', json_build_object('sub', o1, 'role', 'authenticated')::text, true);
  h1 := (public.club_household_save('Session E one', '{}', '[{"first_name":"Owner","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Partner","kind":"adult","role":"partner"},{"first_name":"Kid","kind":"child","role":"child","birth_year":2018,"birth_month":3}]') ->> 'id')::uuid;
  select id into pm from public.club_family_members where household_id = h1 and first_name = 'Partner';
  inv := public.household_invite_create(pm, 'session-e-' || p1 || '@example.invalid');
  perform set_config('request.jwt.claims', json_build_object('sub', p1, 'role', 'authenticated')::text, true);
  perform public.household_invite_accept(inv ->> 'code');
  perform set_config('request.jwt.claims', json_build_object('sub', o2, 'role', 'authenticated')::text, true);
  h2 := (public.club_household_save('Session E two', '{}', '[{"first_name":"Owner","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Partner","kind":"adult","role":"partner"},{"first_name":"Kid","kind":"child","role":"child","birth_year":2019,"birth_month":5}]') ->> 'id')::uuid;
  select id into pm from public.club_family_members where household_id = h2 and first_name = 'Partner';
  inv := public.household_invite_create(pm, 'session-e-' || p2 || '@example.invalid');
  perform set_config('request.jwt.claims', json_build_object('sub', p2, 'role', 'authenticated')::text, true);
  perform public.household_invite_accept(inv ->> 'code');
  select count(*) into m1 from public.club_family_members where household_id = h1;
  select count(*) into m2 from public.club_family_members where household_id = h2;

  -- 1-2: chargeable blocks deletion, from the app/website and from any other path.
  perform set_config('request.jwt.claims', json_build_object('sub', o1, 'role', 'authenticated')::text, true);
  begin
    perform public.account_delete();
    res := res || '1 owner with a trialing subscription cannot delete in the app: false'::text;
  exception when raise_exception then
    get stacked diagnostics e = message_text;
    res := res || ('1 owner with a trialing subscription cannot delete in the app: ' || (e = 'active_membership')::text);
  end;
  begin
    delete from auth.users where id = o1;
    res := res || '2 ... nor by deleting the sign-in directly: false'::text;
  exception when raise_exception then
    get stacked diagnostics e = message_text;
    res := res || ('2 ... nor by deleting the sign-in directly: ' || (e = 'active_membership')::text);
  end;
  res := res || ('3 the refused delete left the family whole (owner, partner, every member): ' ||
    (exists (select 1 from auth.users where id = o1) and (select count(*) from public.household_adults where household_id = h1) = 2
     and (select owner_user_id from public.club_households where id = h1) = o1
     and (select count(*) from public.club_family_members where household_id = h1) = m1)::text);
  -- 4-5: unpaid used to slip through (no paid access). Now refused both ways.
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  begin
    perform public.account_delete();
    res := res || '4 unpaid (still chargeable, no Club access) cannot delete in the app: false'::text;
  exception when raise_exception then
    get stacked diagnostics e = message_text;
    res := res || ('4 unpaid (still chargeable, no Club access) cannot delete in the app: ' || (e = 'active_membership')::text);
  end;
  begin
    delete from auth.users where id = u;
    res := res || '5 ... nor directly: false'::text;
  exception when raise_exception then
    res := res || '5 ... nor directly: true'::text;
  end;

  -- 6: canceled permits deletion.
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  perform public.account_delete();
  res := res || ('6 a canceled subscription permits deletion: ' || (not exists (select 1 from auth.users where id = c))::text);

  -- 7: the second adult deleting their own account touches only their sign-in.
  perform set_config('request.jwt.claims', json_build_object('sub', p1, 'role', 'authenticated')::text, true);
  perform public.account_delete();
  res := res || ('7 second adult deletes their account; the family stays with its owner, every member kept: ' ||
    (not exists (select 1 from auth.users where id = p1) and (select owner_user_id from public.club_households where id = h1) = o1
     and (select count(*) from public.household_adults where household_id = h1) = 1
     and (select count(*) from public.club_family_members where household_id = h1) = m1)::text);

  -- 8: an owner who canceled deletes; the other adult keeps the household and all its data.
  perform set_config('request.jwt.claims', json_build_object('sub', o2, 'role', 'authenticated')::text, true);
  perform public.account_delete();
  res := res || ('8 owner with a canceled subscription deletes; the other adult now owns the family, every member kept: ' ||
    (not exists (select 1 from auth.users where id = o2) and (select owner_user_id from public.club_households where id = h2) = p2
     and exists (select 1 from public.household_adults where household_id = h2 and user_id = p2 and role = 'owner')
     and (select count(*) from public.club_family_members where household_id = h2) = m2)::text);
  perform set_config('request.jwt.claims', json_build_object('sub', p2, 'role', 'authenticated')::text, true);
  res := res || ('9 ... and still opens it: ' || ((public.club_household() ->> 'id')::uuid = h2)::text);
  -- 10: the canceled owner's subscription row stays (billing history), just without a sign-in.
  res := res || ('10 the two canceled subscription records are kept for billing history, without a sign-in: ' ||
    (select count(*) = 2 from public.club_subscriptions where user_id is null and stripe_subscription_id like 'sub_sessione%' and status = 'canceled')::text);

  select count(*) into fails from unnest(res) s where s not like '%: true';
  raise exception 'SESSION_E_TEST % of % passed (all rolled back) | %', array_length(res, 1) - fails, array_length(res, 1), array_to_string(res, ' | ');
end $t$;
