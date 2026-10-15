-- Direct website shop: saving store settings from the dashboard failed with "UPDATE requires a
-- WHERE clause". Supabase's pg_safeupdate rejects an UPDATE without WHERE for API requests, and
-- shop_update_settings updated its single-row table without one. Same function, now scoped to that
-- row (shop_settings.id is the constant key `true`). Privileges are kept by create or replace.
--
-- Supabase dashboard → SQL Editor → paste this whole file → Run. Safe to run more than once.

create or replace function public.shop_update_settings(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p ->> 'tax_mode' = 'manual' then
    raise exception 'manual_tax_disabled';
  end if;
  update public.shop_settings set
    checkout_mode = coalesce(p ->> 'checkout_mode', checkout_mode),
    tax_mode = coalesce(p ->> 'tax_mode', tax_mode),
    tax_reviewed = tax_reviewed or p ? 'tax_mode',
    product_tax_code = coalesce(p ->> 'product_tax_code', product_tax_code),
    checkout_minutes = coalesce((p ->> 'checkout_minutes')::int, checkout_minutes),
    max_checkouts_per_hour = coalesce((p ->> 'max_checkouts_per_hour')::int, max_checkouts_per_hour),
    updated_at = now()
  where id;
  if not found then
    raise exception 'settings_missing';
  end if;
end $$;
