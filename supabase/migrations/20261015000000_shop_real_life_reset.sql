-- Direct website shop: the Real Life Reset Kit, the $7 backup-plan offer at /real-life-reset-kit.
-- Runs after 20261014000000_shop_essential_routines.sql; only adds one product.
--
-- Upload the three files to the private shop-downloads bucket at exactly
--   real-life-reset/plan-b-quick-pivot-framework.pdf
--   real-life-reset/15-minute-reset-checklist.pdf
--   real-life-reset/its-ok-to-pivot-coaching.mp3
-- (supabase/SHOP.md → Digital products). The audio runs 4 min 14 s.
-- tax_code txcd_10000000 is Stripe's general code for electronically supplied services:
-- CONFIRM it with your accountant before turning on Stripe Tax (Dashboard → Inventory).
--
-- Supabase dashboard → SQL Editor → paste this whole file → Run, once. A second run stops at
-- the insert (the slug already exists) and changes nothing.

insert into public.shop_products (slug, name, description, details, price_cents, images, active, stock, max_per_order, includes_companion,
                                  ship_units, kind, files, tax_code, sort)
values
  ('real-life-reset-kit',
   'Real Life Reset Kit',
   'Your backup plan when life gets messy: the Plan B Quick-Pivot Framework, the 15-Minute Reset Checklist and the “It’s OK to Pivot” coaching audio. Instant download.',
   array['Plan B Quick-Pivot Framework (PDF)',
         '15-Minute Reset Checklist (PDF)',
         '“It’s OK to Pivot” coaching audio'],
   700,
   '[{"src":"/images/real-life-reset/kit.webp","alt":"The Real Life Reset Kit: the Plan B Quick-Pivot Framework, the 15-Minute Reset Checklist, and the It’s OK to Pivot audio playing on a phone."}]',
   true, 0, 1, false, 1, 'digital',
   '[{"path":"real-life-reset/plan-b-quick-pivot-framework.pdf","label":"Plan B Quick-Pivot Framework (PDF)"},
     {"path":"real-life-reset/15-minute-reset-checklist.pdf","label":"15-Minute Reset Checklist (PDF)"},
     {"path":"real-life-reset/its-ok-to-pivot-coaching.mp3","label":"“It’s OK to Pivot” coaching audio"}]',
   'txcd_10000000', 40);
