-- Direct website shop: the "Mind Your Own Motherhood" 15oz ceramic mug, sold from
-- /mind-your-own-motherhood-mug. Runs after 20261014000000_shop_essential_routines.sql; only adds one product.
--
-- Physical, like the calendars: stock, a US shipping address, fulfilled by hand from the dashboard.
-- It ships as 1 shipping unit, so it's charged the same shipping rate as one 26-week calendar
-- (supabase/SHOP.md → Shipping); give it its own rate or change ship_units if a mug costs more to ship.
-- Stock starts at 0 (shows "Sold out"): set the real count in Dashboard → Inventory once you have mugs.
-- tax_code txcd_99999999 is Stripe's general tangible goods code, the same as the calendars.
-- No companion entitlement: the mug doesn't come with the cleaning companion.
--
-- Supabase dashboard → SQL Editor → paste this whole file → Run, once. A second run stops at
-- the insert (the slug already exists) and changes nothing.

insert into public.shop_products (slug, name, description, details, price_cents, images, active, stock, max_per_order, includes_companion,
                                  ship_units, kind, tax_code, sort)
values
  ('mind-your-own-motherhood-mug',
   'Mind Your Own Motherhood Mug',
   'A 15oz glossy white ceramic mug printed with “Mind your own Motherhood” in soft sage. Big enough for the coffee you’ll reheat twice.',
   array['15oz ceramic mug, glossy white', '“Mind your own Motherhood” print in soft sage',
         'Microwave and dishwasher safe', 'Ships to US addresses only'],
   2300,
   '[{"src":"/images/shop/mind-your-own-motherhood-mug-1280.webp","alt":"A white 15oz ceramic mug printed with “Mind your own Motherhood” in soft sage-gray lettering."}]',
   true, 0, 5, false, 1, 'physical', 'txcd_99999999', 40);
