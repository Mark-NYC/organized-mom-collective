-- Organized Family Club: the April 2027 kit, Everybody Helps at Mealtime (src/data/club/kits/2027-04-everybody-helps-at-mealtime.ts).
-- A draft: it opens for nobody until an admin schedules it after Megan's letter is approved. Its Family Dinner Team
-- (five steps, the meal and when, optional helpers) saves in club_documents like any kit (doc 'dinner-team'); the
-- meal responsibility planner is a site tool and saves in the browser.
--
-- NOT APPLIED to the live project. Runs after 20261029000000_club_march_kit.sql.
begin;

insert into public.club_kits (slug, month, title, status, release_at, mailer_cutoff_at)
values ('2027-04-everybody-helps-at-mealtime', '2027-04-01', 'Everybody Helps at Mealtime', 'draft', '2027-04-01 04:00:00+00', '2027-03-15 04:00:00+00');

commit;
