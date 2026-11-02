# Companion access

- The permanent printed QR `/start` opens `/app/calendar?source=calendar`.
- `/app/calendar`, `/week`, `/settings`, and `/reorder` share existing cleaning content and progress keys. Their server-rendered navigation contains only Today, Week, Calendar, Settings. Reorders go to Etsy. There is no Club/account navigation or membership request in this copy.
- The calendar copy has a separate install manifest and offline fallback. It remains usable without login or local storage.
- The Club shell (`/app`) defaults to Home, Club, Account. Cleaning cards/preferences/navigation start hidden, including while purchase verification runs.
- Opening the calendar companion records access on that device. A signed-in account can also reveal cleaning through a real, non-refunded calendar order. Club membership alone does not grant cleaning.
- The QR is shared on printed products, so calendar access is a device-level presentation layer, not cryptographic proof of purchase. It grants no paid Club access. Existing server-side Club authorization remains authoritative.
- On a different device, Etsy calendar owners can scan the QR again; their access is not inferred from a Club subscription. Old cleaning bookmarks without calendar access return to the Club shell.
