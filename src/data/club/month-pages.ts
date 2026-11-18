/**
 * The twelve monthly Club pages, as they actually are. Owner decision 2026-11-18: the pages at /app/club/<month> are
 * the source of truth for each month's theme, resources and content. Everything around them that names a month on
 * screen (Club Home, the year strip, Monthly resources, the membership tile, the weekly meeting's links) reads this
 * file, and this file only mirrors the pages: `tests/club-month-pages.test.ts` checks every name below against the
 * page's own source, so it can't drift from them. Nothing here changes a page, a generator or a printable.
 *
 * `name` is the heading the month's page opens with (November: its printed resource's title, since November's page is
 * the meeting and its tool lives at /club/resources). `resources` are the month's printables in the order the page
 * offers them. `builds` and `how` are the year strip's two lines, in the page's own terms.
 * docs/product/UNIFIED_FAMILY_ARCHITECTURE.md §13.
 */
export interface MonthPage {
  /** 1–12 */
  month: number;
  route: string;
  name: string;
  resources: { name: string; route: string }[];
  builds: string;
  how: string;
  /** Where `name` appears, for the drift test: the page and the components it renders. */
  source: string[];
}

export const MONTH_PAGES: readonly MonthPage[] = [
  {
    month: 1, route: '/app/club/january', name: 'Our Family Focus',
    resources: [{ name: 'Our Family Focus', route: '/app/club/january' }],
    builds: 'Planning together',
    how: 'One page with your family’s shared focus for the month, a small habit or two worth trying, and four Words of the Week.',
    source: ['src/pages/app/club/january.astro'],
  },
  {
    month: 2, route: '/app/club/february', name: 'My Laundry, My Job.',
    resources: [{ name: 'My Laundry, My Job.', route: '/app/club/february' }],
    builds: 'Caring for their own things',
    how: 'A picture laundry guide for each child, matched to their age, with laundry days and who runs the machine.',
    source: ['src/pages/app/club/february.astro'],
  },
  {
    month: 3, route: '/app/club/march', name: 'Our Family Rhythm',
    resources: [{ name: 'Our Family Rhythm', route: '/app/club/march' }, { name: 'Our Family Spring Prep', route: '/app/club/march/spring-prep' }],
    builds: 'Owning their part, together',
    how: 'Our Family Rhythm: two moments your family shares each day and everyone’s part in them. Plus Spring Prep: familiar spring jobs, each with an owner.',
    source: ['src/components/club/MarchPlanMobile.astro', 'src/components/club/MarchSpringPrep.astro'],
  },
  {
    month: 4, route: '/app/club/april', name: 'Tonight, we’ve got dinner.',
    resources: [{ name: 'Tonight, we’ve got dinner.', route: '/app/club/april' }],
    builds: 'Sharing meal ownership',
    how: 'One fully prepared dinner for tonight, plus a reusable Dinner Team with a role for everyone.',
    source: ['src/pages/app/club/april.astro'],
  },
  {
    month: 5, route: '/app/club/may', name: 'Our Summer Day',
    resources: [{ name: 'Our Summer Day', route: '/app/club/may' }],
    builds: 'Managing their day',
    how: 'A picture-led summer rhythm kids can check for themselves, so they know what comes next.',
    source: ['src/pages/app/club/may.astro'],
  },
  {
    month: 6, route: '/app/club/june', name: 'The snacks are handled. By the kids.',
    resources: [{ name: 'The snacks are handled. By the kids.', route: '/app/club/june' }],
    builds: 'Making their own snacks',
    how: 'One visual snack station, prepared for your family, so kids can see what they can make and make it themselves.',
    source: ['src/pages/app/club/june.astro'],
  },
  {
    month: 7, route: '/app/club/july', name: 'I’m Bored! What Can I Do?',
    resources: [{ name: 'I’m Bored! What Can I Do?', route: '/app/club/july' }],
    builds: 'Choosing something to do',
    how: 'An activity board with ideas kids can choose and start themselves, so you don’t have to come up with something every time.',
    source: ['src/pages/app/club/july.astro'],
  },
  {
    month: 8, route: '/app/club/august', name: 'Back to School Without the Scramble',
    resources: [{ name: 'Back to School Without the Scramble', route: '/app/club/august' }],
    builds: 'Taking initiative',
    how: 'A back-to-school plan with every child’s own part, plus a Morning Routine and an After-School Routine for the whole family to see.',
    source: ['src/pages/app/club/august.astro'],
  },
  {
    month: 9, route: '/app/club/september', name: 'Our Family Habit Cards',
    resources: [{ name: 'Our Family Habit Cards', route: '/app/club/september' }],
    builds: 'Building independent routines',
    how: 'Personalized habit cards help kids practice one small school-day responsibility without constant reminders.',
    source: ['src/pages/app/club/september.astro'],
  },
  {
    month: 10, route: '/app/club/october', name: 'Less asking. More doing.',
    resources: [{ name: 'Less asking. More doing.', route: '/app/club/october' }],
    builds: 'Caring for shared spaces',
    how: 'A daily reset with one familiar cue, picture jobs and a clear finish line kids can recognize.',
    source: ['src/pages/app/club/october.astro'],
  },
  {
    month: 11, route: '/app/club/november', name: 'Our Family Ownership Plan',
    resources: [{ name: 'Our Family Ownership Plan', route: '/club/resources/2026-11-family-ownership' }],
    builds: 'Owning a whole responsibility',
    how: 'Each family member gets a whole job with a clear owner, timing, and finish line.',
    source: ['src/components/club/NovemberOwnershipPrintable.astro'],
  },
  {
    month: 12, route: '/app/club/december', name: 'Your Christmas Mission Has Arrived!',
    resources: [{ name: 'Your Christmas Mission Has Arrived!', route: '/app/club/december' }],
    builds: 'Being a blessing to others',
    how: 'One kindness mission and two Christmas cards kids can make and send to someone like a grandparent or teacher.',
    source: ['src/pages/app/club/december.astro'],
  },
];

export const monthPage = (month: number) => MONTH_PAGES.find((p) => p.month === month)!;
/** The page's name for a kit month ('YYYY-MM' or 'YYYY-MM-DD'). */
export const monthPageName = (iso: string) => monthPage(Number(iso.slice(5, 7)))?.name ?? null;
