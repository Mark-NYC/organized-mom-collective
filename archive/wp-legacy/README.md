# Legacy WordPress visual archive

Read-only snapshot of `members.organizedmomcollective.com` (WordPress) taken **before** the subdomain is rerouted to the new app.

## Run it

```bash
cd archive/wp-legacy
npm install
npx playwright install chromium      # skip in Claude cloud sessions (Chromium is preinstalled)

# Option A: log in yourself in a real browser window (best — handles 2FA / custom login pages)
node capture.mjs --manual-login

# Option B: credentials
WP_USER='you@example.com' WP_PASS='…' node capture.mjs
#   custom login page? add  --login-url=https://members.organizedmomcollective.com/login/

# Dry run: discover + classify + write the index, no screenshots
node capture.mjs --manual-login --discover-only
```

Use an account that can see **every** month, bundle and course. Pages that show a login or paywall screen are flagged ⚠️ in the index.

Output lands in `output/YYYY-MM-DD/`:

| Path | What |
|---|---|
| `archive-index.md` | Page name, URL, screenshot files, what's worth preserving, and downloads to keep live |
| `screenshots/NN-name-desktop.png` | 1440px full page |
| `screenshots/NN-name-mobile.png` | 390px (iPhone) full page @2x |
| `screenshots/NN-name-detail-XX.png` | Section close-ups @2x for priority and visually rich pages |
| `text/NN-name.md` | Page copy (headline, body text) — the IP |
| `html/NN-name.html` | Rendered HTML, for rebuilding layouts |
| `assets.csv` | Every PDF, ZIP, audio, video and `/wp-content/uploads` image, by page |
| `manifest.json` | Raw data: components found, outline, duplicates, skipped URLs |

### Options

| Flag / env | Default | |
|---|---|---|
| `--origins=` / `ARCHIVE_ORIGINS` | `https://members.organizedmomcollective.com` | Comma-separated. Add `https://organizedmomcollective.com` if offers live on the main domain. |
| `--urls=` / `ARCHIVE_EXTRA_URLS` | — | Extra URLs to force in (unlinked landing pages, drafts with preview links). |
| `--max-pages=` | 400 | Crawl cap. |
| `--depth=` | 4 | Link-crawl depth. |
| `--dup-threshold=` | 0.82 | Copy similarity above which a page counts as a duplicate. |
| `--storage-state=` | — | Reuse a saved Playwright session file. |

## What it does

1. **Finds every page**: WordPress sitemaps, the public WP REST API (catches landing pages that aren't linked or in a sitemap), and a link crawl from the homepage. This is how all landing pages get included.
2. **Skips plumbing**: cart, checkout, account, login, privacy, terms, and category/tag listings.
3. **Never loads anything that could change state**: logout, add-to-cart, nonce/`action=` links, cancel/delete links, and download-manager links. Those links are recorded in the index as assets but never opened. The tool only makes GET requests, apart from the login form submit.
4. **Sorts pages into the priority order**: members home, Tidy, June, other months, Family Table, resources, dashboard, Start Here, progress, audio, the five bundles, and the wall calendar. After those come every other landing page, then products.
5. **Drops duplicates**: a month whose copy (with month names and numbers removed) matches June ≥82% and has the same layout is listed but not screenshotted. Non-bundle product pages that share a layout (merch) keep one example. Every skipped page is listed in the index so a person can overrule it.
6. **Captures** desktop, mobile and close-up screenshots. Before capturing, it closes popups and cookie banners, scrolls to load lazy images, and freezes animations.

## Caveats

- Visiting lessons as a member *may* mark them as viewed in some LMS plugins. Use an admin or test member account if that matters.
- `html/` and `text/` contain members-only content. Keep this repo private, or leave `html/` out of git.
- The "worth preserving" notes come from what the tool detects on each page (outline, components, assets). Give them a human pass before you treat them as final.
