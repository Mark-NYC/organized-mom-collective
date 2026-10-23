-- Organized Family Club: the September 2027 kit, A Week Everyone Can See (src/data/club/kits/2027-09-a-week-everyone-can-see.ts).
-- A draft: it opens for nobody until an admin schedules it after Megan's letter is approved. Its first 15-minute
-- family meeting (five steps, the meeting day and time) saves in club_documents like any kit (doc 'family-meeting');
-- the weekly reset builder is a site tool and saves in the browser.
--
-- NOT APPLIED to the live project. Runs after 20261102000000_club_july_kit.sql.
begin;

insert into public.club_kits (slug, month, title, status, release_at, mailer_cutoff_at)
values ('2027-09-a-week-everyone-can-see', '2027-09-01', 'A Week Everyone Can See', 'draft', '2027-09-01 04:00:00+00', '2027-08-15 04:00:00+00');

commit;
