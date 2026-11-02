import { describe, expect, it } from 'vitest';
import { calendarOrderAccess, calendarPath, cleaningRoutes } from '../src/lib/companion';

describe('calendar companion separation', () => {
  it('keeps all calendar navigation in its own route tree', () => {
    const r = cleaningRoutes('/app/calendar/week');
    expect([r.today, r.week, r.reorder, r.settings, r.monthlyFocus, r.day(1)].every(p => p.startsWith('/app/calendar'))).toBe(true);
    expect(r.day(1)).toBe('/app/calendar?day=monday');
    expect(calendarPath('/app/calendar-other')).toBe(false);
    expect(cleaningRoutes('/app/cleaning').week).toBe('/app/week');
  });
  it('requires a real calendar purchase rather than a Club or digital purchase', () => {
    const order = { test: false, payment_status: 'paid', fulfillment_status: 'shipped', items: [{ slug: 'calendar-26-week' }] };
    expect(calendarOrderAccess([order])).toBe(true);
    expect(calendarOrderAccess([{ ...order, items: [{ slug: 'club-monthly' }] }])).toBe(false);
    expect(calendarOrderAccess([{ ...order, items: [{ slug: 'weekly-reset-system' }] }])).toBe(false);
    expect(calendarOrderAccess([{ ...order, test: true }])).toBe(false);
    expect(calendarOrderAccess([{ ...order, payment_status: 'refunded' }])).toBe(false);
    expect(calendarOrderAccess([{ ...order, fulfillment_status: 'canceled' }])).toBe(false);
    expect(calendarOrderAccess([])).toBe(false);
  });
});
