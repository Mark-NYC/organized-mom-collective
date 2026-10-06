import { monthlyDeepClean, weeklySchedule } from '../data/cleaning';
import type { MonthlyFocus, WeekdayFocus } from '../data/cleaning';
import { isWeekend } from './dates';

export type TodayPlan =
  | { kind: 'weekday'; focus: WeekdayFocus }
  | { kind: 'weekend'; month: MonthlyFocus };

export function monthFocusFor(d: Date): MonthlyFocus {
  return monthlyDeepClean.find((m) => m.month === d.getMonth()) ?? monthlyDeepClean[0];
}

export function planFor(d: Date): TodayPlan {
  if (isWeekend(d)) return { kind: 'weekend', month: monthFocusFor(d) };
  const focus = weeklySchedule.find((w) => w.day === d.getDay());
  // Data covers Mon–Thu, so this only falls back if the data file is edited oddly.
  if (!focus) return { kind: 'weekend', month: monthFocusFor(d) };
  return { kind: 'weekday', focus };
}
