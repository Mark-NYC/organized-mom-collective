import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dailyEssentials, monthlyDeepClean, weeklySchedule } from '../src/data/cleaning';
import { dateForWeekday, dateKey, isWeekend, monthKey, parseDayParam, weekendStart } from '../src/lib/dates';
import { monthFocusFor, planFor } from '../src/lib/schedule';
import { KEEP_DAYS, isOnboarded, keys, pruneOld, readList, resetAllProgress, resetDay, setOnboarded, writeList } from '../src/lib/storage';

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

describe('2027 calendar', () => {
  // The printed calendar's zones, by Date#getDay (0 = Sunday).
  const PRINTED = ['Catch-Up / Reset', 'Living Room', 'Bedrooms', 'Entry/Bathroom', 'Kitchen Reset', 'Deep Cleaning', 'Home Project'];
  const zoneOf = (d: Date) => {
    const p = planFor(d);
    return p.kind === 'weekday' ? p.focus.zone : p.day.zone;
  };

  it('every day of 2027 gets the zone printed for its weekday', () => {
    for (let d = new Date(2027, 0, 1); d.getFullYear() === 2027; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      expect(zoneOf(d), dateKey(d)).toBe(PRINTED[d.getDay()]);
    }
  });

  it('Jan 1 2027 is a Friday: Deep Cleaning with the January project', () => {
    const jan1 = new Date(2027, 0, 1);
    expect(jan1.getDay()).toBe(5);
    expect(planFor(jan1)).toMatchObject({ kind: 'weekend', day: { zone: 'Deep Cleaning' }, month: { name: 'January' } });
  });

  it('each month shows its own monthly home project', () => {
    for (let m = 0; m < 12; m++) expect(monthFocusFor(new Date(2027, m, 15)).month).toBe(m);
    expect(monthFocusFor(new Date(2026, 11, 31)).name).toBe('December');
    expect(monthFocusFor(new Date(2027, 0, 1)).name).toBe('January');
  });

  it('weekends that span a month or year keep one catch-up key, monthly progress follows the month', () => {
    // Fri Dec 31 2027, Sat Jan 1 2028, Sun Jan 2 2028
    const fri = new Date(2027, 11, 31);
    expect(fri.getDay()).toBe(5);
    expect(dateKey(weekendStart(new Date(2028, 0, 2)))).toBe('2027-12-31');
    expect(monthKey(fri)).toBe('2027-12');
    expect(monthKey(new Date(2028, 0, 1))).toBe('2028-01');
    // Fri Apr 30, Sat May 1, Sun May 2 2027
    expect(dateKey(weekendStart(new Date(2027, 4, 2)))).toBe('2027-04-30');
    expect(planFor(new Date(2027, 4, 1))).toMatchObject({ month: { name: 'May' } });
  });

  it('day keys stay local across DST changes', () => {
    // US DST starts Mar 14 2027 and ends Nov 7 2027 (both Sundays)
    expect(dateKey(new Date(2027, 2, 14, 23, 30))).toBe('2027-03-14');
    expect(dateKey(new Date(2027, 10, 7, 0, 30))).toBe('2027-11-07');
    expect(zoneOf(new Date(2027, 2, 15))).toBe('Living Room');
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

  it('keeps about a year of day entries, and monthly entries always', () => {
    writeList(keys.daily('2025-10-01'), ['beds']); // > 1 year old
    writeList(keys.daily('2026-01-01'), ['beds']); // 9 months old
    writeList(keys.weekend('2025-10-03'), ['catch-up']);
    writeList(keys.focus('2025-10-07'), ['tue-bedding']); // exactly 364 days
    writeList(keys.monthly('2024-01'), ['jan-pantry']);
    pruneOld(new Date(2026, 9, 6));
    expect(readList(keys.daily('2025-10-01'))).toEqual([]);
    expect(readList(keys.weekend('2025-10-03'))).toEqual([]);
    expect(readList(keys.daily('2026-01-01'))).toEqual(['beds']);
    expect(readList(keys.focus('2025-10-07'))).toEqual(['tue-bedding']);
    expect(readList(keys.monthly('2024-01'))).toEqual(['jan-pantry']);
  });

  it('a full year of daily data fits easily', () => {
    let bytes = 0;
    for (let i = 0; i < KEEP_DAYS; i++) {
      const day = dateKey(new Date(2026, 0, 1 + i));
      for (const k of [keys.daily(day), keys.focus(day), keys.weekend(day)]) bytes += k.length + 120;
    }
    expect(bytes).toBeLessThan(200_000); // browsers allow ~5 MB
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

describe('routing', () => {
  it('splits ?source= from the app URL and keeps other params', async () => {
    const { takeSourceParam } = await import('../src/lib/entry');
    expect(takeSourceParam('/app?source=calendar')).toEqual({ source: 'calendar', cleaned: '/app' });
    expect(takeSourceParam('/app?source=calendar&day=monday')).toEqual({ source: 'calendar', cleaned: '/app?day=monday' });
    expect(takeSourceParam('/app?day=monday')).toEqual({ source: null, cleaned: '/app?day=monday' });
    expect(takeSourceParam('/app?source=<script>')).toEqual({ source: null, cleaned: '/app' });
  });

  it('keeps the QR entry point and app routes stable', async () => {
    const { routes, isAppPath } = await import('../src/routes');
    const { START_DESTINATION } = await import('../src/config');
    expect(routes.start).toBe('/start');
    expect(START_DESTINATION).toBe('/app?source=calendar');
    expect([routes.today, routes.tidy, routes.reorder, routes.settings]).toEqual(['/app', '/app/tidy', '/app/reorder', '/app/settings']);
    expect(routes.monthlyFocus).toBe('/app/tidy#monthly-focus');
    expect(routes.day(1)).toBe('/app?day=monday');
    expect(isAppPath('/app')).toBe(true);
    expect(isAppPath('/app/tidy')).toBe(true);
    expect(isAppPath('/apple')).toBe(false);
    expect(isAppPath('/')).toBe(false);
  });
});

describe('when the browser won\'t save', () => {
  class FullStorage extends MemStorage {
    setItem(): void {
      throw new DOMException('quota', 'QuotaExceededError');
    }
  }

  it('keeps checkmarks for this visit, reports not saving, and never throws', async () => {
    vi.resetModules();
    (globalThis as unknown as { window: { localStorage: MemStorage } }).window = { localStorage: new FullStorage() };
    const s = await import('../src/lib/storage');
    let notified = 0;
    s.onSavingChange(() => notified++);
    expect(s.isSaving()).toBe(false); // the probe write noticed
    expect(s.writeList(s.keys.daily('2026-10-06'), ['beds'])).toBe(false);
    expect(s.writeList(s.keys.daily('2026-10-06'), ['beds', 'counters'])).toBe(false);
    expect(s.readList(s.keys.daily('2026-10-06'))).toEqual(['beds', 'counters']);
    s.setOnboarded(true);
    expect(s.isOnboarded()).toBe(true);
    expect(notified).toBeLessThanOrEqual(1);
  });

  it('works with no storage at all', async () => {
    vi.resetModules();
    (globalThis as unknown as { window: object }).window = {
      get localStorage(): Storage {
        throw new DOMException('denied', 'SecurityError');
      },
    };
    const s = await import('../src/lib/storage');
    expect(s.isSaving()).toBe(false);
    expect(() => s.writeList(s.keys.focus('2026-10-06'), ['mon-dust'])).not.toThrow();
    expect(s.readList(s.keys.focus('2026-10-06'))).toEqual(['mon-dust']);
    expect(() => s.pruneOld(new Date())).not.toThrow();
  });

  it('a healthy browser reports saving', async () => {
    vi.resetModules();
    const s = await import('../src/lib/storage');
    expect(s.isSaving()).toBe(true);
    expect(s.writeList(s.keys.daily('2026-10-06'), ['beds'])).toBe(true);
    expect(window.localStorage.getItem('omc:v1:daily:2026-10-06')).toBe('["beds"]');
    expect(window.localStorage.getItem('omc:v1:probe')).toBeNull();
  });
});
