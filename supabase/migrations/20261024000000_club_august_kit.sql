-- Organized Family Club: the August 2027 kit, Ready for the School Year (src/data/club/kits/2027-08-school-year.ts).
-- A draft: it opens for nobody until an admin schedules it after Megan's letter is in. Its school setup and parts
-- save in club_documents like any kit (docs 'school-setup', 'school-launch', 'school-routines', 'command-center').
--
-- NOT APPLIED to the live project. Runs after 20261023000000_club_core.sql.
begin;

insert into public.club_kits (slug, month, title, status, release_at, mailer_cutoff_at)
values ('2027-08-school-year', '2027-08-01', 'Ready for the School Year', 'draft', '2027-08-01 04:00:00+00', '2027-07-15 04:00:00+00');

commit;
