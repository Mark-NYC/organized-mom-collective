-- Family development records: what the family decided about each child's skill (MAWL stage, habit cue, finish
-- line, status), the history of those decisions, and the family agreement that goes with it.
-- docs/product/FAMILY_DEVELOPMENT_ENGINE.md.
--
-- NOT APPLIED. Needs the owner's separate approval, a production preflight and a verified backup, like every
-- migration (supabase/rollout/family-development/). Independent of 20261202, 20261203 and 20261204 (follow-through):
-- it depends only on what production already has (20261124 household_shared → household_id_for,
-- 20261127 family_agreements → the agreement columns and household_agreement_json, 20261128 household_club_access →
-- household_billing_user, 20261023 club_core → club_has_access).
-- Test: supabase/tests/family-development.sql (scripts/test-household-sql.sh).
--
-- Why a new table and not new columns on club_responsibilities:
--   - A development record exists for decisions that are NOT agreements: "Not now" (paused) and "Not for us"
--     (dismissed) must be remembered so a skill isn't suggested again, and club_responsibilities rows are either the
--     family profile (existing/desired) or an agreement (confirmed). A dismissal there would look like an agreement.
--   - A record is per child per skill; an agreement may name several people.
-- What it does NOT duplicate: the household, the people and the agreement itself. The words the family agreed to are
-- an ordinary agreement in club_responsibilities ('confirmed', agreed_source 'skill:<skill id>', one owner: the
-- child). This table holds only the MAWL stage, cue, finish line, status, history, and a link to that agreement.
--
-- Agreement lifecycle (one transaction with each decision, so a record and its agreement never disagree):
--   start              creates the agreement (or links the child's live agreement for this skill, if one exists).
--   advance, step-back, stay, check-in, launch   the agreement stays: the child is still practicing, or it's theirs.
--   modify             the agreement's words follow (text, finished, when).
--   pause, dismiss     the agreement is removed the way "We're done with this" removes one: a tombstone
--                      (deleted_at), never a hard delete, so it leaves every list and stays in the record's history.
--   resume, restore    a new agreement is made (a removed one is never brought back silently). 'restore' is for an
--                      active record whose agreement someone removed elsewhere ("Put it back on the list").
-- Existing agreement functions (household_agreement_save/_remove/_json, household_agreements, club_family_profile)
-- are not changed: they read and sync these agreements like any other. A phone with an offline edit to an agreement
-- that a pause removed gets the existing 'removed' answer.
--
-- Rules the database enforces (the app's src/lib/family-development/records.ts applies the same ones):
--   - Never automatic: every change is one explicit decision by a signed-in adult of the household. There is no job,
--     trigger or default that moves a stage. 'advance' moves exactly one stage; Launch only ever comes from the
--     family ('advance' from Watch, or choosing Launch themselves when they start a record for something the child
--     already owns).
--   - A paused or dismissed suggestion that was never started has no stage (null) and no agreement.
--   - Retries are safe: the phone makes the record id and the agreement id. Repeating a start returns what was saved.
--     Two adults agreeing to the same skill for the same child at once get one record and one agreement.
--   - Writes need the household's Club access (either adult, through household_billing_user). Reads need only the
--     household: a lapsed family keeps its history and sees it again when it returns.
--   - History is append-only. Nobody (not even the household) can edit or delete an event.
begin;

create table public.household_development (
  -- Made on the phone, like agreements, so a retry never creates a second record.
  id uuid primary key,
  household_id uuid not null references public.club_households (id) on delete cascade,
  member_id uuid not null references public.club_family_members (id) on delete cascade,
  -- Canonical id from src/lib/family-development/skills.ts (the library is append-only by id).
  skill_id text not null check (skill_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(skill_id) <= 40),
  -- The family's own words for it (defaults to the library title). Kept so a later library edit never rewrites it.
  title text not null check (char_length(btrim(title)) between 1 and 80),
  stage text check (stage in ('model', 'assist', 'watch', 'launch')),
  status text not null check (status in ('active', 'paused', 'launched', 'dismissed')),
  cue text check (char_length(btrim(cue)) between 1 and 80),
  finish_line text check (char_length(btrim(finish_line)) between 1 and 160),
  note text check (char_length(btrim(note)) between 1 and 240),
  -- The responsibility category its agreement is filed under (club_responsibilities.category).
  category text not null default 'other' check (category in ('meals', 'laundry', 'cleaning', 'transportation', 'belongings',
                                                             'school-prep', 'homework', 'pet-care', 'routines', 'other')),
  -- The family agreement that goes with it (club_responsibilities, 'confirmed'). Null for never-started ideas.
  agreement_id uuid references public.club_responsibilities (id) on delete set null,
  -- The last "how is it going?" answer: which kind of progress was asked about, and the answer.
  last_signal text check (last_signal in ('performance', 'consistency', 'ownership')),
  last_value text check (last_value in ('strong', 'partial', 'not-yet')),
  last_check_in_on date,
  -- Watch practice in a new circumstance: how many times the family said they tried one.
  variations_practiced int not null default 0 check (variations_practiced between 0 and 1000),
  library_version int not null check (library_version between 1 and 1000),
  revision int not null default 1,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, member_id, skill_id),
  -- Active and launched records always carry the stage the family chose; launched is always Launch.
  check (status not in ('active', 'launched') or stage is not null),
  check (status <> 'launched' or stage = 'launch'),
  check (status <> 'active' or stage <> 'launch'),
  check ((last_signal is null) = (last_value is null))
);
create index household_development_household on public.household_development (household_id);

create table public.household_development_events (
  id bigint generated always as identity primary key,
  record_id uuid not null references public.household_development (id) on delete cascade,
  household_id uuid not null references public.club_households (id) on delete cascade,
  decision text not null check (decision in ('start', 'modify', 'advance', 'step-back', 'stay', 'check-in',
                                             'pause', 'resume', 'dismiss', 'restore')),
  from_stage text, to_stage text, from_status text, to_status text,
  signal text, value text,
  variation_practiced boolean not null default false,
  note text,
  -- What happened to the family agreement in the same transaction.
  agreement_change text check (agreement_change in ('created', 'linked', 'updated', 'removed')),
  agreement_id uuid,
  library_version int not null,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz not null default now()
);
create index household_development_events_record on public.household_development_events (record_id, decided_at);

-- Readable by the household's adults only; written only through the function below.
alter table public.household_development enable row level security;
alter table public.household_development_events enable row level security;
revoke all on public.household_development, public.household_development_events from public, anon, authenticated;
grant all on public.household_development, public.household_development_events to service_role;
grant select on public.household_development, public.household_development_events to authenticated;
create policy "Adults read their family's development" on public.household_development
  for select to authenticated using (household_id = (select public.household_id_for(auth.uid())));
create policy "Adults read their family's development history" on public.household_development_events
  for select to authenticated using (household_id = (select public.household_id_for(auth.uid())));

create function public.household_development_json(r public.household_development) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'member_id', r.member_id, 'skill_id', r.skill_id, 'title', r.title, 'stage', r.stage, 'status', r.status,
    'cue', r.cue, 'finish_line', r.finish_line, 'note', r.note, 'category', r.category,
    'agreement_id', r.agreement_id,
    -- Whether its agreement is on the family's lists right now (someone may have removed it elsewhere).
    'agreement_live', exists (select 1 from public.club_responsibilities a
                               where a.id = r.agreement_id and a.status = 'confirmed' and a.deleted_at is null),
    'last_signal', r.last_signal, 'last_value', r.last_value,
    'last_check_in_on', r.last_check_in_on, 'variations_practiced', r.variations_practiced,
    'library_version', r.library_version, 'revision', r.revision, 'created_at', r.created_at, 'updated_at', r.updated_at,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('decision', e.decision, 'from_stage', e.from_stage, 'to_stage', e.to_stage,
                                          'from_status', e.from_status, 'to_status', e.to_status, 'signal', e.signal,
                                          'value', e.value, 'variation_practiced', e.variation_practiced, 'note', e.note,
                                          'agreement_change', e.agreement_change, 'decided_at', e.decided_at)
                       order by e.decided_at, e.id)
        from (select * from public.household_development_events x where x.record_id = r.id
               order by x.decided_at desc, x.id desc limit 12) e), '[]'));
