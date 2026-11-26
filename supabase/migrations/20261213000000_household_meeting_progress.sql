-- One resumable weekly meeting per household. The existing agreement and development
-- stores remain authoritative for decisions. No calendar text or names are stored here.
create table public.household_meeting_progress (
  household_id uuid primary key references public.club_households(id) on delete cascade,
  revision bigint not null default 0,
  operation_id uuid,
  step smallint not null check (step between 0 and 3),
  started_at timestamptz not null,
  updated_at timestamptz not null,
  completed_at timestamptz,
  check (started_at <= updated_at and (completed_at is null or (completed_at = updated_at and step = 3)))
);
alter table public.household_meeting_progress enable row level security;
revoke all on public.household_meeting_progress from public, anon, authenticated;

-- Null p_operation reads. Writes compare the last revision the phone actually saw.
-- The household argument only guards against a queued offline write after an account switch.
create function public.family_meeting_progress(
  p_household uuid, p_operation uuid default null, p_base bigint default null,
  p_step integer default null, p_started timestamptz default null,
  p_updated timestamptz default null, p_completed timestamptz default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  hid uuid := public.household_id_for(auth.uid());
  r public.household_meeting_progress;
  conflict boolean := false;
begin
  if hid is null or hid is distinct from p_household then raise exception 'no_household'; end if;
  if p_operation is not null then
    if p_base is null or p_base < 0 or p_step is null or p_step not between 0 and 3
      or p_started is null or p_updated is null or not isfinite(p_started) or not isfinite(p_updated)
      or p_started > p_updated or p_updated > now() + interval '1 day'
      or (p_completed is not null and (p_completed <> p_updated or p_step <> 3))
      then raise exception 'invalid_progress'; end if;
    -- Serialize the first insert as well as concurrent updates.
    perform 1 from public.club_households where id = hid for update;
    select * into r from public.household_meeting_progress where household_id = hid;
    if r.operation_id = p_operation then null;
    elsif coalesce(r.revision, 0) <> p_base then conflict := true;
    elsif r.completed_at is not null and p_started = r.started_at and p_completed is null then conflict := true;
    else
      insert into public.household_meeting_progress as cur
        (household_id, revision, operation_id, step, started_at, updated_at, completed_at)
        values (hid, 1, p_operation, p_step, p_started, p_updated, p_completed)
        on conflict (household_id) do update set revision = cur.revision + 1,
          operation_id = excluded.operation_id, step = excluded.step, started_at = excluded.started_at,
          updated_at = excluded.updated_at, completed_at = excluded.completed_at;
    end if;
  end if;
  select * into r from public.household_meeting_progress where household_id = hid;
  return jsonb_build_object('revision', coalesce(r.revision, 0), 'conflict', conflict,
    'progress', case when r.household_id is not null then jsonb_build_object('step', r.step,
      'startedAt', r.started_at, 'updatedAt', r.updated_at, 'completedAt', r.completed_at) end);
end $$;
revoke all on function public.family_meeting_progress(uuid,uuid,bigint,integer,timestamptz,timestamptz,timestamptz) from public, anon;
grant execute on function public.family_meeting_progress(uuid,uuid,bigint,integer,timestamptz,timestamptz,timestamptz) to authenticated;
