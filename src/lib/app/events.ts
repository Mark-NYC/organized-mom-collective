/**
 * Pilot measurement from the app (docs/pilot/ANALYTICS.md): one allowlisted event name, the platform and the day, for
 * a signed-in grown-up, at most once a day per event (app_event, supabase/migrations/20261210000000_app_events.sql).
 * Never a name, a child, a household or anything a family wrote. Not when signed out, not in the demo, never throws,
 * never waits: measurement must not get in a mom's way.
 */
import { accountRpc, loadSession } from '../account';
import { appShellBuild } from '../native/platform';

export type AppEvent =
  | 'app_open' | 'onboarding_started' | 'onboarding_completed'
  | 'cleaning_checked' | 'plan_added' | 'agreement_made'
  | 'meeting_started' | 'meeting_completed' | 'club_preview_viewed' | 'feedback_sent';

const SENT = 'omc:events:sent:v1';
const today = () => new Date().toISOString().slice(0, 10);

export function track(event: AppEvent): void {
  try {
    if (typeof window === 'undefined' || !loadSession()) return;
    if (new URLSearchParams(location.search).get('demo') === '1') return;
    const sent = JSON.parse(localStorage.getItem(SENT) ?? '{}') as Record<string, string>;
    if (sent[event] === today()) return;
    sent[event] = today();
    localStorage.setItem(SENT, JSON.stringify(sent));
    void accountRpc('app_event', { p_event: event, p_platform: appShellBuild() ? 'ios' : 'web' }).catch(() => {
      // Not sent (offline, or the database doesn't have it yet): try again next time.
      try { const s = JSON.parse(localStorage.getItem(SENT) ?? '{}'); delete s[event]; localStorage.setItem(SENT, JSON.stringify(s)); } catch { /* fine */ }
    });
  } catch {
    // Measurement never blocks anything.
  }
}
