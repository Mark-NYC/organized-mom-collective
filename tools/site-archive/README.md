# Site archive (old WordPress)

Read-only archiver for `members.organizedmomcollective.com` and `organizedmomcollective.com`, built to snapshot the old WordPress member site before the subdomain is rerouted to this app.

```sh
cd tools/site-archive
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install   # locally: drop the env var, then `npx playwright install chromium`
OMC_COOKIE='wordpress_logged_in_…=…' node archive.mjs --download-uploads
```

Output goes to `../../site-archive/` (override with `--out`):

| File | What |
| --- | --- |
| `archive-index.md` | priority pages, login/paywall blocks, reroute-risk assets, duplicates, full page list |
| `assets.csv` | every PDF / image / audio / video / embed / download URL, with HEAD status and reroute risk |
| `pages.csv` | every page with access status, priority tags, duplicates |
| `pages/<host>/<slug>/` | `page.md`, `raw.html`, `rendered.html`, `meta.json`, `screenshots/` (desktop full, above fold, mobile full, close-ups) |
| `discovery/<host>/` | robots.txt, sitemaps, wp-json listings (pages, posts, media, products, course types) |
| `uploads/<host>/` | local copies of `/wp-content/uploads/` files (only with `--download-uploads`) |

## Safety

- The crawler only sends GET/HEAD. In the browser, every non-GET request is aborted, plus `admin-ajax.php`, `wp-cron.php`, heartbeat and progress/tracking REST calls.
- Logout, add-to-cart, cancel/delete, nonce/order-key and `download_file` URLs are listed in `assets.csv` and never requested.
- Cart, checkout, privacy, terms and generic account screens are skipped (listed at the end of the index).

## Auth

Member pages need a logged-in session. Options:

- `OMC_COOKIE` env var: the `Cookie` header from a logged-in browser on the members site (at minimum the `wordpress_logged_in_*` cookie).
- `--cookies cookies.txt`: Netscape cookie export.
- `--login --storage-state state.json`: opens a real browser to log in by hand (local runs only), then pass `--storage-state state.json` on the next run.

Use a member account that owns every product, not an admin: admins bypass paywalls, so the "blocked" flags would be meaningless.

Other flags: `--max-pages N` (default 400), `--concurrency N` (default 2), `--no-screens`.
