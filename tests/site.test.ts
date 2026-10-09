import { describe, expect, it } from 'vitest';
import { BEST_VALUE_ID, CALENDAR_OPTIONS } from '../src/config';
import { calendarOptions, shopUrl } from '../src/lib/reorder';
import { isAppPath, routes } from '../src/routes';

describe('calendarOptions', () => {
  const options = calendarOptions();

  it('lists every option, best value first', () => {
    expect(options).toHaveLength(CALENDAR_OPTIONS.length);
    expect(options[0].id).toBe(BEST_VALUE_ID);
  });

  it('shows the full year as the better value against two half-year calendars', () => {
    const half = options.find((o) => o.id === 'half-year')!;
    const full = options.find((o) => o.id === 'full-year')!;
    expect(full.save).toBe(2 * half.price - full.price);
    expect(full.save).toBeGreaterThan(0);
    expect(full.setsWeeks).toBe(half.weeks);
  });

  it('keeps buy links off until a real Etsy listing is set', () => {
    for (const o of options) expect(o.url === null || /^https:\/\/(www\.)?etsy\.com\/listing\/\d+/.test(o.url)).toBe(true);
    expect(shopUrl()).toBe(options.find((o) => o.bestValue && o.url)?.url ?? options.find((o) => o.url)?.url ?? null);
  });
});

describe('public routes', () => {
  it('stay outside the app scope, so the service worker and manifest never claim them', () => {
    for (const path of [routes.home, routes.calendar, routes.companion, routes.resources, routes.start]) {
      expect(isAppPath(path)).toBe(false);
      expect(path.startsWith('/app')).toBe(false);
    }
    expect(routes.buy.startsWith(`${routes.calendar}#`)).toBe(true);
  });
});
