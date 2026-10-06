# Organized Mom

Companion web app for the Organized Mom Collective family wall calendar. People scan the QR code on the calendar and land on **Today**: a small daily reset plus one area to focus on.

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
| Colors and fonts | `src/styles/global.css` (`@theme`) |
| Pages (`/`, `/tidy`, `/reorder`, `/settings`) | `src/pages/` |
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
