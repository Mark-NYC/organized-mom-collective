import { beforeEach, describe, expect, it } from 'vitest';
import { weeklySchedule } from '../src/data/cleaning';
import { weekPlan, weekRowStatus, weekSummary } from '../src/lib/progress';
import { keys, markActive, writeList } from '../src/lib/storage';

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
    expect(weekRowStatus(today)).toBeNull(); // zone not started: keep the time stamp
  });

  it('shows a weekend day only as "checked things off"', () => {
    const sat = new Date(2026, 9, 10);
    markActive('2026-10-09');
    const fri = weekPlan(sat)[4];
    expect(weekRowStatus(fri)).toMatchObject({ kind: 'checked' });
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
