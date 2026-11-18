# Calendar subscriptions: security review

Date: 2026-11-18. Scope:
- migration `20261205000000_calendar_feeds.sql`;
- the `calendar-feeds` Edge Function (`supabase/functions/calendar-feeds/`, `_shared/handlers/calendar-feeds.ts`, `_shared/calendar/ics.ts`);
- the app client (`src/lib/calendar/feeds.ts`, `CalendarSources.tsx`).

Reviewer: Claude, on branch `claude/calendar-integration`. Nothing here is deployed.

**Result: no open high or medium findings.** The review found and fixed eight issues before release (§2). One residual risk is accepted and explained in §3.

## 1. Verified requirements

| Requirement | How it's enforced | Evidence |
| --- | --- | --- |
| **Private calendar URLs never reach other household members** | Tables have RLS on and no grants to `anon`/`authenticated`; all reads go through security-definer RPCs. `calendar_feed_json` returns `url` and `last_error` only when `owner_user_id = auth.uid()`. The other adult gets name, color and events only. | SQL suite: "never its URL". e2e: "Sam never gets Jen's calendar link", "listed for Sam by name only". |
| **…nor client responses** | The function's responses carry only `{id, result, count, error}`. Errors are fixed sentences, never the URL. `calendar_feed_claim` (the only function returning URLs) is service-role only. | Unit: the Refresh response doesn't contain the host. verify.sql: refresher functions are service-role only. |
| **…nor device storage** | The app never stores links on the device. The local copy keeps feeds with `url: null`, and the panel never displays a link after it's added. | e2e: "the device copy never holds a calendar link". |
| **…nor logs** | The function has no `console.*` calls and never logs a URL. Fetch errors are caught and replaced with fixed messages. Supabase request logs record the function path, not POST bodies. PostgREST passes RPC arguments as bind parameters, which Postgres doesn't log on error by default. | Code review of the handler and entry point. |
| **Credentials** | iCal needs none beyond the link itself; links containing `user:password@` are refused. `CALENDAR_CRON_SECRET` lives only in function secrets and Vault, never in the repository, chat or logs. The service-role key stays inside the function. | Unit: credential links refused. ROLLOUT.md steps. |
| **SSRF: URL** | Only `http`/`https` (`webcal` → `https`). Refused when added: localhost, RFC 1918, link-local, `.local`/`.internal` names. When fetched, `privateHost` blocks all of the following: loopback, 0/8, 10/8, 172.16/12, 192.168/16, 169.254/16 (cloud metadata), 100.64/10, documentation and benchmark ranges, multicast/reserved, IPv6 loopback/ULA/link-local/mapped, `localhost`, `*.local`, `*.internal`, `*.home.arpa`, `metadata.google.internal`. Numeric tricks (`2130706433`, `0x7f.1`, `127.1`) are normalized by the URL parser before the check. | Unit: privateHost table, numeric tricks. SQL suite: private networks refused. |
| **SSRF: DNS resolution** | Every host name is resolved (A + AAAA) before each request, and *any* private answer blocks it. Unresolvable names are never fetched (fail closed). The entry point uses `Deno.resolveDns`, falling back to DNS over HTTPS (Cloudflare) if the runtime lacks it. | Unit: private A/AAAA answers, NXDOMAIN. **Real Deno:** `10.0.0.1.sslip.io` (→ 10.0.0.1) refused without a request. |
| **SSRF: redirects** | `redirect: 'manual'`, at most 3 hops, and every hop re-runs the URL and DNS checks. | Unit: redirect to 127.0.0.1 and to a name resolving to 192.168.0.10 are both stopped after one request. |
| **Response limits** | 15 s timeout, 5 MB cap (streamed and cut off), a body cut off mid-download is refused (`END:VCALENDAR` required), and expansion is capped at 5,000 instances. | Unit: incomplete calendar is an error. |
| **Household isolation** | Every RPC scopes to `household_id_for(auth.uid())`. `member_id` must belong to the caller's household. Imported events carry the feed's household. An adult who leaves stops seeing, sharing and refreshing their feeds there, and re-adding the link in a new household moves it, private, without the old events. | SQL suite: "another family sees nothing", "another family's member is refused", leave/move. e2e: Rosa sees none of the Parks' calendars. |
| **Scheduled refresh needs authorization** | `mode: "due"` requires `x-calendar-cron` equal to `CALENDAR_CRON_SECRET`, compared in constant time. A missing secret on the server means always 401. Manual refresh requires a valid Supabase session, and the feed must be the caller's own (enforced in SQL). The function is deployed with `verify_jwt = false` because it checks both itself. | Unit: wrong, missing, prefix-of and null secret → 401; other adult's feed → 404. e2e: wrong secret → 401. |
| **Abuse of Refresh** | A second Refresh within 30 s answers from storage without fetching, and Retry only restarts a disconnected calendar, so it can't bypass that. There are at most 20 calendars per adult per household. | SQL suite and e2e: double tap not fetched. |
| **Disconnect / remove never touch family events** | Imported events live in their own tables, and the family's `calendar_events` is never read or written by any calendar-feed function. Remove deletes the feed and its events (cascade); rollback drops only the two new tables. | SQL suite: family event byte-identical after everything. e2e: create/edit after imports; rollback keeps Dentist and Piano. Rollout rehearsal: existing functions and rows identical. |
| **A failed refresh never destroys good data** | Errors (5xx, timeout, not a calendar, too big, incomplete, DNS) keep the last good events. A dead link (401/403/404/410) keeps them through two failures in a row and disconnects only on the third (≈18 h of backoff, or three manual Refreshes). A calendar that suddenly comes back empty is distrusted twice the same way. A good refresh replaces events atomically in one transaction. | SQL suite: empty-hiccup, two gone kept, third disconnects. e2e: same with a real fixture going 404, then Refresh reconnects. |
| **Content injection** | Titles and locations are stored as text, length-capped (120/160) and rendered by React or `textContent`, so no HTML is interpreted. Descriptions and attachments are never stored. | Code review. |

