/**
 * Organized Family's four primary destinations, on the website's /app and in the iPhone app: the bottom tab bar on
 * phones (AppTabBar.astro) and the header on wide screens (Nav.astro). Account is the profile control in the header.
 */
export const PRIMARY_TABS = [
  { href: '/app', label: 'Today', icon: 'home' },
  // The shared family calendar is free (src/data/app/features.ts).
  { href: '/app/family-calendar', label: 'Calendar', icon: 'calendar' },
  { href: '/app/cleaning', label: 'Cleaning', icon: 'check' },
  // Family: Our Family Meeting, members, responsibilities and the Family Meeting Club (src/pages/app/family/index.astro).
  { href: '/app/family', label: 'Family', icon: 'family' },
] as const;
