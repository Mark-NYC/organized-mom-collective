-- Visual publishing backlog. Apply via Supabase migrations before using /admin/pins.
create table if not exists public.pinterest_pins (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 title text not null check (length(title) between 1 and 100),
 description text not null default '',
 image_url text not null,
 destination_url text not null,
 board text not null,
 category text not null default 'Editorial',
 keywords text not null default '',
 status text not null default 'ready' check (status in ('ready','exported','uploaded','confirmed')),
 publish_at timestamptz,
 export_batch uuid,
 updated_at timestamptz not null default now()
);
create index if not exists pinterest_pins_queue_idx on public.pinterest_pins (status,created_at,id);
alter table public.pinterest_pins enable row level security;
-- RLS uses the existing admin_whoami() SECURITY DEFINER RPC. Nothing is public.
create policy "admins manage pinterest pins" on public.pinterest_pins for all to authenticated
using (coalesce((public.admin_whoami()->>'admin')::boolean,false))
with check (coalesce((public.admin_whoami()->>'admin')::boolean,false));
grant select,insert,update,delete on public.pinterest_pins to authenticated;
