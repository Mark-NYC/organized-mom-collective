-- Organized Family Club: the March 2027 kit, Spring Clean as a Team (src/data/club/kits/2027-03-spring-clean-together.ts).
-- A draft: it opens for nobody until an admin schedules it after Megan's letter is approved. Its One-Room Family Reset
-- (five steps, the space and when, optional helpers) saves in club_documents like any kit (doc 'one-room-reset'); the
-- spring cleaning builder is a site tool and saves in the browser.
--
-- NOT APPLIED to the live project. Runs after 20261028000000_club_february_kit.sql.
begin;

insert into public.club_kits (slug, month, title, status, release_at, mailer_cutoff_at)
values ('2027-03-spring-clean-together', '2027-03-01', 'Spring Clean as a Team', 'draft', '2027-03-01 05:00:00+00', '2027-02-15 05:00:00+00');

commit;
