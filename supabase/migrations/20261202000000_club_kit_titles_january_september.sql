-- January is the Family Meeting introduction; September is Habit Cards (owner decision 2026-11-16).
--
-- NOT APPLIED. Changes two rows of production data (club_kits.title), so it needs the owner's go like every step in
-- docs/ios/MIGRATION_DEPLOYMENT_PLAN.md. Independent of every other pending migration.
--
-- The kit rows were seeded with earlier working titles. The title is what the admin's kit list, the fulfillment queue
-- and the Club's emails call the month, so it should say what the month is:
--   2027-01-fresh-start-together      'A Fresh Start, Together'    → 'Our First Family Meeting'
--   2027-09-a-week-everyone-can-see   'A Week Everyone Can See'    → 'Our Family Habit Cards'
-- Slugs stay (saved member work and the mailed QR codes are keyed by them). Only a row still carrying the old seed
-- title is touched, so a title an admin already changed by hand is left alone. In production (read 2026-11-16) January
-- is already SCHEDULED under the old title and September is a draft; no member holds either yet.
begin;
update public.club_kits set title = 'Our First Family Meeting'
 where slug = '2027-01-fresh-start-together' and title in ('A Fresh Start, Together', 'A Week Everyone Can See');
update public.club_kits set title = 'Our Family Habit Cards'
 where slug = '2027-09-a-week-everyone-can-see' and title = 'A Week Everyone Can See';
commit;
