import { describe, expect, it } from 'vitest';
import { cleaningZone, emptyPlan, planningWeek, unhandled, weekSummary } from '../src/lib/sunday-setup/summary';
import type { CalendarEvent } from '../src/lib/calendar/recurrence';
import type { FamilyMember } from '../src/lib/club/profile';

const people: FamilyMember[] = [
  { id: 'ana', firstName: 'Ana', kind: 'adult', role: 'parent' },
  { id: 'luis', firstName: 'Luis', kind: 'adult', role: 'partner' },
  { id: 'sofia', firstName: 'Sofia', kind: 'child', role: 'child', birthYear: 2016 },
];
const ev = (p: Partial<CalendarEvent>): CalendarEvent => ({ id: p.id ?? 'e', title: 'x', starts_on: '2026-11-16', timezone: 'America/New_York', member_ids: [], revision: 1, ...p });
const WEEK = '2026-11-15'; // a Sunday

describe('Sunday Setup', () => {
  it('plans the week that holds tomorrow', () => {
    expect(planningWeek('2026-11-15')).toBe('2026-11-15'); // Sunday: this week
    expect(planningWeek('2026-11-14')).toBe('2026-11-15'); // Saturday: next week
    expect(planningWeek('2026-11-18')).toBe('2026-11-15'); // midweek: the rest of this week
    expect(planningWeek('2026-11-15', 1)).toBe('2026-11-16'); // Monday-start family
  });

  it('uses the cleaning companion\'s own zone names, like the printed calendar rows', () => {
    expect(cleaningZone('2026-11-16')).toBe('Living Room'); // Monday
    expect(cleaningZone('2026-11-20')).toBe('Deep Cleaning'); // Friday
  });

  it('builds one block per day from the calendar, dinners and cleaning, with whose pen', () => {
    const events = [
      ev({ id: 'swim', title: 'Swim', start_time: '16:15', recurrence: { freq: 'weekly', by_day: [1, 3] }, member_ids: ['sofia'], owner_member_id: 'luis' }),
      ev({ id: 'dentist', title: 'Dentist', starts_on: '2026-11-17', start_time: '15:30', member_ids: ['sofia'] }),
    ];
    const plan = { ...emptyPlan(WEEK), dinners: { '2026-11-16': { meal: 'Tacos', cook: 'luis' } }, chores: { '2026-11-16': 'sofia' } };
    const days = weekSummary(WEEK, events, plan, people);
    expect(days).toHaveLength(7);
    const mon = days[1];
    expect(mon.label).toBe('Monday 11/16');
    expect(mon.lines.map((l) => l.text)).toEqual(['4:15 PM Swim (Sofia) · Luis handles it', 'Dinner: Tacos · Luis cooks', 'Living Room · Sofia']);
    expect(mon.lines.map((l) => l.memberId)).toEqual(['sofia', 'luis', 'sofia']);
    expect(days[2].lines[0]).toMatchObject({ text: '3:30 PM Dentist (Sofia)', needsOwner: true });
    expect(days[3].lines[0].text).toContain('Swim'); // Wednesday repeat
  });

  it('asks about each event nobody is handling, once per event', () => {
    const events = [
      ev({ id: 'piano', title: 'Piano', recurrence: { freq: 'weekly', by_day: [2, 4] } }),
      ev({ id: 'swim', title: 'Swim', owner_member_id: 'luis' }),
    ];
    expect(unhandled(WEEK, events).map((u) => [u.event.title, u.date])).toEqual([['Piano', '2026-11-17']]);
  });
});
