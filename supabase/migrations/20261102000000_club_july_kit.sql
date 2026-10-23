-- Organized Family Club: the July 2027 kit, Ready to Go (src/data/club/kits/2027-07-ready-to-go.ts).
-- A draft: it opens for nobody until an admin schedules it after Megan's letter is approved. Its Ready-to-Go
-- Challenge (five steps, the outing and when) saves in club_documents like any kit (doc 'ready-to-go'); the packing
-- builder is a site tool and saves in the browser.
--
-- NOT APPLIED to the live project. Runs after 20261101000000_club_june_kit.sql.
begin;

insert into public.club_kits (slug, month, title, status, release_at, mailer_cutoff_at)
values ('2027-07-ready-to-go', '2027-07-01', 'Ready to Go', 'draft', '2027-07-01 04:00:00+00', '2027-06-15 04:00:00+00');

commit;
