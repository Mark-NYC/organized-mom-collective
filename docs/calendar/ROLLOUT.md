# Calendar subscriptions (iCal): staged production rollout

Approved 2026-11-18: a controlled rollout starting with the owner's test account. **Nothing below changes production until the owner explicitly authorizes that stage.** Google OAuth is a separate, later phase.

The rollout:
- adds migration `20261205000000_calendar_feeds.sql` only:
  - 4 new tables (subscriptions, imported events, the rollout flag, testers);
  - 12 functions;
  - 1 trigger;
- adds one Edge Function, `calendar-feeds`;
- uses one secret, `CALENDAR_CRON_SECRET`, in Function Secrets and Vault;
- schedules one job later.

It alters no existing table, row or function, and no billing, Club, subscription, order or family data. No other pending migration (20261202, 20261204) is applied.

## Stage A: prepared (done, no production change)

| Check | Result |
| --- | --- |
| Read-only production preflight (2026-11-19) | **12/12 ok.** Present:<br>• household migrations, the family calendar, `archived_at`, `gen_random_uuid`, `extensions.digest`;<br>• **Vault**: the migration owner can store, read and delete secrets; `authenticated`/`anon` can't.<br>Absent:<br>• no `calendar_feed*` table or function;<br>• migration not recorded;<br>• no calendar links in Vault;<br>• no refresh job. |
| Baseline snapshot (counts only) | 1 family event, 11 households, 11 adults, 23 family members, 11 Club subscriptions, 12 entitlements, 35 shop orders, 0 Vault secrets, latest migration `20261117184817`, plus md5 of the 6 existing calendar and household functions. Compared again after applying. |
| Runtime proof on Supabase Edge Runtime v1.69.6 (local, restricted user worker, 2 s CPU / 256 MB) | Self-test:<br>• pinned connection, `Deno.resolveDns` available;<br>• public Google calendar 33 events;<br>• private name and metadata address refused;<br>• no secret → 401; refresh without sign-in → 401.<br>Certificate check over the pinned socket: right name accepted, wrong name refused. |
| Rehearsals (CI) | Calendar rollout: preflight → apply → verify → use (49 checks) → rollback, with schema identical, no links left in Vault, family events kept → re-apply. Household rollback rehearsal includes 20261205. |
| Fresh verified backup | Requested with a `[db-backup]` push; see the PR for the run's VERIFIED result. Re-run right before Stage C if it's more than a day old. |

## Stage B: owner configuration (about 5 minutes, nothing in chat)

1. **Create the secret on your own computer.** In a terminal:

   ```bash
   openssl rand -hex 32
   ```

   This prints 64 characters. Keep that window open; don't save it in a file, email or chat.
2. **Edge Function secret.** Open <https://supabase.com/dashboard/project/uvqhmlqwmgnohhduttip/functions/secrets>, then Add secret → Name `CALENDAR_CRON_SECRET` → Value = the 64 characters → Save.
3. **Vault secret (same value).** Open <https://supabase.com/dashboard/project/uvqhmlqwmgnohhduttip/integrations/vault/secrets> (Dashboard → Integrations → Vault), then Add new secret → Name `calendar_cron_secret` → Secret = the same 64 characters → Description `calendar-feeds schedule` → Save.
   - Use the Vault page rather than the SQL editor, so the value doesn't end up in the editor's history.
4. Close the terminal window (or run `clear`).
5. Tell Claude two things:
   - "secret set";
   - **the email address of your test account** (the account whose household will see Calendars first). An email isn't a secret, but if you'd rather not paste it, sign in once on the preview site with that account and tell Claude which household name it has.

Claude can check that both secrets **exist** without reading them. Stage C step 6 proves they **match**, still without anyone seeing the value.

## Stage C: backend execution (needs "Execute Stage C")

