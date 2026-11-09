#!/usr/bin/env python3
"""
Writes supabase/migrations/20261123000000_club_welcome_overlap.sql and its rollback (Phase 2d,
docs/club/WELCOME_MARCH_DECEMBER_MIGRATION.md → 2d).

Owner decision (2026-11-09): when a new member's first fulfilled monthly resource already gives the family a daily
rhythm (May's Summer Day Rhythm, August's School Day Routines), that resource is her personalized Welcome win. Her
Welcome Kit is that month's resource and the Family Meeting guide: no Family Rhythm print, no Vision print instead, no
extra printable. Her Family Rhythm stays available digitally. Only while the Welcome switch is 'rhythm'.

Same method as scripts/generate-welcome-rhythm-kit-migration.py: every live definition it changes is copied from the
migrations BEFORE this one, word for word, and only the listed replacements are applied (each must match exactly).
Run: python3 scripts/generate-welcome-overlap-migration.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIG = ROOT / 'supabase' / 'migrations'
OUT = MIG / '20261123000000_club_welcome_overlap.sql'
BACK = ROOT / 'supabase' / 'rollout' / 'rollback-welcome-overlap.sql'
BOTH = "('welcome_vision', 'welcome_rhythm')"
# The monthly resources that already establish a daily family rhythm. Kept in step with `dailyRhythm` in
# src/data/club/resources.ts (tests/club-welcome-overlap.test.ts checks both lists match).
OVERLAP_KITS = ['2027-05-finish-the-school-year', '2027-08-school-year']


def latest(name: str, kind: str = 'function') -> str:
    found = None
    for f in sorted(MIG.glob('*.sql')):
        if f.name >= OUT.name:
            continue
        text = f.read_text()
        pat = (rf'create (or replace )?function public\.{name}\(.*?\$\$;' if kind == 'function'
               else rf'create (or replace )?view public\.{name} .*?;\n\n')
        for m in re.finditer(pat, text, re.S):
            found = (f.name, m.group(0).rstrip())
    if not found:
        sys.exit(f'{name}: no definition found')
    src, body = found
    body = re.sub(r'^create (function|view)', r'create or replace \1', body)
    return f'-- {name}: from {src}, with the replacements listed in scripts/generate-welcome-overlap-migration.py\n{body}'


def edit(body: str, pairs: list[tuple[str, str, int]]) -> str:
    for old, new, n in pairs:
        c = body.count(old)
        if c != n:
            sys.exit(f'expected {n} × {old[:70]!r}, found {c}')
        body = body.replace(old, new)
    return body


# A kit with no separate welcome item: her first month's order alone, in a Welcome Kit.
SOLO = "(q.fulfillment_type = 'monthly_resource' and q.in_welcome_kit and q.kit_partner_id is null)"

queue = edit(latest('club_fulfillment_queue', 'view'), [
    (f"       (o.fulfillment_type in {BOTH} and o.satisfies_month is null) or kw.id is not null as in_kit,\n",
     f"       (o.fulfillment_type in {BOTH} and o.satisfies_month is null) or kw.id is not null\n"
     "         -- 2d: her first month's routine is her Welcome win: that order alone is her Welcome Kit (with the guide).\n"
     "         or (o.fulfillment_type = 'monthly_resource' and o.resource_month = h.first_paid_month and h.welcome_kit_monthly_only) as in_kit,\n", 1),
    ("           when kit.w_pdf <> 'ready' or kit.m_pdf <> 'ready' then 'needs_pdf'\n",
     "           when coalesce(kit.w_pdf, 'ready') <> 'ready' or kit.m_pdf <> 'ready' then 'needs_pdf'\n", 1),
    ("       case when kit.in_kit and kit.w_approved_at is not null and kit.m_approved_at is not null\n"
     "            then greatest(kit.w_approved_at, kit.m_approved_at) end as kit_submitted_at,\n"
     "       case when kit.in_kit and kit.w_approved_at is not null and kit.m_approved_at is not null\n"
     "            then public.club_business_days_after(greatest(kit.w_approved_at, kit.m_approved_at), 2) end as kit_ship_by,\n",
     "       case when kit.in_kit and (kit.w_id is null or kit.w_approved_at is not null) and kit.m_approved_at is not null\n"
     "            then greatest(coalesce(kit.w_approved_at, kit.m_approved_at), kit.m_approved_at) end as kit_submitted_at,\n"
     "       case when kit.in_kit and (kit.w_id is null or kit.w_approved_at is not null) and kit.m_approved_at is not null\n"
     "            then public.club_business_days_after(greatest(coalesce(kit.w_approved_at, kit.m_approved_at), kit.m_approved_at), 2) end as kit_ship_by,\n", 1),
    ("       case when kit.in_kit then kit.w_type end as kit_welcome_type\n",
     "       case when kit.in_kit then coalesce(kit.w_type, 'none') end as kit_welcome_type\n", 1),
])

set_kit = edit(latest('club_admin_set_welcome_kit'), [
    ("  select status into ws from public.club_fulfillment_orders where id = w;\n  if m is null then",
     "  select status into ws from public.club_fulfillment_orders where id = w;\n"
     "  -- 2d: a kit that is her first month alone (its routine is her Welcome win): that one order moves.\n"
     "  if w is null then\n"
     "    perform set_config('club.kit_move', 'on', true);\n"
     "    perform public.club_admin_set_fulfillment(m, p_status, p_note, null);\n"
     "    perform set_config('club.kit_move', '', true);\n"
     "    perform public.admin_log('club.welcome_kit', 'club_order:' || m::text, jsonb_build_object('to', p_status, 'kit', 'first_month_only'));\n"
     "    return (select to_jsonb(x) from public.club_fulfillment_queue x where x.id = m);\n"
     "  end if;\n"
     "  if m is null then", 1),
])

welcome_queue = edit(latest('club_admin_welcome_queue'), [
    ("                        from public.club_fulfillment_queue p where p.id = q.kit_partner_id),\n                     'packing_list', case when q.in_welcome_kit then",
     f"                        from public.club_fulfillment_queue p where p.id = coalesce(q.kit_partner_id, case when {SOLO} then q.id end)),\n"
     f"                     'packing_list', case when {SOLO} then jsonb_build_array('Family Meeting guide (standard insert)',\n"
     "                        to_char(q.resource_month, 'FMMonth YYYY') || ' resource (personalized; her Welcome win, no separate welcome print)')\n"
     "                       when q.in_welcome_kit then", 1),
    (f"where q.fulfillment_type in {BOTH} and q.status not in",
     f"where (q.fulfillment_type in {BOTH} or {SOLO}) and q.status not in", 1),
])

audience = edit(latest('club_email_audience'), [
    ("       and q.readiness = 'needs_confirmation' and now() >= q.member_approved_at + interval '2 days'\n  ) x;",
     "       and q.readiness = 'needs_confirmation' and now() >= q.member_approved_at + interval '2 days'\n"
     "    union all\n"
     "    -- 2d: a kit that is her first month alone: the same two reminders, counted from when her kit was created.\n"
     "    select q.user_id, q.email, q.kit_slug, q.id, case when now() >= q.created_at + interval '7 days' then 2 else 1 end\n"
     f"      from public.club_fulfillment_queue q\n     where p_kind = 'kit_reminder' and {SOLO} and q.status = 'pending'\n"
     "       and q.readiness = 'needs_confirmation' and now() >= q.created_at + interval '2 days'\n  ) x;", 1),
])

kit_submitted = edit(latest('club_kit_submitted'), [
    ("'first_month', (select p.resource_month from public.club_fulfillment_queue p where p.id = q.kit_partner_id),",
     "'first_month', coalesce((select p.resource_month from public.club_fulfillment_queue p where p.id = q.kit_partner_id), case when q.fulfillment_type = 'monthly_resource' then q.resource_month end),", 1),
    ("'welcome_item', q.fulfillment_type)", "'welcome_item', case when q.fulfillment_type = 'monthly_resource' then 'none' else q.fulfillment_type end)", 1),
    (f"where q.user_id = p_user and q.fulfillment_type in {BOTH} and q.in_welcome_kit and q.kit_submitted_at is not null",
     f"where q.user_id = p_user and (q.fulfillment_type in {BOTH} or {SOLO}) and q.in_welcome_kit and q.kit_submitted_at is not null", 1),
])

me = edit(latest('club_me'), [
    ("    'welcome', (select jsonb_build_object('status', q.status, 'readiness', q.readiness, 'approved', q.member_approved_at is not null,\n"
     "                  'personalized', case when q.fulfillment_type = 'welcome_rhythm' then public.club_rhythm_valid(q.personalization) else public.club_vision_valid(q.personalization) end,\n"
     "                  'satisfies_month', q.satisfies_month, 'mailed_at', q.mailed_at,\n"
     "                  'kind', case when q.fulfillment_type = 'welcome_rhythm' then 'rhythm' else 'vision' end)\n"
     f"                  from public.club_fulfillment_queue q where q.user_id = uid and q.fulfillment_type in {BOTH} and q.status <> 'canceled' limit 1),",
     "    -- 2d: a kit that is her first month alone has no welcome item to approve ('approved' true, kind 'monthly').\n"
     "    'welcome', (select jsonb_build_object('status', q.status, 'readiness', q.readiness,\n"
     "                  'approved', q.fulfillment_type = 'monthly_resource' or q.member_approved_at is not null,\n"
     "                  'personalized', case when q.fulfillment_type = 'monthly_resource' then true when q.fulfillment_type = 'welcome_rhythm' then public.club_rhythm_valid(q.personalization) else public.club_vision_valid(q.personalization) end,\n"
     "                  'satisfies_month', q.satisfies_month, 'mailed_at', q.mailed_at,\n"
     "                  'kind', case when q.fulfillment_type = 'monthly_resource' then 'monthly' when q.fulfillment_type = 'welcome_rhythm' then 'rhythm' else 'vision' end)\n"
     f"                  from public.club_fulfillment_queue q where q.user_id = uid and (q.fulfillment_type in {BOTH} or {SOLO}) and q.status <> 'canceled'\n"
     "                 order by (q.fulfillment_type = 'monthly_resource') limit 1),", 1),
])

members = edit(latest('club_admin_members'), [
    (f"from public.club_fulfillment_queue q where q.user_id = h.owner_user_id and q.fulfillment_type in {BOTH} and q.status <> 'canceled' limit 1),",
     f"from public.club_fulfillment_queue q where q.user_id = h.owner_user_id and (q.fulfillment_type in {BOTH} or {SOLO}) and q.status <> 'canceled'\n"
     "                   order by (q.fulfillment_type = 'monthly_resource') limit 1),", 1),
])

member_months = edit(latest('club_admin_member_months'), [
    (f"where q.user_id = p_user and q.fulfillment_type in {BOTH}\n",
     f"where q.user_id = p_user and (q.fulfillment_type in {BOTH} or {SOLO})\n", 1),
    ("order by (q.status = 'canceled'), q.created_at desc limit 1),", "order by (q.status = 'canceled'), (q.fulfillment_type = 'monthly_resource'), q.created_at desc limit 1),", 1),
])

choose = edit(latest('club_welcome_item_choose'), [
    ("  if coalesce((select s.welcome_item from public.club_settings s limit 1), 'vision') = 'rhythm' then\n"
     "    new.fulfillment_type := 'welcome_rhythm';\n  end if;",
     "  if coalesce((select s.welcome_item from public.club_settings s limit 1), 'vision') = 'rhythm' then\n"
     "    -- 2d: her first month (already known when billing creates this order) establishes a daily rhythm: it is her\n"
     "    -- Welcome win. No welcome order; her first month's order is her Welcome Kit (club_fulfillment_queue.in_kit).\n"
     "    if exists (select 1 from public.club_households h join public.club_kits k on k.month = h.first_paid_month\n"
     "                where h.id = new.household_id and k.establishes_daily_rhythm) then\n"
     "      update public.club_households set welcome_kit_monthly_only = true, updated_at = now() where id = new.household_id;\n"
     "      return null;\n"
     "    end if;\n"
     "    new.fulfillment_type := 'welcome_rhythm';\n  end if;", 1),
])

item_of = edit(latest('club_welcome_item_of'), [
    ("  select coalesce(\n", "  select coalesce(\n"
     "    (select 'monthly' from public.club_households h where h.owner_user_id = p_user and h.welcome_kit_monthly_only\n"
     "      and not exists (select 1 from public.club_fulfillment_orders o where o.user_id = p_user and o.status <> 'canceled'\n"
     f"                        and o.fulfillment_type in {BOTH})),\n", 1),
])

flags = ', '.join(f"'{s}'" for s in OVERLAP_KITS)
HEAD = f"""-- GENERATED by scripts/generate-welcome-overlap-migration.py: edit the script, not this file.
--
-- Organized Family Club: the Welcome overlap rule (Phase 2d, docs/club/WELCOME_MARCH_DECEMBER_MIGRATION.md; owner
-- decision 2026-11-09). Only matters while club_settings.welcome_item = 'rhythm' (it ships 'vision').
--
--   * A monthly resource that already gives the family a daily rhythm is flagged on its kit
--     (club_kits.establishes_daily_rhythm): May's Summer Day Rhythm and August's School Day Routines today; flag any
--     later kit the same way (and `dailyRhythm` in src/data/club/resources.ts).
--   * Decided from her ACTUAL first fulfilled month (club_households.first_paid_month, set by billing before it
--     creates her welcome order), never her signup date. When it is flagged: no welcome order at all (no Family Rhythm
--     print, no Vision print, no extra printable); club_households.welcome_kit_monthly_only marks her first month's
--     order as her whole Welcome Kit (that order plus the standard Family Meeting guide). Her Family Rhythm stays hers
--     digitally (/app/club/family-rhythm).
--   * If her first month's order arrives after a Family Rhythm order was made (her first month wasn't known yet), and
--     it is flagged: that Rhythm order is canceled ONLY if she never approved it and nothing went to print; an approved
--     one is never removed or replaced.
--   * One order for the routine: the kit is her existing first-month order; nothing is duplicated. Readiness, the
--     owner's kit actions, the Welcome Kits list and packing list, reminders, the owner email and club_me follow.
--   * Every existing order (Vision or Rhythm) and every approval is unchanged.

