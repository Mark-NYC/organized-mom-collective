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
```

`dist/` is a fully static site — deploy it to Netlify, Vercel, Cloudflare Pages, GitHub Pages, etc.

## Where things live

| What | Where |
| --- | --- |
| **Cleaning tasks** (daily essentials, Mon–Thu focus, weekend copy, 12-month rotation) | `src/data/cleaning.ts` |
| **Reorder URL** | `src/config.ts` → `REORDER_URL` |
| Logo (badge, favicon, app icons) | `public/brand/`, `public/favicon.ico`, `public/icons/` (original in `design/logo/`) |
| Zone icons (daily, Mon–Thu rooms, weekend) | `public/icons/zones/*.png` (originals in `design/zone-icons/`), assigned in `src/data/cleaning.ts` |
| **Month colors** (canonical, from the printed calendar) | `src/theme.ts` |
| Print palette (white, charcoal, rules) and fonts | `src/styles/global.css` (`@theme`) |
| All internal URLs | `src/routes.ts` |
| Where `/start` (the QR) sends people | `src/config.ts` → `START_DESTINATION` |
| App pages (`/app`, `/app/tidy`, `/app/reorder`, `/app/settings`) | `src/pages/app/` |
| Public pages (`/` — temporary placeholder) | `src/pages/index.astro` |
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
- "Catch up instead" → keyed by that weekend's Friday.
- Day-scoped entries older than 60 days are pruned automatically.
- `/app?day=monday` (linked from the Tidy week) shows that weekday of the current Mon–Sun week. Its checkmarks save under that day's own date, so today's progress is never touched.

## Brand notes

- **Fonts:** Montserrat for everything; Georgia Pro (Black Italic) only for the month name and year, as on the printed calendar. Georgia Pro is a licensed Monotype font and isn't bundled — devices that have it use it, everything else falls back to Georgia. If you buy a web license, add an `@font-face` in `src/styles/global.css`.
- **Color:** the app is white / `#545454` charcoal / ruled lines. The current month's color (from `src/theme.ts`) is the only accent: month header, today's cleaning tag, selected states.
- **Zone labels** match the printed calendar exactly: Living Room, Bedrooms, Entry/Bathroom, Kitchen Reset; Friday Deep Cleaning, Saturday Home Project, Sunday Catch-Up / Reset.

## URL architecture

| Area | Routes | Indexing |
| --- | --- | --- |
| Public site | `/` (temporary placeholder). Later: `/calendar`, `/cleaning`, `/blog/…` | indexable, canonical URLs |
| QR entry | `/start` — **permanent**, printed on every calendar as `https://organizedmomcollective.com/start` | noindex |
| Companion app | `/app`, `/app/tidy`, `/app/reorder`, `/app/settings` | `noindex, follow` |
| Accounts (not built) | e.g. `/login`, `/account` | — |

- **`/start` never changes.** It redirects instantly (no history entry) to `START_DESTINATION` (currently `/app?source=calendar`). If your host supports server redirects, a 302 from `/start` to the same destination is equivalent.
- **QR traffic:** `?source=calendar` is recorded for the browser session (`getEntrySource()` in `src/lib/storage.ts`) and removed from the address bar. Hook analytics in there later.
- **PWA:** the manifest's `start_url` and `scope` are `/app`, and the service worker is registered only from app pages with scope `/app`, so the installed app always opens the companion — never the marketing site.
- **Future accounts / paid features:** the UI reads and writes progress only through `src/lib/storage.ts`, which sits on a small backend interface (localStorage today). Progress is anonymous and keyed by stable task ids and dates, so it can be uploaded into an account later. No user, entitlement or premium logic exists yet — add it as its own layer when needed rather than inside components.
