import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { changeOf, cleaningParts, monthParts, weekAhead } from '../src/lib/family-meeting-support';
import { buildFamilyMeeting } from '../src/lib/club/family-meeting';
import { MEETING_GUIDE } from '../src/data/club/meeting-guide';
import { sampleById } from '../src/data/club/samples';
import type { CalendarEvent } from '../src/lib/calendar/recurrence';
import type { FamilyProfile } from '../src/lib/club/family-profile';

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

describe('after: everyone’s part, from the meeting engine', () => {
  it('is the month’s meeting without the suggestions: agreed and already doing, never suggested', () => {
    const parts = monthParts(H, P, '2026-11')!;
    const meeting = buildFamilyMeeting({ household: H, profile: P, month: '2026-11' });
    expect(parts.route).toBe(meeting.route);
    for (const p of meeting.parts.people) {
      const mine = parts.people.find((x) => x.memberId === p.memberId)!;
      expect(mine.parts.map((x) => x.text)).toEqual([...p.confirmed, ...p.existing].map((r) => r.description));
      for (const s of p.suggested) expect(mine.parts.map((x) => x.text)).not.toContain(s.description);
    }
  });
  it('agreed parts come first and say so', () => {
    const profile: FamilyProfile = { ...P, responsibilities: [...P.responsibilities, { id: 'c1', status: 'confirmed', category: 'transportation', ownerIds: ['sample-rivera-sofia'], helperIds: [], scope: 'individual' }] };
    const sofia = monthParts(H, profile, '2027-01')!.people.find((p) => p.name === 'Sofia')!;
    expect(sofia.parts[0].label).toBe('Agreed by our family');
  });
  it('nothing without a household', () => {
    expect(monthParts(null, P, '2026-11')).toBeNull();
  });
  it('cleaning: only cleaning and laundry the family already does or agreed, never what they only want', () => {
    const profile: FamilyProfile = { ...P, responsibilities: [
      ...P.responsibilities,
      { id: 'x1', status: 'existing', category: 'cleaning', ownerIds: ['sample-rivera-mateo'], helperIds: [], scope: 'individual' },
      { id: 'x2', status: 'desired', category: 'laundry', item: 'put-away-laundry', ownerIds: ['sample-rivera-sofia'], helperIds: [] },
    ] };
    const people = cleaningParts(H, profile);
    expect(people.map((p) => p.name)).toEqual(['Mateo']);
    expect(people[0].parts[0].text).toMatch(/^Takes care of /);
  });
});
