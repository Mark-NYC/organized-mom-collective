import { calendarOrderAccess, calendarPath, hasCalendarAccess, rememberCalendarAccess } from './companion';
import { getSession, loadOrders } from './account';

export async function initCompanionAccess() {
  if (calendarPath(location.pathname)) {
    rememberCalendarAccess();
    return; // The QR copy never loads membership, Club navigation or sales UI.
  }
  let calendar = hasCalendarAccess();
  if (!calendar) {
    try {
      if (await getSession()) {
        const orders = await loadOrders();
        calendar = calendarOrderAccess(orders);
      }
    } catch { /* Keep cleaning hidden if purchase verification is unavailable. */ }
  }
  document.querySelectorAll<HTMLElement>('[data-calendar-feature]').forEach(el => { el.hidden = !calendar; });
  if (!calendar && /^\/app\/(cleaning|week|reorder|settings)\/?$/.test(location.pathname)) location.replace('/app');
}
