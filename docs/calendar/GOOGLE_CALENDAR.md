# Connect Google Calendar

Status (2026-11-19): **built and tested on branch `claude/google-calendar-connect` (PR open). Nothing deployed; migration 20261206 not applied; no Google credentials exist yet.** iCal links (20261205, live in production for the test household) are unchanged and remain the secondary option.

The standard: a mom taps **Connect Google Calendar**, approves read-only access on Google's own screen, ticks her calendars, and she's done.

## 1. Audit: what was reused, what was built

| Area | Reused as-is | Built |
| --- | --- | --- |
| Data | `calendar_feeds` / `calendar_feed_events` (privacy, whose calendar, store rules, dedupe by UID + original start), the test-household flag | `calendar_google_accounts` (refresh token in **Vault**), `calendar_google_oauth_states` (one-time, hashed), `calendar_feeds.kind = 'google'` (+ account and calendar ids), a **separate Google switch** (`calendar_feed_testers.google`, `calendar_feed_rollout.google_everyone`) |
| Server | The `calendar-feeds` refresher: claim → fetch → store, backoff, budget, double-tap guard, self-test | A Google branch in the refresher (one token refresh per account per run); a new `calendar-google` function (connect, callback, calendar list, disconnect) |
| App | Calendars panel, Week/Month/Agenda/Today/Meeting views, read-only sheet, device copy | Primary **Connect Google Calendar** button, connected accounts (Reconnect, Disconnect), the calendar picker, the return pages |
| Tests | Test backend, family e2e, SQL harness, rehearsals | Mock Google, 49-check e2e (website + app bundle), 44-check SQL suite, 16 unit tests, 20261206 rehearsal |

Nothing about iCal links changed for families: same panel (now "Add a calendar by link (school, sports, iCal)"), same storage, same refresher path. The iCal e2e (56 checks) still passes on both builds.

## 2. The experience

1. **Calendar → Calendars → Connect Google Calendar.** It's the first, primary button, with the Google "G". Below it: "Read-only: we can see your events, never change them."
2. **Google's own screen** (in the same tab on the website; in Safari's sheet in the iPhone app, because Google forbids its sign-in inside an app's web view). She picks her account and allows read-only calendar access.
3. **Back in the app, the picker opens** with her calendars, main one first, each in its Google color, with a checkbox. For each ticked calendar:
   - **whose calendar** it is (a family member or the whole family), which sets the family color;
   - **Only me** (default) or **Our household**.
4. **Show N calendars.** Their events appear in Week, Month, Agenda, Today, and (shared ones only) the weekly Family Meeting. The events are read-only.
5. **More accounts:** "Connect another account". Each account shows up in Calendars with "Choose calendars" and "Disconnect". If Google stops accepting an account, it shows "Reconnect".
6. **Add a calendar by link** stays as the secondary option for school, sports and other iCal calendars.

Messages:
- She cancels on Google's screen: "You didn't connect Google. Nothing changed."
- She unticks a permission: "allow both calendar permissions…"
- An attempt expires: "Tap Connect again."
- A calendar is deleted in Google: the picker says it's gone.

## 3. Security design

- **OAuth 2.0 authorization code flow with PKCE (S256)**:
  - `access_type=offline`, `prompt=consent select_account`, `include_granted_scopes=false`;
  - a one-time `state` of 32 random bytes; only its SHA-256 is stored, valid 10 minutes, bound to the adult who pressed Connect, and taken once;
  - the code is exchanged server-side with the client secret and the server-held PKCE verifier.
- **Scopes (minimum):** `calendar.calendarlist.readonly` (to list her calendars) and `calendar.events.readonly` (to read events, including calendars shared with her), plus `openid email` (which account it is). There is no write, delete or share scope. If she unticks either calendar scope on Google's screen, the grant is refused **and revoked at once**.
- **Account binding:** the account is identified by the id_token's `sub` (audience and issuer checked; the token comes directly from Google's token endpoint). Reconnecting the same Google account updates it, with no duplicate. Several Google accounts per adult are supported (up to 5).
- **Tokens:**
  - the refresh token is stored with `vault.create_secret` (encrypted at rest); the table holds only the Vault id;
  - access tokens are never stored, only obtained in memory by the functions;
  - no token is ever sent to the app, put in a URL, kept in browser storage, or logged (e2e-checked on storage, page, URLs and responses);
  - a trigger deletes the Vault entry whenever an account is deleted (Disconnect, account deletion, household deletion).
