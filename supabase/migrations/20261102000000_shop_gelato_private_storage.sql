-- Move Gelato artwork mapping from public URLs to private Supabase Storage.
-- Previous migration 20261101000000_shop_gelato.sql must already be applied.
alter table public.shop_gelato_products
  add column if not exists storage_object_path text;

-- Legacy URL is no longer needed. Never put expiring signed URLs in the database.
alter table public.shop_gelato_products
  alter column print_file_url drop not null;

-- Disable all preexisting mappings until private artwork is verified.
update public.shop_gelato_products set enabled = false, print_file_url = null, updated_at = now()
  where print_file_url is not null;

alter table public.shop_gelato_products
  add constraint shop_gelato_private_object_path_valid check (
    storage_object_path is null or (
      length(storage_object_path) between 5 and 512 and
      storage_object_path !~ '(^/|\\.\\.|[?#])' and
      storage_object_path ~ '\\.pdf$'
    )
  );

-- Enabled mappings must use a private bucket object, not a public web URL.
alter table public.shop_gelato_products
  add constraint shop_gelato_private_enabled check (
    not enabled or (storage_object_path is not null and print_file_url is null)
  );

-- This mapping is intentionally DISABLED pending a safe first draft order.
-- Supabase Storage bucket: gelato-print-files (must remain PRIVATE).
insert into public.shop_gelato_products
  (product_id, product_uid, print_file_url, storage_object_path, page_count, enabled)
select id,
  'wall_calendar_product_pf_xl11x16-5-inch_pt_100-lb-cover-coated-silk_cl_4-4_bt_wire-with-hook-top_ct_none_prt_none_ver',
  null, '2027-family-wall-calendar.pdf', 13, false
from public.shop_products where slug = 'family-schedule-calendar-2027'
on conflict (product_id) do update
set product_uid = excluded.product_uid,
    print_file_url = null,
    storage_object_path = excluded.storage_object_path,
    page_count = excluded.page_count,
    enabled = false,
    updated_at = now();
