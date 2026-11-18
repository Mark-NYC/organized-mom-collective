/**
 * Today's shared pieces: the date (worked out on the device) and the rule for showing Club cards. The dashboard itself
 * is TodayDashboard.tsx.
 * The page is static, so anything date-based has to be rendered here, not at build time (before Nov 2026 the
 * page baked the build day's date and zone into the HTML). Refreshes when the day rolls over or the app returns
 * to the foreground (useToday listens to focus; the app's resume also fires focus).
 */
import { useEffect, useState } from 'react';
import { useToday } from '../../lib/hooks';
import { getSession } from '../../lib/account';
import { accountStore } from '../../lib/club/store';

export function TodayDate() {
  const today = useToday();
  return <>{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(today).toUpperCase()}</>;
}

/**
 * Family Meeting Club cards are for households that have the Club, on the website and in the app (owner decision
 * 2026-11-17): a free family never sees a membership card it can't open, an upgrade or a price. Selling the Club stays
 * on the public /club page. Remembered for the visit so the card doesn't flicker in on every screen.
 */
const CLUB_SEEN = 'omc:app:club-access';
export function useShowsClub(): boolean {
  const [has, setHas] = useState(() => { try { return sessionStorage.getItem(CLUB_SEEN) === '1'; } catch { return false; } });
  useEffect(() => {
    void getSession().then(async (s) => {
      const access = s ? Boolean((await accountStore.me().catch(() => null))?.access) : false;
      setHas(access);
      try { sessionStorage.setItem(CLUB_SEEN, access ? '1' : '0'); } catch { /* this screen only */ }
    });
  }, []);
  return has;
}

/**
 * Months a household still holds after its membership ended (delivered months stay theirs). Family shows them a quiet
 * way back to those months: never a rejoin prompt or price (nothing is sold in the app; owner decision 2026-11-17).
 */
export function useKeptClubMonths(): number {
  const [kept, setKept] = useState(0);
  useEffect(() => {
    void getSession().then(async (s) => {
      if (!s) return;
      const me = await accountStore.me().catch(() => null);
      setKept(me && !me.access ? me.kits.length : 0);
    });
  }, []);
  return kept;
}
