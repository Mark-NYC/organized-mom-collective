import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { agreementsByPerson, changeOf, cleaningAgreements, meetingWindow, monthAgreements, weekAhead } from '../src/lib/family-meeting-support';
import { sampleStore } from '../src/lib/club/store';
import { buildFamilyMeeting, suggestionKey } from '../src/lib/club/family-meeting';
import { MEETING_GUIDE } from '../src/data/club/meeting-guide';
import { sampleById } from '../src/data/club/samples';
import type { CalendarEvent } from '../src/lib/calendar/recurrence';
import type { FamilyProfile, Responsibility } from '../src/lib/club/family-profile';

const rivera = sampleById('rivera')!;
const H = rivera.household;
const P = rivera.profile as FamilyProfile;
const NOW = new Date('2026-11-15T18:00:00Z');
const ev = (id: string, o: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id, title: id, starts_on: '2026-11-16', start_time: '16:15', timezone: 'America/New_York', member_ids: [], revision: 2, ...o,
});

describe('the existing Family Meeting stays as it is', () => {
  it('four parts, ten minutes, in order', () => {
    expect(MEETING_GUIDE.parts.map((p) => [p.title, p.minutes])).toEqual([
      ['Our Focus', 2], ['Let’s Talk', 3], ['Everyone’s Part', 3], ['Let’s Practice', 2],
    ]);
  });
  it('no Sunday Setup or second weekly ritual anywhere in the app', () => {
    const features = readFileSync('src/data/app/features.ts', 'utf8');
    expect(features).not.toMatch(/sunday/i);
    expect(readFileSync('src/data/app/shell-routes.json', 'utf8')).not.toMatch(/sunday/i);
    expect(readFileSync('src/routes.ts', 'utf8')).not.toMatch(/sunday-setup|sundaySetup|SUNDAY_SETUP/);
  });
  it('the week reference is screen-only on the meeting page: the printed guide is unchanged', () => {
    const astro = readFileSync('src/components/club/plan/ClubFamilyMeeting.astro', 'utf8');
    expect(astro).toMatch(/data-fm-week hidden/);
    expect(astro).toMatch(/print:hidden" data-fm-week/);
    expect(astro).toMatch(/@media print\{\[data-fm-week\]\{display:none!important\}\}/);
  });
});

describe('before and during: the next seven days', () => {
  it('lists the week by day, from today, with a repeat on each of its days', () => {
    const w = weekAhead([ev('Swim', { recurrence: { freq: 'weekly', by_day: [1, 3] } })], '2026-11-15', NOW);
    expect(w.from).toBe('2026-11-15');
    expect(w.to).toBe('2026-11-21');
    expect(w.days.map((d) => d.label)).toEqual(['Today', 'Tomorrow', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
    expect(w.days[1].items.map((i) => i.title)).toEqual(['Swim']);
    expect(w.days[3].items.map((i) => i.title)).toEqual(['Swim']);
    expect(w.count).toBe(2);
  });
  it('new or changed in the past week, each event once; older edits are not news', () => {
    const w = weekAhead([
      ev('Dentist', { revision: 1, updated_at: '2026-11-14T10:00:00Z' }),
      ev('Swim', { revision: 4, updated_at: '2026-11-13T10:00:00Z', recurrence: { freq: 'daily' } }),
      ev('Piano', { revision: 6, updated_at: '2026-10-01T10:00:00Z' }),
      ev('Party', { revision: 0, updated_at: '2026-11-15T17:00:00Z' }),
    ], '2026-11-15', NOW);
    expect(new Set(w.changes.map((c) => `${c.id}:${c.change}`))).toEqual(new Set(['Dentist:new', 'Swim:changed', 'Party:new']));
    expect(w.changes).toHaveLength(3);
  });
  it('no timestamp, nothing claimed', () => {
    expect(changeOf(ev('x', { revision: 0 }), NOW)).toBeUndefined();
  });
  it('counts plans nobody has said they will handle, once per event', () => {
    const w = weekAhead([ev('A', { recurrence: { freq: 'daily' } }), ev('B', { owner_member_id: 'm1' })], '2026-11-15', NOW);
    expect(w.unhandled).toBe(1);
  });
  it('deleted events are gone', () => {
    expect(weekAhead([ev('A', { deleted: true })], '2026-11-15', NOW).count).toBe(0);
  });
});

describe('after: only what the family agreed', () => {
  const agreement = (over: Partial<Responsibility> = {}): Responsibility => ({
    id: 'g1', status: 'confirmed', category: 'belongings', ownerIds: ['sample-rivera-sofia'], helperIds: [], scope: 'individual',
    agreement: { text: 'Pack my soccer bag before bed.', when: 'Monday evening', month: '2026-11', source: 'month:nov-x' }, ...over,
  });
  it('what was already done and every suggestion stay out: no agreements, nobody listed', () => {
    const m = monthAgreements(H, P, '2026-11')!;
    expect(m.people).toEqual([]);
    expect(buildFamilyMeeting({ household: H, profile: P, month: '2026-11' }).parts.people.some((p) => p.suggested.length)).toBe(true);
  });
  it('an agreement from this month’s meeting shows with its own words, for its person', () => {
    const profile = { ...P, responsibilities: [...P.responsibilities, agreement()] };
    const m = monthAgreements(H, profile, '2026-11')!;
    expect(m.people).toEqual([{ memberId: 'sample-rivera-sofia', name: 'Sofia', parts: [expect.objectContaining({ id: 'g1', text: 'Pack my soccer bag before bed.', when: 'Monday evening' })] }]);
  });
  it('the meeting shows it as agreed and suggests nothing new on top', () => {
    const profile = { ...P, responsibilities: [...P.responsibilities, agreement()] };
    const sofia = buildFamilyMeeting({ household: H, profile, month: '2026-11' }).parts.people.find((p) => p.firstName === 'Sofia')!;
    expect(sofia.confirmed.map((c) => [c.description, c.agreedFrom])).toEqual([['Pack my soccer bag before bed.', 'month:nov-x']]);
    expect(sofia.suggested).toEqual([]);
  });
  it('agreeing to the month resource’s own job replaces that suggestion', () => {
    const resource = [{ memberId: 'sample-rivera-mateo', description: 'Feed the dog after breakfast', id: 'r7' }];
    const before = buildFamilyMeeting({ household: H, profile: P, month: '2026-11', resource }).parts.people.find((p) => p.firstName === 'Mateo')!;
    expect(before.suggested.map((x) => suggestionKey(x))).toEqual(['resource:r7']);
    const profile = { ...P, responsibilities: [...P.responsibilities, agreement({ id: 'g2', category: 'other', ownerIds: ['sample-rivera-mateo'], agreement: { text: 'Feed the dog after breakfast', month: '2026-11', source: 'resource:r7' } })] };
    const after = buildFamilyMeeting({ household: H, profile, month: '2026-11', resource }).parts.people.find((p) => p.firstName === 'Mateo')!;
    expect(after.suggested).toEqual([]);
    expect(after.confirmed.map((c) => c.description)).toEqual(['Feed the dog after breakfast']);
  });
  it('an agreement from another month in another area doesn’t show this month', () => {
    const profile = { ...P, responsibilities: [...P.responsibilities, agreement({ category: 'pet-care', agreement: { text: 'Walk the dog', month: '2027-04' } })] };
    expect(monthAgreements(H, profile, '2027-01')!.people).toEqual([]);
  });
  it('cleaning: only cleaning and laundry agreements, never what the family already does or wants', () => {
    const profile: FamilyProfile = { ...P, responsibilities: [
      ...P.responsibilities,
      { id: 'x1', status: 'existing', category: 'cleaning', ownerIds: ['sample-rivera-mateo'], helperIds: [], scope: 'individual' },
      agreement({ id: 'g3', category: 'laundry', ownerIds: ['sample-rivera-sofia', 'sample-rivera-mateo'], agreement: { text: 'Fold towels together' } }),
    ] };
    const people = cleaningAgreements(H, profile);
    expect(people.map((p) => [p.name, p.parts.map((x) => x.text)])).toEqual([['Sofia', ['Fold towels together']], ['Mateo', ['Fold towels together']]]);
  });
  it('archived people drop out; nothing without a household', () => {
    const h = { ...H, members: H.members.map((m) => (m.id === 'sample-rivera-sofia' ? { ...m, archived: true } : m)) };
    expect(agreementsByPerson(h, { ...P, responsibilities: [agreement()] })).toEqual([]);
    expect(monthAgreements(null, P, '2026-11')).toBeNull();
  });
});

describe('the meeting’s week: rolling now, a chosen meeting day later', () => {
  it('no meeting day: today and the next six days', () => {
    expect(meetingWindow('2026-11-18')).toEqual({ from: '2026-11-18', to: '2026-11-24' });
  });
  it('meeting on Sundays: from the next Sunday, or today when it is Sunday', () => {
    expect(meetingWindow('2026-11-18', 0)).toEqual({ from: '2026-11-22', to: '2026-11-28' });
    expect(meetingWindow('2026-11-15', 0)).toEqual({ from: '2026-11-15', to: '2026-11-21' });
  });
  it('an invalid meeting day falls back to rolling', () => {
    expect(meetingWindow('2026-11-18', 9)).toEqual({ from: '2026-11-18', to: '2026-11-24' });
  });
  it('weekAhead follows the window and still labels today and tomorrow', () => {
    const w = weekAhead([ev('Swim', { starts_on: '2026-11-22' })], '2026-11-21', NOW, 0);
    expect(w.from).toBe('2026-11-22');
    expect(w.days[0].label).toBe('Tomorrow');
    expect(w.days[0].items.map((i) => i.title)).toEqual(['Swim']);
  });
});

describe('the sample family’s agreements (same rules as the database)', () => {
  it('agree, no duplicate on a second tap, edit and reassign, remove; the profile’s own rows untouched', async () => {
    const store = sampleStore('rivera')!;
    const before = (await store.profile())!.responsibilities.filter((r) => r.status !== 'confirmed');
    const input = { category: 'belongings' as const, text: 'Pack my bag', month: '2026-11', source: 'month:x', ownerIds: ['sample-rivera-sofia'] };
    await store.saveAgreement(input);
    const p = await store.saveAgreement(input);
    const mine = p.responsibilities.filter((r) => r.status === 'confirmed');
    expect(mine).toHaveLength(1);
    const edited = await store.saveAgreement({ ...input, id: mine[0].id, text: 'Pack my bag by 8', ownerIds: ['sample-rivera-mateo'] });
    const e = edited.responsibilities.find((r) => r.id === mine[0].id)!;
    expect([e.agreement?.text, e.ownerIds, e.agreement?.source]).toEqual(['Pack my bag by 8', ['sample-rivera-mateo'], 'month:x']);
    await expect(store.saveAgreement({ ...input, ownerIds: ['someone-else'] })).rejects.toThrow('invalid');
    const removed = await store.removeAgreement(mine[0].id!);
    expect(removed.responsibilities.filter((r) => r.status === 'confirmed')).toEqual([]);
    expect(removed.responsibilities).toEqual(before);
    await expect(store.removeAgreement(before[0].id!)).rejects.toThrow('not_found');
  });
});
