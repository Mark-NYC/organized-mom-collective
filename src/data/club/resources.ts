/**
 * The member's monthly resources: each kit slug (the edition her entitlement names, club_kits.slug) → the month's
 * printable, the same component its public sample preview shows. One family, one monthly problem, one tailored plan:
 * a month is one resource, prepared from her family profile. /club/resources/<slug> renders it for her
 * (src/pages/club/resources/[slug].astro); the dashboard links here.
 *
 * `component` picks the printable in that page. Year 2 editions (e.g. December 2027) are listed once they have one.
 *
 * Known gap (Oct 2026, needs the owner's decision): the app's month pages moved on and these four didn't.
 * /app/club/january is the Weekly Meeting (SeptemberSundayReset) and /app/club/september the Habit Cards; February is
 * the laundry guides (FebruaryLaundryGuides) and March the chore charts (MarchChoreCharts). This page, which members
 * open, fulfillment prints and the Welcome Kit's first resource uses, still renders the earlier printables below.
 * Repointing them changes what January members and Welcome Kits receive, and the February and March printables only
 * run inside the plan shell today, so it's a separate change. The Monthly Family Meeting follows the app pages
 * (src/data/club/family-meeting.ts).
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
  { slug: '2027-01-fresh-start-together', month: '2027-01', title: 'Our Family Habit Cards', problem: 'Less reminding, more independence', component: 'january', preview: '/preview/january-habit-cards',
    // docs/club/JANUARY_HABIT_CARDS.md: one cue, one small next action, a card placed where it happens; start with one or two.
    welcome: {
      helps: 'Each card ties one small job to something that already happens, and it sits right where the job happens, so the reminder doesn’t have to come from you.',
      firstStep: 'Show the kids their cards and let each one choose where theirs goes.',
    } },
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