| # | Step | Exactly | Pass when |
| --- | --- | --- | --- |
| 1 | Backup | Fresh `[db-backup]` run if the last VERIFIED one is older than a day | VERIFIED |
| 2 | Final preflight | `supabase/rollout/calendar/preflight.sql` (read-only) + the secret-existence check: `select count(*) from vault.secrets where name = 'calendar_cron_secret'` | 12/12 ok and `1`; snapshot equals Stage A |
| 3 | Apply the migration | `20261205000000_calendar_feeds.sql`, in one transaction, recorded as `calendar_feeds`. No other migration. | No error |
| 4 | Verify | `supabase/rollout/calendar/verify.sql` + the snapshot again | Every check ok:<br>• RLS on;<br>• no app access to the 4 tables;<br>• adult functions `authenticated`-only;<br>• refresher functions service-role only;<br>• no link column;<br>• Vault trigger present;<br>• rollout off, 0 testers.<br>Snapshot identical. |
| 5 | Deploy the function | `calendar-feeds` with `verify_jwt = false`; files: `calendar-feeds/index.ts`, `_shared/db.ts`, `_shared/handlers/calendar-feeds.ts`, `_shared/calendar/ics.ts`, `_shared/calendar/pinned-http.ts` | Deployed (`ACTIVE`) |
| 6 | Self-test on production (no family data) | The database calls the function with the secret from Vault: `select net.http_post(url := 'https://uvqhmlqwmgnohhduttip.supabase.co/functions/v1/calendar-feeds', body := '{"mode":"selftest"}'::jsonb, headers := jsonb_build_object('Content-Type','application/json','x-calendar-cron',(select decrypted_secret from vault.decrypted_secrets where name='calendar_cron_secret')))`, then read that request's row in `net._http_response` | HTTP 200 with `pinned: true`, `public_calendar.result: "ok"`, `private_name_refused: true`, `private_address_refused: true`. A 401 means the two secrets differ. |
| 7 | Auth checks | POST `{"mode":"due"}` without the header; POST `{"feed_id":…}` without sign-in | Both 401 |
| 8 | Switch on the test household | `insert into public.calendar_feed_testers (user_id, note) select id, 'owner test account' from auth.users where email = '<test account email>' returning user_id;` | 1 row; every other household still refused |

Stage C does **not** schedule refreshes and does **not** merge the PR.

## Stage D: test-account import in production (owner, ~10 minutes)

Use the PR's preview site. It runs this branch's code against production: <https://claude-calendar-integration.organized-mom-collective.pages.dev/app/family-calendar>. Only the test household sees Calendars; everyone else's calendar is unchanged.

1. Sign in with the test account on the preview site and open **Calendar**. A **Calendars** link appears under the title.
2. Add this public calendar:
   - link: `https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics`;
   - name "US holidays", whole family, "Our household".
   It should show "… events · updated just now", and the holidays appear in Week, Month and Agenda.
3. Optional, the real case: your own Google calendar's **Secret address in iCal format** (Google Calendar on a computer → Settings → the calendar → Integrate calendar). Set it to "Only me".
4. Tap **Refresh** on each. A second tap within 30 s says it's up to date without fetching.
5. Switch "US holidays" between "Only me" and "Our household". If the test household has a second adult, check what they see.
6. Open one imported event: it's read-only.
7. Remove the private calendar.

Claude then checks on production:
- subscriptions are `ok`;
- links are only in Vault and none appear in the subscription rows;
- the removed calendar's link is gone from Vault;
- other households are still refused;
- the Stage A snapshot is unchanged (family events, households, Club, orders).

## Stage E: scheduled refresh (needs "Execute Stage E", only after Stage D passes)

```sql
select cron.schedule('omc-calendar-feeds-refresh', '*/30 * * * *', $$
  select net.http_post(
    url := 'https://uvqhmlqwmgnohhduttip.supabase.co/functions/v1/calendar-feeds',
    body := '{"mode":"due"}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-calendar-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_cron_secret')),
    timeout_milliseconds := 120000);
$$);
```

Pass when, within 30 minutes:
- `cron.job_run_details` shows the job succeeded;
- its `net._http_response` row is HTTP 200 `{"refreshed":N}`.

## Stage F: release (needs approval for each)

1. **Merge PR #489.** The website deploys from `main`, and Calendars still shows only for the test household.
   - Then run the production smoke test.
   - The website keeps calling the companion a website; Calendars sits inside `/app` only.
2. **TestFlight verification.** Start a signed build (Actions → iPhone app: TestFlight → Run workflow; needs your approval). Then, on the test account on a phone:
   - Calendars, the imported events, the read-only sheet, offline;
   - after relaunch, everything is still there.
3. **Open to everyone** (separate go):
   - `update public.calendar_feed_rollout set everyone = true, updated_at = now() where id;`
   - Watch for 2 weeks: `calendar_feeds` status counts, cron run health, Edge Function invocations, database size.

## Rollback (each layer on its own)

| Layer | Undo | Effect |
| --- | --- | --- |
| Test household | `delete from public.calendar_feed_testers where user_id = …` | Calendars hidden again; nothing refreshed |
| Everyone | `update public.calendar_feed_rollout set everyone = false where id;` | Back to testers only |
| Schedule | `select cron.unschedule('omc-calendar-feeds-refresh');` | Refreshes stop |
| Function | Delete `calendar-feeds` in the dashboard | Refresh stops; stored imports still show |
| Database | `supabase/rollout/calendar/rollback.sql` | Deletes the calendar links from Vault, the subscriptions, imported events and flag tables (also unschedules). The app hides the feature and clears its device copies. Family calendar, households, Club and billing untouched (rehearsed: schema identical). |
| UI | Revert the merge | — |
| Secrets | Delete `CALENDAR_CRON_SECRET` and the Vault entry `calendar_cron_secret` | — |