$$;
revoke execute on function public.household_development_json(public.household_development) from public, anon, authenticated;

-- Every record of the household, for either adult. No Club check: it's the family's own history.
create function public.household_development() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  hid uuid := public.household_id_for(auth.uid());
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if hid is null then raise exception 'no_household'; end if;
  return coalesce((select jsonb_agg(public.household_development_json(r) order by r.created_at, r.id)
                     from public.household_development r where r.household_id = hid), '[]');
end $$;
revoke execute on function public.household_development() from public, anon;
grant execute on function public.household_development() to authenticated;

-- Internal: make sure an active/launched record has a live agreement. Links the child's live 'skill:<id>' agreement if
-- there is one, else creates one with the phone's id. Returns ('created' | 'linked' | null, agreement id).
create function public.household_development_ensure_agreement(r public.household_development, p_agreement uuid, p_uid uuid,
                                                              out change text, out agreement uuid)
language plpgsql security definer set search_path = '' as $$
declare
  src text := 'skill:' || r.skill_id;
  a public.club_responsibilities%rowtype;
  n int;
begin
  change := null; agreement := r.agreement_id;
  if exists (select 1 from public.club_responsibilities x where x.id = r.agreement_id and x.status = 'confirmed' and x.deleted_at is null) then
    return;
  end if;
  select * into a from public.club_responsibilities x
   where x.household_id = r.household_id and x.status = 'confirmed' and x.deleted_at is null
     and x.agreed_source = src and x.owner_ids = array[r.member_id]
   order by x.confirmed_at limit 1;
  if found then change := 'linked'; agreement := a.id; return; end if;
  if p_agreement is null then raise exception 'invalid'; end if;
  -- A retry with the same agreement id: it's already this household's agreement for this skill.
  select * into a from public.club_responsibilities x where x.id = p_agreement;
  if found then
    if a.household_id <> r.household_id or a.status <> 'confirmed' or a.agreed_source is distinct from src
       or a.deleted_at is not null then
      raise exception 'invalid';
    end if;
    change := 'linked'; agreement := a.id; return;
  end if;
  select count(*) into n from public.club_responsibilities x where x.household_id = r.household_id and x.status = 'confirmed' and x.deleted_at is null;
  if n >= 60 then raise exception 'too_many'; end if;
  insert into public.club_responsibilities (id, household_id, status, category, owner_ids, helper_ids, scope, confirmed_at,
                                            agreed_text, agreed_finished, agreed_when, agreed_month, agreed_source,
                                            updated_by, revision, sort)
  values (p_agreement, r.household_id, 'confirmed', r.category, array[r.member_id], '{}', 'individual', now(),
          left(r.title, 160), r.finish_line, left(r.cue, 80), to_char(current_date, 'YYYY-MM'), src, p_uid, 1, n);
  change := 'created'; agreement := p_agreement;
