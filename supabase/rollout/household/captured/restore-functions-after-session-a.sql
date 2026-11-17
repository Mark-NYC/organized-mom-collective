-- Captured read-only from production on 2026-11-17 (after Session A, before Session B) with capture.sql.
-- The exact definition of every function 20261124-20261203 replace or patch. Used by rollback.sql to put them back.
-- 28 of the 29 are byte-identical to the repo's migrations through 20261123; production's club_member_link lacks one
-- comment line the repo has (same logic). Re-capture and compare right before applying Session B.
CREATE OR REPLACE FUNCTION public.account_delete()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  e text := public.account_email();
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from public.admin_users where user_id = uid)
     or exists (select 1 from public.shop_admins where user_id = uid)
     or exists (select 1 from public.survey_admins where user_id = uid) then
    raise exception 'admin_account';
  end if;
  if public.club_has_paid_access(uid) then raise exception 'active_membership'; end if;
  delete from public.account_saves where user_id = uid;
  update public.shop_entitlements set user_id = null where user_id = uid;
  if e is not null then
    update public.tool_email_contacts set marketing_opt_in = false where email = e;
  end if;
  delete from auth.users where id = uid;
end $function$
;

CREATE OR REPLACE FUNCTION public.club_activities_save(p_activities jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  hid uuid := public.club_my_household();
  a jsonb;
  aid uuid;
  ids uuid[];
  keep uuid[] := '{}';
  i int := 0;
begin
  if p_activities is null or jsonb_typeof(p_activities) <> 'array' or jsonb_array_length(p_activities) > 30 then
    raise exception 'invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('club-household:' || auth.uid()::text, 0));
  for a in select * from jsonb_array_elements(p_activities) loop
    i := i + 1;
    aid := nullif(a ->> 'id', '')::uuid;
    if aid is not null and not exists (select 1 from public.club_activities where id = aid and household_id = hid) then
      raise exception 'invalid';
    end if;
    ids := public.club_uuid_list(a -> 'member_ids');
    if not public.club_members_belong(hid, ids) then raise exception 'invalid'; end if;
    insert into public.club_activities as t (id, household_id, category, name, member_ids, days, starts_at, sort)
    values (coalesce(aid, gen_random_uuid()), hid, a ->> 'category', nullif(btrim(a ->> 'name'), ''), ids,
            coalesce((select array_agg(distinct (d #>> '{}')::smallint order by (d #>> '{}')::smallint)
                        from jsonb_array_elements(coalesce(a -> 'days', '[]')) d), '{}'),
            nullif(a ->> 'starts_at', '')::time, i)
    on conflict (id) do update
      set category = excluded.category, name = excluded.name, member_ids = excluded.member_ids, days = excluded.days,
          starts_at = excluded.starts_at, sort = excluded.sort, updated_at = now()
    returning t.id into aid;
    keep := keep || aid;
  end loop;
  delete from public.club_activities where household_id = hid and not (id = any (keep));
  perform public.club_setup_mark(hid, 'week');
  return public.club_family_profile();
exception
  when check_violation or invalid_text_representation or not_null_violation or numeric_value_out_of_range
       or invalid_parameter_value or invalid_datetime_format or datetime_field_overflow then
    raise exception 'invalid';
end $function$
;

CREATE OR REPLACE FUNCTION public.club_address_save(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'invalid'; end if;
  insert into public.club_mailing_addresses as a (user_id, name, line1, line2, city, state, postal_code, paused, updated_at)
  values (uid, btrim(p ->> 'name'), btrim(p ->> 'line1'), nullif(btrim(coalesce(p ->> 'line2', '')), ''), btrim(p ->> 'city'),
          upper(btrim(p ->> 'state')), btrim(p ->> 'postal_code'), coalesce((p ->> 'paused')::boolean, false), now())
  on conflict (user_id) do update set name = excluded.name, line1 = excluded.line1, line2 = excluded.line2, city = excluded.city,
    state = excluded.state, postal_code = excluded.postal_code, paused = excluded.paused, updated_at = now();
  return (select to_jsonb(a) - 'user_id' from public.club_mailing_addresses a where a.user_id = uid);
exception
  when check_violation or not_null_violation or invalid_text_representation then raise exception 'invalid';
end $function$
;

CREATE OR REPLACE FUNCTION public.club_admin_entitlement_service(p_actor uuid, p_user uuid, p_month date, p_kind text, p_action text, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  hh public.club_households%rowtype;
  ent uuid;
  n int := 0;
begin
  if p_kind not in ('digital', 'physical') or p_action not in ('grant', 'revoke') or extract(day from p_month) <> 1
     or btrim(coalesce(p_note, '')) = '' then raise exception 'invalid'; end if;
  select * into hh from public.club_households where owner_user_id = p_user;
  if not found then raise exception 'no_household'; end if;
  if p_action = 'grant' then
    insert into public.club_entitlements (user_id, household_id, resource_month, kit_id, kind, membership_year, plan, source, granted_by, note)
    values (p_user, hh.id, p_month, (select k.id from public.club_kits k where k.month = p_month), p_kind,
      public.club_membership_year(coalesce(hh.first_paid_month, p_month), p_month), 'admin', 'admin', p_actor, left(p_note, 300))
    on conflict (user_id, resource_month, kind) where revoked_at is null do nothing
    returning id into ent;
    if found then
      n := 1;
      if p_kind = 'physical' then
        insert into public.club_fulfillment_orders (entitlement_id, user_id, household_id, resource_month, kit_id, late, cutoff_at, provider)
        values (ent, p_user, hh.id, p_month, (select k.id from public.club_kits k where k.month = p_month),
                now() > public.club_cutoff_at(p_month), public.club_cutoff_at(p_month), 'manual')
        on conflict do nothing;
      end if;
    end if;
  else
    with r as (update public.club_entitlements set revoked_at = now(), revoked_reason = 'admin', note = left(p_note, 300)
                where user_id = p_user and resource_month = p_month and kind = p_kind and revoked_at is null returning id)
    select count(*) into n from r;
    update public.club_fulfillment_orders o set status = 'canceled', note = left('canceled by admin: ' || p_note, 300), updated_at = now()
      from public.club_entitlements e
     where e.id = o.entitlement_id and e.user_id = p_user and e.resource_month = p_month and e.kind = 'physical'
       and e.revoked_reason = 'admin' and o.status in ('pending', 'approved', 'on_hold');
  end if;
  perform public.admin_log_service(p_actor, 'club.entitlement_' || p_action, 'user:' || p_user::text,
    jsonb_build_object('month', p_month, 'kind', p_kind, 'changed', n));
  return jsonb_build_object('changed', n);
end $function$
;

CREATE OR REPLACE FUNCTION public.club_admin_members(p_status text DEFAULT NULL::text, p_month date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x order by x ->> 'enrolled_at' desc nulls last) from (
    select jsonb_build_object(
      'user_id', h.owner_user_id, 'household_id', h.id, 'email', u.email, 'display_name', h.display_name,
      'enrolled_at', h.enrolled_at, 'first_paid_month', h.first_paid_month, 'onboarded', h.onboarded_at is not null,
      'adults', (select count(*) from public.club_family_members m where m.household_id = h.id and m.archived_at is null and m.kind = 'adult'),
      'children', (select count(*) from public.club_family_members m where m.household_id = h.id and m.archived_at is null and m.kind = 'child'),
      'child_birth_years', (select coalesce(jsonb_agg(m.birth_year order by m.birth_year), '[]') from public.club_family_members m where m.household_id = h.id and m.archived_at is null and m.kind = 'child'),
      'plan', s.plan, 'status', s.status, 'cancel_at_period_end', s.cancel_at_period_end, 'current_period_end', s.current_period_end,
      'ended_at', s.ended_at, 'livemode', s.livemode, 'flags', s.flags, 'revoked', s.access_revoked_at is not null,
      'stripe_customer_id', s.stripe_customer_id, 'stripe_subscription_id', s.stripe_subscription_id,
      'payment_problem', s.status in ('past_due', 'unpaid', 'incomplete') or exists (
        select 1 from public.club_invoices i where i.subscription_id = s.id and i.status = 'open' and i.attempt_count > 0),
      'months', (select coalesce(jsonb_agg(distinct e.resource_month order by e.resource_month), '[]') from public.club_entitlements e
                  where e.user_id = h.owner_user_id and e.kind = 'digital' and e.revoked_at is null),
      'welcome', (select jsonb_build_object('status', q.status, 'readiness', q.readiness, 'satisfies_month', q.satisfies_month, 'mailed_at', q.mailed_at,
                        'welcome_item', q.fulfillment_type)
                    from public.club_fulfillment_queue q where q.user_id = h.owner_user_id and (q.fulfillment_type in ('welcome_vision', 'welcome_rhythm') or (q.fulfillment_type = 'monthly_resource' and q.in_welcome_kit and q.kit_partner_id is null)) and q.status <> 'canceled'
                   order by (q.fulfillment_type = 'monthly_resource') limit 1),
      'address', (select jsonb_build_object('name', a.name, 'line1', a.line1, 'line2', a.line2, 'city', a.city, 'state', a.state,
                                            'postal_code', a.postal_code, 'paused', a.paused) from public.club_mailing_addresses a where a.user_id = h.owner_user_id)
    ) as x
      from public.club_households h
      join auth.users u on u.id = h.owner_user_id
      left join lateral (select * from public.club_subscriptions s2 where s2.user_id = h.owner_user_id
                          order by (s2.status in ('trialing', 'active', 'past_due', 'unpaid', 'paused')) desc, s2.created_at desc limit 1) s on true
     where (p_status is null
            or (p_status = 'active' and s.status in ('active', 'trialing') and not s.cancel_at_period_end)
            or (p_status = 'canceling' and s.cancel_at_period_end and s.status in ('active', 'trialing', 'past_due'))
            or (p_status = 'problem' and s.status in ('past_due', 'unpaid', 'incomplete'))
            or (p_status = 'canceled' and s.status in ('canceled', 'incomplete_expired'))
            or (p_status = 'monthly' and s.plan = 'monthly') or (p_status = 'annual' and s.plan = 'annual')
            or (p_status = 'no_profile' and h.onboarded_at is null and h.enrolled_at is not null))
       and (p_month is null or exists (select 1 from public.club_entitlements e where e.user_id = h.owner_user_id
                                        and e.resource_month = p_month and e.revoked_at is null))
  ) t), '[]');
end $function$
;

CREATE OR REPLACE FUNCTION public.club_customer_email(p_user uuid, p_email text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  cus text;
begin
  update public.club_customers set email = lower(btrim(p_email)) where user_id = p_user returning stripe_customer_id into cus;
  update public.club_households set billing_email = lower(btrim(p_email)), updated_at = now() where owner_user_id = p_user;
  return cus;
end $function$
;

CREATE OR REPLACE FUNCTION public.club_document_get(p_kit text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  k public.club_kits%rowtype;
  can text;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into k from public.club_kits where slug = p_kit;
  if not found then raise exception 'not_found'; end if;
  can := public.club_can_open(uid, k.id);
  if can = 'none' then raise exception 'not_found'; end if;
  return jsonb_build_object('can', can, 'documents', coalesce((
    select jsonb_object_agg(d.doc, jsonb_build_object('edits', d.edits, 'palette', d.palette, 'revision', d.revision,
                                                      'engine_version', d.engine_version, 'profile_version', d.profile_version))
      from public.club_documents d join public.club_households h on h.id = d.household_id
     where h.owner_user_id = uid and d.kit_id = k.id), '{}'));
end $function$
;

CREATE OR REPLACE FUNCTION public.club_document_save(p_kit text, p_doc text, p_edits jsonb, p_palette text, p_engine_version integer, p_profile_version integer, p_revision integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  hid uuid;
  kid uuid;
  rev int;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select id into kid from public.club_kits where slug = p_kit;
  if kid is null or public.club_can_open(uid, kid) <> 'edit' then raise exception 'read_only'; end if;
  select id into hid from public.club_households where owner_user_id = uid;
  if hid is null then raise exception 'no_household'; end if;
  insert into public.club_documents as d (household_id, kit_id, doc, engine_version, profile_version, edits, palette)
  values (hid, kid, p_doc, p_engine_version, p_profile_version, p_edits, p_palette)
  on conflict (household_id, kit_id, doc) do update
    set edits = excluded.edits, palette = excluded.palette, engine_version = excluded.engine_version,
        profile_version = excluded.profile_version, revision = d.revision + 1, updated_at = now()
    where d.revision = p_revision
  returning d.revision into rev;
  if rev is null then raise exception 'conflict'; end if;
  return rev;
exception
  when check_violation or not_null_violation then raise exception 'invalid';
end $function$
;

CREATE OR REPLACE FUNCTION public.club_email_audience(p_kind text, p_month date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(x), '[]') from (
    select h.owner_user_id as user_id, u.email, null::text as kit_slug, null::uuid as order_id, null::int as reminder
      from public.club_households h join auth.users u on u.id = h.owner_user_id
     where p_kind = 'profile_reminder' and h.onboarded_at is null and h.enrolled_at < now() - interval '1 day'
       and public.club_has_access(h.owner_user_id)
    union all
    select e.user_id, u.email, k.slug, null, null
      from public.club_entitlements e join auth.users u on u.id = e.user_id join public.club_kits k on k.month = e.resource_month
     where p_kind = 'resource_ready' and e.resource_month = p_month and e.kind = 'digital' and e.revoked_at is null
       and e.fulfilled_by = 'monthly_resource' and k.status in ('scheduled', 'retired')
    union all
    select q.user_id, q.email, q.kit_slug, q.id, null
      from public.club_fulfillment_queue q
     where p_kind = 'review' and q.resource_month = p_month and q.status = 'pending' and q.member_approved_at is null
       and q.fulfillment_type = 'monthly_resource' and not q.in_welcome_kit and q.readiness in ('ready', 'needs_pdf')
    union all
    select q.user_id, q.email, p.kit_slug, q.id, case when now() >= q.member_approved_at + interval '7 days' then 2 else 1 end
      from public.club_fulfillment_queue q join public.club_fulfillment_queue p on p.id = q.kit_partner_id
     where p_kind = 'kit_reminder' and q.fulfillment_type in ('welcome_vision', 'welcome_rhythm') and q.status = 'pending'
       and q.readiness = 'needs_confirmation' and now() >= q.member_approved_at + interval '2 days'
    union all
    -- 2d: a kit that is her first month alone: the same two reminders, counted from when her kit was created.
    select q.user_id, q.email, q.kit_slug, q.id, case when now() >= q.created_at + interval '7 days' then 2 else 1 end
      from public.club_fulfillment_queue q
     where p_kind = 'kit_reminder' and (q.fulfillment_type = 'monthly_resource' and q.in_welcome_kit and q.kit_partner_id is null) and q.status = 'pending'
       and q.readiness = 'needs_confirmation' and now() >= q.created_at + interval '2 days'
  ) x;
$function$
;

CREATE OR REPLACE FUNCTION public.club_family_profile()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  h public.club_households%rowtype;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into h from public.club_households where owner_user_id = uid;
  if not found then return null; end if;
  return jsonb_build_object(
    'setup_done', to_jsonb(h.setup_done),
    'setup_completed', h.setup_completed_at is not null,
    'challenges', to_jsonb(h.challenges), 'challenge_note', h.challenge_note,
    'priority', h.priority, 'priority_note', h.priority_note,
    'activities', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'category', a.category, 'name', a.name, 'member_ids', to_jsonb(a.member_ids),
                                          'days', to_jsonb(a.days), 'starts_at', to_char(a.starts_at, 'HH24:MI')) order by a.sort, a.created_at)
        from public.club_activities a where a.household_id = h.id), '[]'),
    'responsibilities', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'status', r.status, 'category', r.category, 'item', r.item, 'label', r.label,
                                          'owner_ids', to_jsonb(r.owner_ids), 'helper_ids', to_jsonb(r.helper_ids), 'scope', r.scope,
                                          'confirmed_at', r.confirmed_at) order by r.status, r.sort, r.created_at)
        from public.club_responsibilities r where r.household_id = h.id), '[]'));
