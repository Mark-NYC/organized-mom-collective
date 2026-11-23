/**
 * Organized Family's two primary destinations (two-tab redesign, docs/ios/TWO_TAB_REDESIGN.md), on the website's /app
 * and in the iPhone app: the bottom tab bar on phones (AppTabBar.astro) and the header on wide screens (Nav.astro).
 *
 *   Today           we follow through together (/app)
 *   Family Meeting  we decide together (/app/family/meeting)
 *
 * Everything else stays one tap away from Today, never deleted: Plans (the family calendar and its connected
 * calendars), Cleaning, and Resources (/app/family: the family, who does what, sharing, the Club and its months).
 * Account is the profile control in the header.
 */
export const PRIMARY_TABS = [
  { href: '/app', label: 'Today', icon: 'home' },
  { href: '/app/family/meeting', label: 'Family Meeting', icon: 'meeting' },
] as const;

/** Which tab a page belongs to (no tab is a dead end: the app has no back button). Meeting = the meeting itself. */
export function tabFor(path: string): '/app' | '/app/family/meeting' {
  const p = path.replace(/\/$/, '') || '/';
  return /^\/app\/family\/meeting$/.test(p) ? '/app/family/meeting' : '/app';
}