end $$;
revoke execute on function public.household_development_ensure_agreement(public.household_development, uuid, uuid) from public, anon, authenticated;

-- One family decision, and what it means for the family agreement, in one transaction. p:
--   { id, decision, member_id?, skill_id?, title?, stage?, cue?, finish?, note?, category?, agreement_id?,
--     library_version, check?: { signal, value, variation? } }
-- p_base: the revision the phone showed (null for a new record). Another adult's change since then: 'conflict'.
--   start      new record at the family's chosen stage (required) + its agreement (agreement_id from the phone).
--              Launch = something the child already owns. Repeating it (same id) returns what was saved; another
--              adult's start for the same child and skill returns theirs (one record, one agreement).
--   pause      new (a suggestion: "Not now") or existing. Removes its agreement from the lists.
--   dismiss    new ("Not for us") or existing. Removes its agreement. Never suggested again unless resumed.
--   resume     paused/dismissed → active; the stage is required when the record never had one. New agreement.
--   restore    active/launched record whose agreement was removed elsewhere → a new agreement.
--   advance    exactly one stage up; Watch → Launch makes it launched. Only from active. Agreement stays.
--   step-back  exactly one stage down; a launched record becomes active Watch. Agreement stays.
--   stay       same stage; counts as this week's check-in.
--   check-in   records how it's going (check), no stage change.
--   modify     the family's words: title, cue, finish, note; the agreement's words follow.
-- Returns the record with 'agreement' (the agreement as phones sync it, household_agreement_json) when one changed,
-- and 'adopted': true when another adult's record was returned instead of creating one.
create function public.household_development_decide(p jsonb, p_base int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  rid uuid;
  d text;
  cur public.household_development%rowtype;
  nxt public.household_development%rowtype;
  ag public.club_responsibilities%rowtype;
  stages text[] := array['model', 'assist', 'watch', 'launch'];
  idx int;
  chk jsonb;
  sig text; val text; var boolean := false;
  n int;
  ach text; aid uuid;
  adopted boolean := false;
  out_ jsonb;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  hid := public.household_id_for(uid);
  if hid is null then raise exception 'no_household'; end if;
  if not public.club_has_access(public.household_billing_user(uid)) then raise exception 'club_required'; end if;
  if p is null or jsonb_typeof(p) <> 'object'
     or exists (select 1 from jsonb_object_keys(p) k
                 where k not in ('id', 'decision', 'member_id', 'skill_id', 'title', 'stage', 'cue', 'finish', 'note',
                                 'category', 'agreement_id', 'library_version', 'check')) then
    raise exception 'invalid';
  end if;
  rid := (p ->> 'id')::uuid;
  d := p ->> 'decision';
  if rid is null or d is null or (p ->> 'library_version') is null then raise exception 'invalid'; end if;
  if p ? 'stage' and p ->> 'stage' is not null and not (p ->> 'stage' = any (stages)) then raise exception 'invalid'; end if;
  chk := p -> 'check';
  if chk is not null and jsonb_typeof(chk) <> 'null' then
    if d not in ('check-in', 'stay', 'advance', 'step-back') or jsonb_typeof(chk) <> 'object' then raise exception 'invalid'; end if;
    sig := chk ->> 'signal'; val := chk ->> 'value'; var := coalesce((chk ->> 'variation')::boolean, false);
    if sig not in ('performance', 'consistency', 'ownership') or val not in ('strong', 'partial', 'not-yet') then raise exception 'invalid'; end if;
  elsif d = 'check-in' then
    raise exception 'invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('club-household-id:' || hid::text, 0));

  select * into cur from public.household_development where id = rid;
  if not found and d = 'start' then
    -- The other adult agreed to the same skill for the same child first: theirs is the family's decision.
    select * into cur from public.household_development
     where household_id = hid and member_id = (p ->> 'member_id')::uuid and skill_id = p ->> 'skill_id';
    if found then
      if cur.status not in ('active', 'launched') then raise exception 'exists'; end if;
      return public.household_development_json(cur) || jsonb_build_object('adopted', true);
    end if;
  end if;
  if not found then
    if p_base is not null then raise exception 'removed'; end if;
    if d not in ('start', 'pause', 'dismiss') then raise exception 'invalid'; end if;
    if not exists (select 1 from public.club_family_members m
                    where m.id = (p ->> 'member_id')::uuid and m.household_id = hid and m.archived_at is null and m.kind = 'child') then
      raise exception 'invalid';
    end if;
    if exists (select 1 from public.household_development
                where household_id = hid and member_id = (p ->> 'member_id')::uuid and skill_id = p ->> 'skill_id') then
      raise exception 'exists';
    end if;
    if d = 'start' and p ->> 'stage' is null then raise exception 'invalid'; end if;
    select count(*) into n from public.household_development where household_id = hid;
    if n >= 200 then raise exception 'too_many'; end if;
    insert into public.household_development (id, household_id, member_id, skill_id, title, stage, status, cue, finish_line,
                                              note, category, library_version, created_by, updated_by, last_check_in_on)
    values (rid, hid, (p ->> 'member_id')::uuid, p ->> 'skill_id', btrim(p ->> 'title'),
            case when d = 'start' then p ->> 'stage' else nullif(p ->> 'stage', '') end,
            case when d = 'start' then case when p ->> 'stage' = 'launch' then 'launched' else 'active' end
                 when d = 'pause' then 'paused' else 'dismissed' end,
            nullif(btrim(p ->> 'cue'), ''), nullif(btrim(p ->> 'finish'), ''), nullif(btrim(p ->> 'note'), ''),
            coalesce(p ->> 'category', 'other'), (p ->> 'library_version')::int, uid, uid,
            case when d = 'start' then current_date end)
    returning * into nxt;
    if d = 'start' then
      select e.change, e.agreement into ach, aid from public.household_development_ensure_agreement(nxt, (p ->> 'agreement_id')::uuid, uid) e;
      update public.household_development set agreement_id = aid where id = rid returning * into nxt;
    end if;
    insert into public.household_development_events (record_id, household_id, decision, to_stage, to_status, note,
                                                     agreement_change, agreement_id, library_version, decided_by)
    values (nxt.id, hid, d, nxt.stage, nxt.status, nxt.note, ach, aid, nxt.library_version, uid);
    out_ := public.household_development_json(nxt);
    if aid is not null then
      select * into ag from public.club_responsibilities where id = aid;
      out_ := out_ || jsonb_build_object('agreement', public.household_agreement_json(ag));
    end if;
    return out_;
  end if;

  if cur.household_id <> hid then raise exception 'invalid'; end if;
  -- A retried start (the answer was lost on the way back): return what was saved.
  if d = 'start' then
    if (p ->> 'member_id')::uuid is distinct from cur.member_id or p ->> 'skill_id' is distinct from cur.skill_id then raise exception 'invalid'; end if;
    out_ := public.household_development_json(cur);
    if cur.agreement_id is not null then
      select * into ag from public.club_responsibilities where id = cur.agreement_id;
      if found then out_ := out_ || jsonb_build_object('agreement', public.household_agreement_json(ag)); end if;
    end if;
    return out_;
  end if;
  if p_base is distinct from cur.revision then raise exception 'conflict'; end if;
  -- An existing record keeps its child and skill.
  if (p ? 'member_id' and (p ->> 'member_id')::uuid is distinct from cur.member_id)
     or (p ? 'skill_id' and p ->> 'skill_id' is distinct from cur.skill_id) then
    raise exception 'invalid';
  end if;
  nxt := cur;
  idx := array_position(stages, cur.stage);
  case d
    when 'advance' then
      if cur.status <> 'active' or idx is null or idx >= 4 then raise exception 'invalid'; end if;
      nxt.stage := stages[idx + 1];
      nxt.status := case when nxt.stage = 'launch' then 'launched' else 'active' end;
    when 'step-back' then
      if cur.status not in ('active', 'launched') or idx is null or idx <= 1 then raise exception 'invalid'; end if;
      nxt.stage := stages[idx - 1];
      nxt.status := 'active';
    when 'stay', 'check-in' then
      if cur.status not in ('active', 'launched') then raise exception 'invalid'; end if;
    when 'pause' then
      if cur.status = 'paused' then raise exception 'invalid'; end if;
      nxt.status := 'paused';
    when 'dismiss' then
      if cur.status = 'dismissed' then raise exception 'invalid'; end if;
      nxt.status := 'dismissed';
    when 'resume' then
      if cur.status not in ('paused', 'dismissed') then raise exception 'invalid'; end if;
      nxt.stage := coalesce(cur.stage, p ->> 'stage');
      if nxt.stage is null then raise exception 'invalid'; end if;
      nxt.status := case when nxt.stage = 'launch' then 'launched' else 'active' end;
    when 'restore' then
      if cur.status not in ('active', 'launched') then raise exception 'invalid'; end if;
      if exists (select 1 from public.club_responsibilities x where x.id = cur.agreement_id and x.status = 'confirmed' and x.deleted_at is null) then
        raise exception 'invalid';
      end if;
    when 'modify' then
      null;
    else
      raise exception 'invalid';
  end case;
  if d = 'modify' then
    if p ? 'title' then nxt.title := btrim(p ->> 'title'); end if;
    if p ? 'cue' then nxt.cue := nullif(btrim(p ->> 'cue'), ''); end if;
    if p ? 'finish' then nxt.finish_line := nullif(btrim(p ->> 'finish'), ''); end if;
  elsif p ? 'title' or p ? 'cue' or p ? 'finish' then
    -- Wording is changed only by 'modify' (or chosen again when reopening), so a stage decision never quietly
    -- rewrites the family's words.
    if d <> 'resume' then raise exception 'invalid'; end if;
    if p ? 'cue' then nxt.cue := nullif(btrim(p ->> 'cue'), ''); end if;
    if p ? 'finish' then nxt.finish_line := nullif(btrim(p ->> 'finish'), ''); end if;
  end if;
  if p ? 'category' and d in ('resume', 'restore', 'modify') then nxt.category := p ->> 'category'; end if;
  if p ? 'note' then nxt.note := nullif(btrim(p ->> 'note'), ''); end if;
  if sig is not null then
    nxt.last_signal := sig; nxt.last_value := val;
    if var then nxt.variations_practiced := cur.variations_practiced + 1; end if;
  end if;
  if d in ('advance', 'step-back', 'stay', 'check-in', 'resume', 'restore') then nxt.last_check_in_on := current_date; end if;

  update public.household_development
     set title = nxt.title, stage = nxt.stage, status = nxt.status, cue = nxt.cue, finish_line = nxt.finish_line,
         note = nxt.note, category = nxt.category, last_signal = nxt.last_signal, last_value = nxt.last_value,
         last_check_in_on = nxt.last_check_in_on, variations_practiced = nxt.variations_practiced,
         library_version = greatest(cur.library_version, (p ->> 'library_version')::int),
         revision = cur.revision + 1, updated_by = uid, updated_at = now()
   where id = rid returning * into nxt;

  -- The agreement follows the decision.
  if d in ('pause', 'dismiss') then
    update public.club_responsibilities
       set deleted_at = now(), revision = revision + 1, updated_by = uid, updated_at = now()
     where id = cur.agreement_id and household_id = hid and status = 'confirmed' and deleted_at is null
    returning * into ag;
    if found then ach := 'removed'; aid := ag.id; end if;
  elsif d in ('resume', 'restore') then
    select e.change, e.agreement into ach, aid from public.household_development_ensure_agreement(nxt, (p ->> 'agreement_id')::uuid, uid) e;
    if aid is distinct from nxt.agreement_id then
      update public.household_development set agreement_id = aid where id = rid returning * into nxt;
    end if;
    if aid is not null then select * into ag from public.club_responsibilities where id = aid; end if;
  elsif d = 'modify' and (p ? 'title' or p ? 'cue' or p ? 'finish') then
    update public.club_responsibilities
       set agreed_text = left(nxt.title, 160), agreed_finished = nxt.finish_line, agreed_when = left(nxt.cue, 80),
           revision = revision + 1, updated_by = uid, updated_at = now()
     where id = cur.agreement_id and household_id = hid and status = 'confirmed' and deleted_at is null
    returning * into ag;
    if found then ach := 'updated'; aid := ag.id; end if;
  end if;

  insert into public.household_development_events (record_id, household_id, decision, from_stage, to_stage, from_status,
                                                   to_status, signal, value, variation_practiced, note, agreement_change,
                                                   agreement_id, library_version, decided_by)
  values (rid, hid, d, cur.stage, nxt.stage, cur.status, nxt.status, sig, val, var,
          case when p ? 'note' then nxt.note end, ach, aid, (p ->> 'library_version')::int, uid);
  out_ := public.household_development_json(nxt);
  if ach is not null then out_ := out_ || jsonb_build_object('agreement', public.household_agreement_json(ag)); end if;
  return out_;
exception
  when check_violation or invalid_text_representation or not_null_violation or unique_violation then raise exception 'invalid';
end $$;
revoke execute on function public.household_development_decide(jsonb, int) from public, anon;
grant execute on function public.household_development_decide(jsonb, int) to authenticated;

commit;