begin;

alter table public.club_kits add column establishes_daily_rhythm boolean not null default false;
comment on column public.club_kits.establishes_daily_rhythm is
  'This monthly resource already gives the family a daily rhythm: as a first month it is her Welcome win (no separate Family Rhythm print). docs/club/WELCOME_MARCH_DECEMBER_MIGRATION.md 2d';
update public.club_kits set establishes_daily_rhythm = true where slug in ({flags});

alter table public.club_households add column welcome_kit_monthly_only boolean not null default false;
comment on column public.club_households.welcome_kit_monthly_only is
  'Her Welcome Kit is her first month''s resource alone (its daily rhythm is her Welcome win) plus the Family Meeting guide';

-- Her first month's order, when it arrives after a Family Rhythm order: the overlap rule, without ever touching an
-- approved order.
create function public.club_welcome_overlap_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if new.fulfillment_type <> 'monthly_resource' or new.status = 'canceled' then return null; end if;
  if not exists (select 1 from public.club_households h join public.club_kits k on k.month = h.first_paid_month
                  where h.id = new.household_id and h.first_paid_month = new.resource_month and k.establishes_daily_rhythm) then
    return null;
  end if;
  update public.club_fulfillment_orders
     set status = 'canceled', note = left(coalesce(note || ' · ', '') || 'not needed: her first month''s routine is her Welcome win', 300), updated_at = now()
   where household_id = new.household_id and fulfillment_type = 'welcome_rhythm' and status = 'pending' and member_approved_at is null;
  get diagnostics n = row_count;
  if n > 0 then
    update public.club_households set welcome_kit_monthly_only = true, updated_at = now() where id = new.household_id;
  end if;
  return null;
