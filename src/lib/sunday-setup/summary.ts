/**
 * Sunday Setup's "copy to the wall calendar" summary (docs/ios/SUNDAY_SETUP.md). Pure, tested
 * (tests/sunday-setup.test.ts).
 *
 * Everything comes from where it already lives, so nothing is typed twice: the family calendar's occurrences, this
 * week's plan (dinners, cleaning helpers), the cleaning companion's zones for each day (src/data/cleaning.ts via
 * planFor, the same names as the printed calendar's rows), and the family profile's people and colors.
 * The result reads like the 11×17 wall calendar: one block per day, short lines she can copy in with each person's pen.
 */
import { addDays, occurrences, timeLabel, weekday, type CalendarEvent } from '../calendar/recurrence';
import { planFor } from '../schedule';
import type { FamilyMember } from '../club/profile';

export interface WeekPlan {
  week_start: string;
  dinners: Record<string, { meal?: string; cook?: string }>;
  chores: Record<string, string>;
  notes?: string | null;
  completed?: boolean;
  revision: number;
}

export const emptyPlan = (week: string): WeekPlan => ({ week_start: week, dinners: {}, chores: {}, notes: null, completed: false, revision: 0 });

export interface SummaryLine {
  kind: 'event' | 'dinner' | 'cleaning';
  text: string;
  /** Whose pen: the person it's for (events), the cook (dinner), the helper (cleaning). */
  memberId?: string | null;
  /** Events nobody is handling yet. */
  needsOwner?: boolean;
}
export interface SummaryDay { date: string; label: string; lines: SummaryLine[] }

/** The day's cleaning zone, as the printed calendar names it. */
export function cleaningZone(date: string): string {
  const plan = planFor(new Date(`${date}T12:00:00`));
  return plan.kind === 'weekday' ? plan.focus.zone : plan.day.zone;
}

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function weekSummary(week: string, events: CalendarEvent[], plan: WeekPlan, members: FamilyMember[]): SummaryDay[] {
  const name = (id?: string | null) => (id ? members.find((m) => m.id === id)?.firstName : undefined);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const occ = occurrences(events, days[0], days[6]);
  return days.map((date) => {
    const lines: SummaryLine[] = [];
    for (const o of occ.filter((x) => x.date === date)) {
      const e = o.event;
      const who = e.member_ids.map(name).filter(Boolean).join(' & ');
      const handler = name(e.owner_member_id);
      const time = o.continued ? 'continues' : e.start_time ? timeLabel(e) : '';
      lines.push({
        kind: 'event',
        text: [time, e.title, who && `(${who})`, handler && `· ${handler} handles it`].filter(Boolean).join(' '),
        memberId: e.member_ids[0] ?? e.owner_member_id ?? null,
        needsOwner: !e.owner_member_id && !o.continued,
      });
    }
    const dinner = plan.dinners[date];
    if (dinner?.meal) lines.push({ kind: 'dinner', text: `Dinner: ${dinner.meal}${name(dinner.cook) ? ` · ${name(dinner.cook)} cooks` : ''}`, memberId: dinner.cook ?? null });
    const helper = name(plan.chores[date]);
    lines.push({ kind: 'cleaning', text: `${cleaningZone(date)}${helper ? ` · ${helper}` : ''}`, memberId: plan.chores[date] ?? null });
    return { date, label: `${DAY[weekday(date)]} ${+date.slice(5, 7)}/${+date.slice(8, 10)}`, lines };
  });
}

/** Events this week that nobody is handling yet (the review's first question). */
export function unhandled(week: string, events: CalendarEvent[]): { event: CalendarEvent; date: string }[] {
  const seen = new Set<string>();
  return occurrences(events, week, addDays(week, 6))
    .filter((o) => !o.event.owner_member_id && !o.continued)
    .filter((o) => (seen.has(o.event.id) ? false : (seen.add(o.event.id), true)))
    .map((o) => ({ event: o.event, date: o.date }));
}

/** The week Sunday Setup plans: the one that holds tomorrow (on Sunday, the week starting today). */
export function planningWeek(today: string, startsOn: 0 | 1 = 0): string {
  const tomorrow = addDays(today, 1);
  return addDays(tomorrow, -((weekday(tomorrow) - startsOn + 7) % 7));
}
