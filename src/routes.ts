/**
 * Every internal URL in one place.
 *
 *   PUBLIC  /                  brand homepage
 *           /our-story         how Mark and Megan began Organized Mom Collective
 *           /calendar          the Family Wall Calendar product page (buy on Etsy)
 *           /shop              every product (calendar, Weekly Reset, mug), linked from the header
 *           /companion         how the cleaning companion works (public explainer)
 *           /weekly-reset      Weekly Reset System landing page ($9 digital bundle; noindex until checkout is live)
 *           /weekly-reset-simple  one-screen version of it (hero only; always noindex)
 *           /essential-routines $12 downsell after Take Back Control (always noindex)
 *           /family-sanity-saver-starter-kit  Family Command Center landing page ($7; standalone entry point, noindex until sold)
 *           /starter-kit       the FREE Sanity Saver Starter Kit signup (business-card QR lands here; noindex)
 *           /starter-kit/kit   the kit itself: five free tools as a guided path (opened after signup and from its email; noindex)
 *           /real-life-reset-kit  Real Life Reset Kit ($7 backup-plan offer; not linked yet, always noindex)
 *           /take-back-control "Take Back Control" upsell ($29 course + tools after the Weekly Reset; always noindex)
 *           /mind-your-own-motherhood-mug  the $23 mug (noindex until checkout is live)
 *           /planner           free weekly planner, filled in on screen, downloads as a PNG (the upgraded one,
 *                              for Take Back Control buyers, is unlisted: PLANNER_PLUS_PATH in src/data/planner.ts)
 *           /pantry            free pantry inventory tracker, same idea
 *           /try-the-calendar  free monthly family calendar (one row per person), same idea
 *           /chore-chart       free chore chart by age (pick an age group, edit the chores), same idea
 *           /back-to-school-checklist  free three-page back-to-school checklist, same idea
 *           /screen-time-contract      free screen time contract (jobs first, activities earn screen time), same idea
 *           /routine-chart     free routine charts (morning, after-school, bedtime, weekend, custom), same idea
 *           /homeschool-rhythm free homeschool weekly rhythm (time blocks × days, sample rhythms), same idea
 *           /spring-cleaning-checklist  free room-by-room spring cleaning checklist (ticked on screen, progress saved; no PNG)
 *           /fall-cleaning-checklist    the fall version, same idea
 *           /new-year-declutter         eight-week New Year declutter sprint (same component, with badges)
 *           /paper-clutter-blitz        three-day paper blitz with timers (same component)
 *           /laundry-system    free two-page laundry flow checklist (editable, PNG per page)
 *           /closet-reset      free one-page closet declutter checklist, same idea
 *           /lunch-and-snack-station  free two-page fridge printable: lunch builder + snack station, same idea
 *           /command-center-setup     free one-page setup sheet for FP-03's command center, same idea
 *           /travel-checklist          free two-page family travel checklist with trip-type chips, same idea
 *           /fall-pantry-stock-up      free one-page fall & winter pantry stock-up list, same idea
 *           /gratitude-tracker         free November family gratitude tracker (Thanksgiving week computed per year)
 *           /holiday-gift-planner      free one-page holiday budget & gift planner (totals add themselves up)
 *           /mental-load-worksheet     free mental load worksheet (IF-02 companion): brain dump, sort, hand over one whole job
 *           /meal-planner              free weekly dinner planner on FP-05's full/short/zero method + grocery list
 *           /december-countdown        free family December countdown: 24 editable dated days + idea chips
 *           /thanksgiving-plan         free two-page Thanksgiving prep plan (thaw day and timeline from dinner time + turkey weight)
 *           /resources                         resource library hub
 *           /resources/<article-slug>          articles (src/content/articles/)
 *           /resources/topics/<pillar-id>      pillar pages (src/data/pillars.ts)
 *           /support           Help & Support: topics, FAQs, contact form (src/data/support.ts)
 *           /returns           Returns & Refunds policy (/refunds redirects here)
 *           /survey            customer discovery survey (noindex, shared by link)
 *           /survey/admin      survey results, admins only (noindex; AdminLayout)
 *   SHOP    /checkout           direct checkout (noindex; off unless PUBLIC_SHOP_ENABLED). Linked from the offer pages, the calendar
 *                               options (src/lib/reorder.ts) and the mug page once on sale (?product=<slug>), only in builds with the shop on
 *           /checkout/complete  confirmation after Stripe (noindex)
 *           /download?t=…       a digital order's files, from the emailed link (noindex)
 *   ADMIN   /admin              Overview: alerts + business numbers (email + password; noindex; supabase/ADMIN.md)
 *           /admin/pages        Pages & Funnels (page inventory)
 *           /admin/orders       order, inventory and shipping dashboard
 *           /admin/settings     admin access, integrations, page inventory token, audit log
 *   CLUB    /club/join (plans → Stripe Checkout), /club/login, /club/welcome (after checkout: sign in, family, address),
 *           /club/dashboard, /club/family, /club/resources/<slug> (her month), /club/kits/<slug>, /club/tools/<tool>
 *                               Organized Family Club member pages (noindex; a "not available" notice unless
 *                               PUBLIC_CLUB_ENABLED; docs/club/MEMBERSHIP.md)
 *           /admin/club         members, entitlements, fulfillment queue (owner admins)
 *   QR      /start             permanent entry point printed on calendars → APP
 *   APP     /app, /app/week, /app/reorder, /app/settings   (noindex)
 *           /app/tidy → /app/week (old name, kept so earlier links still work)
 *
 * Future areas (not built): auth/account routes such as /login and /account.
 */
