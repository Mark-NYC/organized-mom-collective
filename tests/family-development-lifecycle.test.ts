/**
 * PR #515 review fixes: the meeting plan's lifecycle (accounts, households, Club access, the day), the agreement that
 * goes with each development decision, safe retries, and a family's journey across many meetings.
 * The database half of the agreement lifecycle is in supabase/tests/family-development.sql (one transaction per
 * decision, tombstones, races, retries); this file pins the app half to the same rules.
 */
import { describe, expect, it } from 'vitest';
import { planKey, reconcilePlan, recordScope, recordsFor, type MeetingIdentity, type PlanSlot } from '../src/lib/family-development/meeting-plan';
import { buildDevelopmentPlan, type CheckInStep, type SuggestStep } from '../src/lib/family-development/engine';
import {
  DEVELOPMENT_DECISIONS, NEEDS_AGREEMENT_ID, agreementEffect, applyDecision, availableDecisions, decisionToDb, recordFromDb,
  type DevelopmentRecord,
} from '../src/lib/family-development/records';
import { decideError } from '../src/lib/family-development/client';
import { readFileSync } from 'node:fs';
import { emptyProfile, type FamilyProfile } from '../src/lib/club/family-profile';
import type { Household } from '../src/lib/club/profile';

const TODAY = '2026-11-20';
const household = (id: string, kids: { id: string; name: string; birthYear: number }[]): Household => ({
  id, preferences: {}, profileVersion: 1,
  members: [{ id: `${id}-adult`, firstName: 'Ana', kind: 'adult', role: 'parent', isAccountHolder: true },
    ...kids.map((k) => ({ id: k.id, firstName: k.name, kind: 'child' as const, role: 'child' as const, birthYear: k.birthYear, birthMonth: 1 }))],
});
const H1 = household('h1', [{ id: 'mia', name: 'Mia', birthYear: 2019 }]);
const H2 = household('h2', [{ id: 'leo', name: 'Leo', birthYear: 2016 }]);
const rec = (p: Partial<DevelopmentRecord> & Pick<DevelopmentRecord, 'id' | 'memberId' | 'skillId'>): DevelopmentRecord => ({
  title: p.skillId, stage: 'watch', status: 'active', variationsPracticed: 0, category: 'other', agreementLive: true,
  agreementId: `ag-${p.id}`, libraryVersion: 1, revision: 1, history: [], createdAt: '2026-10-01T00:00:00Z', lastCheckInOn: '2026-11-10', ...p,
});
const id1: MeetingIdentity = { userId: 'u1', householdId: 'h1', club: true, today: TODAY };
const build = (h: Household) => (records: DevelopmentRecord[]) => buildDevelopmentPlan({ household: h, profile: emptyProfile(), records, today: TODAY });
const ready = (records: DevelopmentRecord[] | null | undefined, householdOnScreen: string | null = 'h1') => ({ records, householdOnScreen, profileLoaded: true });

