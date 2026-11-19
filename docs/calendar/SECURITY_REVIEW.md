# Calendar subscriptions: security review

Date: 2026-11-18, updated 2026-11-19 (DNS rebinding closed, links encrypted in Vault, staged-rollout flag). Scope:
- migration `20261205000000_calendar_feeds.sql`;
- the `calendar-feeds` Edge Function (`supabase/functions/calendar-feeds/`, `_shared/handlers/calendar-feeds.ts`, `_shared/calendar/ics.ts`, `_shared/calendar/pinned-http.ts`);
- the app client (`src/lib/calendar/feeds.ts`, `CalendarSources.tsx`).

Reviewer: Claude, on branch `claude/calendar-integration`. Nothing here is deployed.

**Result: no open high or medium findings, and no accepted residual risk left from the first review.** Eleven issues were found and fixed before release (§2). The two risks the first review had accepted are now closed (§3). What remains is listed honestly in §4.

## 1. Verified requirements

| Requirement | How it's enforced | Evidence |
| --- | --- | --- |
| **Private calendar URLs are stored encrypted** | The link is stored with `vault.create_secret` (Supabase Vault, authenticated encryption). `calendar_feeds` keeps only the Vault id, a SHA-256 of the link (to spot the same link twice) and the host name. There is no link column. A trigger deletes the Vault entry whenever a subscription is deleted, by Remove, account deletion or household deletion. The app roles can't read Vault (verified on production). | SQL suite: link in Vault, nowhere in the table; deleted on Remove and on account deletion. e2e: "stored encrypted in Vault". Production preflight: `authenticated`/`anon` have no Vault access. Rollout rehearsal: rollback leaves no links in Vault. |
| **…and never reach other household members** | Tables have RLS on and no grants to `anon`/`authenticated`; all reads go through security-definer RPCs. No RPC returns the link to anyone, owner included: the owner sees the host name only (`url_host`), and the other adult sees name, color and events. | SQL suite: no response contains the token or `https:`. e2e: "Sam never gets Jen's calendar link (or even its host)", "even Jen gets only the host". |
| **…nor client responses** | The function's responses carry only `{id, result, count, error}`. Errors are fixed sentences, never the URL. Links are decrypted in exactly one place, `calendar_feed_claim`, for the refresher (service role only). | Unit: the Refresh response doesn't contain the host. verify.sql: refresher functions are service-role only. |
| **…nor device storage** | The app never receives links, and its device copy drops even the host name. | e2e: "the device copy never holds a calendar link". |
| **…nor logs** | The function has no `console.*` calls and never logs a URL. Fetch errors are caught and replaced with fixed messages. Supabase request logs record the function path, not POST bodies. PostgREST passes RPC arguments as bind parameters, which Postgres doesn't log on error by default. | Code review of the handler and entry point. |
| **Credentials** | iCal needs none beyond the link itself; links containing `user:password@` are refused. `CALENDAR_CRON_SECRET` lives only in function secrets and Vault, never in the repository, chat or logs. The service-role key stays inside the function. | Unit: credential links refused. ROLLOUT.md steps. |
| **SSRF: URL** | Only `http`/`https` (`webcal` → `https`). Refused when added: localhost, RFC 1918, link-local, `.local`/`.internal` names. When fetched, `privateHost` blocks all of the following: loopback, 0/8, 10/8, 172.16/12, 192.168/16, 169.254/16 (cloud metadata), 100.64/10, documentation and benchmark ranges, multicast/reserved, IPv6 loopback/ULA/link-local/mapped, `localhost`, `*.local`, `*.internal`, `*.home.arpa`, `metadata.google.internal`. Numeric tricks (`2130706433`, `0x7f.1`, `127.1`) are normalized by the URL parser before the check. | Unit: privateHost table, numeric tricks. SQL suite: private networks refused. |
| **SSRF: DNS resolution** | Every host name is resolved (A + AAAA) before each request, and *any* private answer blocks it. Unresolvable names are never fetched (fail closed). The entry point uses `Deno.resolveDns`, falling back to DNS over HTTPS (Cloudflare) if the runtime lacks it. | Unit: private A/AAAA answers, NXDOMAIN. **Supabase Edge Runtime (v1.69.6, user worker with hosted CPU/memory limits):** `10.0.0.1.sslip.io` (→ 10.0.0.1) and `169.254.169.254` refused; Deno's resolver used. |
| **SSRF: DNS rebinding** | The request goes to **the exact address that passed the check**. The function opens a socket to that IP (`Deno.connect`), runs TLS over it with the real host name (`Deno.startTls`, so the certificate is verified for that name), and speaks HTTP/1.1 itself (`pinned-http.ts`). A second, different DNS answer is never asked for, so it can't be used. | Unit: a resolver that answers public, then private, is asked once and the public IP is used; `fetch` is never called. **Edge Runtime:** Google's public calendar fetched over the pinned socket (33 events). With a test CA, a certificate for `good.test` is accepted and `evil.test` refused (`NotValidForName`) over the same pinned socket. |
| **SSRF: redirects** | `redirect: 'manual'`, at most 3 hops, and every hop re-runs the URL and DNS checks. | Unit: redirect to 127.0.0.1 and to a name resolving to 192.168.0.10 are both stopped after one request. |
| **Response limits** | 15 s timeout, 5 MB cap (streamed and cut off), a body cut off mid-download is refused (`END:VCALENDAR` required), and expansion is capped at 5,000 instances. | Unit: incomplete calendar is an error. |
| **Household isolation** | Every RPC scopes to `household_id_for(auth.uid())`. `member_id` must belong to the caller's household. Imported events carry the feed's household. An adult who leaves stops seeing, sharing and refreshing their feeds there, and re-adding the link in a new household moves it, private, without the old events. | SQL suite: "another family sees nothing", "another family's member is refused", leave/move. e2e: Rosa sees none of the Parks' calendars. |
| **Scheduled refresh needs authorization** | `mode: "due"` requires `x-calendar-cron` equal to `CALENDAR_CRON_SECRET`, compared in constant time. A missing secret on the server means always 401. Manual refresh requires a valid Supabase session, and the feed must be the caller's own (enforced in SQL). The function is deployed with `verify_jwt = false` because it checks both itself. | Unit: wrong, missing, prefix-of and null secret → 401; other adult's feed → 404. e2e: wrong secret → 401. |
| **Staged rollout** | Server-enforced. Every adult RPC checks `calendar_feeds_enabled(uid)`: on only for households with a tester (`calendar_feed_testers`), or for everyone once `calendar_feed_rollout.everyone` is set. The refresher skips feeds of households that aren't switched on. Adults can't read or change the flag. Remove still works when switched off, so families can always delete their data. | SQL suite: off by default, a tester's household (both adults) on, others refused, switching off stops refreshes. e2e: no Calendars entry before; another household refused. |
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
9. **DNS rebinding** (accepted in the first review). Fixed: pinned connections (§1, "SSRF: DNS rebinding").
10. **Links in plain text** (accepted in the first review). Fixed: Supabase Vault, plus host-only responses even to the owner.
11. **Response-parsing risks of a hand-written HTTP client.** Covered:
    - header injection is stripped (CR/LF), and `Host` can't be overridden;
    - Content-Length, chunked and read-to-close bodies are all supported;
    - gzip/deflate are inflated under the same 5 MB cap, so a small download that inflates hugely is refused;
    - truncated or non-HTTP answers are refused.

    All of this has unit tests.

## 3. Previously accepted risks, now closed

- **DNS rebinding:** closed by pinned connections, verified on Supabase's Edge Runtime.
- **Plain-text links:** closed by Supabase Vault, verified on production (Vault installed; the migration owner can store and delete, the app roles can't read).

## 4. What remains (low)

- **Vault encryption key.** Vault's key is managed by Supabase, outside the database. Anyone with the project's service-role key, or owner access to the dashboard SQL editor, can still read `vault.decrypted_secrets`, just as they could read any customer data. Protect those credentials as before.
- **The host name is stored in plain text** (e.g. `calendar.google.com`), to show the owner which calendar it is. It contains no token.
- **First production run.** The pinned connection and Deno's resolver are proven on Supabase's open-source Edge Runtime (v1.69.6). The hosted platform runs the same runtime, but the rollout's self-test step (ROLLOUT.md) proves it on production before any family uses it. If it fails, nothing is fetched (fail closed).

## 5. Not in scope (and why)

- **Google OAuth tokens.** That's the next phase; tokens will need encrypted storage and revocation on removal.
- **Writing to external calendars.** The integration is read-only by design.
