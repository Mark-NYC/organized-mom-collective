-- Organized Family Club: the February 2027 kit, Better Together (src/data/club/kits/2027-02-better-together.ts).
-- A draft: it opens for nobody until an admin schedules it after Megan's letter is approved. Its Family Connection
-- Challenge (three checkboxes and an "Our idea" line each) saves in club_documents like any kit (doc
-- 'connection-challenge'); the connection planner is a site tool and saves in the browser.
--
-- NOT APPLIED to the live project. Runs after 20261027000000_club_january_kit.sql.
begin;

insert into public.club_kits (slug, month, title, status, release_at, mailer_cutoff_at)
values ('2027-02-better-together', '2027-02-01', 'Better Together', 'draft', '2027-02-01 05:00:00+00', '2027-01-15 05:00:00+00');

commit;
