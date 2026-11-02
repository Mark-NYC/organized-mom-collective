-- Fix the private object path constraint from 20261102000000_shop_gelato_private_storage.sql.
-- The original regex was overescaped and rejected valid .pdf object paths.
-- Safe to run after the earlier migration, independent of whether any products are mapped.
alter table public.shop_gelato_products
  drop constraint if exists shop_gelato_private_object_path_valid;
alter table public.shop_gelato_products
  add constraint shop_gelato_private_object_path_valid
  check (
    storage_object_path is null
    or (
      length(storage_object_path) between 5 and 512
      and left(storage_object_path, 1) <> '/'
      and position('..' in storage_object_path) = 0
      and position('?' in storage_object_path) = 0
      and position('#' in storage_object_path) = 0
      and right(lower(storage_object_path), 4) = '.pdf'
    )
  );
