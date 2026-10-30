import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { buildFamilyMeeting, type FamilyMeeting } from '../src/lib/club/family-meeting';
import { MEETING_MONTHS } from '../src/data/club/family-meeting';
import { GROWTH_ITEMS } from '../src/data/club/family-profile';
import { emptyProfile, type FamilyProfile } from '../src/lib/club/family-profile';
import type { FamilyMember, Household } from '../src/lib/club/profile';
import { sampleById } from '../src/data/club/samples';

/** Every month of the program year, as the kits date them. */
const MONTHS = ['2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08', '2027-09', '2027-10', '2026-11', '2026-12'];

const kid = (id: string, name: string, age: number, month = '2027-01'): FamilyMember =>
  ({ id, firstName: name, kind: 'child', role: 'child', birthYear: Number(month.slice(0, 4)) - age - 1, birthMonth: 1 });
const adult = (id: string, name: string, holder = false, role: FamilyMember['role'] = holder ? 'parent' : 'partner'): FamilyMember =>
  ({ id, firstName: name, kind: 'adult', role, ...(holder ? { isAccountHolder: true } : {}) });
const house = (members: FamilyMember[], preferences: Household['preferences'] = {}): Household => ({ id: 'h', preferences, profileVersion: 1, members });

const rivera = sampleById('rivera')!.household;
const [ana, luis, sofia, mateo, elena] = rivera.members;
const riveraProfile: FamilyProfile = {
  setupDone: ['week', 'responsibilities', 'growth', 'challenges', 'priority'], setupCompleted: true,
  challenges: ['routines', 'knowing-plans'], priority: 'evenings', priorityNote: 'Dinner chaos',
  activities: [
    { id: 'a1', category: 'school', memberIds: [sofia.id, mateo.id], days: [1, 2, 3, 4, 5] },
    { id: 'a2', category: 'sports', name: 'Soccer', memberIds: [sofia.id], days: [2, 4], startsAt: '17:30' },
  ],
  responsibilities: [
    { id: 'r1', status: 'existing', category: 'meals', ownerIds: [ana.id, luis.id], helperIds: [sofia.id], scope: 'shared' },
    { id: 'r2', status: 'existing', category: 'transportation', ownerIds: [luis.id], helperIds: [], scope: 'individual' },
    { id: 'r3', status: 'existing', category: 'laundry', ownerIds: [ana.id], helperIds: [], scope: 'individual' },
    { id: 'r4', status: 'desired', category: 'school-prep', item: 'pack-school-bag', ownerIds: [sofia.id], helperIds: [] },
    { id: 'r5', status: 'desired', category: 'laundry', item: 'put-away-laundry', ownerIds: [], helperIds: [] },
  ],
};

/** Everything the meeting says, as one string. */
const allText = (m: FamilyMeeting) => JSON.stringify(m);
const words = (m: FamilyMeeting) => [
  m.focus.challenge, m.focus.principle, m.focus.why, m.focus.forWhom, ...m.talk.questions.map((q) => q.text), ...m.practice.steps,
  ...m.parts.people.flatMap((p) => [...p.existing, ...p.confirmed, ...p.suggested].flatMap((r) => [r.description, r.finished, r.when ?? '', r.connection])),
].join('\n');

