-- Captured 2026-11-17 after Session B (20261124-26) was applied, before Session C. Read-only. The exact definitions
-- of the 9 existing functions Session C (20261127, 20261128, 20261201) replaces, so C alone can be undone without
-- touching Session B. Byte-identical to production (md5 per function checked against the live database).
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
  select * into h from public.club_households where id = public.household_id_for(uid);
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