- **Redirect handling:**
  - Google returns to `/app/google-callback/` **on our own domain**, which Google's verification requires. That page removes the code from the address bar and history at once, sets `Referrer-Policy: no-referrer`, and hands code and state to the function by POST.
  - The function sends her only to allowlisted origins (`www.` and the apex), with no open redirect, and puts only `google=<result>` and an account id in the URL.
  - Any failure lands her back in the app with a plain message, never an error page.
- **Disconnect:** the token is revoked at Google (`oauth2.googleapis.com/revoke`), then the account, token, calendars and imported events are deleted. If Google can't be reached, everything is still deleted locally and she's told access will lapse.
- **Privacy rules are unchanged:** Google calendars are private by default, the other adult sees only shared ones (never her accounts or emails), other households see nothing, and family events are never touched. All of this is enforced in SQL and tested.
- **Staged rollout, server-enforced:** Google is offered only to households with a Google tester, on top of the calendar test-household flag. Turning it off stops refreshes immediately.

## 4. Syncing

- **The same refresher and schedule as iCal:**
  - every calendar is due every 3 hours (6 h, 12 h, then 24 h when failing); calendars come due at different times because each is timed from its own last refresh;
  - one token refresh per Google account per run;
  - `events.list` with `singleEvents=true` (Google expands recurrences and applies time zones), `showDeleted=false`, a window of 30 days back to 365 ahead, up to 4 pages of 2,500.
- **Shared event model:**
  - events are keyed by **iCalUID + original start time**, the same key iCal links use, so a moved occurrence keeps its identity and the same event via Google and via an iCal link shows once;
  - all-day end dates are converted from Google's exclusive end;
  - cancelled occurrences are skipped;
  - untitled (private) events show "Busy".
- **Unchanged calendars aren't rewritten** (content hash).
- **Failures:**
  - **Token revoked or expired** (`invalid_grant`): the account goes to Reconnect, its calendars keep their events and aren't refreshed meanwhile. Reconnecting refreshes them at once.
  - **Calendar deleted or unshared** (404/410/403): same three-strikes rule as iCal before its events are removed.
  - **Rate limits** (403 rateLimitExceeded/usageLimits, 429): backoff.
- **Quota:** Google allows 10,000 requests a minute per project and 600 a minute per user. A family with 3 calendars uses about 4 requests every 3 hours, far below that. A Testing-mode refresh token expires after 7 days (see §6); that shows as Reconnect.

## 5. Google Cloud Console: what you configure (exact settings)

Use the Google account that should own the app; it's best to use a Google Workspace or business account. Never paste the client secret in chat.

1. **Create a project.** Go to <https://console.cloud.google.com/projectcreate> and set the name to `Organized Family`.
2. **Enable the Google Calendar API.** Go to <https://console.cloud.google.com/apis/library/calendar-json.googleapis.com> (with the project selected) and click **Enable**.
3. **Google Auth Platform → Get started:** <https://console.cloud.google.com/auth/overview>
   - App name: `Organized Family`
   - User support email: your support address
   - Audience: **External**
   - Contact email: your address
4. **Branding:** <https://console.cloud.google.com/auth/branding>
   - App logo: the Organized Family icon (120×120 PNG)
   - App home page: `https://www.organizedmomcollective.com`
   - Privacy policy: `https://www.organizedmomcollective.com/privacy` (add the calendar section from §7 first)
   - Authorized domains: `organizedmomcollective.com`
5. **Data access → Add or remove scopes:** <https://console.cloud.google.com/auth/scopes>. Add exactly these:
   - `.../auth/calendar.calendarlist.readonly`
   - `.../auth/calendar.events.readonly`
   - `openid`
   - `.../auth/userinfo.email`

   **Do not** add `calendar`, `calendar.readonly`, `calendar.events`, or any other scope. Note what badge the Console shows next to each scope (sensitive or restricted); §6 depends on it.
6. **Audience → Test users:** <https://console.cloud.google.com/auth/audience>. Add your test account's Gmail address, plus up to 100 others, while the app is in **Testing**.
7. **Clients → Create client:** <https://console.cloud.google.com/auth/clients/create>
   - Application type: **Web application**; name: `Organized Family web`
   - Authorized JavaScript origins: none needed
   - Authorized redirect URIs: `https://www.organizedmomcollective.com/app/google-callback/` (exactly, with the trailing slash)
   - Create, then copy the **Client ID** and **Client secret** (shown once; download the JSON if offered).
