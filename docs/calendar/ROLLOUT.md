# Calendar subscriptions: production rollout

Status: **ready to roll out on the owner's go. Nothing below has been run on production** except the read-only preflight checks in §1.

The rollout:
- adds two new tables and ten functions (migration 20261205);
- adds one Edge Function and one function secret;
- schedules one job, every 30 minutes;
- ships the app UI (already merged code hides itself until the backend exists).

It changes no existing table, row, function, billing, Club or fulfillment code. Every step can be undone on its own.

Who does what:
- **Owner** creates and enters the secret (it never passes through chat or the repository) and gives the go for each gate.
- **Claude** runs the checks, applies the migration and deploys the function on that go, and reports.

## 1. Before (no changes to production)

| Check | Status |
| --- | --- |
| Read-only production preflight (2026-11-18) | **Passed.** `household_id_for`, `household_adults`, `calendar_events`, `club_family_members.archived_at` and `household_leave` exist. No `calendar_feed*` table or function exists, and the migration isn't recorded. `pg_cron`, `pg_net` and Vault are installed. Database 20 MB; 5 existing cron jobs. |
| Rehearsal on a copy (`scripts/rehearse-calendar-rollout.sh`, also in CI) | Passed. Covers preflight, apply, verify, full use (37 checks), rollback (schema identical, 1,060 objects compared), family data identical, and re-apply. |
| Household rollback rehearsal (CI) includes 20261205 | Passed |
| PR CI green, including the iPhone simulator | See the PR |
| Verified backup | Latest scheduled backup succeeded 2026-11-18 16:28 UTC. **Take a fresh one right before step 3** (below). |

## 2. Owner configuration (once, ~5 minutes, no secrets in chat)

1. **Create the secret on your own computer.** Copy the output; don't paste it anywhere but steps 2a and 2b.

   ```bash
   openssl rand -hex 32
   ```

2. Store the same value in two places:
   - a. **Function secret.** Supabase Dashboard → Project `uvqhmlqwmgnohhduttip` → Edge Functions → Secrets → Add: name `CALENDAR_CRON_SECRET`, value = the output.
   - b. **Vault, for the schedule.** Dashboard → Project Settings → Vault → Add new secret: name `calendar_cron_secret`, value = the same output.
3. Tell Claude "secret set". Nothing else is needed: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY` are provided to functions automatically.

No Google Cloud setup is needed for this release (Google sign-in is the next phase).

## 3. Rollout, in order (each gate needs the owner's go)

| # | Step | Command / action | Pass when |
| --- | --- | --- | --- |
| 0 | Fresh verified backup | Actions → *Database backup* → Run workflow (reason: "before 20261205") | The run ends **VERIFIED** (success) |
| 1 | Preflight again | `supabase/rollout/calendar/preflight.sql` (read-only); save the snapshot rows | Every check `ok = t` |
| 2 | Apply migration | Apply `20261205000000_calendar_feeds.sql` (one transaction) | No error |
| 3 | Verify | `supabase/rollout/calendar/verify.sql`, then the snapshot half of preflight.sql | Every check `ok = t`; snapshot identical to step 1 (family events, households, members, existing calendar functions) |
| 4 | Deploy the function | `supabase functions deploy calendar-feeds --no-verify-jwt` (or the MCP deploy with `verify_jwt: false`) | Deployed |
| 5 | Function smoke | POST `{"mode":"due"}` **without** the header → 401; POST `{"feed_id":"…"}` without sign-in → 401 | Both 401 (the auth checks are live; no secret needed for this) |
| 6 | Schedule the refresh | The SQL in §4 | `cron.job` lists `omc-calendar-feeds-refresh` |
| 7 | First scheduled run | Wait ≤ 30 min; check `cron.job_run_details` and `net._http_response` | Status succeeded, HTTP 200 `{"refreshed":0}` (no feeds yet); a 401 means the two secrets differ |
| 8 | Release the UI | Merge the PR (the website deploys from `main`) | Site deploy succeeds; the existing smoke test passes |
| 9 | Production smoke (owner's test account) | Add a public calendar, e.g. US holidays: `https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics` | Its events appear; "Only me" / "Our household" works on the second adult; Remove clears them. Family events untouched (preflight snapshot unchanged) |
| 10 | iPhone | TestFlight build (separate approval) | Simulator CI already green; same bundle |

The Supabase runtime check (does `Deno.resolveDns` work on Supabase, or does it fall back to DNS over HTTPS?) is covered by step 9. If neither resolver works there, every calendar shows "We couldn't find that calendar's website" and nothing is fetched (fail closed). Tell Claude and it will switch the resolver.

## 4. The schedule (run in the SQL editor at step 6)

The secret is read from Vault at run time; it isn't in this SQL.

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

## 5. Rollback (any time, each layer on its own)

| Layer | Undo | Effect |
| --- | --- | --- |
| UI | Revert the merge | The calendar returns to family events only |
| Schedule | `select cron.unschedule('omc-calendar-feeds-refresh');` | Refreshes stop; Refresh-now still works |
| Function | `supabase functions delete calendar-feeds` | Refresh stops; stored imports still show |
| Database | `supabase/rollout/calendar/rollback.sql` (also unschedules) | Subscriptions and imported events are deleted; the app hides the feature and clears its device copies. Family calendar, households, Club and billing are untouched (rehearsed: schema identical to before). Families would re-add their links. |
| Secret | Remove `CALENDAR_CRON_SECRET` and the Vault entry | — |

Restoring from the backup is only needed if something outside these tables were damaged, which the migration can't do (verify.sql and the snapshot prove it at step 3).

## 6. After release: what to watch (first 2 weeks)

- **Weekly:** `select status, count(*) from calendar_feeds group by 1`. Many `error` or `disconnected` rows point to a parsing gap; read the `last_error` sentences, never the links.
- **Run health:** `cron.job_run_details` for `omc-calendar-feeds-refresh` should show success every 30 minutes.
- **Usage:** Dashboard → Usage → Edge Function invocations (expect ≈1,500/month plus Refreshes) and database size.
