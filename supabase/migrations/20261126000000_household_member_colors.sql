-- Permanent family member colors (owner decision 2026-11-15; docs/ios/MIGRATION_PLAN.md).
--
-- NOT applied to production. Depends on 20261124000000_household_shared.sql (household_save_core).
--
-- Until now a color was saved only when someone picked one (household.preferences.colors, by member id); everyone else
-- got the next free marker color by POSITION (memberColors in src/data/club/family-colors.ts: children first, then
-- grown-ups, in family order). In production no household has a saved color, so adding a baby, removing someone or
-- reordering shifted other people's colors on screen, in the calendar and between one printed mailing and the next.
--
-- This makes every color a saved one:
--   * household_colors_complete(hid) writes, for each current member without a valid saved color, exactly the color
--     memberColors shows them today (same order, same palette, same rules for saved and duplicate choices). It never
--     changes a member who already has a saved color, and keeps the saved colors of archived members (so someone
--     who comes back gets theirs again when it's still free).
--   * Run once for every existing household (below): what families see and what has been printed stays the same.
--   * Run on every family save (household_save_core, so the existing family form and the app both get it): a new
--     member takes the next free color and nobody else's changes, whatever is added, removed or reordered.
-- The client's own pinning (src/lib/household/colors.ts) stays as a second guard.

create function public.household_colors_complete(p_household uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  palette constant text[] := array['blue', 'green', 'purple', 'pink', 'orange', 'teal', 'red', 'brown'];
  prefs jsonb;
  saved jsonb;
  out_ jsonb := '{}';
  used text[] := '{}';
  m record;
  c text;
  i int := 1;
  kept jsonb;
begin
  select preferences into prefs from public.club_households where id = p_household for update;
  if not found then return; end if;
  saved := case when jsonb_typeof(prefs -> 'colors') = 'object' then prefs -> 'colors' else '{}' end;

  -- 1. Saved choices first, in memberColors order (a duplicate choice goes to the first person, like the screen).
  for m in select f.id::text as id from public.club_family_members f
            where f.household_id = p_household and f.archived_at is null
            order by (f.kind <> 'child'), f.sort, f.created_at loop
    c := saved ->> m.id;
    if c = any (palette) and not (c = any (used)) then
      out_ := out_ || jsonb_build_object(m.id, c);
      used := used || c;
    end if;
  end loop;
  -- 2. Everyone else: the next free marker color, in the same order (after eight people the palette repeats).
  for m in select f.id::text as id from public.club_family_members f
            where f.household_id = p_household and f.archived_at is null
            order by (f.kind <> 'child'), f.sort, f.created_at loop
    continue when out_ ? m.id;
    while i <= 8 and palette[i] = any (used) loop i := i + 1; end loop;
    c := palette[((i - 1) % 8) + 1];
    out_ := out_ || jsonb_build_object(m.id, c);
    used := used || c;
    i := i + 1;
  end loop;

  -- Archived members keep their saved color (current members first; the stored list holds at most 20).
  select coalesce(jsonb_object_agg(e.key, e.value), '{}') into kept
    from (select e.key, e.value from jsonb_each(saved) e
            join public.club_family_members f on f.id::text = e.key and f.household_id = p_household and f.archived_at is not null
           where e.value #>> '{}' = any (palette)
           order by f.archived_at desc
           limit greatest(0, 20 - (select count(*) from jsonb_object_keys(out_)))) e;
  if (prefs -> 'colors') is distinct from (kept || out_) then
    update public.club_households set preferences = jsonb_set(coalesce(preferences, '{}'), '{colors}', kept || out_)
     where id = p_household;
  end if;
end $$;
revoke execute on function public.household_colors_complete(uuid) from public, anon, authenticated;

-- Every family save ends with every current member's color saved. Appended to household_save_core (20261124) the
-- same way 20261124 patched the profile saves: one exact text match, or the migration stops.
do $$
declare
  d text := pg_get_functiondef('public.household_save_core(int, text, jsonb, jsonb)'::regprocedure);
  -- The end of the color merge (old saved colors overlaid with what this save sends): complete them after it, so a
  -- color someone chose before is never replaced by a positional one when a save sends no colors.
  marker text := E'    update public.club_households set preferences = prefs where id = hid;\n  end if;\n  return public.club_household();';
  patched text;
begin
  patched := replace(d, marker, E'    update public.club_households set preferences = prefs where id = hid;\n  end if;\n  perform public.household_colors_complete(hid);\n  return public.club_household();');
  if patched = d then raise exception 'household_save_core: end of the color merge not found'; end if;
  execute patched;
end $$;

-- Existing households: save today's colors, exactly as families see them now.
select public.household_colors_complete(id) from public.club_households;
