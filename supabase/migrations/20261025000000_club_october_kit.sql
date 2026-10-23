-- Organized Family Club: the October 2027 kit, A Home That Works Together
-- (src/data/club/kits/2027-10-home-works-together.ts). A draft: it opens for nobody until an admin schedules it after
-- Megan's letter is approved. Its Fall Home Reset saves in club_documents like any kit (doc 'fall-reset'); the chore
-- chart is the site's own and saves in the browser.
--
-- NOT APPLIED to the live project. Runs after 20261024000000_club_august_kit.sql.
begin;

insert into public.club_kits (slug, month, title, status, release_at, mailer_cutoff_at)
values ('2027-10-home-works-together', '2027-10-01', 'A Home That Works Together', 'draft', '2027-10-01 04:00:00+00', '2027-09-15 04:00:00+00');

commit;