describe('meeting plan lifecycle: never stale, never another family\'s', () => {
  const r1 = [rec({ id: 'r1', memberId: 'mia', skillId: 'school-bag' })];
  const first = reconcilePlan(null, id1, ready(r1), build(H1))!;

  it('builds a plan only from records loaded for this adult and household', () => {
    expect(first.key).toBe('u1|h1|2026-11-20');
    expect((first.plan.people[0].step as CheckInStep).record.id).toBe('r1');
    expect(recordScope(id1)).toBe('u1|h1');
  });

  it('keeps the same plan object through the meeting (decisions never reshuffle it)', () => {
    let calls = 0;
    const again = reconcilePlan(first, id1, ready([...r1, rec({ id: 'r2', memberId: 'mia', skillId: 'bed' })]), (r) => { calls++; return build(H1)(r); });
    expect(again).toBe(first);
    expect(calls).toBe(0);
  });

  it('drops the plan when the adult signs out', () => {
    expect(planKey({ ...id1, userId: null })).toBeNull();
    expect(reconcilePlan(first, { ...id1, userId: null }, ready(r1), build(H1))).toBeNull();
  });

  it('drops paid guidance the moment Club access is lost', () => {
    expect(reconcilePlan(first, { ...id1, club: false }, ready(r1), build(H1))).toBeNull();
    expect(recordScope({ ...id1, club: false })).toBeNull(); // and no records are loaded for a free family
  });

  it('switching households never shows the previous household\'s records, even for a moment', () => {
    const id2 = { ...id1, householdId: 'h2' };
    // Records still the old household's (the new load hasn't answered): nothing, not the old plan.
    const loadedForH1 = { scope: 'u1|h1', records: r1 };
    expect(recordsFor(loadedForH1, recordScope(id2))).toBeUndefined();
    expect(reconcilePlan(first, id2, ready(recordsFor(loadedForH1, recordScope(id2)), 'h2'), build(H2))).toBeNull();
    // The screen still shows the old household: nothing either.
    const r2 = [rec({ id: 'x', memberId: 'leo', skillId: 'trash' })];
    expect(reconcilePlan(first, id2, ready(r2, 'h1'), build(H2))).toBeNull();
    // Both belong to the new household: its own plan.
    const next = reconcilePlan(first, id2, ready(r2, 'h2'), build(H2))!;
    expect(next.key).toBe('u1|h2|2026-11-20');
    expect(next.plan.people.map((p) => p.memberId)).toEqual(['leo']);
  });

  it('switching accounts in the same browser starts over, without a restart', () => {
    const id3 = { ...id1, userId: 'u2' };
    expect(recordsFor({ scope: 'u1|h1', records: r1 }, recordScope(id3))).toBeUndefined();
    expect(reconcilePlan(first, id3, ready(undefined), build(H1))).toBeNull();
    expect(reconcilePlan(first, id3, ready(r1), build(H1))!.key).toBe('u2|h1|2026-11-20');
  });

  it('a new meeting day gets a fresh plan; a failed load shows nothing', () => {
    expect(reconcilePlan(first, { ...id1, today: '2026-11-27' }, ready(r1), build(H1))!.key).toBe('u1|h1|2026-11-27');
    expect(reconcilePlan(null, id1, ready(null), build(H1))).toBeNull();
    expect(reconcilePlan(null, id1, { records: r1, householdOnScreen: 'h1', profileLoaded: false }, build(H1))).toBeNull();
  });

  it('the meeting page checks the key at render time and rechecks access on resume, focus and other tabs', () => {
    const meeting = readFileSync('src/components/ourweek/WeeklyMeeting.tsx', 'utf8');
    const client = readFileSync('src/lib/family-development/client.ts', 'utf8');
    expect(meeting).toMatch(/slot && slot\.key === key \? slot\.plan : null/);
    expect(meeting).toMatch(/onAccessLost=\{access\.revoke\}/);
    expect(client).toMatch(/APP_RESUME_EVENT/);
    expect(client).toMatch(/visibilitychange/);
    expect(client).toMatch(/e\.key === SESSION_STORAGE_KEY/);
    expect(client).toMatch(/prev\.userId === userId \? prev : \{ userId, club: false, checked: false \}/); // a new account starts without Club
    expect(client).toMatch(/if \(current\.current === scope\) setLoaded/); // late answers for an old scope are dropped
  });
});

