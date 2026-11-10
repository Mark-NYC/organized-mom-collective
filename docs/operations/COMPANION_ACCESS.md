# Companion access

- The permanent printed QR `/start` opens `/app/calendar?source=calendar`.
- `/app/calendar`, `/week`, `/settings`, and `/reorder` share existing cleaning content and progress keys. Their server-rendered navigation contains only Today, Week, Calendar, Settings. Reorders go to Etsy. There is no Club/account navigation or membership request in this copy.
- The calendar copy has a separate install manifest and offline fallback. It remains usable without login or local storage.
- The Club shell (`/app`) defaults to Home, Club, Account. Cleaning cards/preferences/navigation start hidden, including while purchase verification runs.
- Opening the calendar companion records access on that device. A signed-in account can also reveal cleaning through a real, non-refunded calendar order. Club membership alone does not grant cleaning.
- The QR is shared on printed products, so calendar access is a device-level presentation layer, not cryptographic proof of purchase. It grants no paid Club access. Existing server-side Club authorization remains authoritative.
- On a different device, Etsy calendar owners can scan the QR again; their access is not inferred from a Club subscription. Old cleaning bookmarks without calendar access return to the Club shell.


## Family-led calendar setup (November 10, 2026)

- The permanent printed QR `/start` remains unchanged and continues to redirect to `/app/calendar?source=calendar`. On a new device, the existing first-run onboarding opens automatically.
- The onboarding experience now begins with a **10-minute family meeting**: gather calendar and pens, allow every family member to choose a pen color, invite every person to add at least one activity or responsibility in their own color, then choose a visible shared place to hang the calendar. The cleaning companion comes last, as an optional practical daily rhythm. This is a participation-and-ownership exercise, not an app signup or a solo Mom task.
- Existing users can replay it at `/app/calendar?setup=1`, from Calendar Settings, and via the public `/companion` page. Explicit replay does **not** clear checklist progress, even in the installed PWA.
- The two live Calendar lifecycle email templates now link to `/app/calendar?setup=1` rather than the sales page, and reinforce family meeting and individually colored contributions. Resend template IDs unchanged, republished.
- No personal data or chosen color is collected by the walkthrough. Colors are on the printed paper, not app accounts.
- QA pending: verify public Cloudflare deployment and manually test fresh-QR first run, repeat-setup browser behavior, installed PWA replay, and iPhone narrow viewport. GitHub source changes alone are not proof of deployed site behavior.
