import { describe, expect, it } from 'vitest';
import { buildFamilyMeeting } from '../src/lib/club/family-meeting';
import { clip, itemsPerPerson, meetingView, monthTitle, PRINT_LIMITS, STATUS_LABEL } from '../src/lib/club/family-meeting-view';
import { sampleById, sampleHouseholds } from '../src/data/club/samples';
import type { FamilyProfile } from '../src/lib/club/family-profile';
import type { FamilyMember, Household } from '../src/lib/club/profile';

const rivera = sampleById('rivera')!;
const chen = sampleById('chen')!;
const MONTHS = ['2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08', '2027-09', '2027-10', '2026-11', '2026-12'];

/** Twelve people, every one with an existing job and a confirmed one for one child. */
function large(): { household: Household; profile: FamilyProfile } {
  const names = ['Alexandria-Rose', 'Maximilian', 'Evangeline', 'Bartholomew', 'Anastasia-Grace', 'Christopher', 'Gwendolyn', 'Montgomery', 'Josephine', 'Sebastian', 'Penelope', 'Theodora'];
  const ages = [null, null, null, 17, 15, 13, 11, 9, 7, 5, 3, 1];
  const members: FamilyMember[] = names.map((n, i) => ({
    id: `x${i}`, firstName: n, kind: ages[i] === null ? 'adult' : 'child', role: ages[i] === null ? (i ? 'partner' : 'parent') : 'child',
    ...(i === 0 ? { isAccountHolder: true } : {}), ...(ages[i] === null ? {} : { birthYear: 2026 - ages[i]!, birthMonth: 1 }),
  }));
  const cats = ['meals', 'laundry', 'cleaning', 'transportation', 'belongings', 'school-prep', 'homework', 'pet-care'] as const;
  return {
    household: { id: 'h', preferences: { pets: true }, profileVersion: 1, members },
    profile: {
      setupDone: [], setupCompleted: false, challenges: [], activities: [],
      responsibilities: [
        ...cats.map((c, i) => ({ id: `r${i}`, status: 'existing' as const, category: c, ownerIds: [`x${i % 3}`, `x${3 + (i % 5)}`], helperIds: [`x${8 + (i % 3)}`] })),
        { id: 'c1', status: 'confirmed' as const, category: 'meals' as const, ownerIds: ['x5'], helperIds: [] },
      ],
    },
  };
}

describe('meeting view: labels and order', () => {
  it('uses exactly three status labels', () => {
    expect(Object.values(STATUS_LABEL)).toEqual(['Already doing', 'Suggested for us', 'Agreed by our family']);
  });

  it('reads already doing, then agreed, then suggested, for each person', () => {
    const { household, profile } = large();
    for (const month of MONTHS) {
      const v = meetingView(buildFamilyMeeting({ household, profile, month }), { print: false });
      for (const p of v.people) {
        const order = p.items.map((i) => ['existing', 'confirmed', 'suggested'].indexOf(i.status));
        expect(order).toEqual([...order].sort());
      }
    }
  });

  it('on screen shows everything the engine prepared', () => {
    const { household, profile } = large();
    const m = buildFamilyMeeting({ household, profile, month: '2027-04' });
    const v = meetingView(m, { print: false });
    for (const p of v.people) {
      const src = m.parts.people.find((x) => x.memberId === p.memberId)!;
      expect(p.items).toHaveLength(src.existing.length + src.confirmed.length + src.suggested.length);
      expect(p.more).toBe(0);
    }
    expect(v.dense).toBe(false);
  });

  it('names the leader, or says anyone can read', () => {
    const v = meetingView(buildFamilyMeeting({ household: rivera.household, profile: rivera.profile, month: '2027-04' }), { print: false });
    expect(v.leader.text).toMatch(/^(Luis|Sofia) reads the meeting this month\. Anyone can take a turn\.$/);
    const empty = meetingView({ ...buildFamilyMeeting({ household: rivera.household, month: '2027-04' }), leaderId: null }, { print: false });
    expect(empty.leader.text).toBe('Anyone can read the meeting.');
  });
});

