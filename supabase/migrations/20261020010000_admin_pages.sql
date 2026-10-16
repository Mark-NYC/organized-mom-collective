-- /admin → Pages & Funnels: the page inventory. Requires 20261020000000_admin_core.sql.
--
-- After every push to the default branch, the GitHub Action .github/workflows/page-inventory.yml builds the site,
-- lists every page (scripts/page-inventory.mjs) and sends it here with site_pages_sync. It
-- authenticates with PAGE_INVENTORY_TOKEN, a random secret created in /admin → Settings; only its
-- SHA-256 hash is stored. The token can write the inventory and nothing else.
begin;

create table public.admin_secret (
  id boolean primary key default true check (id),
  inventory_token_hash text check (inventory_token_hash ~ '^[0-9a-f]{64}$'),
  inventory_token_set_at timestamptz
);
insert into public.admin_secret default values;
alter table public.admin_secret enable row level security;
revoke all on public.admin_secret from public, anon, authenticated;

create table public.site_pages (
  path text primary key check (path ~ '^/' and char_length(path) <= 300),
  title text check (char_length(title) <= 300),
  h1 text check (char_length(h1) <= 300),
  type text not null check (type ~ '^[a-z-]{1,20}$'),
  indexable boolean not null,
  redirect_to text check (char_length(redirect_to) <= 500),
  in_sitemap boolean not null default false,
  in_nav boolean not null default false,
  -- How many other pages link here. 0 + not in nav or sitemap = orphan (only reachable by its URL).
  inbound_links int not null default 0 check (inbound_links >= 0),
  orphan boolean not null default false,
  -- [{ placement, label, href, broken? }] from data-cta links in the built HTML.
  ctas jsonb not null default '[]' check (jsonb_typeof(ctas) = 'array' and pg_column_size(ctas) <= 20000),
  source_file text check (char_length(source_file) <= 300),
  build_sha text check (build_sha ~ '^[0-9a-f]{7,40}$'),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  -- Set when a build no longer has the page; cleared if it comes back.
  removed_at timestamptz
);

create table public.site_inventory_runs (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  build_sha text,
  pages int not null,
  added int not null,
  removed int not null,
  -- External CTA destinations checked this run: [{ href, status, broken, pages }]
  links jsonb not null default '[]' check (jsonb_typeof(links) = 'array')
);
create index site_inventory_runs_at on public.site_inventory_runs (at desc);

alter table public.site_pages enable row level security;
alter table public.site_inventory_runs enable row level security;
revoke all on public.site_pages, public.site_inventory_runs from public, anon, authenticated;
grant select on public.site_pages, public.site_inventory_runs to authenticated;
create policy "Admins read pages" on public.site_pages for select to authenticated using ((select public.is_admin('helper')));
create policy "Admins read inventory runs" on public.site_inventory_runs for select to authenticated using ((select public.is_admin('helper')));
grant select, insert, update, delete on public.site_pages, public.site_inventory_runs, public.admin_secret to service_role;

-- Called by the GitHub Action with the public anon key + the inventory token.
-- Returns {"status": "ok", pages, added, removed} | {"status": "unauthorized" | "invalid" | "rate_limited"}.
create function public.site_pages_sync(p_token text, p_build_sha text, p_pages jsonb, p_links jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  stored text;
  n_added int;
  n_removed int;
  sha text := case when p_build_sha ~ '^[0-9a-f]{7,40}$' then p_build_sha end;
begin
  select inventory_token_hash into stored from public.admin_secret;
  if stored is null or p_token is null or char_length(p_token) <> 64
     or encode(extensions.digest(p_token, 'sha256'), 'hex') <> stored then
    return jsonb_build_object('status', 'unauthorized');
  end if;
  if (select count(*) from public.site_inventory_runs where at > now() - interval '1 hour') >= 30 then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  if p_pages is null or jsonb_typeof(p_pages) <> 'array' or jsonb_array_length(p_pages) not between 1 and 2000
     or coalesce(jsonb_typeof(p_links), 'array') <> 'array' or jsonb_array_length(coalesce(p_links, '[]')) > 500 then
    return jsonb_build_object('status', 'invalid');
  end if;

  select count(*) into n_added
    from jsonb_to_recordset(p_pages) as x(path text)
   where not exists (select 1 from public.site_pages s where s.path = x.path and s.removed_at is null);

  insert into public.site_pages (path, title, h1, type, indexable, redirect_to, in_sitemap, in_nav, inbound_links, orphan, ctas, source_file, build_sha, last_seen, removed_at)
  select x.path, left(x.title, 300), left(x.h1, 300), x.type, coalesce(x.indexable, false), left(x.redirect_to, 500),
         coalesce(x.in_sitemap, false), coalesce(x.in_nav, false), greatest(coalesce(x.inbound_links, 0), 0), coalesce(x.orphan, false),
         coalesce(x.ctas, '[]'), left(x.source_file, 300), sha, now(), null
    from jsonb_to_recordset(p_pages) as x(path text, title text, h1 text, type text, indexable boolean, redirect_to text, in_sitemap boolean,
                                          in_nav boolean, inbound_links int, orphan boolean, ctas jsonb, source_file text)
  on conflict (path) do update set
    title = excluded.title, h1 = excluded.h1, type = excluded.type, indexable = excluded.indexable, redirect_to = excluded.redirect_to,
    in_sitemap = excluded.in_sitemap, in_nav = excluded.in_nav, inbound_links = excluded.inbound_links, orphan = excluded.orphan,
    ctas = excluded.ctas, source_file = excluded.source_file, build_sha = excluded.build_sha, last_seen = now(), removed_at = null;

  update public.site_pages set removed_at = now()
   where removed_at is null and path not in (select x.path from jsonb_to_recordset(p_pages) as x(path text));
  get diagnostics n_removed = row_count;

  insert into public.site_inventory_runs (build_sha, pages, added, removed, links)
  values (sha, jsonb_array_length(p_pages), n_added, n_removed, coalesce(p_links, '[]'));
  delete from public.site_inventory_runs where at < now() - interval '90 days';

  return jsonb_build_object('status', 'ok', 'pages', jsonb_array_length(p_pages), 'added', n_added, 'removed', n_removed);
end $$;
revoke execute on function public.site_pages_sync(text, text, jsonb, jsonb) from public;
grant execute on function public.site_pages_sync(text, text, jsonb, jsonb) to anon, authenticated, service_role;

-- /admin → Settings: a new inventory token, shown once. The old one stops working.
create function public.admin_rotate_inventory_token() returns text
language plpgsql security definer set search_path = '' as $$
declare
  t text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if not public.is_admin('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.admin_secret set inventory_token_hash = encode(extensions.digest(t, 'sha256'), 'hex'), inventory_token_set_at = now();
  perform public.admin_log_service(auth.uid(), 'admin.inventory_token_rotated', null, '{}');
  return t;
end $$;
revoke execute on function public.admin_rotate_inventory_token() from public, anon;
grant execute on function public.admin_rotate_inventory_token() to authenticated;

create function public.admin_inventory_token_set_at() returns timestamptz
language sql stable security definer set search_path = '' as $$
  select inventory_token_set_at from public.admin_secret where public.is_admin('owner');
$$;
revoke execute on function public.admin_inventory_token_set_at() from public, anon;
grant execute on function public.admin_inventory_token_set_at() to authenticated;

commit;
