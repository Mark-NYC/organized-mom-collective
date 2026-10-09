# Organized Mom

Companion web app for the Organized Mom Collective family wall calendar. People scan the QR code on the calendar (`/start`) and land in the app on **Today**: a small daily reset plus one area to focus on.

Astro + TypeScript + Tailwind CSS v4, with React islands only where there's state. No backend, no accounts — progress is saved in the browser's `localStorage`.

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
```

`dist/` is a fully static site — deploy it to Netlify, Vercel, Cloudflare Pages, GitHub Pages, etc.

## Where things live

| What | Where |
| --- | --- |
| **Cleaning tasks** (daily essentials, Mon–Thu focus, weekend copy, 12-month rotation) | `src/data/cleaning.ts` |
| **Reorder: prices, editions (dates once confirmed), Etsy listing URLs** | `src/config.ts` → `CALENDAR_OPTIONS` (a button stays disabled until its `etsyUrl` is a real `etsy.com/listing/…` URL; update `editions` each new calendar year) |
| Reorder photos | `public/images/reorder/`, resized 640/960/1280 from `design/etsy-listing/` 11 (hero), 02 (features), 05 (calendar + app). All 12 Etsy listing images live in `design/etsy-listing/`. Not precached, so the offline install stays small. |
| Logo (badge, favicon, app icons) | `public/brand/`, `public/favicon.ico`, `public/icons/` (original in `design/logo/`) |
| Zone icons (daily, Mon–Thu rooms, weekend) | `public/icons/zones/*.png` (originals in `design/zone-icons/`), assigned in `src/data/cleaning.ts` |
| **Month colors** (canonical, from the printed calendar) | `src/theme.ts` |
| Print palette (white, charcoal, rules) and fonts | `src/styles/global.css` (`@theme`) |
| All internal URLs | `src/routes.ts` |
| Where `/start` (the QR) sends people | `src/config.ts` → `START_DESTINATION` |
| App pages (`/app`, `/app/week`, `/app/reorder`, `/app/settings`; `/app/tidy` redirects to `/app/week`) | `src/pages/app/` |
| Public pages (`/` — temporary placeholder) | `src/pages/index.astro` |
| **Resource library** (`/resources`: hub, pillar pages, articles) | `src/pages/resources/`, articles in `src/content/articles/`. Editorial system and code map: `CLAUDE.md` and `docs/editorial/` |
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
| Public site | `/` (temporary placeholder), `/resources`, `/resources/<slug>`, `/resources/topics/<pillar>`, `/sitemap.xml`. Later: `/calendar`, `/cleaning` | indexable, canonical URLs (no trailing slash); the hub stays noindex until it has articles |
| QR entry | `/start` — **permanent**, printed on every calendar as `https://organizedmomcollective.com/start` | noindex |
| Companion app | `/app` (Today), `/app/week`, `/app/reorder`, `/app/settings`. `/app/tidy` is the old name for Week and redirects there, keeping `#monthly-focus` | `noindex, follow` |
| Accounts (not built) | e.g. `/login`, `/account` | — |

- **`/start` never changes.** It redirects instantly (no history entry) to `START_DESTINATION` (currently `/app?source=calendar`). If your host supports server redirects, a 302 from `/start` to the same destination is equivalent.
- **QR traffic:** `?source=calendar` is recorded for the browser session (`getEntrySource()` in `src/lib/storage.ts`) and removed from the address bar. Hook analytics in there later.
- **Offline:** on its first install the service worker saves every app page, script, font and icon, so the app opens and works offline after one visit. The file list and cache version are written into `dist/sw.js` at build time by `offline-precache.mjs`; each deploy gets a fresh cache and the old one is removed. Pages are network-first (falling back to the saved copy after 4 s on a weak signal); hashed `/_astro/` files and icons come from the saved copy.
- **Add to Home Screen:** after a checkmark (never during onboarding), phones in a browser get a small dismissible card (`src/components/InstallInvite.tsx`). Android browsers that support it get a real Install button; iPhone gets Share → Add to Home Screen steps. Closing it stores `omc:v1:install-invite = dismissed`; the steps stay in Settings. Not shown on desktop, in the installed app, or when the browser isn't saving.
- **iPhone Home Screen storage:** iOS gives the installed app its own storage, separate from Safari. Safari leaves a copy of progress in Cache Storage (`omc-handoff`), which iOS shares, and the installed app imports it on first launch if it has nothing saved yet (never overwrites). Best effort — verify on a real iPhone before relying on it.
- **PWA:** the manifest's `start_url` and `scope` are `/app`, and the service worker is registered only from app pages with scope `/app`, so the installed app always opens the companion — never the marketing site.
- **Future accounts / paid features:** the UI reads and writes progress only through `src/lib/storage.ts`, which sits on a small backend interface (localStorage today). Progress is anonymous and keyed by stable task ids and dates, so it can be uploaded into an account later. No user, entitlement or premium logic exists yet — add it as its own layer when needed rather than inside components.