describe('agreement lifecycle: a record and its agreement never disagree', () => {
  it('defines what every decision does to the agreement', () => {
    const active = { status: 'active' as const };
    expect(agreementEffect('start', active)).toBe('ensure');
    expect(agreementEffect('start', { status: 'launched' })).toBe('ensure');
    expect(agreementEffect('start', { status: 'paused' })).toBe('keep'); // "Not now" before starting: no agreement
    expect(agreementEffect('pause', { status: 'paused' })).toBe('remove');
    expect(agreementEffect('dismiss', { status: 'dismissed' })).toBe('remove');
    expect(agreementEffect('resume', active)).toBe('ensure');
    expect(agreementEffect('restore', active)).toBe('ensure');
    expect(agreementEffect('modify', active)).toBe('update-words');
    for (const d of ['advance', 'step-back', 'stay', 'check-in'] as const) expect(agreementEffect(d, active)).toBe('keep');
    expect(DEVELOPMENT_DECISIONS).toContain('restore');
  });

  it('the database implements the same lifecycle', () => {
    const sql = readFileSync('supabase/migrations/20261207000000_family_development_records.sql', 'utf8');
    expect(sql).toMatch(/if d in \('pause', 'dismiss'\) then\s+update public\.club_responsibilities\s+set deleted_at = now\(\)/);
    expect(sql).toMatch(/elsif d in \('resume', 'restore'\) then\s+select e\.change, e\.agreement into ach, aid from public\.household_development_ensure_agreement/);
    expect(sql).not.toMatch(/delete from public\.club_responsibilities/); // tombstones only, never a hard delete
    expect(sql).not.toMatch(/deleted_at = null/); // a removed agreement is never brought back silently
  });

  it('an agreement removed elsewhere is surfaced, not silently kept or dropped', () => {
    const r = rec({ id: 'r1', memberId: 'mia', skillId: 'teeth', agreementLive: false, lastCheckInOn: TODAY });
    const s = buildDevelopmentPlan({ household: H1, records: [r], today: TODAY }).people[0].step as CheckInStep;
    expect(s.agreementRemoved).toBe(true);
    expect(s.decisions).toEqual(['restore', 'pause']);
    expect(s.why[0]).toMatch(/taken off Mia’s list/);
    expect(availableDecisions({ stage: 'watch', status: 'active', agreementLive: true })).not.toContain('restore');
    expect(applyDecision({ stage: 'watch', status: 'active' }, { decision: 'restore' })).toEqual({ stage: 'watch', status: 'active' });
    expect(() => applyDecision({ stage: 'watch', status: 'paused' }, { decision: 'restore' })).toThrow();
  });

  it('sends the phone-made agreement id only with decisions that create one, so retries reuse it', () => {
    const t = { id: 'r', memberId: 'm', skillId: 'bed', title: 'Make my bed' };
    const once = decisionToDb(t, { decision: 'start', stage: 'model', category: 'cleaning', agreementId: 'A' }, 1, true);
    const again = decisionToDb(t, { decision: 'start', stage: 'model', category: 'cleaning', agreementId: 'A' }, 1, true);
    expect(once).toEqual(again);
    expect(once).toMatchObject({ id: 'r', agreement_id: 'A', category: 'cleaning' });
    expect(decisionToDb(rec({ id: 'r', memberId: 'm', skillId: 'bed' }), { decision: 'stay', agreementId: 'A' }, 1, false)).not.toHaveProperty('agreement_id');
    expect(NEEDS_AGREEMENT_ID).toEqual(['start', 'resume', 'restore']);
  });

  it('reads the agreement link and liveness the database reports', () => {
    const base = { id: 'x', member_id: 'c', skill_id: 'bed', title: 'Make my bed', stage: 'watch' as const, status: 'active' as const, cue: null, finish_line: null, note: null, last_signal: null, last_value: null, last_check_in_on: null, variations_practiced: 0, library_version: 1, revision: 2 };
    expect(recordFromDb({ ...base, agreement_id: 'a', agreement_live: false, category: 'cleaning' })).toMatchObject({ agreementId: 'a', agreementLive: false, category: 'cleaning' });
    expect(recordFromDb({ ...base }).agreementLive).toBe(false); // no agreement at all
  });

  it('maps every database refusal to a "not saved" message; nothing unknown reads as success', () => {
    expect(decideError(new Error('conflict'))).toBe('conflict');
    expect(decideError(new Error('club_required'))).toBe('club_required');
    expect(decideError(new Error('signed_out'))).toBe('signed_out');
    expect(decideError(new Error('exists'))).toBe('exists');
    expect(decideError(new Error('too_many'))).toBe('too_many');
    expect(decideError(new TypeError('Failed to fetch'))).toBe('offline');
    expect(decideError('weird')).toBe('offline');
  });

  it('the meeting reports "saved" only from the database\'s answer, with the agreement it returned', () => {
    const coach = readFileSync('src/components/family/DevelopmentCoach.tsx', 'utf8');
    expect(coach).toMatch(/const live = r\.agreement && !r\.agreement\.deleted;/);
    expect(coach).toMatch(/Saved: agreed by our family\. It’s on \$\{firstName\}’s list\./);
    expect(coach).toMatch(/useState\(\(\) => \(\{ record: newRecordId\(\), agreement: newRecordId\(\) \}\)\)/); // ids kept for retries
    expect(coach).toMatch(/if \(busy\) return;/); // no double submit
  });
});

