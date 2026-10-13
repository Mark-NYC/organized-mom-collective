-- Direct website shop: the Family Sanity Saver Starter Kit, the $7 Family Command Center offer at
-- /family-sanity-saver-starter-kit. Runs after 20261016000000_shop_real_life_reset.sql; only adds
-- one product.
--
-- Seeded SWITCHED OFF (active = false): the calendar is the 2025–2026 academic edition (July 2025 –
-- June 2026), already over. An inactive product is hidden from the catalog and refused at checkout.
-- When the 2026–2027 files are ready, replace them in Storage at the same paths, update the labels
-- below if the years change, then turn it on: Dashboard → Inventory, or
--   update public.shop_products set active = true where slug = 'family-sanity-saver-starter-kit';
--
-- Upload the six files to the private shop-downloads bucket at exactly
--   family-sanity-saver/family-wall-calendar.pdf            (fillable: type 5 names once, every month fills in)
--   family-sanity-saver/family-wall-calendar-example.pdf    (the same calendar with a sample family filled in)
--   family-sanity-saver/blank-monthly-calendar.pdf          (one undated month, print as many as needed)
--   family-sanity-saver/command-center-refresh-sheet.pdf
--   family-sanity-saver/30-minute-daily-tidy-system.pdf
--   family-sanity-saver/first-weekly-reset-coaching-session.mp3   (7 min 8 s)
-- (supabase/SHOP.md → Digital products). tax_code txcd_10000000 is Stripe's general code for
-- electronically supplied services: CONFIRM it with your accountant before turning on Stripe Tax.
--
-- Supabase dashboard → SQL Editor → paste this whole file → Run, once. A second run stops at
-- the insert (the slug already exists) and changes nothing.

insert into public.shop_products (slug, name, description, details, price_cents, images, active, stock, max_per_order, includes_companion,
                                  ship_units, kind, files, tax_code, sort)
values
  ('family-sanity-saver-starter-kit',
   'Family Sanity Saver Starter Kit',
   'A customizable 12-month family wall calendar: type your family’s names once and every month fills in. Plus the Command Center Refresh Sheet, the 30-Minute Daily Tidy System and your first weekly reset coaching session. Instant download.',
   array['12-month Family Wall Calendar (fillable: type your names once)',
         'Command Center Refresh Sheet',
         '30-Minute Daily Tidy System',
         'Your First Weekly Reset coaching session (7-minute audio)'],
   700,
   '[{"src":"/images/family-sanity-saver/kit.webp","alt":"The Family Sanity Saver Starter Kit: the 12-month family wall calendar with the family’s names filled in, the Command Center Refresh Sheet, the 30-Minute Daily Tidy System and the coaching audio on a phone."}]',
   false, 0, 1, false, 1, 'digital',
   '[{"path":"family-sanity-saver/family-wall-calendar.pdf","label":"2025–2026 Family Wall Calendar (fillable PDF: type your names once)"},
     {"path":"family-sanity-saver/family-wall-calendar-example.pdf","label":"Example: the calendar with a family filled in (PDF)"},
     {"path":"family-sanity-saver/blank-monthly-calendar.pdf","label":"Blank monthly page, any month (PDF)"},
     {"path":"family-sanity-saver/command-center-refresh-sheet.pdf","label":"Command Center Refresh Sheet (PDF)"},
     {"path":"family-sanity-saver/30-minute-daily-tidy-system.pdf","label":"30-Minute Daily Tidy System (fillable PDF)"},
     {"path":"family-sanity-saver/first-weekly-reset-coaching-session.mp3","label":"Your First Weekly Reset coaching session (audio)"}]',
   'txcd_10000000', 50);
