# Organized Family design system

Status 2026-11-18: built on branch `claude/premium-app-design` (stacked on the web/app parity change, PR #484). Not
merged or deployed. The visual reference is the owner's two premium mockups (Today/Calendar/Cleaning/Family/Account);
this is a visual redesign of the existing product, not a rebuild.

## One implementation for the website and the iPhone app

The website's `/app` and the iPhone app are the same source (docs/ios/WEB_APP_PARITY.md). The design system is one
stylesheet and a few components, used by every primary screen on both:

| Piece | Where |
| --- | --- |
| Tokens and components (CSS) | `src/styles/family-app-brand.css`, the "Organized Family design system" section: `--of-*` tokens, `.of-tile` (plain, `--sage`, `--month`, `--quiet`), `.of-tile-head` / `.of-tile-title` / `.of-tile-sub` / `.of-tile-action`, `.of-rows` / `.of-row` (event and list rows), `.of-avatar`, `.of-chip`, `.of-dot`, `.of-progress`, `.of-stat`, `.of-seg` (segmented control), `.of-btn` (`--soft`, `--danger`, `--block`), `.of-list` / `.of-list-item` / `.of-icon-box` (grouped settings), `.of-dash` (Today's two-column layout), `.of-page-title`, `.of-eyebrow`, `.of-group-title` |
| React components | `src/components/app/ui.tsx`: `Tile`, `TileHead`, `Chevron`, `Avatar` (a member's own color), `Progress` (segmented or continuous, a real progressbar), `Icon` (navigation and settings line icons) |
| Primary destinations | `src/data/app/tabs.ts`: Today · Calendar · Cleaning · Family. Phones: the bottom tab bar (`AppTabBar.astro`); 1024 px and wider: the header (`Nav.astro`, `data-app-topnav`). Account is the profile control |
| Monthly accent | `src/layouts/AppLayout.astro` sets `--of-month`, `--of-month-wash`, `--of-month-accent` on the device from the approved month colors (`src/theme.ts` → `monthTints`). January = Soft Frost Blue `#CDDDE1` |

**Typography:** Georgia (`--font-serif`) for page and tile titles, Montserrat for everything else. **Base:** warm
ivory `#FBF7F1`, charcoal `#4d4544` text, white tiles with a 1px warm rule, 10px corners and a soft shadow.

## Color rules

- The base interface is the same all year. The month's color only tints month tiles (Family Meeting, the Club, the
  calendar's empty state), the selected day and segment, today's marker and focus rings.
- Family member colors are permanent (`src/data/club/family-colors.ts`) and never come from the month: event bars,
  month-grid dots, avatars and chips use the member's own color (avatars as a soft wash of it).
- Only existing approved definitions are used: one color per month in `src/theme.ts`, its lightest derived step for
  tiles and its contrast-checked accent for labels and progress. No new palettes. (The owner's January list also named
  Pale Evergreen and Soft Leaf Green; in `src/theme.ts` those are December's and May's colors, so each shows in its own
  month.)
- Contrast, checked for all twelve months: accent on its tile ≥ 5.3:1, body text ≥ 7.0:1, soft text ≥ 5.3:1 (month
  tiles use a slightly darker soft gray, `#5f5754`). Brand sage text `#4c6648` on sage 5.2:1. The wordmark's green is
  now `#536b4e` (5.8:1; it was 3.9:1).

## Audit of the UI before (2026-11-18)

| Screen | Before | Kept | Changed |
| --- | --- | --- | --- |
| Navigation | Unicode glyph tabs; a phone column with a bottom bar on desktop | The four destinations, profile control, QR pages' own tabs | Line icons; tabs move to the header at 1024 px and wider, Club pages included |
| Today | Stacked square panels; data behind "→" links; a family card with no data | Every data source (calendar occurrences, week ahead, agreements, cleaning checkmarks, Club access rule) | A two-column dashboard: today's plans (or what's next), today's reset with icon and progress, this week's Family Meeting preparation (plans, new or changed, nobody handling), everyone's part with avatars, this month's Club plan when entitled |
| Calendar | Week only, plain controls | Week as the default and approved layout; events, recurrence, sharing, sync, conflicts, the event sheet | Week · Month · Agenda (other views of the same events, the choice remembered on the device), family color legend, event cards in the member's color, Add event, styled sheet |
| Cleaning | The companion's print-style layout | Routines, zones, checklists, progress ring and week dots, shared progress, the zone icons (`public/icons/zones/`, untouched), onboarding, the QR pages exactly as before | `/app/cleaning` only (`TodayApp variant="app"`): this week's rhythm (Mon–Sun zones with their icons, today marked, finished days checked), today's reset as a tile, each checklist as a tile, cleaning preferences link |
| Family | Meeting card plus two link cards; members only in Account | The meeting guide, responsibilities page, Club pages | Family Meeting tile with the four parts, the family with avatars and ages, who does what (agreements), sharing with the other grown-up (real state), the Club tile when entitled |
| Account | Square panels and text links | Sign-in, sign out everywhere, the delete-account flow and its refusal while a membership can be charged, billing only on the website, household sharing | Grouped: Household, Membership, Sign-in, Settings; avatars; real buttons (sign out, delete in a quiet danger style) |

**Not built, though in the mockups** (they don't exist in the product; CLAUDE.md: never show roadmap features): a
"Premium/Plus" membership, Notifications, Calendar Sync, Family Permissions, Security & Password, Shared Routines,
Cleaning's "All Tasks" tab and a family chores checklist.

**Unchanged on purpose:** the Club's monthly pages, kits, printables, previews and downloads (`/app/club/…`,
`/club/…`); the cleaning icon artwork; the printed calendar's QR pages (`/app/calendar…`), apart from the app
background's warm ivory and the wordmark's darker green; the database, billing and URLs.

## Verified

- Every screen at 393 px and 1280 px with the demo family (plans added through the real calendar sheet, cleaning tasks
  checked through the real checklist), compared with the mockups.
- axe (WCAG 2.1 AA) on Today, Calendar (Week, Month, Agenda), Cleaning, Family and Account: 0 violations; no tap
  target under 44 × 44 px.
- The two-phone family e2e (107 checks) on the website build and on the app bundle; unit tests; the app-shell smoke
  test; website/app parity screenshots.
