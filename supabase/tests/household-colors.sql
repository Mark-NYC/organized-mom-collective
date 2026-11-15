-- Permanent member colors (supabase/migrations/20261126000000_household_member_colors.sql). Run by
-- scripts/test-household-sql.sh on a throwaway local database. Never on the real project.
\set ON_ERROR_STOP 1
\set QUIET 1
\set fx `cat supabase/tests/fixtures/member-colors.json`
select set_config('omc.fx', :'fx', false) \g /dev/null

create function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
create function pg_temp.as_user(p_role text, p_sub text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when p_sub is null then '{}' else jsonb_build_object('sub', p_sub)::text end, false);
  execute format('set role %I', p_role);
end $$;
/** name -> color for a household, from what's saved. */
create function pg_temp.colors_of(p_household uuid) returns jsonb language sql as $$
  select coalesce(jsonb_object_agg(f.first_name, h.preferences -> 'colors' ->> f.id::text), '{}')
    from public.club_households h join public.club_family_members f on f.household_id = h.id
   where h.id = p_household and f.archived_at is null;
$$;

-- ---------------------------------------------------------------- existing households (fixtures) get today's colors
create temp table fx_homes (n int, name text, owner uuid, hid uuid, expected jsonb);
do $$
declare
  fx jsonb := current_setting('omc.fx')::jsonb;
  h jsonb;
  i int := 0;
  uid uuid;
  hid uuid;
  members jsonb;
  saved jsonb;
begin
  for h in select * from jsonb_array_elements(fx -> 'households') loop
    i := i + 1;
    uid := ('00000000-0000-0000-0000-0000000c0' || lpad(i::text, 3, '0'))::uuid;
    insert into auth.users (id, email, email_confirmed_at) values (uid, 'colors' || i || '@example.com', now());
    select jsonb_agg(jsonb_build_object('first_name', m ->> 'n', 'kind', m ->> 'kind', 'role', case when m ->> 'kind' = 'child' then 'child' else 'parent' end,
             'birth_year', (m ->> 'y')::int, 'is_account_holder', ord = 1) order by ord)
      into members from jsonb_array_elements(h -> 'members') with ordinality t(m, ord);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', uid)::text, true);
    perform public.club_household_save('Fixture ' || i, '{}', members);
    select id into hid from public.club_households where owner_user_id = uid;
    -- As before the migration: no saved colors except the fixture's own; archived people archived.
    select coalesce(jsonb_object_agg(f.id::text, s.value), '{}') into saved
      from jsonb_each(h -> 'saved') s join public.club_family_members f on f.household_id = hid and f.first_name = s.key;
    update public.club_households set preferences = (preferences - 'colors') || jsonb_build_object('colors', saved) where id = hid;
    update public.club_family_members f set archived_at = now()
      from jsonb_array_elements(h -> 'members') m
     where f.household_id = hid and f.first_name = m ->> 'n' and (m ->> 'archived')::boolean;
    insert into fx_homes values (i, h ->> 'name', uid, hid, h -> 'expected');
  end loop;
end $$;

-- The deploy-time backfill, on those existing households.
select public.household_colors_complete(hid) from fx_homes;
select pg_temp.expect(pg_temp.colors_of(hid) = expected, 'backfill = the colors the app shows today: ' || name) from fx_homes order by n;
select pg_temp.expect((select (h.preferences -> 'colors') ? f.id::text from public.club_households h join public.club_family_members f on f.household_id = h.id
                        where h.id = (select hid from fx_homes where n = 5) and f.first_name = 'Oona'), 'an archived person keeps their saved color on record');
grant select on fx_homes to authenticated;
create temp table snap as select hid, (select preferences from public.club_households where id = hid) p from fx_homes;
select public.household_colors_complete(hid) from fx_homes;
select pg_temp.expect(not exists (select 1 from snap s join public.club_households h on h.id = s.hid where h.preferences is distinct from s.p), 'running it again changes nothing');

-- ---------------------------------------------------------------- after that, colors never move
\set H1 '(select hid from fx_homes where n = 1)'
\set O1 '(select owner from fx_homes where n = 1)'
create function pg_temp.members_json(p_household uuid, p_extra jsonb default '[]', p_drop text default null, p_first text default null) returns jsonb language sql as $$
  select coalesce(jsonb_agg(x order by o), '[]') from (
    select jsonb_build_object('id', f.id, 'first_name', f.first_name, 'kind', f.kind, 'role', f.role, 'birth_year', f.birth_year, 'is_account_holder', f.is_account_holder) x,
           case when f.first_name = p_first then 0 else f.sort end o
      from public.club_family_members f where f.household_id = p_household and f.archived_at is null and f.first_name is distinct from p_drop
    union all select e, -1 from jsonb_array_elements(p_extra) e) t;
$$;
grant execute on function pg_temp.members_json(uuid, jsonb, text, text) to authenticated;
create temp table before1 as select pg_temp.colors_of(:H1) c;
grant select on before1 to authenticated;

select pg_temp.as_user('authenticated', (:O1)::text);
select public.club_household_save('Fixture 1', '{}', pg_temp.members_json(:H1, '[{"first_name":"Baby","kind":"child","role":"child","birth_year":2026}]'));
reset role;
select pg_temp.expect((pg_temp.colors_of(:H1) - 'Baby') = (select c from before1), 'adding a baby (first in the family) changes nobody else''s color');
select pg_temp.expect(pg_temp.colors_of(:H1) ->> 'Baby' = 'orange', 'the baby gets the next free color');

select pg_temp.as_user('authenticated', (:O1)::text);
select public.club_household_save('Fixture 1', '{}', pg_temp.members_json(:H1, '[]', 'Cleo'));
reset role;
select pg_temp.expect(pg_temp.colors_of(:H1) = (select c from before1) - 'Cleo' || jsonb_build_object('Baby', 'orange'), 'removing someone changes nobody else''s color');

select pg_temp.as_user('authenticated', (:O1)::text);
select public.club_household_save('Fixture 1', '{}', pg_temp.members_json(:H1, '[]', null, 'Bodhi'));
reset role;
select pg_temp.expect(pg_temp.colors_of(:H1) = (select c from before1) - 'Cleo' || jsonb_build_object('Baby', 'orange'), 'reordering changes nobody''s color');

select pg_temp.as_user('authenticated', (:O1)::text);
select public.club_household_save('Fixture 1', jsonb_build_object('colors', jsonb_build_object((select id from public.club_family_members where household_id = :H1 and first_name = 'Dev')::text, 'red')), pg_temp.members_json(:H1));
reset role;
select pg_temp.expect(pg_temp.colors_of(:H1) ->> 'Dev' = 'red' and (pg_temp.colors_of(:H1) - 'Dev') = ((select c from before1) - 'Cleo' - 'Dev' || jsonb_build_object('Baby', 'orange')), 'a color she picks is saved; nobody else changes');

select pg_temp.as_user('authenticated', (:O1)::text);
select public.club_household_save('Fixture 1', '{}', pg_temp.members_json(:H1));
reset role;
select pg_temp.expect(pg_temp.colors_of(:H1) ->> 'Dev' = 'red', 'a later save that sends no colors keeps every saved one (the existing family form)');