import { DAY_PARAMS } from './lib/dates';

export const routes = {
  /** Organized Family Club member pages (behind PUBLIC_CLUB_ENABLED; never linked from public pages). */
  clubStart: '/club/start',
  clubJoin: '/club/join',
  clubLogin: '/club/login',
  clubWelcome: '/club/welcome',
  clubDashboard: '/club/dashboard',
  /** A member's personalized month (src/data/club/resources.ts). */
  clubResource: (slug: string) => `/club/resources/${slug}`,
  adminClub: '/admin/club',
  clubFamily: '/club/family',
  clubKit: (slug: string) => `/club/kits/${slug}`,
  /** A site tool hosted inside the Club (src/data/club/tools.ts). */
  clubTool: (id: string) => `/club/tools/${id}`,
  home: '/',
  ourStory: '/our-story',
  calendar: '/calendar',
  /** Every product, one card each, linking to its own page. */
  shop: '/shop',
  /** The calendar page's options and Etsy buttons. */
  buy: '/calendar#buy',
  companion: '/companion',
  weeklyReset: '/weekly-reset',
  /** One-screen version of the Weekly Reset page, for ads and Pins (always noindex). */
  weeklyResetSimple: '/weekly-reset-simple',
  takeBackControl: '/take-back-control',
  /** Standalone $7 Family Command Center landing page (noindex until sold). */
  /** $7 Real Life Reset Kit offer (not linked from anywhere yet; always noindex). */
  realLifeReset: '/real-life-reset-kit',
  familySanitySaver: '/family-sanity-saver-starter-kit',
  /** The free Sanity Saver Starter Kit (src/data/starter-kit.ts): signup, then the kit. */
  starterKit: '/starter-kit',
  starterKitKit: '/starter-kit/kit',
  /** $12 downsell after Take Back Control (noindex). */
  essentialRoutines: '/essential-routines',
  /** The "Mind Your Own Motherhood" mug ($23; noindex until checkout is live). */
  mug: '/mind-your-own-motherhood-mug',
  planner: '/planner',
  pantry: '/pantry',
  tryCalendar: '/try-the-calendar',
  choreChart: '/chore-chart',
  backToSchool: '/back-to-school-checklist',
  screenTime: '/screen-time-contract',
  routineChart: '/routine-chart',
  homeschoolRhythm: '/homeschool-rhythm',
  springCleaning: '/spring-cleaning-checklist',
  fallCleaning: '/fall-cleaning-checklist',
  newYearDeclutter: '/new-year-declutter',
  paperBlitz: '/paper-clutter-blitz',
  laundrySystem: '/laundry-system',
  closetReset: '/closet-reset',
  lunchSnackStation: '/lunch-and-snack-station',
  commandCenterSetup: '/command-center-setup',
  travelChecklist: '/travel-checklist',
  fallPantry: '/fall-pantry-stock-up',
  gratitudeTracker: '/gratitude-tracker',
  holidayGifts: '/holiday-gift-planner',
  thanksgivingPlan: '/thanksgiving-plan',
  decemberCountdown: '/december-countdown',
  mealPlanner: '/meal-planner',
  mentalLoad: '/mental-load-worksheet',
  resources: '/resources',
  /** The Free tools section of the resource hub. */
  freeTools: '/tools',
  article: (slug: string) => `/resources/${slug}`,
  pillar: (id: string) => `/resources/topics/${id}`,
  survey: '/survey',
  surveyAdmin: '/survey/admin',
  /** Help & Support: help topics, FAQs and the contact form (#contact). */
  support: '/support',
  supportContact: '/support#contact',
  /** Returns & Refunds policy, linked from the footer, /calendar and the checkout. The old /refunds redirects here. */
  returns: '/returns',
  /** Direct website checkout: the offer pages, the calendar options and (once on sale) the mug page link here, in shop-enabled builds. */
  checkout: '/checkout',
  checkoutComplete: '/checkout/complete',
  download: '/download',
  /** Customer account (noindex): sign in with an emailed code, saved tools, purchases. Off unless PUBLIC_ACCOUNTS_ENABLED. */
  account: '/account',
  adminOrders: '/admin/orders',
  start: '/start',
  today: '/app',
  week: '/app/week',
  /** Old name for the Week page; redirects to `week`. */
  tidy: '/app/tidy',
  reorder: '/app/reorder',
  settings: '/app/settings',
  monthlyFocus: '/app/week#monthly-focus',
  /** A specific weekday of the current week, e.g. /app?day=monday */
  day: (dow: number) => `/app?day=${DAY_PARAMS[dow]}`,
} as const;

/** True for paths inside the companion app. */
export const isAppPath = (path: string) => path === '/app' || path.startsWith('/app/');
