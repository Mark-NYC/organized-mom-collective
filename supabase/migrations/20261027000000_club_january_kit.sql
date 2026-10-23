-- Organized Family Club: the January 2027 kit, A Fresh Start, Together
-- (src/data/club/kits/2027-01-fresh-start-together.ts). A draft: it opens for nobody until an admin schedules it
-- after Megan's letter is approved. Its One-Thing Family Reset (the five steps, the family's one thing, a plan and a
-- start day) saves in club_documents like any kit (doc 'one-thing-plan'); the habit builder is a site tool and saves
-- in the browser.
--
-- NOT APPLIED to the live project. Runs after 20261026000000_club_december_kit.sql.
begin;

insert into public.club_kits (slug, month, title, status, release_at, mailer_cutoff_at)
values ('2027-01-fresh-start-together', '2027-01-01', 'A Fresh Start, Together', 'draft', '2027-01-01 05:00:00+00', '2026-12-15 05:00:00+00');

commit;
