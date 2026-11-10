/**
 * Admin information architecture. Navigation shows real destinations only.
 * Future pages belong in the roadmap, not in the day-to-day workspace.
 */
export interface AdminSection {
  id: string;
  label: string;
  href: string;
  description: string;
}
export interface AdminGroup {
  id: string;
  label: string;
  sections: AdminSection[];
}
export const ADMIN_GROUPS: AdminGroup[] = [
  {
    id: 'home',
    label: 'Home',
    sections: [
      { id: 'overview', label: 'Overview', href: '/admin', description: 'Attention and business health' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    sections: [
      { id: 'orders', label: 'Orders', href: '/admin/orders', description: 'Payments and fulfillment' },
      { id: 'products', label: 'Products & stock', href: '/admin/orders?tab=inventory', description: 'Inventory and catalog' },
      { id: 'club', label: 'Family Club', href: '/admin/club', description: 'Members and monthly kits' },
    ],
  },
  {
    id: 'growth',
    label: 'Growth',
    sections: [
      { id: 'pins', label: 'Pinterest Studio', href: '/admin/pins', description: 'Content queue' },
      { id: 'email', label: 'Email reporting', href: '/admin/email', description: 'Subscriber, delivery and sales indicators' },
      { id: 'pages', label: 'Pages & funnels', href: '/admin/pages', description: 'Site inventory and links' },
      { id: 'survey', label: 'Survey', href: '/survey/admin', description: 'Responses' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    sections: [
      { id: 'settings', label: 'Settings', href: '/admin/settings', description: 'Account and integrations' },
    ],
  },
];
export const ADMIN_SECTIONS: AdminSection[] = ADMIN_GROUPS.flatMap((group) => group.sections);
/** Not navigation: a roadmap list for planning only. */
export const ADMIN_FUTURE = ['Unified customer profiles', 'Support inbox', 'Offer performance'] as const;

/** Signed out after this long without a click or key press. */
export const ADMIN_IDLE_MS = 30 * 60 * 1000;
