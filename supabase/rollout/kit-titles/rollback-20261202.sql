-- Rollback for 20261202000000_club_kit_titles_january_september.sql (docs/product/UNIFIED_FAMILY_ARCHITECTURE.md §10).
-- Puts back the two seed titles, and only on a row that still carries the title the migration wrote, so a title an
-- admin changed afterwards is left alone. Touches nothing else. Rehearsed by scripts/rehearse-kit-titles.sh.
begin;
update public.club_kits set title = 'A Fresh Start, Together'
 where slug = '2027-01-fresh-start-together' and title = 'Our First Family Meeting';
update public.club_kits set title = 'A Week Everyone Can See'
 where slug = '2027-09-a-week-everyone-can-see' and title = 'Our Family Habit Cards';
commit;