end $function$
;

CREATE OR REPLACE FUNCTION public.club_fulfillment_approve(p_kit text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  k public.club_kits%rowtype;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into k from public.club_kits where slug = p_kit;
  if not found or public.club_can_open(uid, k.id) <> 'edit' then raise exception 'read_only'; end if;
  update public.club_resource_versions v set approved_at = now()
    from public.club_households h where h.id = v.household_id and h.owner_user_id = uid and v.kit_id = k.id;
  update public.club_fulfillment_orders set member_approved_at = now(), updated_at = now()
   where user_id = uid and resource_month = k.month and fulfillment_type = 'monthly_resource' and status = 'pending';
  return found;
end $function$
;

CREATE OR REPLACE FUNCTION public.club_household_save(p_display_name text, p_preferences jsonb, p_members jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  hid uuid;
  m jsonb;
  keep uuid[] := '{}';
  mid uuid;
  i int := 0;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if p_members is null or jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) not between 1 and 12 then
    raise exception 'invalid';
  end if;
  if p_preferences is null or jsonb_typeof(p_preferences) <> 'object'
     or exists (select 1 from jsonb_object_keys(p_preferences) k
                 where k not in ('palette', 'week_starts', 'faith_content', 'pets', 'school', 'weekday_dinner', 'priorities', 'icon_style', 'colors')) then
    raise exception 'invalid';
  end if;
  -- 20261113: her family's illustration style (src/lib/club/illustration-style.ts), one of two values.
  if p_preferences ? 'icon_style' and coalesce(p_preferences ->> 'icon_style', '') not in ('hand-drawn', 'soft-color') then
    raise exception 'invalid';
  end if;
  -- 20261120: family member colors (src/data/club/family-colors.ts), member id → marker color id.
  if not public.club_preferences_colors_ok(p_preferences) then
    raise exception 'invalid';
  end if;
  if p_preferences ? 'priorities' and (
       jsonb_typeof(p_preferences -> 'priorities') <> 'array'
       or jsonb_array_length(p_preferences -> 'priorities') > 8
       or exists (select 1 from jsonb_array_elements(p_preferences -> 'priorities') x
                   where jsonb_typeof(x) <> 'string' or x #>> '{}' !~ '^[a-z]+(-[a-z]+)*$' or char_length(x #>> '{}') > 40)) then
    raise exception 'invalid';
  end if;
  if exists (select 1 from jsonb_array_elements(p_members) x where btrim(coalesce(x ->> 'first_name', '')) = '') then
    raise exception 'invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('club-household:' || uid::text, 0));
  insert into public.club_households (owner_user_id, display_name, preferences, onboarded_at)
  values (uid, nullif(btrim(p_display_name), ''), p_preferences, now())
  on conflict (owner_user_id) do update
    set display_name = excluded.display_name, preferences = excluded.preferences,
        profile_version = club_households.profile_version + 1, updated_at = now(),
        onboarded_at = coalesce(club_households.onboarded_at, now())
  returning id into hid;
  for m in select * from jsonb_array_elements(p_members) loop
    i := i + 1;
    mid := nullif(m ->> 'id', '')::uuid;
    if mid is not null and not exists (select 1 from public.club_family_members where id = mid and household_id = hid) then
      raise exception 'invalid';
    end if;
    insert into public.club_family_members as f (id, household_id, first_name, kind, role, birth_year, birth_month, is_account_holder, sort)
    values (coalesce(mid, gen_random_uuid()), hid, btrim(m ->> 'first_name'), m ->> 'kind', m ->> 'role',
            (m ->> 'birth_year')::smallint, (m ->> 'birth_month')::smallint,
            coalesce((m ->> 'is_account_holder')::boolean, false) and m ->> 'kind' = 'adult', i)
    on conflict (id) do update
      set first_name = excluded.first_name, kind = excluded.kind, role = excluded.role,
          is_account_holder = excluded.is_account_holder,
          birth_year = excluded.birth_year, birth_month = excluded.birth_month, sort = excluded.sort,
          archived_at = null, updated_at = now()
    returning f.id into mid;
    keep := keep || mid;
  end loop;
  update public.club_family_members set archived_at = now(), updated_at = now()
   where household_id = hid and archived_at is null and not (id = any (keep));
  if (select count(*) from public.club_family_members where household_id = hid and archived_at is null and is_account_holder) > 1 then
    raise exception 'invalid';
  end if;
  return public.club_household();
exception
  when check_violation or invalid_text_representation or not_null_violation or numeric_value_out_of_range
       or invalid_parameter_value then
    raise exception 'invalid';
end $function$
;

CREATE OR REPLACE FUNCTION public.club_household()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  h public.club_households%rowtype;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into h from public.club_households where owner_user_id = uid;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', h.id, 'display_name', h.display_name, 'preferences', h.preferences, 'profile_version', h.profile_version,
    'onboarded', h.onboarded_at is not null,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'first_name', m.first_name, 'kind', m.kind, 'role', m.role,
                                          'is_account_holder', m.is_account_holder,
                                          'birth_year', m.birth_year, 'birth_month', m.birth_month,
                                          'archived', m.archived_at is not null) order by m.sort, m.created_at)
        from public.club_family_members m
       where m.household_id = h.id and (m.archived_at is null or m.archived_at > now() - interval '1 year')), '[]'));
