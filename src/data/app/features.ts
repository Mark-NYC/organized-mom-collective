/**
 * The family system's areas, in the order the app grows (docs/ios/OMC_APP_ROADMAP.md → 3).
 *
 * `live` areas exist and may be shown. `planned` areas are architecture only: never rendered, linked or
 * described to customers (CLAUDE.md: never advertise roadmap features as live). Flip one to `live` only when
 * its milestone ships, in the same change as its screens.
 */
export type FeatureStatus = 'live' | 'planned';

export interface AppFeature {
  id: 'today' | 'cleaning' | 'club' | 'family' | 'calendar' | 'inbox' | 'sunday-setup';
  label: string;
  href: string;
  status: FeatureStatus;
  /** Roadmap milestone that ships it. */
  milestone: number;
}

export const APP_FEATURES: readonly AppFeature[] = [
  { id: 'today', label: 'Today', href: '/app', status: 'live', milestone: 1 },
  { id: 'cleaning', label: 'Cleaning', href: '/app/cleaning', status: 'live', milestone: 1 },
  { id: 'club', label: 'Club', href: '/app/club', status: 'live', milestone: 1 },
  { id: 'family', label: 'Account', href: '/app/account', status: 'live', milestone: 1 },
  { id: 'calendar', label: 'Calendar', href: '/app/family-calendar', status: 'live', milestone: 3 },
  { id: 'sunday-setup', label: 'Sunday Setup', href: '/app/sunday-setup', status: 'live', milestone: 4 },
  { id: 'inbox', label: 'Inbox', href: '/app/inbox', status: 'planned', milestone: 6 },
];

/** What screens may show today. */
export const visibleFeatures = () => APP_FEATURES.filter((f) => f.status === 'live');
