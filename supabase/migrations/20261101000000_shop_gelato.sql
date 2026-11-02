-- Gelato is opt-in per product. A claim is permanent until an operator resolves
-- ambiguous network failures, preventing accidental duplicate production orders.
create table if not exists public.shop_gelato_products (
  product_id uuid primary key references public.shop_products(id) on delete cascade,
  product_uid text not null check (length(product_uid) between 3 and 250),
  print_file_url text not null check (print_file_url ~ '^https://[^[:space:]]+$'),
  page_count integer check (page_count between 1 and 1000),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
create table if not exists public.shop_gelato_orders (
  order_id uuid primary key references public.shop_orders(id),
  gelato_order_id text,
  status text not null default 'submitting' check (status in ('submitting','draft','failed','needs_review')),
  error_code text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.shop_gelato_products enable row level security;
alter table public.shop_gelato_orders enable row level security;
revoke all on public.shop_gelato_products, public.shop_gelato_orders from anon, authenticated;
grant select, insert, update on public.shop_gelato_products, public.shop_gelato_orders to service_role;
create or replace function public.shop_gelato_claim(p_order uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_inserted integer;
begin
  if not exists (select 1 from public.shop_orders where id = p_order and payment_status = 'paid' and coalesce(digital,false) = false) then
    return false;
  end if;
  insert into public.shop_gelato_orders(order_id) values(p_order) on conflict do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted = 1;
end $$;
revoke all on function public.shop_gelato_claim(uuid) from public, anon, authenticated;
grant execute on function public.shop_gelato_claim(uuid) to service_role;
create or replace function public.shop_gelato_record(p_order uuid, p_status text, p_gelato_id text default null, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('draft','failed','needs_review') then raise exception 'invalid gelato status'; end if;
  update public.shop_gelato_orders
  set status = p_status, gelato_order_id = p_gelato_id,
      error_code = left(p_error,100), updated_at = now()
  where order_id = p_order and status = 'submitting';
end $$;
revoke all on function public.shop_gelato_record(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.shop_gelato_record(uuid,text,text,text) to service_role;
