# Organized Mom

Companion web app for the Organized Mom Collective family wall calendar. People scan the QR code on the calendar (`/start`) and land in the app on **Today**: a small daily reset plus one area to focus on.

Astro + TypeScript + Tailwind CSS v4, with React islands only where there's state. No backend, no accounts — progress is saved in the browser's `localStorage`. The exceptions use Supabase: the customer survey (`/survey`, see `supabase/README.md`) and the direct website shop (`/checkout`, `/admin/orders`, built but switched off; see `supabase/SHOP.md`).

## Install / run / build

Requires Node 22.12+.

```sh
npm install
npm run dev       # http://localhost:4321
npm run build     # type-check + static build into dist/
npm run preview   # serve the production build
npm test          # unit tests (schedule + storage logic)
npm run check:site  # after a build: links, SEO metadata, tracker sync; regenerates the content inventory
npm run verify    # build + check:site + tests
npm run test:shop # shop end-to-end tests on a throwaway local Postgres + PostgREST (see supabase/SHOP.md)
npm run build:functions # rebuild the paste-ready Edge Function files in supabase/dashboard/ after editing supabase/functions/
```

`dist/` is a fully static site — deploy it to Netlify, Vercel, Cloudflare Pages, GitHub Pages, etc.

## Where things live

| What | Where |
| --- | --- |
| **Cleaning tasks** (daily essentials, Mon–Thu focus, weekend copy, 12-month rotation) | `src/data/cleaning.ts` |
| **Reorder: prices, editions (dates once confirmed), Etsy listing URLs** | `src/config.ts` → `CALENDAR_OPTIONS` (a button stays disabled until its `etsyUrl` is a real `etsy.com/listing/…` URL; update `editions` each new calendar year) |
| Reorder photos | `public/images/reorder/`, resized 640/960/1280 from `design/etsy-listing/` 11 (hero), 02-transparent (features; transparent background, so its frame has no fill or border), 05 (calendar + app). All 12 Etsy listing images live in `design/etsy-listing/`. Not precached, so the offline install stays small. |
| Public site photos | `public/images/site/`: `family-kitchen` (listing 03, cropped above its caption), `calendar-on-wall` (01), `calendar-specs` (07), `calendar-sets` (08), each 640/960/1280; `og-calendar.jpg` (11, cropped to 1200 × 630, the default share image). `calendar-cutout` (480/720/960, transparent webp): the homepage hero's flat calendar page, cut out of its white backdrop with the drop shadow kept as transparency; original in `design/hero/calendar-flat-original.webp`. Recreate it from a new flat image rather than editing the cutout. `app-today` / `app-week` (390/780) are real screenshots of the built app at 390 × 844 with sample checkmarks — retake them when those screens change. `app-today-<mon…sun>` (390/780) are the same Today screen once per weekday with the date line blanked; the homepage hero (`src/components/site/LiveTodayPhone.astro`) shows today's one and writes the visitor's date over the blank. Retake them, and `src/data/app-today-shot.json`, with `scripts/capture-app-today.mjs` (instructions at its top). Public pages also reuse `public/images/reorder/`. |
| Logo (badge, favicon, app icons) | `public/brand/`, `public/favicon.ico`, `public/icons/` (original in `design/logo/`) |
| Zone icons (daily, Mon–Thu rooms, weekend) | `public/icons/zones/*.png` (originals in `design/zone-icons/`), assigned in `src/data/cleaning.ts` |
| **Month colors** (canonical, from the printed calendar) | `src/theme.ts` |
| Print palette (white, charcoal, rules) and fonts | `src/styles/global.css` (`@theme`) |
| All internal URLs | `src/routes.ts` |
| Where `/start` (the QR) sends people | `src/config.ts` → `START_DESTINATION` |
| App pages (`/app`, `/app/week`, `/app/reorder`, `/app/settings`; `/app/tidy` redirects to `/app/week`) | `src/pages/app/` |
| Public pages: homepage, calendar product page, companion explainer, 404 | `src/pages/index.astro`, `src/pages/calendar.astro`, `src/pages/companion.astro`, `src/pages/404.astro` |
| **Homepage** (`/`): "Family System" positioning, copy supplied word for word | `src/pages/index.astro`. Only the calendar and the cleaning companion exist today, so every planned app feature (shared calendar, Sunday Setup, meals, to-dos) carries a `.status-soon` "Coming soon" tag (`.status` in `global.css`) and every CTA goes to `/calendar`. Remove a tag only when that feature ships. |
| Public header / footer (never shown in the app) | `src/components/resources/SiteHeader.astro`, `SiteFooter.astro` |
| Public-page pieces: calendar options, Shop button, phone frame | `src/components/site/` |
| "Shop" buttons | `ShopButton` goes straight to the Etsy listing (best value first) once an `etsyUrl` is set; until then to `/calendar#buy` |
| Etsy reviews and shop stats (homepage hero line + reviews section, quote by `/calendar#buy`) | `src/data/reviews.ts`. Verified feedback on earlier calendar editions only: always labeled that way, never in Product structured data |
| **Customer survey** (`/survey`, noindex) and results (`/survey/admin`, admins only) | Questions and answer ids: `src/data/survey.ts`. UI: `src/components/survey/`. Supabase calls, stats, CSV: `src/lib/survey.ts`. Database, security and setup: `supabase/README.md`. Needs `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` at build time (`.env.example`). |
| **Resource library** (`/resources`: hub, pillar pages, articles) | `src/pages/resources/`, articles in `src/content/articles/`. Editorial system and code map: `CLAUDE.md` and `docs/editorial/` |
| **Direct shop** (`/checkout`, `/checkout/complete`, `/admin/orders`; off until launch) | UI: `src/components/shop/`, `src/pages/checkout/`, `src/pages/admin/`. Browser logic: `src/lib/shop.ts`. Server: `supabase/functions/` (Edge Functions), `supabase/migrations/*_shop.sql`. Setup, testing, launch steps: `supabase/SHOP.md`. Build vars `PUBLIC_SHOP_ENABLED`, `PUBLIC_STRIPE_PUBLISHABLE_KEY` (`.env.example`). Buy buttons still go to Etsy. |
| Layouts: public (indexable) vs app (noindex) | `src/layouts/PublicLayout.astro`, `src/layouts/AppLayout.astro` |
| UI components | `src/components/` |
| Date / schedule / storage logic | `src/lib/` |
| PWA manifest, icons, service worker | `public/` |

