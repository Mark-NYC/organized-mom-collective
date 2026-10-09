import { beforeEach, describe, expect, it } from 'vitest';
import { weeklySchedule } from '../src/data/cleaning';
import { weekPlan, weekRowStatus, weekSummary } from '../src/lib/progress';
import { monthKey } from '../src/lib/dates';
import { creditMonthly, keys, readList, resetDay, uncreditMonthly, wasActive, writeList } from '../src/lib/storage';

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

// 2026-10-05 is a Monday; "today" is Wednesday 2026-10-07.
const wed = new Date(2026, 9, 7);
const ids = (dow: number) => weeklySchedule.find((w) => w.day === dow)!.tasks.map((t) => t.id);

describe('week page', () => {
  it('lists Monday to Sunday of the current week with today marked', () => {
    const days = weekPlan(wed);
    expect(days.map((d) => d.key)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
    expect(days.map((d) => d.when)).toEqual(['past', 'past', 'today', 'future', 'future', 'future', 'future']);
    expect(days.slice(0, 4).every((d) => d.zoneTotal > 0)).toBe(true);
    expect(days.slice(4).every((d) => d.zoneTotal === 0)).toBe(true);
  });

  it('reads the same saved checkmarks Today writes', () => {
    writeList(keys.focus('2026-10-05'), ids(1)); // Monday zone finished
    writeList(keys.focus('2026-10-06'), ids(2).slice(0, 2)); // Tuesday: two tasks
    writeList(keys.daily('2026-10-07'), ['beds']); // Wednesday: Daily Reset only
    const [mon, tue, today] = weekPlan(wed);
    expect(weekRowStatus(mon)).toMatchObject({ kind: 'done', text: 'Done' });
    expect(weekRowStatus(tue)).toMatchObject({ kind: 'count', text: `2/${ids(2).length}` });
    expect(today.active).toBe(true);
    expect(weekRowStatus(today)).toMatchObject({ kind: 'active' }); // active, but the zone isn't claimed
  });

  it('a weekend day with any work shows "Active", never a finished zone', () => {
    const sat = new Date(2026, 9, 10);
    writeList(keys.daily('2026-10-09'), ['beds']); // Friday: Daily Reset only
    const fri = weekPlan(sat)[4];
    expect(weekRowStatus(fri)).toMatchObject({ kind: 'active', text: 'Active' });
    expect(weekRowStatus(weekPlan(sat)[6])).toBeNull(); // Sunday, still ahead
  });

  it('summary counts what she did, never what is left', () => {
    expect(weekSummary(weekPlan(wed))).toBe('A fresh week. Today’s zone is a good place to start.');
    writeList(keys.daily('2026-10-06'), ['beds']);
    expect(weekSummary(weekPlan(wed))).toBe('You’ve shown up 1 day this week.');
    writeList(keys.focus('2026-10-05'), ids(1));
    expect(weekSummary(weekPlan(wed))).toBe('1 zone finished. You’ve shown up 2 days this week.');
  });
});

// Fri 2026-10-09, Sat 10, Sun 11.
const FRI = '2026-10-09';
const SAT = '2026-10-10';
const SUN = '2026-10-11';
const sun = new Date(2026, 9, 11, 20);
const row = (days: ReturnType<typeof weekPlan>, key: string) => days.find((d) => d.key === key)!;

describe('weekend activity belongs to its own day', () => {
  it('a Friday project task lights Friday only, and stays checked all month', () => {
    writeList(keys.monthly('2026-10'), ['oct-shoes']);
    creditMonthly(FRI, '2026-10', 'oct-shoes');
    const days = weekPlan(sun);
    expect([FRI, SAT, SUN].map((k) => row(days, k).active)).toEqual([true, false, false]);
    expect(weekRowStatus(row(days, FRI))).toMatchObject({ kind: 'active' });
    // Same shared list on Friday, Saturday and Sunday.
    expect(keys.monthly(monthKey(new Date(2026, 9, 9)))).toBe(keys.monthly(monthKey(new Date(2026, 9, 11))));
    expect(readList(keys.monthly('2026-10'))).toEqual(['oct-shoes']);
  });

  it('a Friday Daily Reset is Friday activity, not finished Deep Cleaning', () => {
    writeList(keys.daily(FRI), ['beds']);
    const fri = row(weekPlan(sun), FRI);
    expect(fri.zoneTotal).toBe(0);
    expect(weekRowStatus(fri)?.kind).toBe('active');
    expect(weekRowStatus(fri)?.text).not.toMatch(/done/i);
  });

  it('"Catch up instead" counts on the day it was checked only', () => {
    writeList(keys.weekend(SAT), ['catch-up']);
    expect([wasActive(FRI), wasActive(SAT), wasActive(SUN)]).toEqual([false, true, false]);
  });

  it('checking then undoing leaves the day as it was', () => {
    writeList(keys.daily(SAT), ['beds']);
    writeList(keys.daily(SAT), []);
    expect(wasActive(SAT)).toBe(false);
    creditMonthly(SAT, '2026-10', 'oct-shoes');
    expect(wasActive(SAT)).toBe(true);
    uncreditMonthly('2026-10', 'oct-shoes');
    expect(wasActive(SAT)).toBe(false);
    expect(window.localStorage.getItem(keys.active(SAT))).toBeNull();
  });

  it('undo takes the credit back from the day it was given, even after the day or month changed', () => {
    // Ticked October's project on Sun Nov 1 (viewing Fri Oct 30), unticked later.
    creditMonthly('2026-11-01', '2026-10', 'oct-shoes');
    creditMonthly('2026-11-01', '2026-11', 'nov-x');
    uncreditMonthly('2026-10', 'oct-shoes');
    expect(readList(keys.active('2026-11-01'))).toEqual(['monthly:2026-11:nov-x']);
  });

  it('checking a past day from Week leaves today untouched', () => {
    // Viewing Tuesday on Friday: the zone saves under Tuesday's date.
    writeList(keys.focus('2026-10-06'), [ids(2)[0]]);
    const days = weekPlan(new Date(2026, 9, 9));
    expect(row(days, '2026-10-06').zoneDone).toBe(1);
    expect(row(days, FRI).active).toBe(false);
  });

  it('existing saved progress still counts', () => {
    window.localStorage.setItem(keys.active(SAT), '1'); // legacy flag from before this change
    window.localStorage.setItem(keys.weekend(FRI), JSON.stringify(['catch-up'])); // old Friday-keyed weekend
    expect(wasActive(SAT)).toBe(true);
    creditMonthly(SAT, '2026-10', 'oct-shoes');
    uncreditMonthly('2026-10', 'oct-shoes');
    expect(wasActive(SAT)).toBe(true); // the legacy flag is kept
    expect(wasActive(FRI)).toBe(true); // old weekend entry shows on Friday…
    expect(wasActive(SUN)).toBe(false); // …and no longer on Sunday
  });

  it('reset today clears that day only and keeps the monthly project', () => {
    writeList(keys.monthly('2026-10'), ['oct-shoes']);
    creditMonthly(SAT, '2026-10', 'oct-shoes');
    writeList(keys.weekend(SAT), ['catch-up']);
    writeList(keys.weekend(SUN), ['catch-up']);
    resetDay(SAT);
    expect(wasActive(SAT)).toBe(false);
    expect(wasActive(SUN)).toBe(true);
    expect(readList(keys.monthly('2026-10'))).toEqual(['oct-shoes']);
  });

  it('a new week, month and year start neutral', () => {
    creditMonthly('2027-12-31', '2027-12', 'dec-x'); // Fri
    writeList(keys.daily('2028-01-02'), ['beds']); // Sun
    const sunday = weekPlan(new Date(2028, 0, 2, 23, 59));
    expect(sunday.filter((d) => d.active).map((d) => d.key)).toEqual(['2027-12-31', '2028-01-02']);
    expect(weekPlan(new Date(2028, 0, 3, 0, 1)).some((d) => d.active)).toBe(false);
  });
});
