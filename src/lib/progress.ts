/**
 * Encouragement and the week view. Pure functions, so the wording rules are tested:
 * count what she did, never what's left; missed days are just empty, never mentioned.
 */
import { dateForWeekday, dateKey } from './dates';
import { wasActive } from './storage';

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
  /** Looking at another day from the Tidy week, not today. */
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
