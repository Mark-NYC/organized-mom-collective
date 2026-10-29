/**
 * The member's monthly resources: each kit slug (the edition her entitlement names, club_kits.slug) → the month's
 * printable, the same component its public sample preview shows. One family, one monthly problem, one tailored plan:
 * a month is one resource, prepared from her family profile. /club/resources/<slug> renders it for her
 * (src/pages/club/resources/[slug].astro); the dashboard links here.
 *
 * `component` picks the printable in that page. Year 2 editions (e.g. December 2027) are listed once they have one.
 */
export interface ClubResource {
  slug: string;
  /** YYYY-MM */
  month: string;
  title: string;
  /** The problem it takes off Mom's plate, for the dashboard. */
  problem: string;
  component: 'november' | 'december' | 'january' | 'february' | 'march' | 'april' | 'may' | 'june' | 'july' | 'august' | 'september' | 'october';
  /** The public sample preview of the same printable. */
  preview: string;
}

export const clubResources: readonly ClubResource[] = [
  { slug: '2026-11-family-ownership', month: '2026-11', title: 'Our Family Ownership Plan', problem: 'Who owns which jobs, start to finish', component: 'november', preview: '/club/worksheet-generator' },
  { slug: '2026-12-christmas-mission', month: '2026-12', title: 'Your Christmas Mission', problem: 'A kindness mission the kids lead', component: 'december', preview: '/club/december-preview' },
  { slug: '2027-01-fresh-start-together', month: '2027-01', title: 'Our Family Habit Cards', problem: 'Less reminding, more independence', component: 'january', preview: '/preview/january-habit-cards' },
  { slug: '2027-02-better-together', month: '2027-02', title: 'Family Connection Cards', problem: 'Making room for time together', component: 'february', preview: '/club/february-preview' },
  { slug: '2027-03-spring-clean-together', month: '2027-03', title: 'Spring Prep as a Family', problem: 'One project with a part for everyone', component: 'march', preview: '/club/march-preview' },
  { slug: '2027-04-everybody-helps-at-mealtime', month: '2027-04', title: 'Our Dinner Team', problem: 'Dinner isn’t just Mom’s job', component: 'april', preview: '/club/april-preview' },
  { slug: '2027-05-finish-the-school-year', month: '2027-05', title: 'Our Summer Day Rhythm', problem: 'A rhythm kids can follow when school ends', component: 'may', preview: '/club/may-preview' },
  { slug: '2027-06-summer-with-a-plan', month: '2027-06', title: 'My Family’s Snack Station', problem: 'Snacks without a request every hour', component: 'june', preview: '/club/june-preview' },
  { slug: '2027-07-ready-to-go', month: '2027-07', title: 'What Can I Do Right Now?', problem: 'Ideas kids can start on their own', component: 'july', preview: '/club/july-preview' },
  { slug: '2027-08-school-year', month: '2027-08', title: 'My School Day Routines', problem: 'Mornings and afternoons without constant reminders', component: 'august', preview: '/club/august-preview' },
  { slug: '2027-09-a-week-everyone-can-see', month: '2027-09', title: 'Our Family Sunday Reset', problem: 'Getting ready for the week, together', component: 'september', preview: '/club/september-preview' },
  { slug: '2027-10-home-works-together', month: '2027-10', title: 'Our 5-Minute Reset', problem: 'A daily reset with a clear finish line', component: 'october', preview: '/club/october-preview' },
];

export const clubResourceBySlug = (slug: string | null | undefined) => clubResources.find((r) => r.slug === slug);

/** Where a member's own copy of a printable keeps its browser state; mirrored to club_resource_versions. */
export const memberStorageKey = (slug: string) => `omc:club:member:${slug}:v1`;
export const MEMBER_STORAGE_PREFIX = 'omc:club:member:';
