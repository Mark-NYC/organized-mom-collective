-- One small preference per setting, or per zone/week move. Compare and replace
-- individual choices, leaving checkmarks in the existing household_cleaning_marks.
create table public.household_cleaning_rhythm (
  household_id uuid not null references public.club_households(id) on delete cascade,
  setting text not null,
  value text not null,
  primary key(household_id, setting)
);
alter table public.household_cleaning_rhythm enable row level security;
revoke all on public.household_cleaning_rhythm from public, anon, authenticated;
create function public.family_cleaning_rhythm(p_household uuid, p_setting text default null,
  p_value text default null, p_expected text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare hid uuid := public.household_id_for(auth.uid()); prior text; week_date date;
begin
  if hid is null or hid is distinct from p_household then raise exception 'no_household'; end if;
  if p_setting is not null then
    if p_setting ~ '^move:[0-9]{4}-[0-9]{2}-[0-9]{2}:[1-4]$' then
      week_date := split_part(p_setting, ':', 2)::date;
      if extract(isodow from week_date) <> 1 or week_date not between current_date - 366 and current_date + 21
        or (p_value is not null and p_value !~ '^[0-6]$') then raise exception 'invalid_move'; end if;
    elsif not coalesce((p_setting = 'mode' and p_value in ('printed','one-day','off'))
      or (p_setting = 'mainDay' and p_value ~ '^[0-6]$')
      or (p_setting = 'dailyReset' and p_value in ('true','false')),false)
      then raise exception 'invalid_setting'; end if;
    perform 1 from public.club_households where id = hid for update;
    select value into prior from public.household_cleaning_rhythm where household_id = hid and setting = p_setting;
    if prior is distinct from p_value then
      if prior is distinct from p_expected then raise exception 'changed_on_another_device'; end if;
      if p_value is null then delete from public.household_cleaning_rhythm where household_id = hid and setting = p_setting;
      else insert into public.household_cleaning_rhythm values (hid,p_setting,p_value)
        on conflict (household_id,setting) do update set value=excluded.value;
      end if;
    end if;
  end if;
  return (select coalesce(jsonb_object_agg(setting,value),'{}'::jsonb) from public.household_cleaning_rhythm
    where household_id = hid and (setting not like 'move:%' or split_part(setting,':',2) >= (current_date - 14)::text));
end $$;
revoke all on function public.family_cleaning_rhythm(uuid,text,text,text) from public,anon;
grant execute on function public.family_cleaning_rhythm(uuid,text,text,text) to authenticated;