8. **Domain ownership:** <https://search.google.com/search-console>. Verify `organizedmomcollective.com` with the same Google account (DNS TXT record at your DNS host, Cloudflare). Verification requires it.
9. **Supabase function secrets:** <https://supabase.com/dashboard/project/uvqhmlqwmgnohhduttip/functions/secrets>. Add:
   - `CALENDAR_GOOGLE_CLIENT_ID` = the Client ID
   - `CALENDAR_GOOGLE_CLIENT_SECRET` = the Client secret
   - optional `CALENDAR_GOOGLE_REDIRECT_URI` = `https://www.organizedmomcollective.com/app/google-callback/` (this is already the default)

   These names are new and don't touch any existing Google or Supabase credential.
10. Tell Claude "Google client configured". Claude never needs to see the values.

## 6. Scopes, verification and security assessment

| Scope | Why | Expected classification |
| --- | --- | --- |
| `calendar.calendarlist.readonly` | List her calendars (names, colors, time zones) | Sensitive (Google's verification guide lists Calendar as a sensitive-scope API; confirm with the Console badge) |
| `calendar.events.readonly` | Read events, including shared calendars | Sensitive (same) |
| `openid`, `email` | Which Google account it is | Non-sensitive |

- **Security assessment (CASA):** Google requires the annual third-party security assessment only for **restricted** scopes ("applications requesting access to restricted scopes must undergo an annual security assessment", support.google.com/cloud/answer/13465431). Gmail and Drive scopes are typically the restricted ones. **Calendar read-only scopes are not restricted, so CASA should not apply.** Confirm by checking that the Console shows no "restricted" badge in step 5.
- **Sensitive-scope verification is required** before public launch (support.google.com/cloud/answer/13464321). It needs:
  - **Brand verification:** a homepage on a verified domain, the privacy policy linked from the homepage and the consent screen, and domain ownership in Search Console.
  - **Use case:** "read-only display of the family's own calendars inside the family calendar".
  - **Narrowest-scope justification:** why `calendar.events.readonly` and not `calendar.events.owned.readonly`: families need calendars shared with them, such as school and team calendars.
  - **Limited-use data handling statement:** see §7.
  - **Demo video (YouTube, unlisted):** the consent screen with exactly these scopes, connecting, picking calendars, events appearing, Disconnect.
- **Until verified:**
  - In **Testing**, only listed test users (up to 100) can connect, and their **refresh tokens expire after 7 days**. They see Reconnect weekly; that's expected during the test stage.
  - If the app is published without verification, users see Google's "unverified app" screen, and it's limited to 100 new users.
  - Plan **2–6 weeks** for verification.

## 7. Privacy policy addition (draft for your approval; not published)

> **Connected calendars.** If you connect a Google Calendar, we receive read-only access to the list of your calendars and the events on the calendars you choose. We store the event titles, times and locations for the coming year so they appear in your family calendar, and nothing else. We never change, delete or share your Google events, never use them for advertising, and never let people read them except as needed for security or to comply with law. Calendars you keep private are visible only to you; calendars you share are visible to the other adult in your household. You can disconnect at any time in Calendars, which deletes the stored events and revokes our access, or remove access at myaccount.google.com/permissions. Our use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.

## 8. Staged rollout (each stage needs your explicit go)

**Production today:**
- migration 20261205 is applied;
- `calendar-feeds` v3 is deployed;
- 1 iCal test household;
- no refresh schedule;
- no Google anything.

| Stage | What | Pass when |
| --- | --- | --- |
| A. Owner setup | §5 steps 1–10 (Testing mode, your test Gmail as a test user) | You say "Google client configured" |
| B. Preflight + backup | `supabase/rollout/calendar-google/preflight.sql` (read-only) and a fresh verified backup | All ok; backup VERIFIED |
| C. Deploy the refresher first | Redeploy `calendar-feeds` from this branch. It works with today's database, and **must go before the migration** (the old v3 would treat Google calendars as broken links) | Self-test: pinned, public calendar ok, refusals ok |
| D. Apply migration 20261206 | Only this migration | `verify.sql` all ok; preflight snapshot identical (family data, iCal subscription, 12 functions) |
| E. Deploy `calendar-google` | `verify_jwt = false` (Google's redirect carries no session) | POST without sign-in → 401; forged callback → back to the app with "expired" |
| F. Switch on Google for your test household | `update public.calendar_feed_testers set google = true where user_id = (select id from auth.users where email = '<test email>');` | Only that household sees Connect Google Calendar |
| G. Test on the PR preview (no merge) | Connect, pick calendars, check events, Only me / Our household, a second account, Disconnect, Reconnect. In the iPhone app later, via TestFlight. | All work; the DB shows tokens only in Vault; other households unaffected |
| H. Release | Merge the PR (the website deploys); TestFlight build (approval); still test households only | Smoke test passes |
| I. Verification | Submit sensitive-scope verification (§6); publish the app "In production" when approved | Google approves |
| J. Everyone | `update public.calendar_feed_rollout set google_everyone = true where id;`. This **also needs** `everyone = true` for calendars, a separate decision. | 2 weeks of watching account statuses, refresh health, quota |

Scheduled refresh (`omc-calendar-feeds-refresh`) stays off until you approve it separately. Google calendars then refresh with it; until then, Refresh in Calendars and the import right after Connect keep them current.

## 9. Rollback (each layer on its own)

| Layer | Undo | Effect |
| --- | --- | --- |
| Test household | `update public.calendar_feed_testers set google = false where …` | Google hidden for them; nothing refreshed; data kept |
| Function | Delete `calendar-google` | No new connections; existing Google calendars keep their last events |
| Refresher | Redeploy `calendar-feeds` v3 **only after** rolling back the migration | — |
| Database | `supabase/rollout/calendar-google/rollback.sql` | Removes Google accounts, encrypted tokens, Google calendars and their events, and restores 20261205's two functions exactly. Rehearsed: schema identical, no tokens left, iCal kept. Tokens aren't revoked at Google by SQL; families can remove access at myaccount.google.com/permissions, or run Disconnect first. |
| Secrets | Delete `CALENDAR_GOOGLE_CLIENT_ID` and `CALENDAR_GOOGLE_CLIENT_SECRET`; delete the OAuth client in Google Cloud | Every grant stops working at once |

## 10. Tests

| Test | Result |
| --- | --- |
| `supabase/tests/calendar-google.sql` | 44 checks: switch, states (hashed, single-use, expiry, binding), Vault tokens, reconnect without duplicate, 2 accounts, selection and privacy, refresher claim (Google + iCal), Reconnect state, isolation, disconnect cleanup, account deletion, family events untouched |
| `tests/calendar-google.test.ts` | 16 unit tests: minimal read-only scopes, PKCE, state hashing, allowlisted redirects, replay/forged state, cancel, partial grant (revoked), wrong audience, relay POST, iPhone return page, calendar list (owner-only, no tokens), Reconnect, disconnect + revoke (also offline), event mapping, token cache, gone, rate limit, revoked, mixed Google + iCal run, failure → calm redirect |
| `scripts/e2e/calendar-google-e2e.mjs` (mock Google) | **49/49 on the website build and 49/49 on the app bundle.** Covers the whole flow through Google's screen and the relay page, the picker, two accounts, recurring, moved and cancelled events, all-day, time zones, the read-only sheet, no tokens anywhere in the app, forged and replayed callbacks, allowlist, cancel, partial grant, the other adult's privacy, another household, iCal beside Google, the scheduled refresh, revoked access → Reconnect → fixed, a deleted calendar, and disconnect + revoke |
| Rehearsal `scripts/rehearse-calendar-google-rollout.sh` | Preflight 8 ok → apply → verify 10 ok → snapshot identical → both suites → rollback (1,120 objects identical, no tokens, iCal kept) → re-apply |
| iPhone simulator (CI) | Seeded Google account (`scripts/e2e/google-seed.sql`): Google event on the calendar, the account in Calendars, Connect another account, Add by link |
| Supabase Edge Runtime v1.69.6 (local) | Both functions boot as restricted workers; iCal self-test still passes; `calendar-google` answers 401 without sign-in |
| Regressions | 1,287 unit tests; all household SQL suites; iCal e2e 56/56 on both builds; family e2e; app-shell smoke; household and calendar rollback rehearsals |

## 11. What still needs you, or Google

- **Google Cloud setup (§5)** and the Search Console domain check: only you can do these.
- **Privacy policy text (§7):** your approval, then publish before verification.
- **Real-Google confirmation:** the first connect in Stage G proves the parts a mock can't, namely PKCE acceptance on Google's web-client flow, the exact scope strings, and Safari's sheet in the iPhone app. If Google rejected PKCE for web clients, it's a one-line switch; the client secret and state already protect the flow.
- **Verification by Google (§6):** timing is up to Google.
