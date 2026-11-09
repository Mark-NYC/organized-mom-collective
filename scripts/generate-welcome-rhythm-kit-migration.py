#!/usr/bin/env python3
"""
Writes supabase/migrations/20261122000000_club_welcome_rhythm_kit.sql (Phase 2c,
docs/club/WELCOME_MARCH_DECEMBER_MIGRATION.md).

Every live function or view it changes is copied from its latest definition in the repository's migrations, word for
word, and only the listed replacements are applied; each replacement must match exactly the expected number of times or
the script stops. So the regenerated definitions can't drift from what production runs, and the diff of each one is
exactly the replacements below. Run: python3 scripts/generate-welcome-rhythm-kit-migration.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIG = ROOT / 'supabase' / 'migrations'
OUT = MIG / '20261122000000_club_welcome_rhythm_kit.sql'
BOTH = "('welcome_vision', 'welcome_rhythm')"


def latest(name: str, kind: str = 'function') -> str:
    """The last definition of public.<name> in the migrations, from `create` to its closing `$$;` (or `;` for a view)."""
    found = None
    for f in sorted(MIG.glob('*.sql')):
        if f.name >= OUT.name:
            continue  # only what comes before this migration (later ones may redefine the same objects)
        text = f.read_text()
        pat = (rf'create (or replace )?function public\.{name}\(.*?\$\$;' if kind == 'function'
               else rf'create (or replace )?view public\.{name} .*?;\n\n')
        for m in re.finditer(pat, text, re.S):
            found = (f.name, m.group(0).rstrip())
    if not found:
        sys.exit(f'{name}: no definition found')
    src, body = found
    body = re.sub(r'^create (function|view)', r'create or replace \1', body)
    return f'-- {name}: from {src}, with the replacements listed in scripts/generate-welcome-rhythm-kit-migration.py\n{body}'


def edit(body: str, pairs: list[tuple[str, str, int]]) -> str:
    for old, new, n in pairs:
        c = body.count(old)
        if c != n:
            sys.exit(f'expected {n} × {old[:70]!r}, found {c}')
        body = body.replace(old, new)
    return body


queue = edit(latest('club_fulfillment_queue', 'view'), [
    # Kit readiness: the welcome item is the Vision print or the Family Rhythm.
    ("           when not public.club_vision_valid(kit.w_personalization) or kit.w_approved_at is null then 'needs_vision'\n",
     "           when kit.w_type = 'welcome_vision' and (not public.club_vision_valid(kit.w_personalization) or kit.w_approved_at is null) then 'needs_vision'\n"
     "           when kit.w_type = 'welcome_rhythm' and (not public.club_rhythm_valid(kit.w_personalization) or kit.w_approved_at is null) then 'needs_rhythm'\n", 1),
    ("         when o.fulfillment_type = 'welcome_vision' and (not public.club_vision_valid(o.personalization) or o.member_approved_at is null) then 'needs_vision'\n",
     "         when o.fulfillment_type = 'welcome_vision' and (not public.club_vision_valid(o.personalization) or o.member_approved_at is null) then 'needs_vision'\n"
     "         when o.fulfillment_type = 'welcome_rhythm' and (not public.club_rhythm_valid(o.personalization) or o.member_approved_at is null) then 'needs_rhythm'\n", 1),
    ("when o.fulfillment_type = 'welcome_vision' then 'welcome'", f"when o.fulfillment_type in {BOTH} then 'welcome'", 1),
    ("case when o.fulfillment_type = 'welcome_vision' then kit.m_id else kit.w_id end as kit_partner_id",
     f"case when o.fulfillment_type in {BOTH} then kit.m_id else kit.w_id end as kit_partner_id", 1),
    ("w.fulfillment_type = 'welcome_vision' and w.status <> 'canceled'", f"w.fulfillment_type in {BOTH} and w.status <> 'canceled'", 1),
    ("     where o.fulfillment_type = 'welcome_vision' and o.satisfies_month is null\n",
     f"     where o.fulfillment_type in {BOTH} and o.satisfies_month is null\n", 1),
    ("       (o.fulfillment_type = 'welcome_vision' and o.satisfies_month is null) or kw.id is not null as in_kit,\n",
     f"       (o.fulfillment_type in {BOTH} and o.satisfies_month is null) or kw.id is not null as in_kit,\n"
     f"       case when o.fulfillment_type in {BOTH} then o.fulfillment_type else kw.fulfillment_type end as w_type,\n", 1),
    ("case when o.fulfillment_type = 'welcome_vision' then o.", f"case when o.fulfillment_type in {BOTH} then o.", 4),
    # One more column, at the end (a view can only gain columns there): which welcome item the kit carries.
    ("       h.meeting_guide_seen_at\n", "       h.meeting_guide_seen_at,\n       case when kit.in_kit then kit.w_type end as kit_welcome_type\n", 1),
])

set_kit = edit(latest('club_admin_set_welcome_kit'), [
    ("case when q.fulfillment_type = 'welcome_vision' then", f"case when q.fulfillment_type in {BOTH} then", 2),
])

welcome_queue = edit(latest('club_admin_welcome_queue'), [
    ("'vision_value', q.personalization ->> 'value', 'family_name', q.personalization ->> 'family_name',",
     "'welcome_item', q.fulfillment_type,\n"
     "                     'vision_value', case when q.fulfillment_type = 'welcome_vision' then q.personalization ->> 'value' end,\n"
     "                     'family_name', case when q.fulfillment_type = 'welcome_vision' then q.personalization ->> 'family_name' else q.display_name end,\n"
     "                     'rhythm_approved_at', case when q.fulfillment_type = 'welcome_rhythm' then q.personalization ->> 'approved_at' end,", 1),
    ("'Family Vision print (personalized)', 'Family Meeting guide (standard insert)',",
     "case when q.fulfillment_type = 'welcome_rhythm' then 'Family Rhythm (personalized)' else 'Family Vision print (personalized)' end, 'Family Meeting guide (standard insert)',", 1),
    ("else jsonb_build_array('Family Vision print (personalized)') end)",
     "else jsonb_build_array(case when q.fulfillment_type = 'welcome_rhythm' then 'Family Rhythm (personalized)' else 'Family Vision print (personalized)' end) end)", 1),
    ("where q.fulfillment_type = 'welcome_vision' and q.status not in", f"where q.fulfillment_type in {BOTH} and q.status not in", 1),
])

audience = edit(latest('club_email_audience'), [
    # Her two Welcome Kit reminders, as before, for either welcome item (and nothing more: requirement 10, §11.1).
    ("where p_kind = 'kit_reminder' and q.fulfillment_type = 'welcome_vision' and q.status = 'pending'",
     f"where p_kind = 'kit_reminder' and q.fulfillment_type in {BOTH} and q.status = 'pending'", 1),
])

kit_submitted = edit(latest('club_kit_submitted'), [
    ("'submitted_at', q.kit_submitted_at, 'ship_by', q.kit_ship_by)",
     "'submitted_at', q.kit_submitted_at, 'ship_by', q.kit_ship_by, 'welcome_item', q.fulfillment_type)", 1),
    ("where q.user_id = p_user and q.fulfillment_type = 'welcome_vision' and q.in_welcome_kit",
     f"where q.user_id = p_user and q.fulfillment_type in {BOTH} and q.in_welcome_kit", 1),
])

me = edit(latest('club_me'), [
    ("'personalized', public.club_vision_valid(q.personalization), 'satisfies_month', q.satisfies_month, 'mailed_at', q.mailed_at)\n"
     "                  from public.club_fulfillment_queue q where q.user_id = uid and q.fulfillment_type = 'welcome_vision' and q.status <> 'canceled' limit 1),",
     "'personalized', case when q.fulfillment_type = 'welcome_rhythm' then public.club_rhythm_valid(q.personalization) else public.club_vision_valid(q.personalization) end,\n"
     "                  'satisfies_month', q.satisfies_month, 'mailed_at', q.mailed_at,\n"
     "                  'kind', case when q.fulfillment_type = 'welcome_rhythm' then 'rhythm' else 'vision' end)\n"
     f"                  from public.club_fulfillment_queue q where q.user_id = uid and q.fulfillment_type in {BOTH} and q.status <> 'canceled' limit 1),", 1),
])

members = edit(latest('club_admin_members'), [
    ("'welcome', (select jsonb_build_object('status', q.status, 'readiness', q.readiness, 'satisfies_month', q.satisfies_month, 'mailed_at', q.mailed_at)\n"
     "                    from public.club_fulfillment_queue q where q.user_id = h.owner_user_id and q.fulfillment_type = 'welcome_vision' and q.status <> 'canceled' limit 1),",
     "'welcome', (select jsonb_build_object('status', q.status, 'readiness', q.readiness, 'satisfies_month', q.satisfies_month, 'mailed_at', q.mailed_at,\n"
     "                        'welcome_item', q.fulfillment_type)\n"
     f"                    from public.club_fulfillment_queue q where q.user_id = h.owner_user_id and q.fulfillment_type in {BOTH} and q.status <> 'canceled' limit 1),", 1),
])

member_months = edit(latest('club_admin_member_months'), [
    ("'created_at', q.created_at, 'mailed_at', q.mailed_at, 'vision_value', q.personalization ->> 'value')",
     "'created_at', q.created_at, 'mailed_at', q.mailed_at, 'welcome_item', q.fulfillment_type,\n"
     "                  'vision_value', case when q.fulfillment_type = 'welcome_vision' then q.personalization ->> 'value' end)", 1),
    ("where q.user_id = p_user and q.fulfillment_type = 'welcome_vision'", f"where q.user_id = p_user and q.fulfillment_type in {BOTH}", 1),
])

bundle = edit(latest('club_admin_fulfillment_bundle'), [
    # The Family Rhythm prints the plan she approved, kept on the order: never her live plan.
    ("'state', (select v.state from public.club_resource_versions v where v.household_id = o.household_id and v.kit_id = o.kit_id));",
     "'state', case when o.fulfillment_type = 'welcome_rhythm' then o.personalization -> 'state'\n"
     "              else (select v.state from public.club_resource_versions v where v.household_id = o.household_id and v.kit_id = o.kit_id) end);", 1),
])

# Her Welcome plan's save / approve / unapprove (Phase 2b) now keep the Welcome Kit's Family Rhythm order in step.
plan_save = edit(latest('club_welcome_plan_save'), [
    ("  if rev is null then raise exception 'conflict'; end if;\n  return rev;",
     "  if rev is null then raise exception 'conflict'; end if;\n"
     "  -- A change after she approved it for her Welcome Kit: the kit waits for her approval again (nothing has gone to\n"
     "  -- print yet). Once the owner approved the kit for print, the order keeps the plan she approved.\n"
     "  if p_revision <> 0 then perform public.club_welcome_rhythm_order_clear(h.id); end if;\n"
     "  return rev;", 1),
])
plan_approve = edit(latest('club_welcome_plan_approve'), [
    ("  if n = 0 then raise exception 'conflict'; end if;\n  return public.club_welcome_plan_get();",
     "  if n = 0 then raise exception 'conflict'; end if;\n"
     "  perform public.club_welcome_rhythm_order_set(h.id);\n"
     "  return public.club_welcome_plan_get();", 1),
])
plan_unapprove = edit(latest('club_welcome_plan_unapprove'), [
    ("declare\n  uid uuid := auth.uid();\n  n int;\nbegin",
     "declare\n  uid uuid := auth.uid();\n  n int;\n  hid uuid;\nbegin", 1),
    ("  if n = 0 then raise exception 'conflict'; end if;\n  return public.club_welcome_plan_get();",
     "  if n = 0 then raise exception 'conflict'; end if;\n"
     "  select h.id into hid from public.club_households h where h.owner_user_id = uid;\n"
     "  perform public.club_welcome_rhythm_order_clear(hid);\n"
     "  return public.club_welcome_plan_get();", 1),
])

HEAD = """-- GENERATED by scripts/generate-welcome-rhythm-kit-migration.py: edit the script, not this file.
--
-- Organized Family Club: the Family Rhythm in the Welcome Kit (Phase 2c, docs/club/WELCOME_MARCH_DECEMBER_MIGRATION.md).
--
--   * A second welcome item, 'welcome_rhythm': her Family Rhythm (club_welcome_plans), in the Welcome Kit in place of
--     the Family Vision print, for NEW enrollments only and only once the owner switches it on:
--     club_settings.welcome_item = 'rhythm'. It ships as 'vision' (today's behavior): applying this migration changes no
--     new or existing order. Every existing welcome_vision order keeps its Vision print (owner decision D3), pending
--     ones included; nothing is ever converted.
--   * How a new kit gets it: the order the billing functions already insert ('welcome_vision', outside a December
--     substitution) becomes 'welcome_rhythm' in a BEFORE INSERT trigger while the switch is on. The trigger also adds
--     nothing when the household already has a live welcome order of either kind, so there is never a second one.
--     club_invoice_apply and club_intro_grant are unchanged (their 'welcome_order' return value names only a Vision
--     order; nothing reads it).
--   * What prints is what she approved: approving her plan (club_welcome_plan_approve) copies it onto the order
--     (personalization: { state, fingerprint, revision, approved_at }) and records her approval there; a later change
--     or Undo clears both while the kit hasn't gone to print. Once the owner approves the kit, the order keeps the plan
--     she approved; she can still change and print her own copy (evergreen). The print view reads the order's copy.
--   * Readiness 'needs_rhythm' (beside 'needs_vision'); the queue, kit actions, reminders (the same two), the owner's
--     "kit submitted" email, the admin lists and the member's club_me name the item ('welcome_item' / 'kind').
--   * NOT included (2d, required before the switch is turned on): no Rhythm in the mailing when her first month
--     already gives the family a daily rhythm (May, August); owner guardrail 1, §11.1.
--
-- Additive or same-shape: no column removed, no order, entitlement, approval or subscription changed.

begin;

-- ---------------------------------------------------------------- the switch (off)

alter table public.club_settings add column welcome_item text not null default 'vision' check (welcome_item in ('vision', 'rhythm'));
comment on column public.club_settings.welcome_item is
  'Welcome Kit item for NEW enrollments: vision (Family Vision print) or rhythm (Family Rhythm). Owner decision; see docs/club/WELCOME_MARCH_DECEMBER_MIGRATION.md';

-- ---------------------------------------------------------------- the order type

alter table public.club_fulfillment_orders drop constraint club_fulfillment_orders_fulfillment_type_check;
alter table public.club_fulfillment_orders add constraint club_fulfillment_orders_fulfillment_type_check
  check (fulfillment_type in ('monthly_resource', 'welcome_vision', 'welcome_rhythm'));
-- The Rhythm's approved plan is larger than the Vision print's two choices.
alter table public.club_fulfillment_orders drop constraint club_fulfillment_orders_personalization_check;
alter table public.club_fulfillment_orders add constraint club_fulfillment_orders_personalization_check
  check (personalization is null or (jsonb_typeof(personalization) = 'object'
         and (octet_length(personalization::text) <= 2000 or (fulfillment_type = 'welcome_rhythm' and octet_length(personalization::text) <= 70000))));
create unique index club_fulfillment_one_welcome_rhythm on public.club_fulfillment_orders (household_id)
  where status <> 'canceled' and fulfillment_type = 'welcome_rhythm';

-- The plan on a Rhythm order is complete: her saved entries and what printed when she approved.
create function public.club_rhythm_valid(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select p is not null and jsonb_typeof(p) = 'object' and jsonb_typeof(p -> 'state') = 'object' and p -> 'state' <> '{}'::jsonb
     and char_length(coalesce(p ->> 'fingerprint', '')) > 0;
$$;
revoke execute on function public.club_rhythm_valid(jsonb) from public, anon, authenticated;
grant execute on function public.club_rhythm_valid(jsonb) to service_role;

-- New welcome orders: the Family Rhythm while the switch is on; never a second live welcome order of either kind.
create function public.club_welcome_item_choose() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.fulfillment_type <> 'welcome_vision' or new.satisfies_month is not null then return new; end if;
  if exists (select 1 from public.club_fulfillment_orders o where o.household_id = new.household_id and o.status <> 'canceled'
               and o.fulfillment_type in ('welcome_vision', 'welcome_rhythm')) then
    return null;
  end if;
  if coalesce((select s.welcome_item from public.club_settings s limit 1), 'vision') = 'rhythm' then
    new.fulfillment_type := 'welcome_rhythm';
  end if;
  return new;
end $$;
revoke execute on function public.club_welcome_item_choose() from public, anon, authenticated;
create trigger club_welcome_item_choose before insert on public.club_fulfillment_orders
  for each row execute function public.club_welcome_item_choose();

-- Her approved plan onto her Rhythm order (while nothing has gone to print), and back off it.
create function public.club_welcome_rhythm_order_set(p_household uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  w public.club_welcome_plans%rowtype;
begin
  select * into w from public.club_welcome_plans where household_id = p_household;
  if not found or w.approved_at is null then return; end if;
  update public.club_fulfillment_orders
     set personalization = jsonb_build_object('state', w.state, 'fingerprint', w.approved_fingerprint, 'revision', w.revision, 'approved_at', w.approved_at),
         member_approved_at = now(), pdf_status = 'not_ready', updated_at = now()
   where household_id = p_household and fulfillment_type = 'welcome_rhythm' and status in ('pending', 'on_hold');
end $$;
create function public.club_welcome_rhythm_order_clear(p_household uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.club_fulfillment_orders set personalization = null, member_approved_at = null, pdf_status = 'not_ready', updated_at = now()
   where household_id = p_household and fulfillment_type = 'welcome_rhythm' and status in ('pending', 'on_hold')
     and (personalization is not null or member_approved_at is not null);
end $$;
revoke execute on function public.club_welcome_rhythm_order_set(uuid), public.club_welcome_rhythm_order_clear(uuid) from public, anon, authenticated;
grant execute on function public.club_welcome_rhythm_order_set(uuid), public.club_welcome_rhythm_order_clear(uuid) to service_role;

-- Which welcome item her Welcome Kit carries, for the emails (club-webhook, club-admin): 'rhythm' or 'vision' (also
-- when she has no welcome order yet: what the switch would give her).
create function public.club_welcome_item_of(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select case when o.fulfillment_type = 'welcome_rhythm' then 'rhythm' else 'vision' end from public.club_fulfillment_orders o
      where o.user_id = p_user and o.fulfillment_type in ('welcome_vision', 'welcome_rhythm') and o.status <> 'canceled'
      order by o.created_at desc limit 1),
    (select s.welcome_item from public.club_settings s limit 1), 'vision');
$$;
revoke execute on function public.club_welcome_item_of(uuid) from public, anon, authenticated;
grant execute on function public.club_welcome_item_of(uuid) to service_role;"""
TAIL = "commit;"
parts = [HEAD.rstrip(), queue, set_kit, welcome_queue, audience, kit_submitted, me, members, member_months, bundle,
         plan_save, plan_approve, plan_unapprove, TAIL.rstrip()]
OUT.write_text('\n\n'.join(parts) + '\n')
print(f'wrote {OUT.relative_to(ROOT)}')

# The rollback: every definition above back to its latest text before this migration (unchanged copies), the
# additions removed. Refuses while any Family Rhythm order exists, so no order is ever orphaned or converted.
BACK = ROOT / 'supabase' / 'rollout' / 'rollback-welcome-rhythm-kit.sql'
originals = [latest(n, 'view' if n == 'club_fulfillment_queue' else 'function') for n in (
    'club_fulfillment_queue', 'club_admin_set_welcome_kit', 'club_admin_welcome_queue', 'club_email_audience', 'club_kit_submitted',
    'club_me', 'club_admin_members', 'club_admin_member_months', 'club_admin_fulfillment_bundle',
    'club_welcome_plan_save', 'club_welcome_plan_approve', 'club_welcome_plan_unapprove')]
BACK.write_text('\n\n'.join([
    """-- GENERATED by scripts/generate-welcome-rhythm-kit-migration.py. Undoes 20261122000000_club_welcome_rhythm_kit.sql.
-- Run only with the owner's go-ahead. Refuses while any Family Rhythm Welcome Kit order exists.
begin;
do $$ begin
  if exists (select 1 from public.club_fulfillment_orders where fulfillment_type = 'welcome_rhythm') then
    raise exception 'welcome_rhythm orders exist: rollback refused';
  end if;
end $$;
drop trigger club_welcome_item_choose on public.club_fulfillment_orders;
drop function public.club_welcome_item_choose();
-- The view reads club_rhythm_valid: replace it first (its extra last column is dropped by recreating it).
drop view public.club_fulfillment_queue;""",
    *[o.replace('create or replace view', 'create view', 1) if 'view public.club_fulfillment_queue' in o else o for o in originals],
    """revoke all on public.club_fulfillment_queue from public, anon, authenticated;
grant select on public.club_fulfillment_queue to service_role;
drop function public.club_welcome_rhythm_order_set(uuid);
drop function public.club_welcome_rhythm_order_clear(uuid);
drop function public.club_rhythm_valid(jsonb);
drop function public.club_welcome_item_of(uuid);
drop index public.club_fulfillment_one_welcome_rhythm;
alter table public.club_fulfillment_orders drop constraint club_fulfillment_orders_personalization_check;
alter table public.club_fulfillment_orders add constraint club_fulfillment_orders_personalization_check
  check (personalization is null or (jsonb_typeof(personalization) = 'object' and octet_length(personalization::text) <= 2000));
alter table public.club_fulfillment_orders drop constraint club_fulfillment_orders_fulfillment_type_check;
alter table public.club_fulfillment_orders add constraint club_fulfillment_orders_fulfillment_type_check
  check (fulfillment_type in ('monthly_resource', 'welcome_vision'));
alter table public.club_settings drop column welcome_item;
commit;"""]) + '\n')
print(f'wrote {BACK.relative_to(ROOT)}')
