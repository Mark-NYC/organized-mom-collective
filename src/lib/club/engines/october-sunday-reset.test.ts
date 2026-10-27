import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRIGGER, applyDefaults, defaultFallJobs, displayName, emptyState, hasChanges, planKey, planMembers, preparedState, readSavedPlan,
  type PlanMember,
} from './october-sunday-reset';

const family: PlanMember[] = [
  { id: 'ana', firstName: 'Ana', kind: 'adult', role: 'parent', isAccountHolder: true },
  { id: 'luis', firstName: 'Luis', kind: 'adult', role: 'partner' },
  { id: 'sofia', firstName: 'Sofia', kind: 'child', birthYear: 2014, birthMonth: 3 },
  { id: 'mateo', firstName: 'Mateo', kind: 'child', birthYear: 2019, birthMonth: 6 },
  { id: 'old', firstName: 'Old', kind: 'child', birthYear: 2015, archived: true },
  { id: 'pet', firstName: 'Rex', kind: 'pet' },
];

describe('October Sunday Reset plan', () => {
  it('puts only current adults and children on the sheet', () => {
    expect(planMembers(family).map((m) => m.id)).toEqual(['ana', 'luis', 'sofia', 'mateo']);
  });

  it('prepares a role for everyone and owners for every fall job', () => {
    const members = planMembers(family);
    const s = preparedState(members);
    expect(s.trigger).toBe(DEFAULT_TRIGGER);
    expect(Object.keys(s.assignments)).toEqual(['ana', 'luis', 'sofia', 'mateo']);
    expect(s.assignments.ana).toMatch(/shared plans/);
    expect(s.fallJobs.map((j) => j.ownerId)).toEqual(['sofia', 'mateo', 'luis']);
  });

  it('calls the first two parents Mom and Dad unless renamed', () => {
    const members = planMembers(family);
    expect(displayName(members[0], members)).toBe('Mom');
    expect(displayName(members[1], members)).toBe('Dad');
    expect(displayName(members[2], members)).toBe('Sofia');
    expect(displayName(members[1], members, { luis: 'Papa' })).toBe('Papa');
  });

  it('keeps her edits when filling defaults', () => {
    const members = planMembers(family);
    const s = applyDefaults({ ...emptyState(), assignments: { sofia: 'Pack my violin' } }, members);
    expect(s.assignments.sofia).toBe('Pack my violin');
    expect(s.fallJobs).toHaveLength(3);
  });

  it('never restores another family’s saved plan, and rejects malformed JSON', () => {
    const state = preparedState(planMembers(family));
    const raw = JSON.stringify({ current: planKey('rivera', 'sample-rivera'), state });
    expect(readSavedPlan(raw, planKey('rivera', 'sample-rivera'))).toEqual(state);
    expect(readSavedPlan(raw, planKey('chen', 'sample-chen'))).toBeNull();
    expect(readSavedPlan('{nope', 'x')).toBeNull();
    expect(readSavedPlan(JSON.stringify({ current: 'x', state: { trigger: 1 } }), 'x')).toBeNull();
    expect(planKey(null, 'h1')).toBe('null:h1'); // the original inline key format
  });

  it('tells her own changes from the prepared plan', () => {
    const members = planMembers(family);
    expect(hasChanges(preparedState(members), members)).toBe(false);
    expect(hasChanges({ ...preparedState(members), text: { family: 'Look ahead. Get ready. Share the work.', cue: DEFAULT_TRIGGER } }, members)).toBe(false);
    expect(hasChanges({ ...preparedState(members), trigger: 'Sunday evening' }, members)).toBe(true);
    const s = preparedState(members);
    s.assignments.mateo = 'Feed the fish';
    expect(hasChanges(s, members)).toBe(true);
    const t = preparedState(members);
    t.fallJobs = defaultFallJobs(members).map((j, i) => (i === 0 ? { ...j, removed: true } : j));
    expect(hasChanges(t, members)).toBe(true);
  });
});

import { planFingerprint, roleSuggestions, setFallJob, setName, setRole, setTrigger } from './october-sunday-reset';

describe('October plan edits from the mobile sheets', () => {
  const members = planMembers(family);
  it('suggests the prepared role first, then two that fit the age', () => {
    const s = roleSuggestions(members[2], 2);
    expect(s[0]).toBe(preparedState(members).assignments.sofia);
    expect(s).toHaveLength(3);
    expect(new Set(s).size).toBe(3);
    expect(roleSuggestions({ id: 't', firstName: 'Tot', kind: 'child', birthYear: 2024 }, 0)[0]).toMatch(/picture calendar/);
  });
  it('changes the rhythm and drops any typed cue', () => {
    const s = setTrigger({ ...preparedState(members), text: { cue: 'old' } }, '  Sunday   evening ');
    expect(s.trigger).toBe('Sunday evening');
    expect(s.text?.cue).toBeUndefined();
    expect(setTrigger(preparedState(members), '   ').trigger).toBe(DEFAULT_TRIGGER);
  });
  it('renames, clears a rename, reassigns and removes', () => {
    const s = preparedState(members);
    setName(s, 'luis', 'Papa');
    expect(displayName(members[1], members, s.names)).toBe('Papa');
    setName(s, 'luis', ' ');
    expect(displayName(members[1], members, s.names)).toBe('Dad');
    setRole(s, 'sofia', 'Pack my violin');
    setFallJob(s, 'gear', { ownerId: 'sofia', removed: true });
    expect(s.assignments.sofia).toBe('Pack my violin');
    expect(s.fallJobs.find((j) => j.id === 'gear')).toMatchObject({ ownerId: 'sofia', removed: true });
  });
  it('fingerprints what prints, regardless of key order', () => {
    const a = preparedState(members);
    const b = structuredClone(a);
    b.assignments = Object.fromEntries(Object.entries(b.assignments).reverse());
    expect(planFingerprint(a)).toBe(planFingerprint(b));
    expect(planFingerprint(setTrigger(b, 'Sunday evening'))).not.toBe(planFingerprint(a));
  });
});
