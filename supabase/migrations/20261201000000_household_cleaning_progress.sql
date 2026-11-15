-- Shared cleaning progress: both grown-ups see the same checkmarks (docs/ios/MIGRATION_PLAN.md → 11).
--
-- NOT APPLIED. Depends on 20261124000000_household_shared.sql (household_adults, club_my_household). Additive: one
-- table, two functions. Free: any adult of a household, no membership check.
--
-- The cleaning companion keeps checkmarks on the device, as lists of task ids per day or month
-- (src/lib/storage.ts: omc:v1:daily:2026-11-15 → ["dishes","counters"]). This is the household's copy, one row per
-- item, so two phones never overwrite each other's lists:
--   list     daily | focus | weekend | monthly | active   (the same names as the device keys)
--   period   2026-11-15, or 2026-11 for the monthly project
--   item     the task id (or, for 'active', the monthly tick credited to that day)
--   done     checked or unchecked (an uncheck is a row too, so the other phone hears about it)
--   changed_at  when it was tapped, as the phone says, never later than the server's clock. For one item the latest
--               tap wins, so something checked offline on Monday can't undo Tuesday's change when it finally arrives.
--   synced_at   when it reached the server: the changes feed runs on this.
begin;

create table public.household_cleaning_marks (
  household_id uuid not null references public.club_households (id) on delete cascade,
  list text not null check (list in ('daily', 'focus', 'weekend', 'monthly', 'active')),
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}(-[0-9]{2})?$'),
  item text not null check (char_length(item) between 1 and 120),
  done boolean not null,
  changed_at timestamptz not null,
  synced_at timestamptz not null default clock_timestamp(),
  changed_by uuid references auth.users (id) on delete set null,
  primary key (household_id, list, period, item)
);
create index household_cleaning_marks_feed on public.household_cleaning_marks (household_id, synced_at);

alter table public.household_cleaning_marks enable row level security;
revoke all on public.household_cleaning_marks from public, anon, authenticated;
grant all on public.household_cleaning_marks to service_role;
grant select on public.household_cleaning_marks to authenticated;
create policy "Adults read their cleaning progress" on public.household_cleaning_marks
  for select to authenticated using (household_id = (select public.household_id_for(auth.uid())));

-- Save taps: [{list, period, item, done, at}], at most 500 a call. Returns how many changed the household's record.
-- A tap older than what the household has for that item is ignored (not an error): the newer one stands.
create function public.cleaning_marks_push(p_marks jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid := public.club_my_household();
  n int;
begin
  if p_marks is null or jsonb_typeof(p_marks) <> 'array' or jsonb_array_length(p_marks) > 500 then raise exception 'invalid'; end if;
  with taps as (
    -- One row per item: the latest tap in this call.
    select distinct on (m ->> 'list', m ->> 'period', m ->> 'item')
           m ->> 'list' as list, m ->> 'period' as period, m ->> 'item' as item, (m ->> 'done')::boolean as done,
           least((m ->> 'at')::timestamptz, now()) as at
      from jsonb_array_elements(p_marks) m
     order by m ->> 'list', m ->> 'period', m ->> 'item', (m ->> 'at')::timestamptz desc
  ), saved as (
    insert into public.household_cleaning_marks as c (household_id, list, period, item, done, changed_at, synced_at, changed_by)
    select hid, t.list, t.period, t.item, t.done, t.at, clock_timestamp(), uid from taps t
    on conflict (household_id, list, period, item) do update
      set done = excluded.done, changed_at = excluded.changed_at, synced_at = excluded.synced_at, changed_by = excluded.changed_by
      where c.changed_at < excluded.changed_at
    returning 1
  )
  select count(*) into n from saved;
  return jsonb_build_object('now', now(), 'applied', n);
exception
  when check_violation or not_null_violation or invalid_text_representation or invalid_datetime_format
       or datetime_field_overflow then
    raise exception 'invalid';
end $$;
revoke execute on function public.cleaning_marks_push(jsonb) from public, anon;
grant execute on function public.cleaning_marks_push(jsonb) to authenticated;

-- What changed after p_since (unchecks included), or with null everything checked in about the last year (the
-- companion keeps a year on the device too), plus the server's clock for next time.
create function public.cleaning_marks_changes(p_since timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  hid uuid := public.household_id_for(auth.uid());
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if hid is null then return jsonb_build_object('now', now(), 'marks', '[]'::jsonb); end if;
  return jsonb_build_object('now', now(), 'marks', coalesce((
    select jsonb_agg(jsonb_build_object('list', c.list, 'period', c.period, 'item', c.item, 'done', c.done, 'at', c.changed_at) order by c.synced_at)
      from public.household_cleaning_marks c
     where c.household_id = hid
       and (case when p_since is null then c.done and c.period >= to_char(current_date - 400, 'YYYY-MM') else c.synced_at > p_since end)), '[]'));
end $$;
revoke execute on function public.cleaning_marks_changes(timestamptz) from public, anon;
grant execute on function public.cleaning_marks_changes(timestamptz) to authenticated;

commit;
