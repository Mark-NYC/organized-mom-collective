import { addDays, weekday, weekStart } from '../calendar/recurrence';
import { keys, readList, writeList } from '../storage';
import type { V16State } from '../v16/model';

export type Rhythm = V16State['cleaning'];
export type Settings = Record<string, string>;

export function decodeRhythm(settings: Settings, checks: Rhythm['checks']): Rhythm {
  const moved: Rhythm['moved'] = {};
  for (const [key, target] of Object.entries(settings)) {
    const match = /^move:(\d{4}-\d{2}-\d{2}):([1-4])$/.exec(key);
    if (match && /^[0-6]$/.test(target)) (moved[match[1]] ??= {})[Number(match[2])] = Number(target);
  }
  return { mode: settings.mode === 'one-day' || settings.mode === 'off' ? settings.mode : 'printed',
    mainDay: /^[0-6]$/.test(settings.mainDay) ? Number(settings.mainDay) : 6,
    dailyReset: settings.dailyReset !== 'false', moved, checks };
}

/** Zone checkmarks keep the printed zone's original date, even when moved to another day. */
export function cleaningChecks(monday: string): Rhythm['checks'] {
  const checks: Rhythm['checks'] = {};
  const months = new Set<string>();
  for (let i = 0; i < 14; i++) {
    const date = addDays(monday, i);
    months.add(date.slice(0, 7));
    for (const id of readList(keys.daily(date))) checks[`daily:${date}:${id}`] = true;
    for (const id of readList(keys.focus(date))) checks[`zone:${weekStart(date, 1)}:${weekday(date)}:${id}`] = true;
  }
  for (const month of months) for (const id of readList(keys.monthly(month))) checks[`monthly:${month}:${id}`] = true;
  return checks;
}

export function toggleCleaningCheck(key: string): boolean {
  const [kind, period, third, fourth] = key.split(':');
  const id = kind === 'zone' ? fourth : third;
  const list = kind === 'zone' ? keys.focus(addDays(period, Number(third) - 1))
    : kind === 'daily' ? keys.daily(period) : keys.monthly(period);
  const current = readList(list);
  return writeList(list, current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
}
export function rhythmChanges(current: Rhythm, patch: Partial<Rhythm>): Record<string, string | null> {
  const changes: Record<string, string | null> = {};
  for (const field of ['mode', 'mainDay', 'dailyReset'] as const) {
    if (patch[field] !== undefined && patch[field] !== current[field]) changes[field] = String(patch[field]);
  }
  if (patch.moved) for (const [week, days] of Object.entries(patch.moved)) {
    for (const day of [1, 2, 3, 4]) {
      if (days[day] !== current.moved[week]?.[day]) changes[`move:${week}:${day}`] = days[day] === undefined ? null : String(days[day]);
    }
  }
  return changes;
}
