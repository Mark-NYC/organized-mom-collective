/**
 * The member's monthly resources: each kit slug (the edition her entitlement names, club_kits.slug) → the month's
 * printable, the same component its public sample preview shows. One family, one monthly problem, one tailored plan:
 * a month is one resource, prepared from her family profile. /club/resources/<slug> renders it for her
 * (src/pages/club/resources/[slug].astro); the dashboard links here.
 *
 * `component` picks the printable in that page. Year 2 editions (e.g. December 2027) are listed once they have one.
 *
 * Known gap (Oct 30 2026, waiting on the owner; docs/club/RESOURCE_CONSISTENCY.md): the app's month pages, the kit
 * registry's January and September themes and the Monthly Family Meeting moved on; four entries here didn't.
 *   January   renders JanuaryHabitCards (now headed "September 2027"); the app's January is the Weekly Meeting.
 *   February  renders FebruaryConnectionCards; the app's February is the laundry guides (FebruaryLaundryGuides).
 *   March     renders MarchSpringPrep; the app's March is the chore charts (MarchChoreCharts, landscape, one per child).
 *   September renders SeptemberSundayReset (now headed "Our Family Weekly Meeting · January 2027"); the app's
 *             September is the Habit Cards.
 * This page is what members approve, what the admin's ?fulfillment= view prints for the mailing, and the Welcome
 * Kit's first resource (January for founding members; four January orders are pending). Repointing changes what is
 * mailed and the page count, and February's and March's current printables only run inside the plan shell, so it
 * waits for the owner's decision. `sameAsApp: false` marks them.
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
  /**
   * False while this page renders a different printable from the month's app page (/app/club/<month>), which is
   * where the Monthly Family Meeting lives. The Club library then doesn't send her from her copy to a meeting about
   * a different tool. See the header and docs/club/RESOURCE_CONSISTENCY.md.
   */
  sameAsApp: boolean;
}

export const clubResources: readonly ClubResource[] = [
  { slug: '2026-11-family-ownership', month: '2026-11', title: 'Our Family Ownership Plan', problem: 'Who owns which jobs, start to finish', component: 'november', preview: '/club/worksheet-generator', sameAsApp: true },
  { slug: '2026-12-christmas-mission', month: '2026-12', title: 'Your Christmas Mission', problem: 'A kindness mission the kids lead', component: 'december', preview: '/club/december-preview', sameAsApp: true },
  { slug: '2027-01-fresh-start-together', month: '2027-01', title: 'Our Family Habit Cards', problem: 'Less reminding, more independence', component: 'january', preview: '/preview/january-habit-cards', sameAsApp: false,
    // docs/club/JANUARY_HABIT_CARDS.md: one cue, one small next action, a card placed where it happens; start with one or two.
    welcome: {
      helps: 'Each card ties one small job to something that already happens, and it sits right where the job happens, so the reminder doesn’t have to come from you.',
      firstStep: 'Show the kids their cards and let each one choose where theirs goes.',
    } },
  { slug: '2027-02-better-together', month: '2027-02', title: 'Family Connection Cards', problem: 'Making room for time together', component: 'february', preview: '/club/february-preview', sameAsApp: false },
  { slug: '2027-03-spring-clean-together', month: '2027-03', title: 'Spring Prep as a Family', problem: 'One project with a part for everyone', component: 'march', preview: '/club/march-preview', sameAsApp: false },
  { slug: '2027-04-everybody-helps-at-mealtime', month: '2027-04', title: 'Our Dinner Team', problem: 'Dinner isn’t just Mom’s job', component: 'april', preview: '/club/april-preview', sameAsApp: true },
  { slug: '2027-05-finish-the-school-year', month: '2027-05', title: 'Our Summer Day Rhythm', problem: 'A rhythm kids can follow when school ends', component: 'may', preview: '/club/may-preview', sameAsApp: true },
  { slug: '2027-06-summer-with-a-plan', month: '2027-06', title: 'My Family’s Snack Station', problem: 'Snacks without a request every hour', component: 'june', preview: '/club/june-preview', sameAsApp: true },
  { slug: '2027-07-ready-to-go', month: '2027-07', title: 'What Can I Do Right Now?', problem: 'Ideas kids can start on their own', component: 'july', preview: '/club/july-preview', sameAsApp: true },
  { slug: '2027-08-school-year', month: '2027-08', title: 'My School Day Routines', problem: 'Mornings and afternoons without constant reminders', component: 'august', preview: '/club/august-preview', sameAsApp: true },
  { slug: '2027-09-a-week-everyone-can-see', month: '2027-09', title: 'Our Family Sunday Reset', problem: 'Getting ready for the week, together', component: 'september', preview: '/club/september-preview', sameAsApp: false },
  { slug: '2027-10-home-works-together', month: '2027-10', title: 'Our Daily Reset', problem: 'A daily reset with a clear finish line', component: 'october', preview: '/club/october-preview', sameAsApp: true },
];

export const clubResourceBySlug = (slug: string | null | undefined) => clubResources.find((r) => r.slug === slug);

/** Where a member's own copy of a printable keeps its browser state; mirrored to club_resource_versions. */
export const memberStorageKey = (slug: string) => `omc:club:member:${slug}:v1`;
export const MEMBER_STORAGE_PREFIX = 'omc:club:member:';
