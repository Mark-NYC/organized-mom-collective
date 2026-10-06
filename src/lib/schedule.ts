import { monthlyDeepClean, weekend, weeklySchedule } from '../data/cleaning';
import type { MonthlyFocus, WeekdayFocus, WeekendDay } from '../data/cleaning';
import { isWeekend } from './dates';

export type TodayPlan =
  | { kind: 'weekday'; focus: WeekdayFocus }
  | { kind: 'weekend'; day: WeekendDay; month: MonthlyFocus };

export function monthFocusFor(d: Date): MonthlyFocus {
  return monthlyDeepClean.find((m) => m.month === d.getMonth()) ?? monthlyDeepClean[0];
}

function weekendPlan(d: Date): TodayPlan {
  const day = weekend.days.find((w) => w.day === d.getDay()) ?? weekend.days[0];
  return { kind: 'weekend', day, month: monthFocusFor(d) };
}

export function planFor(d: Date): TodayPlan {
  if (isWeekend(d)) return weekendPlan(d);
  const focus = weeklySchedule.find((w) => w.day === d.getDay());
  // Data covers Mon–Thu, so this only falls back if the data file is edited oddly.
  return focus ? { kind: 'weekday', focus } : weekendPlan(d);
}
