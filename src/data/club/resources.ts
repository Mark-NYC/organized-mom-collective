/**
 * The member's monthly resources: each kit slug (the edition her entitlement names, club_kits.slug) → the month's
 * printable, the same component its public sample preview shows. One family, one monthly problem, one tailored plan:
 * a month is one resource, prepared from her family profile. /club/resources/<slug> renders it for her
 * (src/pages/club/resources/[slug].astro); the dashboard links here.
 *
 * `component` picks the printable in that page. Year 2 editions (e.g. December 2027) are listed once they have one.
 *
 * `title` is the name of what prints, used everywhere a member or the owner sees the month (Welcome Kit, Club Home,
 * the plan pages, admin fulfillment and CSV). It follows the app tool at /app/club/<month>, which is what members
 * edit and fulfillment prints: January 2027 is "Our Family Weekly Meeting" and September "Our Family Habit Cards"
 * (the same as src/data/club/family-meeting.ts → resourceTitle and the public Club page; fixed Nov 2026).
 *
 * Known gap: `component` is the older member copy at /club/resources/<slug>, which still renders the earlier printables
 * for January (Habit Cards), February, March and September. Members are sent to the app tools instead (memberPlanHref);
 * repointing those old pages is a separate change.
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
  /**
   * When this month is a new member's first (her Welcome Kit): how it helps and the one thing to do with the kids
   * first, in her words. Written from the month's product doc; months without one show only the problem line.
   */
  welcome?: { helps: string; firstStep: string };
}

export const clubResources: readonly ClubResource[] = [
  { slug: '2026-11-family-ownership', month: '2026-11', title: 'Our Family Ownership Plan', problem: 'Who owns which jobs, start to finish', component: 'november', preview: '/club/worksheet-generator' },
  { slug: '2026-12-christmas-mission', month: '2026-12', title: 'Your Christmas Mission', problem: 'A kindness mission the kids lead', component: 'december', preview: '/club/december-preview' },
  { slug: '2027-01-fresh-start-together', month: '2027-01', title: 'Our Family Weekly Meeting', problem: 'Looking at the week together, so the plan isn’t only in your head', component: 'january', preview: '/app/club/january?sample=rivera',
    // The printed resource is the app tool /app/club/january (SeptemberSundayReset: the two-sided Weekly Meeting sheet),
    // which fulfillment prints (?fulfillment=<order>). docs/club/WELCOME_KIT.md → Naming.
    welcome: {
      helps: 'Once a week, ten or fifteen minutes around the wall calendar: everyone sees what’s coming, gets ready for it and takes a part, so you aren’t the family’s only calendar.',
      firstStep: 'Pick a time this week for your first meeting and let the kids know they each get a part.',
    } },
  { slug: '2027-02-better-together', month: '2027-02', title: 'Family Laundry Guides', problem: 'Laundry the kids can own, step by step', component: 'february', preview: '/club/february-preview' },
  { slug: '2027-03-spring-clean-together', month: '2027-03', title: 'Family Chore Charts', problem: 'Chores without chasing everyone', component: 'march', preview: '/club/march-preview' },
  { slug: '2027-04-everybody-helps-at-mealtime', month: '2027-04', title: 'Our Dinner Team', problem: 'Dinner isn’t just Mom’s job', component: 'april', preview: '/club/april-preview' },
  { slug: '2027-05-finish-the-school-year', month: '2027-05', title: 'Our Summer Day Rhythm', problem: 'A rhythm kids can follow when school ends', component: 'may', preview: '/club/may-preview' },
  { slug: '2027-06-summer-with-a-plan', month: '2027-06', title: 'My Family’s Snack Station', problem: 'Snacks without a request every hour', component: 'june', preview: '/club/june-preview' },
  { slug: '2027-07-ready-to-go', month: '2027-07', title: 'What Can I Do Right Now?', problem: 'Ideas kids can start on their own', component: 'july', preview: '/club/july-preview' },
  { slug: '2027-08-school-year', month: '2027-08', title: 'My School Day Routines', problem: 'Mornings and afternoons without constant reminders', component: 'august', preview: '/club/august-preview' },
  { slug: '2027-09-a-week-everyone-can-see', month: '2027-09', title: 'Our Family Habit Cards', problem: 'One small school-day habit, without the reminders', component: 'september', preview: '/club/september-preview' },
  { slug: '2027-10-home-works-together', month: '2027-10', title: 'Our 5-Minute Reset', problem: 'A daily reset with a clear finish line', component: 'october', preview: '/club/october-preview' },
];

export const clubResourceBySlug = (slug: string | null | undefined) => clubResources.find((r) => r.slug === slug);

/** Where a member's own copy of a printable keeps its browser state; mirrored to club_resource_versions. */
export const memberStorageKey = (slug: string) => `omc:club:member:${slug}:v1`;
export const MEMBER_STORAGE_PREFIX = 'omc:club:member:';
