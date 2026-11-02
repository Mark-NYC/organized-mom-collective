/** Calendar QR access is device-local, not a paid Club entitlement. */
export const CALENDAR_ACCESS_KEY = 'omc:calendar-companion:v1';
export const calendarPath = (path: string) => /^\/app\/calendar(?:\/|$)/.test(path);
export const hasCalendarAccess = () => {
  try { return localStorage.getItem(CALENDAR_ACCESS_KEY) === '1'; } catch { return false; }
};
export function rememberCalendarAccess() {
  try { localStorage.setItem(CALENDAR_ACCESS_KEY, '1'); } catch { /* QR still works without storage. */ }
}
export function cleaningRoutes(path = typeof location === 'undefined' ? '' : location.pathname) {
  const base = calendarPath(path) ? '/app/calendar' : '/app';
  const today = base === '/app' ? '/app/cleaning' : base;
  return { today, cleaning: today, week: `${base}/week`, reorder: `${base}/reorder`, settings: `${base}/settings`, monthlyFocus: `${base}/week#monthly-focus`, day: (day: number) => `${today}?day=${['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][day]}` };
}

/** A Club subscription is deliberately not evidence of a calendar purchase. */
export function calendarOrderAccess(orders: { test: boolean; payment_status: string; fulfillment_status: string; items: { slug: string }[] }[]) {
  return orders.some(o => !o.test && ['paid', 'partially_refunded'].includes(o.payment_status) && o.fulfillment_status !== 'canceled' && o.items.some(i => ['calendar-26-week', 'calendar-52-week', 'family-schedule-calendar-2027'].includes(i.slug)));
}
