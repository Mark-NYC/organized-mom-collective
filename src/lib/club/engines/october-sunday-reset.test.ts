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
