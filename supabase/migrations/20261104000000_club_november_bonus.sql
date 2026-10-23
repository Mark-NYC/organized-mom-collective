-- Organized Family Club: November's bonus (src/data/club/kits/2026-11-family-ownership.ts → bonus). Members who can
-- open November can open September's kit too (A Week Everyone Can See), before September's own release date, so a
-- new member has the meeting guide November builds on. Digital only: no back issue is mailed, no price, no purchase.
--
-- The rule stays in one place: club_can_open. A bonus kit opens with the kit that gives it ('edit' with access,
-- 'read' when that kit was earned), once the giving kit is released and the bonus kit is ready (not a draft; an admin
-- schedules it after Megan's letter is approved). Every kit she could open before still opens the same way.
-- November's own documents are unchanged: its guide saves as doc 'next-step' like any kit document.
--
-- NOT APPLIED to the live project. Runs after 20261103000000_club_september_kit.sql.
begin;

create table public.club_kit_bonuses (
  kit_id uuid not null references public.club_kits (id) on delete cascade,
  bonus_kit_id uuid not null references public.club_kits (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (kit_id, bonus_kit_id),
  check (kit_id <> bonus_kit_id)
);
alter table public.club_kit_bonuses enable row level security;
-- No policies: the browser reads it only through club_can_open and club_me.

insert into public.club_kit_bonuses (kit_id, bonus_kit_id)
select g.id, b.id from public.club_kits g, public.club_kits b
 where g.slug = '2026-11-family-ownership' and b.slug = '2027-09-a-week-everyone-can-see';

-- A bonus kit, through the kit that gives it: 'edit', 'read' or 'none'.
create function public.club_bonus_open(p_user uuid, p_kit uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when bool_or(public.club_has_access(p_user) and g.status = 'scheduled') then 'edit'
      when bool_or(public.club_earned(p_user, g.id)) then 'read' end
      from public.club_kit_bonuses x
      join public.club_kits g on g.id = x.kit_id
      join public.club_kits b on b.id = x.bonus_kit_id
     where x.bonus_kit_id = p_kit and b.status <> 'draft' and public.club_kit_released(g.id)), 'none');
$$;
revoke execute on function public.club_bonus_open(uuid, uuid) from public, anon, authenticated;
grant execute on function public.club_bonus_open(uuid, uuid) to service_role;

-- May she open this kit? As before for released kits; a bonus opens with the kit that gives it.
create or replace function public.club_can_open(p_user uuid, p_kit uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when public.club_kit_released(p_kit) and public.club_has_access(p_user)
         and exists (select 1 from public.club_kits k where k.id = p_kit and k.status <> 'retired') then 'edit'
    when public.club_kit_released(p_kit) and public.club_earned(p_user, p_kit) then 'read'
    else public.club_bonus_open(p_user, p_kit) end;
$$;

-- The kits she can open, bonuses included (club_can_open already says 'none' for an unreleased kit that isn't one).
create or replace function public.club_me() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  s public.club_subscriptions%rowtype;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into s from public.club_subscriptions where user_id = uid order by created_at desc limit 1;
  return jsonb_build_object(
    'access', public.club_has_access(uid),
    'grant', (select g.reason from public.club_access_grants g
               where g.user_id = uid and g.revoked_at is null and (g.expires_at is null or g.expires_at > now())),
    'status', s.status,
    'renews', case when s.cancel_at_period_end then null else s.current_period_end end,
    'ends', case when s.cancel_at_period_end then s.current_period_end end,
    'revoked', s.access_revoked_at is not null,
    'onboarded', exists (select 1 from public.club_households h where h.owner_user_id = uid and h.onboarded_at is not null),
    'kits', coalesce((
      select jsonb_agg(jsonb_build_object('slug', k.slug, 'title', k.title, 'month', k.month,
                                          'can', public.club_can_open(uid, k.id)) order by k.month desc)
        from public.club_kits k where public.club_can_open(uid, k.id) <> 'none'), '[]'));
end $$;

commit;
