-- Direct website shop: the "Take Back Control" download, the $29 offer at /take-back-control.
-- Runs after 20261012000000_shop_digital.sql; only adds one product.
--
-- Upload its files to the private shop-downloads bucket at exactly these paths
-- (supabase/SHOP.md → Digital products). Missing files don't break the others.
-- tax_code txcd_10000000 is Stripe's general code for electronically supplied services:
-- CONFIRM it with your accountant before turning on Stripe Tax (Dashboard → Inventory).
--
-- Supabase dashboard → SQL Editor → paste this whole file → Run, once. A second run stops at
-- the insert (the slug already exists) and changes nothing.

insert into public.shop_products (slug, name, description, details, price_cents, images, active, stock, max_per_order, includes_companion,
                                  ship_units, kind, files, tax_code, sort)
values
  ('take-back-control',
   'Take Back Control',
   'The 4-week Take Back Control audio course plus advanced implementation tools: the 4 routine printables, the Family Chore Chart System and the 7-Day Declutter Dash. Instant download.',
   array['4-week audio course (5–7 minute episodes) + the 3 Minute Reset Ritual',
         'Morning, After-School, Bedtime and Weekend Prep Routine printables',
         'Family Chore Chart System (chore chart by age)',
         '7-Day Declutter Dash (daily challenge guide)'],
   2900,
   '[{"src":"/images/take-back-control/overview.webp","alt":"Everything in Take Back Control: routine printables, chore cards and decluttering guide around a laptop, and a phone playing the audio course."}]',
   true, 0, 1, false, 1, 'digital',
   '[{"path":"take-back-control/week-1-create-your-family-reset-rhythm.mp3","label":"Week 1: Create Your Family Reset Rhythm (MP3)"},
     {"path":"take-back-control/week-2-morning-flow-that-doesnt-break.mp3","label":"Week 2: Morning Flow That Doesn’t Break (MP3)"},
     {"path":"take-back-control/week-3-weekly-planning-on-autopilot.mp3","label":"Week 3: Weekly Planning on Autopilot (MP3)"},
     {"path":"take-back-control/week-4-declutter-your-brain-not-just-the-toys.mp3","label":"Week 4: Declutter Your Brain, Not Just the Toys (MP3)"},
     {"path":"take-back-control/3-minute-reset-ritual.m4a","label":"Bonus: 3 Minute Reset Ritual (audio)"},
     {"path":"take-back-control/morning-routine.pdf","label":"Morning Routine (PDF)"},
     {"path":"take-back-control/after-school-routine.pdf","label":"After-School Routine (PDF)"},
     {"path":"take-back-control/bedtime-routine.pdf","label":"Bedtime Routine (PDF)"},
     {"path":"take-back-control/weekend-prep-routine.pdf","label":"Weekend Prep Routine (PDF)"},
     {"path":"take-back-control/chore-chart-by-age.pdf","label":"Family Chore Chart System: Chore Chart by Age (PDF)"},
     {"path":"take-back-control/7-day-declutter-dash.pdf","label":"7-Day Declutter Dash (PDF)"}]',
   'txcd_10000000', 20);
