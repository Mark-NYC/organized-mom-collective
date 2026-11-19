-- The parts of a Supabase project the migrations rely on, for testing them on a plain
-- local Postgres (scripts/test-shop.sh). Never run this against the real project.
-- Roles are cluster-wide, so create them only once.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit password 'authenticator';
  end if;
end $$;
grant anon, authenticated, service_role to authenticator;

create schema extensions;
create schema auth;
grant usage on schema auth, extensions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

-- The verified token's claims (Supabase's auth.jwt()); tests set request.jwt.claims.
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

-- Supabase's default privileges: new tables and functions are open to the API roles
-- unless a migration revokes them (ours do).
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- Supabase Vault's interface (vault.create_secret, vault.secrets, vault.decrypted_secrets) for local tests only. The
-- real Vault encrypts `secret`; this stand-in does not. Like the real one, the app roles can't reach it.
create schema if not exists vault;
create table vault.secrets (
  id uuid primary key default gen_random_uuid(),
  name text unique,
  description text not null default '',
  secret text not null,
  key_id uuid,
  nonce bytea,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create function vault.create_secret(new_secret text, new_name text default null, new_description text default '', new_key_id uuid default null)
returns uuid language sql as $$ insert into vault.secrets (secret, name, description) values (new_secret, new_name, coalesce(new_description, '')) returning id $$;
create view vault.decrypted_secrets as select s.*, s.secret as decrypted_secret from vault.secrets s;
revoke all on schema vault from public;
revoke all on all tables in schema vault from public, anon, authenticated;
revoke all on all functions in schema vault from public, anon, authenticated;
grant usage on schema vault to service_role;
grant select on vault.decrypted_secrets to service_role;
