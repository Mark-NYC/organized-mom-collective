/**
 * The month-independent habit intelligence (src/lib/club/habits/), exercised with themes that aren't January's:
 * the same family context, focus scoring and experiment selection serve any month. Made-up families.
 */
import { describe, expect, it } from 'vitest';
import { HABIT_LIBRARY } from '../src/data/club/habit-library';
import { familyContext } from '../src/lib/club/habits/context';
import { scoreOpportunities } from '../src/lib/club/habits/focus';
import { recommendHabits, starterHabits } from '../src/lib/club/habits/recommend';
import { progressKey, type MonthTheme, type Opportunity } from '../src/lib/club/habits/types';
import type { GuideProfile } from '../src/lib/club/meeting-guide/state';
import type { FamilyMember, Household } from '../src/lib/club/profile';

const adult = (id: string, firstName: string): FamilyMember => ({ id, firstName, kind: 'adult', role: 'parent', isAccountHolder: true });
/** Age on the first day of `month` ('YYYY-MM'): born in June of the right year. */
const child = (id: string, firstName: string, age: number, month = '2027-01'): FamilyMember => {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return { id, firstName, kind: 'child', role: 'child', birthYear: m >= 6 ? y - age : y - age - 1, birthMonth: 6 };
};
const home = (members: FamilyMember[]): Household => ({ id: 'h', displayName: 'Test', preferences: {}, profileVersion: 1, members });
const profile = (p: Partial<GuideProfile>): GuideProfile => ({ challenges: [], activities: [], responsibilities: [], ...p });
const all = HABIT_LIBRARY.map((h) => h.id);
const theme = (month: string, schoolInSession: boolean, over: Partial<MonthTheme> = {}): MonthTheme => ({ month, schoolInSession, maxExperiments: 2, sharedFrom: 4, allowed: all, ...over });
const opp = (id: string, items: string[], o: Partial<Opportunity> = {}): Opportunity => ({ id, title: id, opportunity: '', discuss: '', discover: '', priorities: [], challenges: [], items, ...o });
const run = (h: Household, p: GuideProfile, t: MonthTheme, opps: Opportunity[], progress = {}) => {
  const ctx = familyContext(h, p, t.month, { progress });
  const top = scoreOpportunities(ctx, opps, t)[0];
  return { ctx, top, rec: recommendHabits(ctx, t, top.o, { title: top.o.title, source: top.source }) };
};
const text = (x: unknown) => JSON.stringify(x);