describe('engine review against the doctrine', () => {
  it('a family\'s explicit wish beats the default progression (a capable child can start the advanced skill)', () => {
    const records = [rec({ id: 'r1', memberId: 'leo', skillId: 'sort', lastCheckInOn: TODAY })];
    const profile: FamilyProfile = { ...emptyProfile(), responsibilities: [{ status: 'desired', category: 'laundry', item: 'put-away-laundry', ownerIds: ['leo'], helperIds: [] }] };
    const s = buildDevelopmentPlan({ household: H2, profile, records, today: TODAY }).people[0].step as SuggestStep;
    expect(s.skill.id).toBe('fold');
    expect(s.why[0]).toMatch(/You said/);
  });

  it('the family priority outranks a seasonal match', () => {
    const profile: FamilyProfile = { ...emptyProfile(), priority: 'laundry' };
    const s = buildDevelopmentPlan({ household: H2, profile, records: [], today: '2026-08-20' }).people[0].step as SuggestStep;
    expect(['hamper', 'sort', 'fold', 'load']).toContain(s.skill.id);
  });

  it('existing agreements come before new skills', () => {
    const agreement = (agreedAt: string, n = 1): FamilyProfile => ({ ...emptyProfile(), responsibilities: Array.from({ length: n }, (_, i) => ({ id: `a${i}`, status: 'confirmed' as const, category: 'meals' as const, ownerIds: ['leo'], helperIds: [], agreement: { text: 'Feed the dog', agreedAt } })) });
    const plan = (p: FamilyProfile) => buildDevelopmentPlan({ household: H2, profile: p, records: [], today: TODAY }).people[0].step;
    expect(plan(agreement('2026-11-18T10:00:00Z'))).toBeNull(); // agreed this week: let it settle
    expect(plan(agreement('2026-10-01T10:00:00Z', 2))).toBeNull(); // two going already
    expect(plan(agreement('2026-10-01T10:00:00Z', 1))?.kind).toBe('suggest');
  });
});

describe('acceptance: one family across many meetings', () => {
  it('accept → saved → same stage next week → long Watch → Launch only by choice → pause leaves no contradiction', () => {
    let records: DevelopmentRecord[] = [];
    const meet = (today: string) => buildDevelopmentPlan({ household: H1, profile: emptyProfile(), records, today });
    const decideLocal = (id: string, input: Parameters<typeof applyDecision>[1], today: string) => {
      const cur = records.find((r) => r.id === id)!;
      const next = applyDecision(cur, input);
      const effect = agreementEffect(input.decision, next);
      records = records.map((r) => r.id !== id ? r : {
        ...r, ...next, revision: r.revision + 1, lastCheckInOn: today,
        agreementLive: effect === 'remove' ? false : effect === 'ensure' ? true : r.agreementLive,
        ...(input.check ? { lastSignal: input.check.signal, lastValue: input.check.value, variationsPracticed: r.variationsPracticed + (input.check.variation ? 1 : 0) } : {}),
      });
    };
    // Week 1: one idea for Mia; the family agrees.
    const idea = meet('2026-11-20').people[0].step as SuggestStep;
    expect(idea.kind).toBe('suggest');
    const started = applyDecision(null, { decision: 'start', stage: 'model' });
    records = [rec({ id: 'r', memberId: 'mia', skillId: idea.skill.id, ...started, lastCheckInOn: '2026-11-20', agreementLive: agreementEffect('start', started) === 'ensure' })];
    // Week 2: the same responsibility and stage come back as a check-in, not a new idea.
    let s = meet('2026-11-27').people[0].step as CheckInStep;
    expect(s.kind).toBe('check-in');
    expect(s.record.stage).toBe('model');
    decideLocal('r', { decision: 'advance' }, '2026-11-27');
    decideLocal('r', { decision: 'advance' }, '2026-11-27'); // the family moves on to Watch, two explicit taps
    // Twelve weeks of Watch, good and bad, never move the stage.
    for (let w = 0; w < 12; w++) {
      const day = `2027-0${1 + Math.floor(w / 4)}-${String(1 + (w % 4) * 7).padStart(2, '0')}`;
      s = meet(day).people[0].step as CheckInStep;
      expect(s.record.stage).toBe('watch');
      decideLocal('r', { decision: 'check-in', check: { signal: 'consistency', value: w % 3 ? 'strong' : 'partial', variation: w % 2 === 0 } }, day);
    }
    expect(records[0].stage).toBe('watch');
    // Launch only when they decide.
    decideLocal('r', { decision: 'advance' }, '2027-04-01');
    expect(records[0]).toMatchObject({ stage: 'launch', status: 'launched', agreementLive: true });
    // Pausing takes it off every list; the meeting doesn't keep asking about it.
    decideLocal('r', { decision: 'pause' }, '2027-05-01');
    expect(records[0]).toMatchObject({ status: 'paused', agreementLive: false });
    const after = meet('2027-06-01').people[0].step;
    expect(after?.kind === 'check-in' && after.record.id === 'r').toBe(false);
    expect(after?.kind === 'suggest' ? after.skill.id : null).not.toBe(idea.skill.id);
  });
});
