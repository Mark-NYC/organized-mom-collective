-- Self-test only (no production data): a small database with every kind of thing the real backup must carry.
create table public.selftest_families (id bigint generated always as identity primary key, name text not null, note text);
insert into public.selftest_families (name, note) select 'Family ' || g, case when g % 3 = 0 then 'line one' || chr(10) || 'line ''two''' end from generate_series(1, 250) g;
alter table public.selftest_families enable row level security;
create policy "Members read" on public.selftest_families for select to authenticated using (true);
create view public.selftest_names as select name from public.selftest_families;
create function public.selftest_touch() returns trigger language plpgsql set search_path = '' as $$ begin new.note := coalesce(new.note, ''); return new; end $$;
create trigger selftest_touch before update on public.selftest_families for each row execute function public.selftest_touch();
create function public.selftest_on_signup() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.selftest_families (name) values ('signup'); return new; end $$;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'selftest' || g || '@example.com', now(), now()
    from generate_series(1, 5) g;
create trigger selftest_signup after insert on auth.users for each row execute function public.selftest_on_signup();
insert into storage.buckets (id, name, public) values ('selftest', 'selftest', false);
create policy "selftest read own" on storage.objects for select to authenticated using (bucket_id = 'selftest');
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values ('20260101000000', 'selftest_one'), ('20260102000000', 'selftest_two');
