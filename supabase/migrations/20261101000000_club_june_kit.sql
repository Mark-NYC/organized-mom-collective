-- Organized Family Club: the June 2027 kit, Summer With a Plan (src/data/club/kits/2027-06-summer-with-a-plan.ts).
-- A draft: it opens for nobody until an admin schedules it after Megan's letter is approved. Its Summer Family
-- Agreement (four decisions, what the family wrote) saves in club_documents like any kit (doc 'summer-agreement');
-- the summer rhythm (routine chart) and the screen time agreement are site tools and save in the browser.
--
-- NOT APPLIED to the live project. Runs after 20261031000000_club_may_kit.sql.
begin;

insert into public.club_kits (slug, month, title, status, release_at, mailer_cutoff_at)
values ('2027-06-summer-with-a-plan', '2027-06-01', 'Summer With a Plan', 'draft', '2027-06-01 04:00:00+00', '2027-05-15 04:00:00+00');

commit;
