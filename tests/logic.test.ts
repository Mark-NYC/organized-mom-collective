import { beforeEach, describe, expect, it } from 'vitest';
import { dailyEssentials, monthlyDeepClean, weeklySchedule } from '../src/data/cleaning';
import { dateForWeekday, dateKey, isWeekend, monthKey, parseDayParam, weekendStart } from '../src/lib/dates';
import { planFor } from '../src/lib/schedule';
import { isOnboarded, keys, pruneOld, readList, resetAllProgress, resetDay, setOnboarded, writeList } from '../src/lib/storage';

// Minimal in-memory localStorage
class MemStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

beforeEach(() => {
  (globalThis as unknown as { window: { localStorage: MemStorage } }).window = { localStorage: new MemStorage() };
});

describe('schedule', () => {
  it('maps Mon–Thu to room focus and Fri–Sun to the monthly project', () => {
    // 2026-10-05 is a Monday
    expect(planFor(new Date(2026, 9, 5))).toMatchObject({ kind: 'weekday', focus: { zone: 'Living Room' } });
    expect(planFor(new Date(2026, 9, 6))).toMatchObject({ kind: 'weekday', focus: { zone: 'Bedrooms' } });
    expect(planFor(new Date(2026, 9, 7))).toMatchObject({ kind: 'weekday', focus: { zone: 'Entry/Bathroom' } });
    expect(planFor(new Date(2026, 9, 8))).toMatchObject({ kind: 'weekday', focus: { zone: 'Kitchen Reset' } });
    const weekendZones = { 9: 'Deep Cleaning', 10: 'Home Project', 11: 'Catch-Up / Reset' } as const;
    for (const [day, zone] of Object.entries(weekendZones)) {
      expect(planFor(new Date(2026, 9, Number(day)))).toMatchObject({
        kind: 'weekend',
        day: { zone },
        month: { title: 'Closet Cleanout' },
      });
    }
  });

  it('weekend days share the same Friday key', () => {
    const fri = dateKey(weekendStart(new Date(2026, 9, 9)));
    expect(dateKey(weekendStart(new Date(2026, 9, 10)))).toBe(fri);
    expect(dateKey(weekendStart(new Date(2026, 9, 11)))).toBe(fri);
    expect(fri).toBe('2026-10-09');
    expect(isWeekend(new Date(2026, 9, 8))).toBe(false);
  });

  it('formats local keys', () => {
    expect(dateKey(new Date(2026, 0, 3))).toBe('2026-01-03');
    expect(monthKey(new Date(2026, 11, 31))).toBe('2026-12');
  });
});

describe('selected weekday', () => {
  it('maps ?day= to that weekday in the current Monday–Sunday week', () => {
    const tue = new Date(2026, 9, 6);
    expect(dateKey(dateForWeekday(tue, 1))).toBe('2026-10-05'); // Monday, earlier
    expect(dateKey(dateForWeekday(tue, 4))).toBe('2026-10-08'); // Thursday, later
    expect(dateKey(dateForWeekday(tue, 0))).toBe('2026-10-11'); // Sunday ends the week
    const sun = new Date(2026, 9, 11);
    expect(dateKey(dateForWeekday(sun, 1))).toBe('2026-10-05');
    // across a month boundary
    expect(dateKey(dateForWeekday(new Date(2026, 9, 1), 1))).toBe('2026-09-28');
  });

  it('parses day params leniently and rejects junk', () => {
    expect(parseDayParam('Monday')).toBe(1);
    expect(parseDayParam('sunday')).toBe(0);
    expect(parseDayParam('funday')).toBeNull();
    expect(parseDayParam(null)).toBeNull();
  });
});

describe('data', () => {
  it('has 12 months, ids unique within each list', () => {
    expect(monthlyDeepClean.map((m) => m.month)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const lists = [dailyEssentials.tasks, ...weeklySchedule.map((w) => w.tasks), ...monthlyDeepClean.map((m) => m.tasks)];
    for (const list of lists) expect(new Set(list.map((t) => t.id)).size).toBe(list.length);
    for (const m of monthlyDeepClean) expect(m.tasks.length).toBeGreaterThanOrEqual(4);
  });
});

describe('storage', () => {
  it('daily state is per date, so a new day starts clean', () => {
    writeList(keys.daily('2026-10-06'), ['beds']);
    expect(readList(keys.daily('2026-10-06'))).toEqual(['beds']);
    expect(readList(keys.daily('2026-10-07'))).toEqual([]);
  });

  it('reset today keeps monthly progress and onboarding', () => {
    setOnboarded(true);
    writeList(keys.daily('2026-10-09'), ['beds']);
    writeList(keys.focus('2026-10-09'), ['x']);
    writeList(keys.weekend('2026-10-09'), ['catch-up']);
    writeList(keys.monthly('2026-10'), ['oct-shoes']);
    resetDay('2026-10-09', '2026-10-09');
    expect(readList(keys.daily('2026-10-09'))).toEqual([]);
    expect(readList(keys.weekend('2026-10-09'))).toEqual([]);
    expect(readList(keys.monthly('2026-10'))).toEqual(['oct-shoes']);
    expect(isOnboarded()).toBe(true);
  });

  it('reset all clears progress but not onboarding', () => {
    setOnboarded(true);
    writeList(keys.monthly('2026-10'), ['oct-shoes']);
    writeList(keys.daily('2026-10-06'), ['beds']);
    resetAllProgress();
    expect(readList(keys.monthly('2026-10'))).toEqual([]);
    expect(readList(keys.daily('2026-10-06'))).toEqual([]);
    expect(isOnboarded()).toBe(true);
  });

  it('prunes old day entries only', () => {
    writeList(keys.daily('2026-01-01'), ['beds']);
    writeList(keys.daily('2026-10-01'), ['beds']);
    writeList(keys.monthly('2026-01'), ['jan-pantry']);
    pruneOld(new Date(2026, 9, 6));
    expect(readList(keys.daily('2026-01-01'))).toEqual([]);
    expect(readList(keys.daily('2026-10-01'))).toEqual(['beds']);
    expect(readList(keys.monthly('2026-01'))).toEqual(['jan-pantry']);
  });

  it('survives corrupt storage values', () => {
    window.localStorage.setItem(keys.daily('2026-10-06'), '{not json');
    expect(readList(keys.daily('2026-10-06'))).toEqual([]);
  });
});

describe('theme', () => {
  it('uses the canonical printed-calendar month colors', async () => {
    const { monthColors, monthColor } = await import('../src/theme');
    expect(monthColors.map((m) => m.hex)).toEqual([
      '#CDDDE1', '#E8D2D6', '#C7DED3', '#DDD8E8', '#D4DFC4', '#F1D8A8',
      '#ECCBC2', '#DCCFAE', '#CDD2BC', '#D8B79F', '#D5C5B8', '#BBCBC4',
    ]);
    expect(monthColor(9)).toBe('#D8B79F');
    expect(monthColors.map((m) => m.name)).toEqual(monthlyDeepClean.map((m) => m.name));
  });
});
