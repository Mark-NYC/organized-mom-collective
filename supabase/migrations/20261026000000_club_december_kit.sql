-- Organized Family Club: the December 2027 kit, Christmas Is a Family Affair
-- (src/data/club/kits/2027-12-christmas-family-affair.ts). A draft: it opens for nobody until an admin schedules it
-- after Megan's letter is approved. Its Family Christmas Plan saves in club_documents like any kit (doc
-- 'christmas-plan'); the traditions picker is a site tool and saves in the browser.
--
-- The mailer goes out early (cutoff November 1) to arrive in late November; the kit page opens December 1 like every
-- month's (release_at decides which invoice earns it). It works just as well opened mid-December.
--
-- NOT APPLIED to the live project. Runs after 20261025000000_club_october_kit.sql.
begin;

insert into public.club_kits (slug, month, title, status, release_at, mailer_cutoff_at)
values ('2027-12-christmas-family-affair', '2027-12-01', 'Christmas Is a Family Affair', 'draft', '2027-12-01 05:00:00+00', '2027-11-01 04:00:00+00');

commit;
