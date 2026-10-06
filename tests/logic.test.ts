import { beforeEach, describe, expect, it } from 'vitest';
import { dailyEssentials, monthlyDeepClean, weeklySchedule } from '../src/data/cleaning';
import { dateKey, isWeekend, monthKey, weekendStart } from '../src/lib/dates';
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
    expect(planFor(new Date(2026, 9, 5))).toMatchObject({ kind: 'weekday', focus: { title: 'Living Room Reset' } });
    expect(planFor(new Date(2026, 9, 6))).toMatchObject({ kind: 'weekday', focus: { title: 'Bedroom Reset' } });
    expect(planFor(new Date(2026, 9, 7))).toMatchObject({ kind: 'weekday', focus: { title: 'Entry + Bathrooms' } });
    expect(planFor(new Date(2026, 9, 8))).toMatchObject({ kind: 'weekday', focus: { title: 'Kitchen Blitz' } });
    for (const day of [9, 10, 11]) {
      expect(planFor(new Date(2026, 9, day))).toMatchObject({ kind: 'weekend', month: { title: 'Closet Cleanout' } });
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