describe('meeting view: the printed page shortens by rule, not by shrinking', () => {
  it('items per person by family size', () => {
    expect([1, 4, 5, 6, 7, 12].map(itemsPerPerson)).toEqual([3, 3, 2, 2, 1, 1]);
  });

  it('a twelve-person family prints one item each, in three columns, keeps agreed first, counts the rest', () => {
    const { household, profile } = large();
    for (const month of MONTHS) {
      const m = buildFamilyMeeting({ household, profile, month });
      const v = meetingView(m, { print: true });
      expect(v.dense).toBe(true);
      for (const p of v.people) {
        const src = m.parts.people.find((x) => x.memberId === p.memberId)!;
        const total = src.existing.length + src.confirmed.length + src.suggested.length;
        expect(p.items.length).toBe(Math.min(1, total));
        expect(p.more).toBe(total - p.items.length);
        if (src.confirmed.length) expect(p.items[0].status).toBe('confirmed');
        for (const i of p.items) expect(i.detail).toBeUndefined();
      }
      // "Finished looks like" once per distinct suggestion.
      const finished = v.people.flatMap((p) => p.items.map((i) => i.finished)).filter(Boolean);
      expect(new Set(finished).size).toBe(finished.length);
    }
  });

  it('small families keep finished lines and shared notes on paper', () => {
    const v = meetingView(buildFamilyMeeting({ household: rivera.household, profile: rivera.profile, month: '2027-04' }), { print: true });
    expect(v.dense).toBe(false);
    const ana = v.people.find((p) => p.name === 'Ana')!;
    expect(ana.items[0]).toMatchObject({ label: 'Already doing', detail: 'Shared with Luis', finished: expect.any(String) });
  });

  it('clips long lines at a word boundary only', () => {
    expect(clip('short', 20)).toBe('short');
    const long = 'Check and pack my things for the competitive regional swim team practice and the weekend meet before bed';
    const c = clip(long, PRINT_LIMITS.description);
    expect(c.length).toBeLessThanOrEqual(PRINT_LIMITS.description);
    expect(c.endsWith('…')).toBe(true);
    expect(long.startsWith(c.slice(0, -1))).toBe(true);
    expect(long[c.length - 1]).toBe(' ');
  });

  it('dates the guide by the kit’s month', () => {
    expect(monthTitle('2027-01')).toBe('January 2027');
    expect(monthTitle('2026-11')).toBe('November 2026');
  });
});

describe('meeting: real activities, never invented ones', () => {
  it('Rivera January asks about Sofia’s soccer, the evening before', () => {
    const m = buildFamilyMeeting({ household: rivera.household, profile: rivera.profile, month: '2027-01' });
    expect(m.talk.questions[0].text).toBe('What could Sofia do on Mon and Wed evenings to be ready for Soccer on Tue and Thu?');
  });

  it('Chen January: the swimmers pack their own gear, cued the evening before their own days', () => {
    const m = buildFamilyMeeting({ household: chen.household, profile: chen.profile, month: '2027-01' });
    const owen = m.parts.people.find((p) => p.firstName === 'Owen')!;
    expect(owen.suggested[0]).toMatchObject({ description: 'Check and pack my things for Swim team before bed.', when: 'Tue, Thu and Sun evenings', sourceId: 'jan-gear' });
    // Ivy (8) has piano on Wednesdays; her growth area (morning routine) isn't one of January's, so her lessons decide.
    const ivy = m.parts.people.find((p) => p.firstName === 'Ivy')!;
    expect(ivy.suggested[0]).toMatchObject({ description: 'Check and pack my things for Piano before bed.', when: 'Tuesday evening' });
  });

  it('a child who isn’t on any activity never gets an activity job', () => {
    const m = buildFamilyMeeting({ household: chen.household, profile: chen.profile, month: '2027-01' });
    const leo = m.parts.people.find((p) => p.firstName === 'Leo')!;
    expect(leo.suggested.map((s) => s.sourceId)).not.toContain('jan-gear');
    const none = buildFamilyMeeting({ household: chen.household, month: '2027-01' });
    expect(JSON.stringify(none)).not.toMatch(/Swim|Piano|evening/);
  });

  it('every sample family gets a complete meeting every month', () => {
    for (const s of sampleHouseholds.filter((x) => x.household.members.length)) {
      for (const month of MONTHS) {
        const m = buildFamilyMeeting({ household: s.household, profile: s.profile, month });
        expect(m.talk.questions).toHaveLength(3);
        expect(m.practice.steps.length).toBeGreaterThanOrEqual(2);
        expect(JSON.stringify(m)).not.toMatch(/\b(mom|dad|parents?)\b/i);
      }
    }
  });
});
