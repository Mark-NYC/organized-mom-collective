-- Organized Family Club: the Welcome Family Rhythm, saved per household (Phase 2b,
-- docs/club/WELCOME_MARCH_DECEMBER_MIGRATION.md → §3.2, owner decision D1).
--
-- A permanent resource, not a month: it can't live in club_kits / club_resource_versions (one kit per month, unique,
-- opened by entitlement). One row per household, the same revision rules as club_resource_save, and an approval
-- recorded against what prints (the printable's fingerprint), so the Welcome Kit (2c) can trust it on any device.
--
-- Evergreen, not homework (owner guardrail, §11.1): approval is asked once, for printing; saving a change clears it
-- (she approves again only if a mailing still needs it); nothing here schedules a check-in, reapproval or reminder.
--
-- Access: edit while she has Club access; read afterwards if she ever held a month or a Welcome Kit; nobody else.
-- Additive only: no existing table, function, order, entitlement or approval changes. Tests: supabase/tests/club-welcome-plan.sql.

begin;

create table public.club_welcome_plans (
  household_id uuid primary key references public.club_households (id) on delete cascade,
  resource text not null default 'family-rhythm' check (resource in ('family-rhythm')),
  -- The page's saved storage entries, as club_resource_versions.state ({ "<key>": { "s": "s", "v": "<json>" } }).
  state jsonb not null default '{}' check (jsonb_typeof(state) = 'object' and octet_length(state::text) <= 65536),
  revision int not null default 1,
  approved_at timestamptz,
  -- What printed when she approved (the printable's fingerprint). Set and cleared together with approved_at.
  approved_fingerprint text check (octet_length(approved_fingerprint) <= 32768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint club_welcome_plans_approval_pair check ((approved_at is null) = (approved_fingerprint is null))
);

alter table public.club_welcome_plans enable row level security;
revoke all on public.club_welcome_plans from public, anon, authenticated;
-- No policies: members read and write only through the functions below; admins through the fulfillment print view (2c).

-- 'edit' | 'read' | 'none' for this user's household.
create function public.club_welcome_plan_access(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when not exists (select 1 from public.club_households h where h.owner_user_id = p_user) then 'none'
    when public.club_has_access(p_user) then 'edit'
    when exists (select 1 from public.club_entitlements e where e.user_id = p_user and e.revoked_at is null)
      or exists (select 1 from public.club_fulfillment_orders o where o.user_id = p_user and o.status <> 'canceled'
                   and o.fulfillment_type <> 'monthly_resource') then 'read'
    else 'none'
  end;
$$;
revoke execute on function public.club_welcome_plan_access(uuid) from public, anon, authenticated;
grant execute on function public.club_welcome_plan_access(uuid) to service_role;

create function public.club_welcome_plan_get() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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
end $$;

-- Save her plan (edit access; a stale tab gets 'conflict'). The same state is a no-op that keeps her approval; any
-- other change clears it. Never refused because something was printed: the Welcome Kit prints its own snapshot (2c).
create function public.club_welcome_plan_save(p_state jsonb, p_revision int) returns int
language plpgsql security definer set search_path = '' as $$
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
  return rev;
exception
  when check_violation or not_null_violation then raise exception 'invalid';
end $$;

-- Her approval of what prints, against the revision she's looking at (a newer save elsewhere: 'conflict'). A plan she
-- never changed has no row yet: approving it saves the prepared plan she approved (p_state) first.
create function public.club_welcome_plan_approve(p_revision int, p_fingerprint text, p_state jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
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
  return public.club_welcome_plan_get();
exception
  when check_violation or not_null_violation then raise exception 'invalid';
end $$;

-- Taking her approval back (Undo). Same revision rule.
create function public.club_welcome_plan_unapprove(p_revision int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if public.club_welcome_plan_access(uid) <> 'edit' then raise exception 'read_only'; end if;
  update public.club_welcome_plans w set approved_at = null, approved_fingerprint = null, updated_at = now()
    from public.club_households h where h.id = w.household_id and h.owner_user_id = uid and w.revision = p_revision;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'conflict'; end if;
  return public.club_welcome_plan_get();
end $$;

revoke execute on function public.club_welcome_plan_get(), public.club_welcome_plan_save(jsonb, int),
  public.club_welcome_plan_approve(int, text, jsonb), public.club_welcome_plan_unapprove(int) from public, anon;
grant execute on function public.club_welcome_plan_get(), public.club_welcome_plan_save(jsonb, int),
  public.club_welcome_plan_approve(int, text, jsonb), public.club_welcome_plan_unapprove(int) to authenticated;

commit;
