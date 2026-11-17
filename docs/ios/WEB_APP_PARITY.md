# Organized Family: the website and the iPhone app are one experience

Owner decision 2026-11-17: a family opening `organizedmomcollective.com/app` in Safari should recognize the same app
they open on their iPhone. The iPhone app is the source of truth.

## How they relate

One codebase. The iPhone app is the same Astro source built with `PUBLIC_APP_SHELL=ios` (`npm run build:app`,
`astro.app.config.mjs`); the website is `npm run build`. Every difference between them is a check on that flag, so
parity means removing those checks wherever the difference isn't a platform necessity. There is no second design or
implementation.

## Audit (2026-11-17, live website vs the app bundle, 12 screens at 393 px and 1280 px)

| Area | Before: website | Before: iPhone app | Now (both) |
| --- | --- | --- | --- |
| Main navigation | Today · Club · Account (Cleaning hidden unless unlocked); phones only, header links on desktop | Today · Calendar · Cleaning · Family at every width, Account behind the profile icon | The app's tabs and profile icon |
| Digital calendar | Same component and data, at `/app/family-calendar`, but not linked; signed-out "Sign in" went to the Club login | In the Calendar tab | Calendar tab; sign-in and family setup go to `/app/sign-in` and `/app/family/setup` on both |
| Today | Club card, family card; no calendar plans; cleaning only if unlocked | Today's plans from the family calendar and Family Meeting support, today's reset, Club card (households with the Club), family | The app's Today |
| Cleaning | Only after the printed calendar's QR scan or a website calendar order | Free (owner decision 2026-11-15) | Free everywhere (owner decision 2026-11-17); the app's shared cleaning progress (`CleaningParts`) on both |
| Family | Club card shown to everyone | Club card only for households with the Club | The app's rule (owner decision 2026-11-17) |
| Account | "Account & family", Club links, no sign-out or delete panel | Family, sharing, sign-in panel with sign out and delete account | The app's account |
| Club month pages | Signed out → Club dashboard | Signed out → `/app/sign-in` | `/app/sign-in` |
| Invitation (`/club/invite`) | No tab bar | Tab bar, but Cleaning missing (the tab waited for a script that page never loaded) | Tab bar with all four tabs on both |

## Differences kept on purpose

| Difference | Why |
| --- | --- |
| **Billing:** the website's Account and Club header link to Account & Billing (for the paying owner); a refused account deletion says "cancel it in Account & Billing first". The app never links to billing | Nothing is bought or managed in the app (docs/brand/OUR_WEEK.md) |
| The printed calendar's QR pages (`/app/calendar…`, website) keep their own tabs: Today · Week · Calendar (reorder) · Settings | Printed QR links and the reorder page stay as they are |
| Settings shows "Add to Home Screen" on the website | Safari needs it; the app is already installed |
| "Saved on this device" (website) vs "this phone" (app) | The website also runs on computers (`thisDevice()`, `src/lib/native/platform.ts`) |
| The Club's own website pages (`/club/login`, `/club/welcome`, `/club/dashboard`) keep their layout | The Club's checkout onboarding and billing live there |
| Native bridge, durable storage, safe areas, signing | iOS only |

## Verified

- **Rendered, side by side** (`scripts/parity-audit.mjs <website build> <out>`): 12 screens at 393 px and 1280 px,
  signed out: tabs, header, profile icon and headings identical on every screen; pixel-identical except Settings
  (the Add to Home Screen row).
- **Signed in, the whole family flow** (`scripts/e2e/family-e2e.mjs <build> <out> web|app`, isolated test backend,
  never production): 107 of 107 on the website build and 107 of 107 on the app bundle. Two phones: invitation and
  join, calendar events in each person's family color, shared editing and conflicts, agreements, shared cleaning,
  offline changes waiting and syncing, free versus Club family, account deletion refused while a membership can be
  charged, another household isolated. Its 16 screenshots are pixel-identical between the two builds except offline
  ("this device") and the Club account panel (Account & Billing on the website).
- **Recurring events**, both builds: a weekly Monday + Thursday event shows on both days this week and next, and
  survives a reload (signed out, saved on the device); the renders differ only by "this phone" / "this device".
- QR pages on the website still show their own four tabs (phone) and header links (desktop).
- Unit tests, the app-shell smoke test and the website build pass; `check:site` reports only the three Pinterest plan
  fields already open on `main`.
