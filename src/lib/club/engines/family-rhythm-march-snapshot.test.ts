/**
 * March stays exactly as it is while the Family Rhythm becomes reusable (docs/club/WELCOME_MARCH_DECEMBER_MIGRATION.md,
 * Phase 2a). Recorded from the engine before it moved to family-rhythm.ts; any change to what March prepares, shows or
 * prints fails here. Regenerate (`vitest -u`) only for an intended, reviewed change to March itself.
 */
import { describe, expect, it } from 'vitest';
import { sampleHouseholds } from '../../../data/club/samples';
import { families } from '../../../../tests/club/fixtures';
import { familyContext, familySnapshot } from '../personalize/family';
import {
  addRow, freshState, fromLegacy, isRhythmState, preparedPlan, removeRow, restorePlan, rhythmFingerprint, rhythmView, saveRow, setAnchor, setHabit,
  setMomentLabel, setMomentOn, setRowOwners, validatePlan, type RhythmMember, type RhythmState,
} from './march-family-rhythm';
import type { ContextPrefs } from '../personalize/family';

/** Everything the sheet, rail and phone read, without the context object itself (ages are kept from it). */
const shown = (s: RhythmState, members: readonly RhythmMember[], prefs?: ContextPrefs) => {
  const v = rhythmView(s, members, prefs);
  return {
    // Every moment as the editor sees it: one compact line per part (row id, job, title, owners, habit, established, mode).
    moments: v.moments.map((m) => [m.id, m.anchor, m.title, m.cue, m.when, m.enabled, m.finish,
      m.parts.map((r) => [r.id, r.job ?? null, r.title, r.icon, r.owners.map((o) => `${o.id}:${o.color.id}`).join(','), r.habit, r.established, r.mode, r.ownership])]),
    printed: v.printed.map((m) => [m.id, m.rows.map((r) => [r.ids.join('+'), r.mode])]),
    habits: v.habits.map((h) => h.sentence),
    people: v.people.map((p) => `${p.id}:${p.name}:${p.color.id}:${p.age}`),
    changed: v.changed,
    fingerprint: rhythmFingerprint(s, members, prefs),
  };
};

const SAMPLES = sampleHouseholds.map((x) => x.id);

describe('March Family Rhythm is unchanged (snapshot)', () => {
  it.each(SAMPLES)('sample %s: prepared plan, view and fingerprint', (id) => {
    const s = sampleHouseholds.find((x) => x.id === id)!;
    const members = s.household.members as RhythmMember[];
    const prefs = s.household.preferences;
    const state: RhythmState = { ...freshState(), ...(s.profile ? { profile: familySnapshot(s.profile) } : {}) };
    const ctx = familyContext(members, prefs, '2027-03', state.profile);
    const plan = preparedPlan(ctx);
    expect({ plan: JSON.stringify(plan), issues: validatePlan(plan, ctx), view: shown(state, members, prefs) }).toMatchSnapshot();
  });

  it.each(Object.keys(families))('fixture %s: prepared view and fingerprint', (key) => {
    const h = families[key];
    expect(shown(freshState(), h.members as RhythmMember[], h.preferences)).toMatchSnapshot();
  });

  it('120 generated households: fingerprints', () => {
    let seed = 11;
    const rand = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31; };
    const out: string[] = [];
    for (let n = 0; n < 120; n++) {
      const adults = 1 + Math.floor(rand() * 3);
      const kids = Math.floor(rand() * 7);
      const members = [
        ...Array.from({ length: adults }, (_, i) => ({ id: `a${i}`, firstName: `Grown${i}`, kind: 'adult' as const, ...(i === 0 ? { isAccountHolder: true } : {}) })),
        ...Array.from({ length: kids }, (_, i) => ({ id: `k${i}`, firstName: `Kid${i}`, kind: 'child' as const, birthYear: 2008 + Math.floor(rand() * 18), birthMonth: 1 + Math.floor(rand() * 12) })),
      ] as RhythmMember[];
      out.push(rhythmFingerprint(freshState(), members, { pets: rand() > 0.5 }));
    }
    expect(out).toMatchSnapshot();
  });

  it('a sequence of edits on Rivera, then a save round trip', () => {
    const s0 = sampleHouseholds.find((x) => x.id === 'rivera')!;
    const members = s0.household.members as RhythmMember[];
    const prefs = s0.household.preferences;
    const s: RhythmState = { ...freshState(), profile: familySnapshot(s0.profile!) };
    const steps: unknown[] = [];
    const v0 = rhythmView(s, members, prefs);
    const [m1, m2, m3] = v0.moments;
    setMomentLabel(s, m1.id, 'Before school', members, prefs); steps.push(shown(s, members, prefs));
    setMomentOn(s, m3.id, true, members, prefs); steps.push(shown(s, members, prefs));
    setAnchor(s, m2.id, 'home', members, prefs); steps.push(shown(s, members, prefs));
    const kid = members.find((m) => m.kind === 'child')!;
    const added = addRow(s, m1.id, kid.id, members, prefs, undefined, 'Water the plants');
    steps.push({ added, view: shown(s, members, prefs) });
    const row = s.plan!.rows[0];
    setRowOwners(s, row.id, members.slice(0, 2).map((m) => m.id), members, prefs); steps.push(shown(s, members, prefs));
    setHabit(s, s.plan!.rows[1].id, true, members, prefs); steps.push(shown(s, members, prefs));
    steps.push(saveRow(s, undefined, { title: 'Make dinner', owners: [kid.id], moment: m1.id, habit: false }, members, prefs));
    removeRow(s, s.plan!.rows[s.plan!.rows.length - 1].id, members, prefs); steps.push(shown(s, members, prefs));
    const saved = JSON.parse(JSON.stringify(s));
    steps.push({ valid: isRhythmState(saved), same: rhythmFingerprint(saved, members, prefs) === rhythmFingerprint(s, members, prefs) });
    restorePlan(s); steps.push(shown(s, members, prefs));
    expect(steps).toMatchSnapshot();
  });

  it('the earlier chore charts still migrate the same way', () => {
    const s0 = sampleHouseholds.find((x) => x.id === 'rivera')!;
    const members = s0.household.members as RhythmMember[];
    const kids = members.filter((m) => m.kind === 'child');
    const legacy = { palette: 'sage', kids: Object.fromEntries(kids.map((k, i) => [k.id, { daily: [{ id: i % 2 ? 'feed-pets' : 'clear-the-table' }, { id: 'make-my-bed' }] }])) };
    const s = fromLegacy(legacy, members, s0.household.preferences, familySnapshot(s0.profile!));
    expect(s && shown(s, members, s0.household.preferences)).toMatchSnapshot();
  });
});
