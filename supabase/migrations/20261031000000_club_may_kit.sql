-- Organized Family Club: the May 2027 kit, Finish the School Year Well (src/data/club/kits/2027-05-finish-the-school-year.ts).
-- A draft: it opens for nobody until an admin schedules it after Megan's letter is approved. Its School Year Wrap-Up
-- (five steps, optional helpers) saves in club_documents like any kit (doc 'school-wrap-up'); the wrap-up builder is
-- a site tool and saves in the browser.
--
-- NOT APPLIED to the live project. Runs after 20261030000000_club_april_kit.sql.
begin;

insert into public.club_kits (slug, month, title, status, release_at, mailer_cutoff_at)
values ('2027-05-finish-the-school-year', '2027-05-01', 'Finish the School Year Well', 'draft', '2027-05-01 04:00:00+00', '2027-04-15 04:00:00+00');

commit;