describe('habit intelligence, beyond January', () => {
  it('a preschooler developing a simple routine: one experiment, done together, anchors to discuss', () => {
    const h = home([adult('a', 'Rae'), child('k', 'Bea', 4, '2027-03')]);
    const p = profile({ priority: 'mornings', responsibilities: [{ status: 'desired', category: 'routines', item: 'morning-routine', ownerIds: ['k'] }] });
    const { rec } = run(h, p, theme('2027-03', true), [opp('mornings', ['morning-routine', 'pack-school-bag'], { priorities: ['mornings'] })]);
    expect(rec.experiments).toHaveLength(1);
    const e = rec.experiments[0];
    expect(e).toMatchObject({ who: 'Bea, 4', itemId: 'morning-routine', action: 'Get dressed in clothes laid out the night before.', basis: 'need' });
    expect(e.support).toMatch(/help with buttons at first/);
    expect(e.anchor).toEqual({ text: 'after breakfast or after waking up', verified: false });
    expect(e.ownership).toBe('Let Bea choose tomorrow’s outfit from two.');
  });

  it('a teenager with a seasonal activity: anchored to the activity she listed, never to a season', () => {
    const h = home([adult('a', 'Kai'), child('t', 'Ivo', 15, '2027-07')]);
    const p = profile({ priority: 'activities', activities: [{ category: 'sports', name: 'swim team', memberIds: ['t'] }] });
    const { rec } = run(h, p, theme('2027-07', false), [opp('activities', ['activity-gear', 'pack-school-bag', 'calendar-check'], { priorities: ['activities'] })]);
    const e = rec.experiments[0];
    expect(e).toMatchObject({ itemId: 'activity-gear', title: 'Ready for swim team', action: 'Pack the gear and sort the ride for swim team.' });
    expect(e.anchor).toEqual({ text: 'the evening before each swim team', verified: true });
    expect(text(rec)).not.toMatch(/summer|winter|fall|spring|season/i);
    // School's out: no school-bag habit, even though the theme lists it.
    expect(rec.experiments.map((x) => x.itemId)).not.toContain('pack-school-bag');
    // With her days, the anchor names them (the evenings before).
    const withDays = profile({ priority: 'activities', activities: [{ category: 'sports', name: 'swim team', memberIds: ['t'], days: [2, 4] } as GuideProfile['activities'][number]] });
    const r2 = run(h, withDays, theme('2027-07', false), [opp('activities', ['activity-gear'], { priorities: ['activities'] })]).rec;
    expect(r2.experiments[0].anchor).toEqual({ text: 'Monday and Wednesday evenings, before swim team', verified: true });
  });

  it('five children sharing one household challenge: one shared routine adapted by age, not five assignments', () => {
    const h = home([adult('a', 'Lou'), child('c1', 'Abe', 3), child('c2', 'Bo', 5), child('c3', 'Cal', 7), child('c4', 'Dot', 10), child('c5', 'Eve', 13)]);
    const p = profile({ priority: 'tidying' });
    const { rec } = run(h, p, theme('2027-01', true), [opp('home', ['tidy-room', 'own-belongings'], { priorities: ['tidying'] })]);
    expect(rec.experiments).toHaveLength(1);
    const e = rec.experiments[0];
    expect(e).toMatchObject({ who: 'Abe, Bo, Cal, Dot and Eve', title: 'A five-minute family pick-up', ownership: 'The kids take turns choosing the music.' });
    expect(e.adaptations!.map((a) => a.name)).toEqual(['Abe', 'Bo', 'Cal', 'Dot', 'Eve']);
    expect(e.adaptations![0].action).toBe('Put toys back in the bins.');
    expect(e.adaptations![4].action).toMatch(/weekly bedroom reset/);
  });

  it('a family whose routine changes between school and summer: same family, different habits', () => {
    const h = (m: string) => home([adult('a', 'Mo'), child('k1', 'Pia', 8, m), child('k2', 'Rex', 11, m)]);
    const p = profile({ priority: 'mornings', activities: [{ category: 'school', memberIds: ['k1', 'k2'] }],
      responsibilities: [{ status: 'desired', category: 'school-prep', item: 'pack-school-bag', ownerIds: ['k1'] }, { status: 'desired', category: 'routines', item: 'morning-routine', ownerIds: [] }] });
    const mornings = [opp('mornings', ['morning-routine', 'pack-school-bag', 'own-belongings'], { priorities: ['mornings'] })];
    const school = run(h('2027-01'), p, theme('2027-01', true), mornings).rec;
    const summer = run(h('2027-07'), p, theme('2027-07', false), mornings).rec;
    expect(school.experiments.map((e) => e.itemId)).toContain('pack-school-bag');
    expect(school.experiments.find((e) => e.itemId === 'pack-school-bag')!.anchor.verified).toBe(true);
    expect(summer.experiments.map((e) => e.itemId)).not.toContain('pack-school-bag');
    expect(summer.experiments.map((e) => e.itemId)).toContain('morning-routine');
  });

  it('progress shapes what’s suggested: done is noticed, struggling gets a simpler version', () => {
    const h = home([adult('a', 'Ash'), child('k', 'Ola', 9)]);
    const p = profile({ priority: 'evenings', responsibilities: [{ status: 'desired', category: 'meals', item: 'help-with-meals', ownerIds: ['k'] }] });
    const evenings = [opp('evenings', ['help-with-meals', 'bedtime-routine'], { priorities: ['evenings'] })];
    expect(run(h, p, theme('2027-01', true), evenings).rec.experiments[0].action).toBe('Clear and rinse the dishes.');
    const struggling = run(h, p, theme('2027-01', true), evenings, { [progressKey('k', 'help-with-meals')]: 'struggling' }).rec;
    expect(struggling.experiments[0].action).toBe('Set the table.');
    const done = run(h, p, theme('2027-01', true), evenings, { [progressKey('k', 'help-with-meals')]: 'independent' }).rec;
    expect(done.experiments.map((e) => e.itemId)).not.toContain('help-with-meals');
    expect(done.recognized[0]).toMatchObject({ name: 'Ola' });
  });

  it('prefers two distinct experiments to many, and never one per child just to include everyone', () => {
    const h = home([adult('a', 'Cy'), child('k1', 'Al', 6), child('k2', 'Bi', 8), child('k3', 'Ci', 10)]);
    const p = profile({ priority: 'evenings' });
    const { rec } = run(h, p, theme('2027-01', true, { sharedFrom: 9 }), [opp('evenings', ['bedtime-routine', 'help-with-meals'], { priorities: ['evenings'] })]);
    expect(rec.experiments.length).toBeLessThanOrEqual(2);
    expect(new Set(rec.experiments.map((e) => e.memberIds[0])).size).toBe(rec.experiments.length);
    expect(rec.notes.some((n) => /left out/.test(n.outcome))).toBe(true);
  });

  it('with too little to go on, starts from the month’s shared habit and one clearly framed idea', () => {
    const ctx = familyContext(home([adult('a', 'Dee'), child('k', 'Eli', 8)]), null, '2027-01');
    const rec = starterHabits(ctx, theme('2027-01', true), 'family-meeting', 'calendar-check');
    expect(rec.experiments.map((e) => [e.who, e.basis])).toEqual([['Everyone', 'consider'], ['Eli, 8', 'consider']]);
    expect(rec.experiments.every((e) => !e.why)).toBe(true);
  });

  it('library: every child-level line uses the name, never a pronoun, and assumes no season', () => {
    for (const item of HABIT_LIBRARY) {
      for (const h of Object.values(item.byStage)) {
        for (const line of [h!.action, h!.ownership, h!.support ?? '']) {
          expect(line, `${item.id}: ${line}`).not.toMatch(/\b(he|she|him|her|his|hers|they|them|their|theirs)\b/i);
          expect(line).not.toMatch(/summer|winter|fall|spring|season|\b(Mom|Dad|parents?)\b/i);
        }
      }
      expect(item.wish ?? '').not.toMatch(/\b(their|his|her)\b/i);
    }
  });
});