end $function$
;

CREATE OR REPLACE FUNCTION public.club_intro_grant(p_sub text, p_card text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  sub public.club_subscriptions%rowtype;
  hh public.club_households%rowtype;
  st public.club_settings%rowtype;
  claim public.club_intro_claims%rowtype;
  m date;
  v_email text;
  v_addr text;
  by_ text;
  ent uuid;
  welcome uuid;
begin
  select * into st from public.club_settings;
  select * into sub from public.club_subscriptions where stripe_subscription_id = p_sub;
  if not found then raise exception 'unknown_subscription'; end if;
  select * into claim from public.club_intro_claims where subscription_id = sub.id;
  if found then
    return jsonb_build_object('granted', claim.revoked_at is null, 'month', claim.intro_month, 'first_charge_at', sub.current_period_end, 'replay', true);
  end if;
  if sub.status <> 'trialing' or sub.user_id is null or 'duplicate' = any (sub.flags) or sub.access_revoked_at is not null then
    return jsonb_build_object('granted', false, 'reason', 'not_trialing');
  end if;
  select * into hh from public.club_households where owner_user_id = sub.user_id for update;
  if not found then raise exception 'no_household'; end if;
  m := case when st.program_start_month > public.club_month_of(sub.started_at) then st.program_start_month else public.club_month_of(sub.started_at) end;
  select public.club_email_hash(u.email) into v_email from auth.users u where u.id = sub.user_id;
  select public.club_address_hash(a.line1, a.postal_code) into v_addr from public.club_mailing_addresses a where a.user_id = sub.user_id;

  -- One free month per household: this account, its email, its mailing address, its card; or a member before.
  if exists (select 1 from public.club_intro_claims i
              where i.household_id = hh.id or i.user_id = sub.user_id or i.email_hash = v_email
                 or (v_addr is not null and i.address_hash = v_addr) or (p_card is not null and i.card_fingerprint = p_card))
     or exists (select 1 from public.club_subscriptions s where s.user_id = sub.user_id and s.id <> sub.id
                 and s.status not in ('incomplete', 'incomplete_expired')) then
    return jsonb_build_object('granted', false, 'reason', 'already_claimed',
      'fallback_trial_end', case when st.program_start_month > public.club_month_of(now())
                                 then st.program_start_month::timestamp at time zone 'America/New_York' end);
  end if;

  insert into public.club_intro_claims (subscription_id, user_id, household_id, email_hash, address_hash, card_fingerprint, intro_month)
  values (sub.id, sub.user_id, hh.id, v_email, v_addr, p_card, m);
  update public.club_households set enrolled_at = coalesce(enrolled_at, now()),
         first_paid_month = least(coalesce(first_paid_month, m), m), updated_at = now()
   where id = hh.id returning * into hh;

  -- The welcome print: free, right away, once per household.
  insert into public.club_fulfillment_orders (user_id, household_id, resource_month, fulfillment_type, invoice_id, provider, personalization)
  values (sub.user_id, hh.id, public.club_month_of(now()), 'welcome_vision', null, 'manual', null)
  on conflict (household_id) where status <> 'canceled' and fulfillment_type = 'welcome_vision' do nothing;
  select o.id into welcome from public.club_fulfillment_orders o
   where o.household_id = hh.id and o.fulfillment_type = 'welcome_vision' and o.status <> 'canceled';

  -- The free month, like a paid one. A first month that's a December is the welcome print (no Christmas mailing).
  by_ := 'monthly_resource';  -- 20261108: a first December gets its December resource too (no substitution).
  insert into public.club_entitlements (user_id, household_id, resource_month, kit_id, kind, membership_year, plan, source,
    invoice_id, subscription_id, period_start, period_end, fulfilled_by)
  values (sub.user_id, hh.id, m, case when by_ = 'monthly_resource' then (select k.id from public.club_kits k where k.month = m) end,
    'digital', public.club_membership_year(hh.first_paid_month, m), coalesce(sub.plan, 'monthly'), 'intro', null, sub.id,
    sub.current_period_start, sub.current_period_end, by_)
  on conflict (user_id, resource_month, kind) where revoked_at is null do nothing;
  if m >= st.first_mailing_month then
    insert into public.club_entitlements (user_id, household_id, resource_month, kit_id, kind, membership_year, plan, source,
      invoice_id, subscription_id, period_start, period_end, fulfilled_by)
    values (sub.user_id, hh.id, m, case when by_ = 'monthly_resource' then (select k.id from public.club_kits k where k.month = m) end,
      'physical', public.club_membership_year(hh.first_paid_month, m), coalesce(sub.plan, 'monthly'), 'intro', null, sub.id,
      sub.current_period_start, sub.current_period_end, by_)
    on conflict (user_id, resource_month, kind) where revoked_at is null do nothing
    returning id into ent;
    if ent is not null and by_ = 'welcome_vision' then
      update public.club_fulfillment_orders set entitlement_id = ent, satisfies_month = m, updated_at = now() where id = welcome and entitlement_id is null;
    elsif ent is not null then
      -- Its regular batch when she joined by that month's second-Sunday cutoff, else its catch-up batch.
      insert into public.club_fulfillment_orders (entitlement_id, user_id, household_id, resource_month, kit_id, late, cutoff_at, provider)
      values (ent, sub.user_id, hh.id, m, (select k.id from public.club_kits k where k.month = m),
        now() > public.club_mailing_cutoff_at(m), public.club_mailing_cutoff_at(m), 'manual')
      on conflict do nothing;
    end if;
  end if;
  return jsonb_build_object('granted', true, 'month', m, 'first_charge_at', sub.current_period_end, 'welcome_order', welcome);
end $function$
;

CREATE OR REPLACE FUNCTION public.club_invoice_apply(p jsonb, p_periods jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  sub public.club_subscriptions%rowtype;
  inv public.club_invoices%rowtype;
  hh public.club_households%rowtype;
  st public.club_settings%rowtype;
  first_month date;
  per jsonb;
  p_start timestamptz;
  p_end timestamptz;
  m date;
  n int;
  have int;
  guard int;
  by_ text;
  paid_at timestamptz;
  ent uuid;
  welcome uuid;
  granted int := 0;
  months date[] := '{}';
  first_paid boolean := false;
  was_paid boolean;
begin
  select * into st from public.club_settings;
  select * into sub from public.club_subscriptions where stripe_subscription_id = p ->> 'subscription';
  if not found then raise exception 'unknown_subscription'; end if;
  -- A replayed invoice.paid isn't her first payment again.
  was_paid := exists (select 1 from public.club_invoices where stripe_invoice_id = p ->> 'id' and status = 'paid');
  insert into public.club_invoices as x (stripe_invoice_id, subscription_id, user_id, status, billing_reason, amount_due_cents,
    amount_paid_cents, period_start, period_end, paid_at, livemode, stripe_payment_intent_id, stripe_charge_id, attempt_count,
    failure_message, plan, updated_at)
  values (p ->> 'id', sub.id, sub.user_id, p ->> 'status', p ->> 'billing_reason', coalesce((p ->> 'amount_due_cents')::int, 0),
    coalesce((p ->> 'amount_paid_cents')::int, 0), (p ->> 'period_start')::timestamptz, (p ->> 'period_end')::timestamptz,
    (p ->> 'paid_at')::timestamptz, (p ->> 'livemode')::boolean, p ->> 'payment_intent', p ->> 'charge',
    coalesce((p ->> 'attempt_count')::int, 0), left(p ->> 'failure_message', 300), p ->> 'plan', now())
  on conflict (stripe_invoice_id) do update set
    status = excluded.status, amount_due_cents = excluded.amount_due_cents, amount_paid_cents = excluded.amount_paid_cents,
    period_start = excluded.period_start, period_end = excluded.period_end, paid_at = coalesce(excluded.paid_at, x.paid_at),
    stripe_payment_intent_id = coalesce(excluded.stripe_payment_intent_id, x.stripe_payment_intent_id),
    stripe_charge_id = coalesce(excluded.stripe_charge_id, x.stripe_charge_id),
    attempt_count = greatest(x.attempt_count, excluded.attempt_count), failure_message = excluded.failure_message,
    plan = coalesce(excluded.plan, x.plan), updated_at = now()
  returning * into inv;

  if inv.status <> 'paid' or inv.amount_refunded_cents >= greatest(inv.amount_paid_cents, 1) and inv.amount_paid_cents > 0
     or inv.disputed or sub.access_revoked_at is not null or sub.user_id is null or 'duplicate' = any (sub.flags) then
    return jsonb_build_object('granted', 0, 'status', inv.status, 'first_paid', false, 'months', '[]'::jsonb);
  end if;
  paid_at := coalesce(inv.paid_at, now());

  select * into hh from public.club_households where owner_user_id = sub.user_id for update;
  if not found then raise exception 'no_household'; end if;
  first_paid := not was_paid and inv.amount_paid_cents > 0 and not exists (
    select 1 from public.club_invoices i2 join public.club_subscriptions s2 on s2.id = i2.subscription_id
     where s2.user_id = sub.user_id and i2.status = 'paid' and i2.amount_paid_cents > 0 and i2.stripe_invoice_id <> inv.stripe_invoice_id);

  -- The household's original first paid month: the earliest month any paid period covers. Never moves later.
  select min(public.club_month_of((x ->> 'start')::timestamptz)) into first_month from jsonb_array_elements(p_periods) x
   where st.program_start_month is null or public.club_month_of((x ->> 'start')::timestamptz) >= st.program_start_month;
  if first_month is not null and (hh.first_paid_month is null or first_month < hh.first_paid_month) then
    update public.club_households set first_paid_month = first_month, enrolled_at = coalesce(enrolled_at, inv.paid_at, now())
     where id = hh.id returning * into hh;
  end if;

  -- A member from her first paid invoice, even one that buys no month yet (a founding member's welcome print).
  if hh.enrolled_at is null and inv.amount_paid_cents > 0 then
    update public.club_households set enrolled_at = coalesce(inv.paid_at, now()) where id = hh.id returning * into hh;
  end if;

  -- The welcome print: once per household, outside the monthly cutoff, pending until she personalizes and approves it.
  if jsonb_array_length(p_periods) > 0 or inv.amount_paid_cents > 0 then
    insert into public.club_fulfillment_orders (user_id, household_id, resource_month, fulfillment_type, invoice_id, provider, personalization)
    values (sub.user_id, hh.id, public.club_month_of(paid_at), 'welcome_vision', inv.stripe_invoice_id, 'manual', null)
    on conflict (household_id) where status <> 'canceled' and fulfillment_type = 'welcome_vision' do nothing;
  end if;
  select o.id into welcome from public.club_fulfillment_orders o
   where o.household_id = hh.id and o.fulfillment_type = 'welcome_vision' and o.status <> 'canceled';

  for per in select * from jsonb_array_elements(p_periods) loop
    n := case when per ->> 'plan' = 'annual' then 12 else 1 end;
    p_start := (per ->> 'start')::timestamptz;
    p_end := (per ->> 'end')::timestamptz;
    -- Nothing before the program starts: a paid period there buys no month and no mailing (the 2027 resources
    -- are never handed out as 2026 months). Founding checkouts don't create such periods; this is the backstop.
    if st.program_start_month is not null and public.club_month_of(p_start) < st.program_start_month then
      continue;
    end if;
    -- What this invoice's period already granted (a replay grants nothing new).
    select count(*) into have from public.club_entitlements e
     where e.invoice_id = inv.stripe_invoice_id and e.kind = 'digital' and e.period_start = p_start;
    -- A renewal continues right after the months its subscription's previous paid period bought; otherwise the
    -- month the period starts in. Months already held are skipped, so a month is never sold twice.
    m := coalesce((select (max(e.resource_month) + interval '1 month')::date from public.club_entitlements e
                    where e.subscription_id = sub.id and e.kind = 'digital' and e.revoked_at is null
                      and e.period_end = p_start and e.invoice_id <> inv.stripe_invoice_id),
                  public.club_month_of(p_start));
    guard := 0;
    while have < n and guard < 36 loop
      guard := guard + 1;
      if not exists (select 1 from public.club_entitlements e where e.user_id = sub.user_id and e.resource_month = m
                      and e.kind = 'digital' and e.revoked_at is null) then
        by_ := 'monthly_resource';  -- 20261108: a first December gets its December resource too (no substitution).
        insert into public.club_entitlements (user_id, household_id, resource_month, kit_id, kind, membership_year, plan, source,
          invoice_id, subscription_id, period_start, period_end, fulfilled_by)
        values (sub.user_id, hh.id, m, case when by_ = 'monthly_resource' then (select k.id from public.club_kits k where k.month = m) end,
          'digital', public.club_membership_year(hh.first_paid_month, m), per ->> 'plan', 'invoice', inv.stripe_invoice_id, sub.id,
          p_start, p_end, by_);
        have := have + 1;
        granted := granted + 1;
        months := months || m;
      end if;
      m := (m + interval '1 month')::date;
    end loop;

    -- The printed copy of each paid month from the first mailing month: that month's resource, in its regular batch
    -- when paid by its cutoff, else its catch-up batch. A substituted December is the welcome print instead.
    for m, by_ in select e.resource_month, e.fulfilled_by from public.club_entitlements e
                   where e.invoice_id = inv.stripe_invoice_id and e.kind = 'digital' and e.period_start = p_start and e.revoked_at is null
                     and e.resource_month >= st.first_mailing_month
                   order by e.resource_month loop
      insert into public.club_entitlements (user_id, household_id, resource_month, kit_id, kind, membership_year, plan, source,
        invoice_id, subscription_id, period_start, period_end, fulfilled_by)
      values (sub.user_id, hh.id, m, case when by_ = 'monthly_resource' then (select k.id from public.club_kits k where k.month = m) end,
        'physical', public.club_membership_year(hh.first_paid_month, m), per ->> 'plan', 'invoice', inv.stripe_invoice_id, sub.id,
        p_start, p_end, by_)
      on conflict (user_id, resource_month, kind) where revoked_at is null do nothing
      returning id into ent;
      if found then
        if by_ = 'welcome_vision' then
          update public.club_fulfillment_orders set entitlement_id = ent, satisfies_month = m, updated_at = now()
           where id = welcome and entitlement_id is null;
        else
          insert into public.club_fulfillment_orders (entitlement_id, user_id, household_id, resource_month, kit_id, late, cutoff_at, provider)
          values (ent, sub.user_id, hh.id, m, (select k.id from public.club_kits k where k.month = m),
            paid_at > public.club_mailing_cutoff_at(m), public.club_mailing_cutoff_at(m), 'manual')
          on conflict do nothing;
        end if;
      end if;
    end loop;
  end loop;

  -- A substituted December before the first mailing month (none today) still names the welcome print.
  update public.club_fulfillment_orders set satisfies_month = hh.first_paid_month, updated_at = now()
   where id = welcome and satisfies_month is null and extract(month from hh.first_paid_month) = 12
     and exists (select 1 from public.club_entitlements e where e.household_id = hh.id and e.resource_month = hh.first_paid_month
                  and e.fulfilled_by = 'welcome_vision' and e.revoked_at is null);

  return jsonb_build_object('granted', granted, 'status', inv.status, 'first_paid', first_paid,
    'program_start', st.program_start_month,
    'months', to_jsonb(months), 'user_id', sub.user_id, 'household_id', hh.id, 'welcome_order', welcome,
    'mailings', (select coalesce(jsonb_agg(e.resource_month order by e.resource_month), '[]') from public.club_entitlements e
                  where e.invoice_id = inv.stripe_invoice_id and e.kind = 'physical' and e.revoked_at is null));
end $function$
;

CREATE OR REPLACE FUNCTION public.club_me()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  s public.club_subscriptions%rowtype;
  h public.club_households%rowtype;
  cur date := public.club_month_of(now());
  last_owned date;
  next_month date;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into s from public.club_subscriptions where user_id = uid order by (status in ('trialing', 'active', 'past_due', 'unpaid', 'paused')) desc, created_at desc limit 1;
  select * into h from public.club_households where owner_user_id = uid;
  select max(e.resource_month) into last_owned from public.club_entitlements e where e.user_id = uid and e.kind = 'digital' and e.revoked_at is null;
  next_month := coalesce((last_owned + interval '1 month')::date, public.club_month_of(s.current_period_end));
  return jsonb_build_object(
    'access', public.club_has_access(uid),
    -- Her free first month (one per household), and when it ends.
    'intro', (select jsonb_build_object('month', i.intro_month, 'trial_ends', case when s.status = 'trialing' then s.current_period_end end)
                from public.club_intro_claims i where i.user_id = uid and i.revoked_at is null order by i.claimed_at desc limit 1),
    'grant', (select g.reason from public.club_access_grants g
               where g.user_id = uid and g.revoked_at is null and (g.expires_at is null or g.expires_at > now())),
    'member', h.enrolled_at is not null or coalesce(s.status in ('trialing', 'active', 'past_due'), false),
    'plan', s.plan,
    'status', s.status,
    'payment_problem', s.status in ('past_due', 'unpaid', 'incomplete'),
    'renews', case when s.status in ('trialing', 'active', 'past_due') and not s.cancel_at_period_end then s.current_period_end end,
    'ends', case when s.cancel_at_period_end and s.status in ('trialing', 'active', 'past_due') then s.current_period_end end,
    'ended_at', s.ended_at,
    'revoked', s.access_revoked_at is not null,
    'onboarded', h.onboarded_at is not null,
    'has_address', exists (select 1 from public.club_mailing_addresses a where a.user_id = uid),
    'enrolled_at', h.enrolled_at,
    'first_paid_month', h.first_paid_month,
    'current_month', cur,
    'membership_year', case when h.first_paid_month is not null then public.club_membership_year(h.first_paid_month, greatest(cur, h.first_paid_month)) end,
    'kits', coalesce((
      select jsonb_agg(jsonb_build_object('slug', k.slug, 'title', k.title, 'month', k.month,
                                          'can', public.club_can_open(uid, k.id)) order by k.month desc)
        from public.club_kits k where public.club_can_open(uid, k.id) <> 'none'), '[]'),
    -- 2d: a kit that is her first month alone has no welcome item to approve ('approved' true, kind 'monthly').
    'welcome', (select jsonb_build_object('status', q.status, 'readiness', q.readiness,
                  'approved', q.fulfillment_type = 'monthly_resource' or q.member_approved_at is not null,
                  'personalized', case when q.fulfillment_type = 'monthly_resource' then true when q.fulfillment_type = 'welcome_rhythm' then public.club_rhythm_valid(q.personalization) else public.club_vision_valid(q.personalization) end,
                  'satisfies_month', q.satisfies_month, 'mailed_at', q.mailed_at,
                  'kind', case when q.fulfillment_type = 'monthly_resource' then 'monthly' when q.fulfillment_type = 'welcome_rhythm' then 'rhythm' else 'vision' end)
                  from public.club_fulfillment_queue q where q.user_id = uid and (q.fulfillment_type in ('welcome_vision', 'welcome_rhythm') or (q.fulfillment_type = 'monthly_resource' and q.in_welcome_kit and q.kit_partner_id is null)) and q.status <> 'canceled'
                 order by (q.fulfillment_type = 'monthly_resource') limit 1),
    -- The next month she'd receive, and when it's paid for (only while the membership continues).
    -- A founding member who holds no month yet: the month her first membership payment buys.
    'next', case when s.status in ('trialing', 'active', 'past_due') and not s.cancel_at_period_end
                  and next_month is not null then
              jsonb_build_object('month', next_month, 'payment_on', s.current_period_end,
                'slug', (select k.slug from public.club_kits k where k.month = next_month),
                'title', (select k.title from public.club_kits k where k.month = next_month),
                'regular_cutoff_at', public.club_mailing_cutoff_at(next_month)) end,
    -- Only the months she has bought, each with what fulfills it and its printed copy.
    'months', coalesce((
      select jsonb_agg(r order by (r ->> 'month')) from (
        select jsonb_build_object(
          'month', d.resource_month,
          'fulfilled_by', d.fulfilled_by,
          'free', d.source = 'intro',
          'slug', k.slug, 'title', k.title,
          'published', coalesce(k.status in ('scheduled', 'retired'), false),
          'can', case when k.id is null or d.fulfilled_by <> 'monthly_resource' then 'none' else public.club_can_open(uid, k.id) end,
          'state', case
            when d.fulfilled_by = 'welcome_vision' then 'welcome_vision'
            when coalesce(k.status in ('scheduled', 'retired'), false) then 'available'
            else 'preparing' end,
          'membership_year', d.membership_year,
          'plan', d.plan,
          'mailing', (select jsonb_build_object('status', q.status, 'readiness', q.readiness, 'late', q.late, 'batch', q.batch,
                                                'approved', q.member_approved_at is not null, 'mailed_at', q.mailed_at)
                        from public.club_fulfillment_queue q where q.user_id = uid and q.resource_month = d.resource_month
                         and q.fulfillment_type = 'monthly_resource' and q.status <> 'canceled' limit 1)
        ) as r
        from public.club_entitlements d
        left join public.club_kits k on k.month = d.resource_month
        where d.user_id = uid and d.kind = 'digital' and d.revoked_at is null
      ) t), '[]'));
end $function$
;

CREATE OR REPLACE FUNCTION public.club_meeting_guide_mark()
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  t timestamptz;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  update public.club_households set meeting_guide_seen_at = coalesce(meeting_guide_seen_at, now())
   where owner_user_id = auth.uid() returning meeting_guide_seen_at into t;
  if t is null then raise exception 'no_household'; end if;
  return t;
end $function$
;

CREATE OR REPLACE FUNCTION public.club_meeting_guide_seen()
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select h.meeting_guide_seen_at from public.club_households h where h.owner_user_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.club_member_link(p_user uuid, p_email text, p_customer text, p_livemode boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  hid uuid;
  existing uuid;
begin
  if p_user is null or p_customer !~ '^cus_[A-Za-z0-9]+$' then raise exception 'invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('club-household:' || p_user::text, 0));
  insert into public.club_households (owner_user_id, billing_email) values (p_user, lower(btrim(p_email)))
  on conflict (owner_user_id) do update set billing_email = coalesce(club_households.billing_email, excluded.billing_email)
  returning id into hid;
  select user_id into existing from public.club_customers where stripe_customer_id = p_customer;
  if existing is not null and existing <> p_user then raise exception 'customer_user_mismatch'; end if;
  if exists (select 1 from public.club_customers where user_id = p_user and stripe_customer_id <> p_customer) then
    insert into public.club_customers (stripe_customer_id, user_id, email, livemode, household_id)
    values (p_customer, null, lower(btrim(p_email)), p_livemode, hid)
    on conflict (stripe_customer_id) do update set household_id = excluded.household_id;
  else
    insert into public.club_customers (stripe_customer_id, user_id, email, livemode, household_id)
    values (p_customer, p_user, lower(btrim(p_email)), p_livemode, hid)
    on conflict (stripe_customer_id) do update set user_id = excluded.user_id, household_id = excluded.household_id;
  end if;
  return jsonb_build_object('household_id', hid);
end $function$
;

CREATE OR REPLACE FUNCTION public.club_my_household()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  hid uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select id into hid from public.club_households where owner_user_id = auth.uid();
  if hid is null then raise exception 'no_household'; end if;
  return hid;
end $function$
;

CREATE OR REPLACE FUNCTION public.club_resource_get(p_kit text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  k public.club_kits%rowtype;
  can text;
  v public.club_resource_versions%rowtype;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into k from public.club_kits where slug = p_kit;
  if not found then raise exception 'not_found'; end if;
  can := public.club_can_open(uid, k.id);
  if can = 'none' then raise exception 'not_found'; end if;
  select v2.* into v from public.club_resource_versions v2 join public.club_households h on h.id = v2.household_id
   where h.owner_user_id = uid and v2.kit_id = k.id;
  return jsonb_build_object('can', can, 'month', k.month, 'state', coalesce(v.state, '{}'), 'revision', coalesce(v.revision, 0),
    'profile_version', v.profile_version, 'approved_at', v.approved_at,
    'mailing', (select jsonb_build_object('status', q.status, 'readiness', q.readiness, 'approved', q.member_approved_at is not null)
                  from public.club_fulfillment_queue q where q.user_id = uid and q.resource_month = k.month and q.status <> 'canceled'
                   and q.fulfillment_type = 'monthly_resource' limit 1));
end $function$
;

CREATE OR REPLACE FUNCTION public.club_resource_save(p_kit text, p_state jsonb, p_revision integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  k public.club_kits%rowtype;
  h public.club_households%rowtype;
  rev int;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into k from public.club_kits where slug = p_kit;
  if not found or public.club_can_open(uid, k.id) <> 'edit' then raise exception 'read_only'; end if;
  select * into h from public.club_households where owner_user_id = uid;
  if not found then raise exception 'no_household'; end if;
  if exists (select 1 from public.club_fulfillment_queue q where q.household_id = h.id and q.resource_month = k.month
              and q.fulfillment_type = 'monthly_resource'
              and (q.status in ('printed', 'mailed') or (q.in_welcome_kit and q.status = 'approved'))) then
    raise exception 'already_printed';
  end if;
  -- Opening a printable writes back what it loaded: the same state changes nothing, and keeps her approval.
  if p_revision <> 0 and exists (select 1 from public.club_resource_versions v where v.household_id = h.id and v.kit_id = k.id
                                    and v.revision = p_revision and v.state = p_state) then
    return p_revision;
  end if;
  if p_revision = 0 then
    insert into public.club_resource_versions (household_id, kit_id, state, profile_version)
    values (h.id, k.id, p_state, h.profile_version) on conflict (household_id, kit_id) do nothing returning revision into rev;
  else
    update public.club_resource_versions set state = p_state, profile_version = h.profile_version, revision = revision + 1,
           approved_at = null, updated_at = now()
     where household_id = h.id and kit_id = k.id and revision = p_revision returning revision into rev;
  end if;
  if rev is null then raise exception 'conflict'; end if;
  update public.club_fulfillment_orders set member_approved_at = null, pdf_status = 'not_ready', updated_at = now()
   where household_id = h.id and resource_month = k.month and fulfillment_type = 'monthly_resource' and status in ('pending', 'on_hold');
  return rev;
exception
  when check_violation or not_null_violation then raise exception 'invalid';
end $function$
;

CREATE OR REPLACE FUNCTION public.club_responsibilities_save(p_status text, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  hid uuid := public.club_my_household();
  r jsonb;
  rid uuid;
  owners uuid[];
  helpers uuid[];
  keep uuid[] := '{}';
  i int := 0;
begin
  if p_status not in ('existing', 'desired') or p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) > 30 then
    raise exception 'invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('club-household:' || auth.uid()::text, 0));
  for r in select * from jsonb_array_elements(p_items) loop
    i := i + 1;
    rid := nullif(r ->> 'id', '')::uuid;
    if rid is not null and not exists (select 1 from public.club_responsibilities where id = rid and household_id = hid and status = p_status) then
      raise exception 'invalid';
    end if;
    owners := public.club_uuid_list(r -> 'owner_ids');
    helpers := public.club_uuid_list(r -> 'helper_ids');
    if not public.club_members_belong(hid, owners || helpers) then raise exception 'invalid'; end if;
    insert into public.club_responsibilities as t (id, household_id, status, category, item, label, owner_ids, helper_ids, scope, sort)
    values (coalesce(rid, gen_random_uuid()), hid, p_status, r ->> 'category', nullif(r ->> 'item', ''),
            nullif(btrim(r ->> 'label'), ''), owners, helpers,
            case cardinality(owners) when 0 then null when 1 then 'individual' else 'shared' end, i)
    on conflict (id) do update
      set category = excluded.category, item = excluded.item, label = excluded.label, owner_ids = excluded.owner_ids,
          helper_ids = excluded.helper_ids, scope = excluded.scope, sort = excluded.sort, updated_at = now()
    returning t.id into rid;
    keep := keep || rid;
  end loop;
  delete from public.club_responsibilities where household_id = hid and status = p_status and not (id = any (keep));
  perform public.club_setup_mark(hid, case p_status when 'existing' then 'responsibilities' else 'growth' end);
  return public.club_family_profile();
exception
  when check_violation or invalid_text_representation or not_null_violation or numeric_value_out_of_range
       or invalid_parameter_value then
    raise exception 'invalid';
end $function$
;

CREATE OR REPLACE FUNCTION public.club_welcome_item_of(p_user uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(
    (select 'monthly' from public.club_households h where h.owner_user_id = p_user and h.welcome_kit_monthly_only
      and not exists (select 1 from public.club_fulfillment_orders o where o.user_id = p_user and o.status <> 'canceled'
                        and o.fulfillment_type in ('welcome_vision', 'welcome_rhythm'))),
    (select case when o.fulfillment_type = 'welcome_rhythm' then 'rhythm' else 'vision' end from public.club_fulfillment_orders o
      where o.user_id = p_user and o.fulfillment_type in ('welcome_vision', 'welcome_rhythm') and o.status <> 'canceled'
      order by o.created_at desc limit 1),
    (select s.welcome_item from public.club_settings s limit 1), 'vision');
$function$
;

CREATE OR REPLACE FUNCTION public.club_welcome_plan_access(p_user uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when not exists (select 1 from public.club_households h where h.owner_user_id = p_user) then 'none'
    when public.club_has_access(p_user) then 'edit'
    when exists (select 1 from public.club_entitlements e where e.user_id = p_user and e.revoked_at is null)
      or exists (select 1 from public.club_fulfillment_orders o where o.user_id = p_user and o.status <> 'canceled'
                   and o.fulfillment_type <> 'monthly_resource') then 'read'
    else 'none'
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.club_welcome_plan_approve(p_revision integer, p_fingerprint text, p_state jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  h public.club_households%rowtype;
  n int;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if public.club_welcome_plan_access(uid) <> 'edit' then raise exception 'read_only'; end if;
  if p_fingerprint is null or btrim(p_fingerprint) = '' then raise exception 'invalid'; end if;
  select * into h from public.club_households where owner_user_id = uid;
  if not found then raise exception 'no_household'; end if;
  if p_revision = 0 then
    if p_state is null then raise exception 'invalid'; end if;
    insert into public.club_welcome_plans (household_id, state, approved_at, approved_fingerprint)
      values (h.id, p_state, now(), p_fingerprint) on conflict (household_id) do nothing;
    get diagnostics n = row_count;
  else
    update public.club_welcome_plans set approved_at = now(), approved_fingerprint = p_fingerprint, updated_at = now()
     where household_id = h.id and revision = p_revision;
    get diagnostics n = row_count;
  end if;
  if n = 0 then raise exception 'conflict'; end if;
  perform public.club_welcome_rhythm_order_set(h.id);
  return public.club_welcome_plan_get();
exception
  when check_violation or not_null_violation then raise exception 'invalid';
end $function$
;

CREATE OR REPLACE FUNCTION public.club_welcome_plan_get()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  can text;
  w public.club_welcome_plans%rowtype;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  can := public.club_welcome_plan_access(uid);
  if can = 'none' then raise exception 'not_found'; end if;
  select w2.* into w from public.club_welcome_plans w2 join public.club_households h on h.id = w2.household_id where h.owner_user_id = uid;
  return jsonb_build_object('can', can, 'resource', 'family-rhythm', 'state', coalesce(w.state, '{}'), 'revision', coalesce(w.revision, 0),
    'approved_at', w.approved_at, 'approved_fingerprint', w.approved_fingerprint, 'updated_at', w.updated_at);
end $function$
;

CREATE OR REPLACE FUNCTION public.club_welcome_plan_save(p_state jsonb, p_revision integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  h public.club_households%rowtype;
  rev int;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if public.club_welcome_plan_access(uid) <> 'edit' then raise exception 'read_only'; end if;
  select * into h from public.club_households where owner_user_id = uid;
  if not found then raise exception 'no_household'; end if;
  if p_revision <> 0 and exists (select 1 from public.club_welcome_plans w where w.household_id = h.id and w.revision = p_revision and w.state = p_state) then
    return p_revision;
  end if;
  if p_revision = 0 then
    insert into public.club_welcome_plans (household_id, state) values (h.id, p_state)
      on conflict (household_id) do nothing returning revision into rev;
  else
    update public.club_welcome_plans set state = p_state, revision = revision + 1, approved_at = null, approved_fingerprint = null, updated_at = now()
     where household_id = h.id and revision = p_revision returning revision into rev;
  end if;
  if rev is null then raise exception 'conflict'; end if;
  -- A change after she approved it for her Welcome Kit: the kit waits for her approval again (nothing has gone to
  -- print yet). Once the owner approved the kit for print, the order keeps the plan she approved.
  if p_revision <> 0 then perform public.club_welcome_rhythm_order_clear(h.id); end if;
  return rev;
exception
  when check_violation or not_null_violation then raise exception 'invalid';
end $function$
;

CREATE OR REPLACE FUNCTION public.club_welcome_plan_unapprove(p_revision integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  n int;
  hid uuid;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if public.club_welcome_plan_access(uid) <> 'edit' then raise exception 'read_only'; end if;
  update public.club_welcome_plans w set approved_at = null, approved_fingerprint = null, updated_at = now()
    from public.club_households h where h.id = w.household_id and h.owner_user_id = uid and w.revision = p_revision;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'conflict'; end if;
  select h.id into hid from public.club_households h where h.owner_user_id = uid;
  perform public.club_welcome_rhythm_order_clear(hid);
  return public.club_welcome_plan_get();
end $function$
;
