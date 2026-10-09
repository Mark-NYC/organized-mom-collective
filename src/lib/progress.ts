/**
 * Encouragement and the week view. Pure functions, so the wording rules are tested:
 * count what she did, never what's left; missed days are just empty, never mentioned.
 */
import { dateForWeekday, dateKey } from './dates';
import { weeklySchedule } from '../data/cleaning';
import { keys, readList, wasActive } from './storage';

/** Shown when the day's routine is complete. One per day, so it doesn't change on refresh. */
export const COMPLETE_LINES = [
  'A little lighter today.',
  'You made room for what matters.',
  'Look what you got done.',
  'That’s enough for today.',
  'Small steps. A calmer home.',
] as const;

export function completeLine(d: Date): string {
  const dayNumber = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
  return COMPLETE_LINES[dayNumber % COMPLETE_LINES.length];
}

export interface DayProgress {
  done: number;
  total: number;
  dailyDone: number;
  dailyTotal: number;
  /** Days this week with any checkmark, including today. */
  daysThisWeek: number;
  /** Looking at another day picked from the Week page, not today. */
  viewing: boolean;
  date: Date;
}

/** The one line under today's zone. */
export function progressLine(p: DayProgress): string {
  if (p.viewing) return p.done === p.total ? 'All done for this day.' : p.done === 0 ? '' : `${p.done} done`;
  if (p.total > 0 && p.done === p.total) return completeLine(p.date);
  // Daily Reset just finished and the zone isn't started yet; after that, the running count.
  if (p.dailyDone === p.dailyTotal && p.done === p.dailyTotal && p.total > p.dailyTotal)
    return 'Daily Reset done. A little lighter already.';
  if (p.done === 0) {
    const n = p.daysThisWeek;
    return n > 0 ? `You’ve shown up ${n} ${n === 1 ? 'day' : 'days'} this week.` : 'One small task is a great start.';
  }
  if (p.done === 1) return 'One done. It counts.';
  return `${p.done} done today`;
}

export type WeekDayState = 'done' | 'today' | 'past' | 'future';

export interface WeekDay {
  date: Date;
  name: string;
  state: WeekDayState;
}

/** Monday–Sunday of the week containing `today`, each marked by whether she did anything. */
export function weekActivity(today: Date): WeekDay[] {
  const todayKey = dateKey(today);
  return [1, 2, 3, 4, 5, 6, 0].map((dow) => {
    const date = dateForWeekday(today, dow);
    const key = dateKey(date);
    const state: WeekDayState = key > todayKey ? 'future' : wasActive(key) ? 'done' : key === todayKey ? 'today' : 'past';
    return { date, name: date.toLocaleDateString('en-US', { weekday: 'long' }), state };
  });
}

/** One row of the Week page: a day of the current Mon–Sun week and how far she got. */
export interface WeekPlanDay {
  /** Date#getDay index (1 = Monday … 0 = Sunday). */
  dow: number;
  key: string;
  when: 'past' | 'today' | 'future';
  /** Mon–Thu zone tasks checked / in the zone. 0 / 0 on Fri–Sun (optional, not counted). */
  zoneDone: number;
  zoneTotal: number;
  /** Anything checked off that day, under that day's own lists (same signal as the week dots on Today). */
  active: boolean;
}

export function weekPlan(today: Date): WeekPlanDay[] {
  const todayKey = dateKey(today);
  return [1, 2, 3, 4, 5, 6, 0].map((dow) => {
    const key = dateKey(dateForWeekday(today, dow));
    const focus = weeklySchedule.find((w) => w.day === dow);
    const checked = new Set(focus ? readList(keys.focus(key)) : []);
    return {
      dow,
      key,
      when: key === todayKey ? 'today' : key < todayKey ? 'past' : 'future',
      zoneDone: focus ? focus.tasks.filter((t) => checked.has(t.id)).length : 0,
      zoneTotal: focus?.tasks.length ?? 0,
      active: key <= todayKey && wasActive(key),
    };
  });
}

export interface WeekRowStatus {
  kind: 'done' | 'count' | 'active';
  text: string;
  /** Spoken after the day and zone, e.g. "3 of 6 tasks done". */
  label: string;
}

/**
 * What a Week row shows instead of its time stamp, or null to keep the time.
 * "Done" only ever means that day's Mon–Thu zone is finished. Any other work that day
 * (the Daily Reset, catching up, a monthly project task) shows as "Active": she did
 * something that day, without claiming the zone was done.
 */
export function weekRowStatus(d: WeekPlanDay): WeekRowStatus | null {
  if (d.zoneTotal > 0 && d.zoneDone === d.zoneTotal) return { kind: 'done', text: 'Done', label: 'zone done' };
  if (d.zoneDone > 0) return { kind: 'count', text: `${d.zoneDone}/${d.zoneTotal}`, label: `${d.zoneDone} of ${d.zoneTotal} zone tasks done` };
  return d.active ? { kind: 'active', text: 'Active', label: 'active this day' } : null;
}

/** The one line above the week. Counts what she did, never what's left. */
export function weekSummary(days: WeekPlanDay[]): string {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const zones = days.filter((d) => d.zoneTotal > 0 && d.zoneDone === d.zoneTotal).length;
  const shown = days.filter((d) => d.active).length;
  if (shown === 0 && zones === 0) return 'A fresh week. Today’s zone is a good place to start.';
  const showedUp = shown > 0 ? `You’ve shown up ${plural(shown, 'day')} this week.` : '';
  return zones > 0 ? `${plural(zones, 'zone')} finished. ${showedUp}`.trim() : showedUp;
}
