-- Add the separate monthly 2027 family schedule wall calendar to direct checkout.
-- Run in Supabase SQL Editor after core shop migrations. Do not overwrite existing inventory.
-- Stock deliberately starts at zero until physical stock and fulfillment are confirmed.
insert into public.shop_products (
  slug, name, description, details, price_cents, images, active, stock,
  max_per_order, includes_companion, ship_units, kind, tax_code, sort
) values (
  'family-schedule-calendar-2027',
  '2027 Family Schedule Wall Calendar',
  'Large January to December 2027 monthly family wall calendar with five schedule rows and to-do space. Wire bound, 11 × 16.5 inches.',
  array[
    'January through December 2027', 'Five planning rows per month',
    '11 × 16.5 inches, wire bound with hanging loop', 'Monthly to-do area',
    'Ships to US addresses'
  ],
  3099,
  '[{"src":"https://i.etsystatic.com/29608155/r/il/de7ac8/8645639709/il_794xN.8645639709_cqeg.jpg","alt":"2027 monthly family schedule wall calendar."}]'::jsonb,
  true, 0, 5, false, 1, 'physical', 'txcd_99999999', 35
)
on conflict (slug) do nothing;

-- After confirming actual units available, enter the real stock in Dashboard → Orders → Inventory.
-- Ensure a real US shipping rate and live Stripe launch switches are configured before taking orders.