### Editing tasks

Each task has a stable `id` that's used to remember its checkbox. Reword a label freely; if you replace a task with something different, give it a new `id`.

### How progress is stored

All keys are prefixed `omc:v1:` (see `src/lib/storage.ts`):

- Daily essentials and Mon–Thu focus → keyed by date, so they start fresh every day.
- Monthly deep-clean tasks → keyed by month, so progress carries across that month's weekends.
- "Catch up instead" → keyed by its own date, like a weekday zone. (Before Oct 2026 it was keyed by the weekend's Friday; those entries now show on Friday only.)
- `active:YYYY-MM-DD` → the monthly project ticks made that date (e.g. `["monthly:2026-10:oct-shoes"]`), so the shared project counts as activity on the day it was done and nowhere else. Unticking removes it. The old value `"1"` still counts.
- A day is active (its dot on Today, its row on Week) when anything is checked under that day's own keys: Daily Reset, zone, catch-up, or a monthly tick credited to it. Week shows "✓ Done" only for a finished Mon–Thu zone; any other work that day shows "Active".
- Day-scoped entries are kept for about a year (`KEEP_DAYS` = 366, the life of a 52-week calendar; ~90 KB at most), then pruned. Monthly entries are never pruned.
- If the browser won't save (private browsing, storage full or blocked), checkmarks are kept in memory for that visit and Today shows a short note that they won't be remembered. Nothing crashes and nothing claims to be saved.
- `/app?day=monday` (linked from the Week page) shows that weekday of the current Mon–Sun week. Its checkmarks save under that day's own date, so today's progress is never touched.

## Brand notes

- **Fonts:** Montserrat for everything in the companion website; Georgia Pro (Black Italic) only for the month name and year, as on the printed calendar. The public resource library (`/resources`) also uses Georgia for article titles and section headings (see `docs/editorial/BLOG_EDITORIAL_STYLE.md`). Georgia Pro is a licensed Monotype font and isn't bundled — devices that have it use it, everything else falls back to Georgia. If you buy a web license, add an `@font-face` in `src/styles/global.css`.
- **Color:** the app is white / `#545454` charcoal / ruled lines. The current month's color (from `src/theme.ts`) is the only accent: month header, today's cleaning tag, selected states.
- **Zone labels** match the printed calendar exactly: Living Room, Bedrooms, Entry/Bathroom, Kitchen Reset; Friday Deep Cleaning, Saturday Home Project, Sunday Catch-Up / Reset.

## URL architecture

| Area | Routes | Indexing |
| --- | --- | --- |
| Public site | `/` (homepage), `/calendar` (product page, buy on Etsy), `/companion` (how the cleaning companion works; "Get Started" in the header), `/resources`, `/resources/<slug>`, `/resources/topics/<pillar>`, `/sitemap.xml` | indexable, canonical URLs (no trailing slash); the hub stays noindex until it has articles; the 404 is noindex |
| Survey | `/survey` (shared by link), `/survey/admin` (results, sign-in required) | noindex, not in the sitemap |
| Shop (off until launch) | `/checkout`, `/checkout/complete`, `/admin/orders` (sign-in required) | noindex, not in the sitemap, not linked |
| QR entry | `/start` — **permanent**, printed on every calendar as `https://organizedmomcollective.com/start` | noindex |
| Companion app | `/app` (Today), `/app/week`, `/app/reorder`, `/app/settings`. `/app/tidy` is the old name for Week and redirects there, keeping `#monthly-focus` | `noindex, follow` |
| Accounts (not built) | e.g. `/login`, `/account` | — |

- **`/start` never changes.** It redirects instantly (no history entry) to `START_DESTINATION` (currently `/app?source=calendar`). If your host supports server redirects, a 302 from `/start` to the same destination is equivalent.
- **QR traffic:** `?source=calendar` is recorded for the browser session (`getEntrySource()` in `src/lib/storage.ts`) and removed from the address bar. Hook analytics in there later.
- **Offline:** on its first install the service worker saves every app page, script, font and icon, so the app opens and works offline after one visit. The file list and cache version are written into `dist/sw.js` at build time by `offline-precache.mjs`; each deploy gets a fresh cache and the old one is removed. Pages are network-first (falling back to the saved copy after 4 s on a weak signal); hashed `/_astro/` files and icons come from the saved copy.
- **Add to Home Screen:** after a checkmark (never during onboarding), phones in a browser get a small dismissible card (`src/components/InstallInvite.tsx`). Android browsers that support it get a real Install button; iPhone gets Share → Add to Home Screen steps. Closing it stores `omc:v1:install-invite = dismissed`; the steps stay in Settings. Not shown on desktop, in the installed app, or when the browser isn't saving.
- **iPhone Home Screen storage:** iOS gives the installed app its own storage, separate from Safari. Safari leaves a copy of progress in Cache Storage (`omc-handoff`), which iOS shares, and the installed app imports it on first launch if it has nothing saved yet (never overwrites). Best effort — verify on a real iPhone before relying on it.
- **PWA:** the manifest's `start_url` and `scope` are `/app`, and the service worker is registered only from app pages with scope `/app`, so the installed app always opens the companion — never the marketing site. Public pages have their own layout (`PublicLayout`): no manifest link, no service worker, no app navigation. The app never shows the public header, footer or sales elements beyond its own Reorder page.
- **Future accounts / paid features:** the UI reads and writes progress only through `src/lib/storage.ts`, which sits on a small backend interface (localStorage today). Progress is anonymous and keyed by stable task ids and dates, so it can be uploaded into an account later. No user, entitlement or premium logic exists yet — add it as its own layer when needed rather than inside components.