describe('family meeting: shape, for all 12 monthly themes', () => {
  it('has content for every month, matching the current resources', () => {
    expect(MEETING_MONTHS.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const themes = MEETING_MONTHS.map((m) => m.theme.toLowerCase());
    expect(themes[0]).toMatch(/weekly family meeting/);
    expect(themes[1]).toMatch(/laundry/);
    expect(themes[2]).toMatch(/chore charts/);
    expect(themes[3]).toMatch(/meal/);
    expect(themes[4]).toMatch(/summer routines/);
    expect(themes[5]).toMatch(/snack/);
    expect(themes[6]).toMatch(/bored/);
    expect(themes[7]).toMatch(/school-day/);
    expect(themes[8]).toMatch(/habit cards/);
    expect(themes[9]).toMatch(/daily home reset/);
    expect(themes[10]).toMatch(/complete responsibility/);
    expect(themes[11]).toMatch(/blessing others/);
    for (const m of MEETING_MONTHS) {
      const page = m.route.startsWith('/app/club/') ? `src/pages${m.route}.astro` : 'src/pages/club/resources/[slug].astro';
      expect(existsSync(page), m.route).toBe(true);
    }
  });

  it.each(MONTHS)('%s: four sections, ten minutes, three questions, a practice', (month) => {
    const m = buildFamilyMeeting({ household: rivera, profile: riveraProfile, month });
    expect(m.focus.minutes + m.talk.minutes + m.parts.minutes + m.practice.minutes).toBe(10);
    expect(m.talk.questions).toHaveLength(3);
    expect(m.practice.steps.length).toBeGreaterThanOrEqual(2);
    expect(m.practice.resource).toBe(m.resourceTitle);
    expect(m.parts.people.map((p) => p.memberId)).toEqual(rivera.members.map((x) => x.id));
    expect(words(m)).not.toMatch(/\{\w+\}/);
  });

  it('January introduces the Weekly Meeting; it never replaces it', () => {
    const m = buildFamilyMeeting({ household: rivera, profile: riveraProfile, month: '2027-01' });
    expect(m.resourceTitle).toBe('Our Family Weekly Meeting');
    expect(m.practice.steps.join(' ')).toMatch(/weekly meeting time/);
  });

  it('is deterministic', () => {
    for (const month of MONTHS) expect(buildFamilyMeeting({ household: rivera, profile: riveraProfile, month })).toEqual(buildFamilyMeeting({ household: rivera, profile: riveraProfile, month }));
  });
});

describe('family meeting: one grown-up or several', () => {
  const solo = house([adult('jess', 'Jess', true), kid('max', 'Max', 9), kid('ivy', 'Ivy', 6)]);
  const grand = house([adult('liz', 'Liz', true), adult('nan', 'Nan', false, 'grandparent'), kid('oli', 'Oli', 6)]);

  it.each(MONTHS)('%s: never says Mom, Dad or parents', (month) => {
    for (const h of [solo, grand, rivera]) expect(words(buildFamilyMeeting({ household: h, month }))).not.toMatch(/\b(mom|dad|mother|father|parents?|both of you)\b/i);
  });

  it('the account holder leads only when nobody else can', () => {
    for (const month of MONTHS) {
      expect(buildFamilyMeeting({ household: grand, month }).leaderId).toBe('nan');
      expect(buildFamilyMeeting({ household: house([adult('a', 'Ann', true), kid('t', 'Tot', 4)]), month }).leaderId).toBe('a');
    }
    // Rotates among those who can: Luis and Sofia (11).
    const leaders = new Set(MONTHS.map((month) => buildFamilyMeeting({ household: rivera, month }).leaderId));
    expect([...leaders].sort()).toEqual([luis.id, sofia.id].sort());
  });

  it('never makes the account holder everyone’s organizer or reminder', () => {
    for (const month of MONTHS) {
      for (const h of [solo, grand, rivera]) {
        const holder = buildFamilyMeeting({ household: h, month }).parts.people.find((p) => h.members.find((x) => x.id === p.memberId)?.isAccountHolder)!;
        for (const s of holder.suggested) expect(s.description).not.toMatch(/remind|everyone’s|make sure|organize|check on/i);
      }
    }
  });

  it('grown-ups get no day or time: nothing assumes when they’re free', () => {
    for (const month of MONTHS) {
      for (const p of buildFamilyMeeting({ household: rivera, profile: riveraProfile, month }).parts.people) {
        if (p.kind === 'adult') for (const s of p.suggested) expect(s.when).toBeUndefined();
      }
    }
  });
});

describe('family meeting: children of different ages', () => {
  const wide = (month: string) => house([adult('a', 'Ann', true), kid('baby', 'Bea', 1, month), kid('k3', 'Cal', 3, month), kid('k6', 'Dee', 6, month), kid('k9', 'Eli', 9, month), kid('k12', 'Fay', 12, month), kid('k15', 'Gus', 15, month)]);

  it.each(MONTHS)('%s: every child’s suggestion fits their age; under 3 joins in with no job', (month) => {
    const m = buildFamilyMeeting({ household: wide(month), month });
    const content = MEETING_MONTHS.find((x) => x.month === Number(month.slice(5)))!;
    for (const p of m.parts.people.filter((x) => x.kind === 'child')) {
      if (p.age! < 3) {
        expect(p.joinsIn).toBe(true);
        expect(p.suggested).toEqual([]);
        continue;
      }
      for (const s of p.suggested) {
        const ex = content.examples.find((e) => e.id === s.sourceId)!;
        expect(ex.adult).toBeUndefined();
        expect(p.age!).toBeGreaterThanOrEqual(ex.minAge!);
        if (ex.maxAge !== undefined) expect(p.age!).toBeLessThanOrEqual(ex.maxAge);
      }
    }
  });

  it('no cooking step under 12 and no solo laundry load under 9', () => {
    const apr = buildFamilyMeeting({ household: wide('2027-04'), month: '2027-04' });
    for (const p of apr.parts.people) if ((p.age ?? 99) < 12) expect(p.suggested.map((s) => s.sourceId)).not.toContain('apr-helper');
    for (const p of apr.parts.people) if (p.kind === 'child') expect(p.suggested.map((s) => s.sourceId)).not.toContain('apr-captain');
    const feb = buildFamilyMeeting({ household: wide('2027-02'), month: '2027-02' });
    for (const p of feb.parts.people) if ((p.age ?? 99) < 9) expect(p.suggested.map((s) => s.sourceId)).not.toContain('feb-own-load');
  });

  it('asks the youngest-friendly tool question when a child is under 7', () => {
    const young = buildFamilyMeeting({ household: house([adult('a', 'Ann', true), kid('k', 'Kit', 4)]), month: '2027-02' });
    const older = buildFamilyMeeting({ household: house([adult('a', 'Ann', true), kid('k', 'Kit', 10)]), month: '2027-02' });
    expect(young.talk.questions[1].text).toBe('Where do dirty clothes go in our house?');
    expect(older.talk.questions[1].text).toBe('Which part of laundry could you do all by yourself?');
  });

  it('a family without children still gets a meeting for grown-ups', () => {
    const m = buildFamilyMeeting({ household: house([adult('a', 'Ann', true), adult('b', 'Bo')]), month: '2027-04' });
    expect(m.talk.questions[1].audience).toBe('grown-ups');
    expect(m.practice.steps[0]).toMatch(/roles/);
    expect(m.focus.forWhom).toBe('For Ann and Bo.');
  });
});

describe('family meeting: missing, partial and detailed profiles', () => {
  const minimal = house([adult('m', 'Maya', true), kid('k', 'Kai', 7)]);

  it.each(MONTHS)('%s: no profile answers → useful generic meeting, nothing invented', (month) => {
    for (const profile of [null, undefined, emptyProfile()]) {
      const m = buildFamilyMeeting({ household: minimal, profile, month });
      expect(m.talk.questions[0].basis).toBe('generic');
      expect(m.talk.questions[2].basis).toBe('generic');
      expect(m.missing).toEqual(['activities', 'challenges', 'existing responsibilities', 'growth areas', 'priority']);
      expect(words(m)).not.toMatch(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b|\d{1,2}:\d{2}|weekdays/);
      for (const p of m.parts.people) expect([...p.existing, ...p.confirmed]).toEqual([]);
    }
  });

  it('uses her own activity name and days, and only hers', () => {
    const m = buildFamilyMeeting({ household: rivera, profile: riveraProfile, month: '2027-07' });
    expect(m.talk.questions[0]).toEqual({ text: 'Soccer is part of our week on Tue and Thu. What could you do on the days without it?', basis: 'activity', audience: 'everyone' });
    const none = buildFamilyMeeting({ household: rivera, profile: { ...riveraProfile, activities: [] }, month: '2027-07' });
    expect(allText(none)).not.toMatch(/Soccer/);
  });

  it('a school cue uses school days only for the children she said go to school', () => {
    const m = buildFamilyMeeting({ household: rivera, profile: riveraProfile, month: '2027-08' });
    const by = (id: string) => m.parts.people.find((p) => p.memberId === id)!.suggested[0];
    expect(by(sofia.id).when).toBe('The night before, on weekdays');
    expect(by(mateo.id).when).toBe('Before school, on weekdays');
    expect(by(elena.id).when).toBe('Before bed');
  });

  it('homeschooling families read “lessons”', () => {
    const h = { ...rivera, preferences: { ...rivera.preferences, school: 'homeschool' as const } };
    const m = buildFamilyMeeting({ household: h, profile: riveraProfile, month: '2027-08' });
    expect(words(m)).toMatch(/Before lessons/);
    // The resource's own name (My School Day) stays.
    expect(words(m).replace(/My School Day/g, '')).not.toMatch(/\bschool\b(?! bag)/i);
  });

  it('only names people in the family, and skips archived members', () => {
    const h = { ...rivera, members: [...rivera.members, { ...kid('gone', 'Zed', 8), archived: true }] };
    const m = buildFamilyMeeting({ household: h, profile: riveraProfile, month: '2027-03' });
    expect(allText(m)).not.toMatch(/Zed/);
    const names = new Set(rivera.members.map((x) => x.firstName));
    for (const w of words(m).match(/\b[A-Z][a-z]+\b/g) ?? []) if (/^(Sofia|Mateo|Elena|Ana|Luis|Zed|Max|Kai)$/.test(w)) expect(names.has(w)).toBe(true);
  });

  it('never invents pet care for a family without a pet', () => {
    const noPet = house([adult('a', 'Ann', true), kid('k', 'Kit', 8)]);
    for (const month of MONTHS) expect(allText(buildFamilyMeeting({ household: noPet, month }))).not.toMatch(/\bpet\b/i);
    const pet = buildFamilyMeeting({ household: house([adult('a', 'Ann', true), kid('k', 'Kit', 5)], { pets: true }), profile: { ...emptyProfile(), responsibilities: [{ status: 'desired', category: 'pet-care', item: 'pet-care', ownerIds: [], helperIds: [] }] }, month: '2026-11' });
    expect(pet.parts.people[1].suggested[0].sourceId).toBe('nov-pet');
  });

  it('personalizes the focus from her priority, then her challenges, then generic', () => {
    expect(buildFamilyMeeting({ household: rivera, profile: riveraProfile, month: '2027-04' }).focus.why).toMatch(/Dinner and evenings are what you most want to share/);
    expect(buildFamilyMeeting({ household: rivera, profile: { ...riveraProfile, priority: undefined }, month: '2027-01' }).focus.why).toMatch(/Knowing what’s happening is hard/);
    expect(buildFamilyMeeting({ household: rivera, month: '2027-01' }).focus.why).toBe(MEETING_MONTHS[0].why);
  });

  it('prefers the growth area she picked for that child', () => {
    const m = buildFamilyMeeting({ household: rivera, profile: riveraProfile, month: '2027-08' });
    expect(m.parts.people.find((p) => p.memberId === sofia.id)!.suggested[0].sourceId).toBe('aug-bag');
    expect(m.talk.questions[2]).toMatchObject({ basis: 'growth', text: expect.stringContaining('Sofia') });
    expect(GROWTH_ITEMS.find((g) => g.id === 'pack-school-bag')).toBeTruthy();
  });

  it('agrees the verb with one or two owners', () => {
    const m = buildFamilyMeeting({ household: rivera, profile: { ...riveraProfile, responsibilities: riveraProfile.responsibilities.filter((r) => r.status === 'existing') }, month: '2027-04' });
    expect(m.talk.questions[2].text).toBe('Ana and Luis already take care of meals and kitchen. What does finished look like?');
  });
});

describe('family meeting: existing, suggested and confirmed stay apart', () => {
  it('existing comes from the profile: owners vs helpers, shared vs individual', () => {
    const m = buildFamilyMeeting({ household: rivera, profile: riveraProfile, month: '2027-04' });
    const p = (id: string) => m.parts.people.find((x) => x.memberId === id)!;
    expect(p(ana.id).existing).toEqual([expect.objectContaining({ status: 'existing', involvement: 'owns', scope: 'shared', sourceId: 'r1', source: 'profile' })]);
    expect(p(sofia.id).existing).toEqual([expect.objectContaining({ status: 'existing', involvement: 'helps', description: 'Helps with meals and kitchen when asked' })]);
    // Owners keep their job, nothing new on top; a helper still gets a suggestion.
    expect(p(ana.id).suggested).toEqual([]);
    expect(p(luis.id).suggested).toEqual([]);
    expect(p(sofia.id).suggested).toHaveLength(1);
  });

  it('only the month’s areas show as existing', () => {
    const m = buildFamilyMeeting({ household: rivera, profile: riveraProfile, month: '2027-02' });
    expect(m.parts.people.flatMap((p) => p.existing.map((e) => e.sourceId))).toEqual(['r3']);
    expect(buildFamilyMeeting({ household: rivera, profile: riveraProfile, month: '2026-11' }).parts.people.flatMap((p) => p.existing).length).toBe(5);
  });

  it('never turns a suggestion into a confirmed responsibility', () => {
    for (const month of MONTHS) {
      const before = structuredClone(riveraProfile);
      const m = buildFamilyMeeting({ household: rivera, profile: riveraProfile, month, resource: [{ memberId: mateo.id, description: 'Table captain', id: 'role:table' }] });
      expect(riveraProfile).toEqual(before);
      for (const p of m.parts.people) {
        expect(p.confirmed).toEqual([]);
        for (const s of p.suggested) expect(s.status).toBe('suggested');
        for (const e of p.existing) expect(e.status).toBe('existing');
      }
    }
  });

  it('confirmed ones come only from the family’s confirmed rows', () => {
    const profile: FamilyProfile = { ...riveraProfile, responsibilities: [...riveraProfile.responsibilities, { id: 'c1', status: 'confirmed', category: 'meals', ownerIds: [mateo.id], helperIds: [] }, { id: 's1', status: 'suggested', category: 'meals', ownerIds: [elena.id], helperIds: [] }] };
    const m = buildFamilyMeeting({ household: rivera, profile, month: '2027-04' });
    const p = (id: string) => m.parts.people.find((x) => x.memberId === id)!;
    expect(p(mateo.id).confirmed).toEqual([expect.objectContaining({ status: 'confirmed', sourceId: 'c1' })]);
    expect(p(mateo.id).suggested).toEqual([]);
    expect(p(elena.id).confirmed).toEqual([]);
    expect(p(elena.id).existing).toEqual([]);
  });

  it('what the resource prepared is a suggestion, for family members only', () => {
    const m = buildFamilyMeeting({ household: rivera, profile: riveraProfile, month: '2027-04', resource: [
      { memberId: mateo.id, description: 'Table captain', finished: 'Table set and cleared', id: 'role:table' },
      { memberId: 'stranger', description: 'Cook' },
    ] });
    expect(m.parts.people.find((p) => p.memberId === mateo.id)!.suggested).toEqual([expect.objectContaining({ status: 'suggested', source: 'resource', sourceId: 'role:table', description: 'Table captain' })]);
    expect(allText(m)).not.toMatch(/stranger/);
    expect(m.used).toContain('resource');
  });

  it('every recommendation has what Step 5 asks for', () => {
    for (const month of MONTHS) {
      for (const p of buildFamilyMeeting({ household: rivera, profile: riveraProfile, month }).parts.people) {
        for (const r of [...p.existing, ...p.confirmed, ...p.suggested]) {
          expect(r.memberId).toBe(p.memberId);
          expect(r.description.length).toBeGreaterThan(3);
          expect(['existing', 'suggested', 'confirmed']).toContain(r.status);
          expect(r.finished.length).toBeGreaterThan(3);
          expect(r.connection.length).toBeGreaterThan(3);
        }
        expect(p.suggested.length).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('family meeting: content rules', () => {
  const content = JSON.stringify(MEETING_MONTHS);
  it('no Mom, Dad or parents in any month', () => expect(content).not.toMatch(/\b(mom|dad|parents?)\b/i));
  it('only known tokens', () => {
    for (const t of content.match(/\{(\w+)\}/g) ?? []) expect(['{activity}', '{activityMid}', '{eveningBefore}', '{days}', '{who}', '{kids}', '{kid}', '{task}', '{takes}', '{growth}', '{school}']).toContain(t);
  });
  it('children’s examples start at 3, and every month has an example for every age from 3 up and for grown-ups', () => {
    for (const m of MEETING_MONTHS) {
      for (const e of m.examples) if (!e.adult) expect(e.minAge).toBeGreaterThanOrEqual(3);
      for (let age = 3; age <= 17; age++) expect(m.examples.some((e) => !e.adult && !e.requiresPets && age >= e.minAge! && (e.maxAge === undefined || age <= e.maxAge)), `${m.month} age ${age}`).toBe(true);
      expect(m.examples.some((e) => e.adult === 'any'), `${m.month} grown-ups`).toBe(true);
      for (const g of m.growth) expect(GROWTH_ITEMS.some((x) => x.id === g)).toBe(true);
    }
  });
});

describe('family meeting: samples', () => {
  it('Rivera (complete profile) and a minimal family, April and August', () => {
    const minimal = house([adult('m', 'Maya', true), kid('k', 'Kai', 7)]);
    const out = ['2027-04', '2027-08'].flatMap((month) => [buildFamilyMeeting({ household: rivera, profile: riveraProfile, month }), buildFamilyMeeting({ household: minimal, month })]);
    expect(out).toMatchSnapshot();
  });
});