end $$;
revoke execute on function public.club_welcome_overlap_check() from public, anon, authenticated;
create trigger club_welcome_overlap_check after insert on public.club_fulfillment_orders
  for each row execute function public.club_welcome_overlap_check();"""

parts = [HEAD, queue, set_kit, welcome_queue, audience, kit_submitted, me, members, member_months, choose, item_of, 'commit;']
OUT.write_text('\n\n'.join(parts) + '\n')
print(f'wrote {OUT.relative_to(ROOT)}')

originals = [latest(n, 'view' if n == 'club_fulfillment_queue' else 'function') for n in (
    'club_fulfillment_queue', 'club_admin_set_welcome_kit', 'club_admin_welcome_queue', 'club_email_audience', 'club_kit_submitted',
    'club_me', 'club_admin_members', 'club_admin_member_months', 'club_welcome_item_choose', 'club_welcome_item_of')]
BACK.write_text('\n\n'.join([
    """-- GENERATED by scripts/generate-welcome-overlap-migration.py. Undoes 20261123000000_club_welcome_overlap.sql.
-- Run only with the owner's go-ahead. Refuses while any household's Welcome Kit is its first month alone.
begin;
do $$ begin
  if exists (select 1 from public.club_households where welcome_kit_monthly_only) then
    raise exception 'first-month-only Welcome Kits exist: rollback refused';
  end if;
end $$;
drop trigger club_welcome_overlap_check on public.club_fulfillment_orders;
drop function public.club_welcome_overlap_check();""",
    *originals,
    """alter table public.club_households drop column welcome_kit_monthly_only;
alter table public.club_kits drop column establishes_daily_rhythm;
commit;"""]) + '\n')
print(f'wrote {BACK.relative_to(ROOT)}')