## 2. Found and fixed during this review

1. **DNS-based SSRF.** Host names resolving to private addresses (e.g. `10.0.0.1.sslip.io`) passed the name check. Fixed: resolution check on every hop, failing closed.
2. **Disconnecting on one 403/404 wiped events.** Some servers return these briefly. Fixed: three consecutive failures are needed.
3. **An empty or truncated download could replace a whole calendar.** Fixed: an `END:VCALENDAR` check, plus the empty-twice rule.
4. **No throttle on Refresh.** Fixed: 30-second guard, and Retry can't bypass it.
5. **Feeds of an adult who changed households** kept being refreshed and blocked re-adding the link. Fixed: they're no longer claimed, and re-adding moves them.
6. **The cron secret was compared with `!==`.** Fixed: constant-time compare.
7. **The device copy held private links.** Fixed: links are stripped before caching.
8. **After a backend rollback the device copy could keep showing imports.** Fixed: the app clears them when the functions are gone.

## 3. Accepted residual risk

- **DNS rebinding (time-of-check vs time-of-use).** A hostile DNS server could answer "public" to our check and "private" to the fetch a moment later. Deno's `fetch` can't pin the checked IP.
  - Impact is limited. This is blind SSRF: GET only, no custom headers or body, and responses are never returned. Only text that parses as iCal is stored, as event titles in the attacker's own household. Supabase Edge Functions run on Supabase's isolated edge network, not inside the database network.
  - Revisit if Supabase exposes a resolve-then-connect API, or if the fetch is moved behind an egress proxy.
- **Links are stored in plain text** in `calendar_feeds.url`, readable by the service role and the project owner, like every other table. Encrypting them with Vault/pgsodium is possible later. The privacy policy should say links are stored to refresh the calendar.

## 4. Not in scope (and why)

- **Google OAuth tokens.** That's the next phase; tokens will need encrypted storage and revocation on removal.
- **Writing to external calendars.** The integration is read-only by design.
