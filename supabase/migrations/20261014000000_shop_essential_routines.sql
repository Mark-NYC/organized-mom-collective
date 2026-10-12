-- Direct website shop: the Essential Routines Bundle, the $12 downsell at /essential-routines.
-- Runs after 20261013000000_shop_take_back_control.sql; only adds one product.
--
-- The 4 routine PDFs are the same files Take Back Control delivers (already in the bucket under
-- take-back-control/). Upload the Quick Setup Audio to the private shop-downloads bucket at exactly
--   essential-routines/quick-setup-audio.m4a
-- (supabase/SHOP.md → Digital products). The "Why Routines Work" cheat sheet is a page on the site,
-- not a file: the buyer's download page links to it (src/components/shop/DownloadFiles.tsx).
-- tax_code txcd_10000000 is Stripe's general code for electronically supplied services:
-- CONFIRM it with your accountant before turning on Stripe Tax (Dashboard → Inventory).
--
-- Supabase dashboard → SQL Editor → paste this whole file → Run, once. A second run stops at
-- the insert (the slug already exists) and changes nothing.

insert into public.shop_products (slug, name, description, details, price_cents, images, active, stock, max_per_order, includes_companion,
                                  ship_units, kind, files, tax_code, sort)
values
  ('essential-routines',
   'Essential Routines Bundle',
   'Four printable family routines (morning, after school, bedtime, weekend prep) plus the Quick Setup Audio and the “Why Routines Work” cheat sheet. Instant download.',
   array['Morning, After-School, Bedtime and Weekend Prep Routine printables',
         'Bonus: Quick Setup Audio (8 minutes)',
         'Bonus: “Why Routines Work” cheat sheet (read online)'],
   1200,
   '[{"src":"/images/essential-routines/overview.webp","alt":"The Essential Routines Bundle: the four routine printables, the Why Routines Work cheat sheet on a laptop, and the Quick Setup Audio on a phone."}]',
   true, 0, 1, false, 1, 'digital',
   '[{"path":"take-back-control/morning-routine.pdf","label":"Morning Routine (PDF)"},
     {"path":"take-back-control/after-school-routine.pdf","label":"After-School Routine (PDF)"},
     {"path":"take-back-control/bedtime-routine.pdf","label":"Bedtime Routine (PDF)"},
     {"path":"take-back-control/weekend-prep-routine.pdf","label":"Weekend Prep Routine (PDF)"},
     {"path":"essential-routines/quick-setup-audio.m4a","label":"Bonus: Quick Setup Audio (audio)"}]',
   'txcd_10000000', 30);
