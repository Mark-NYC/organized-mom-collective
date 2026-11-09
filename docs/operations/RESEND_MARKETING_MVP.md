# Resend email marketing foundation, November 9, 2026

## Status
**Contact sync trigger deployed but Resend credential check failed (401); no marketing messages enabled.** The existing transactional delivery and Club mail remain unchanged.
This branch adds suppression persistence, verified Resend feedback ingestion, and an on-demand
consent-only contact importer. It does not create a scheduled email sender.

## Four paths
1. Resource signup, optional explicit opt-in: Day 2 tip; Day 6 tip. Then One Small Win.
2. One Small Win: twice-monthly helpful broadcast; one problem, one action, one link.
3. Club activation: existing transactional welcome/reminders remain; proposed Day 3 and Day 10 teaching emails after onboarding is finished.
4. Calendar purchase: existing receipt/shipping remain; teaching emails begin only after confirmed delivery, not based on purchase date.

No promotional follow-up without recorded consent. Suppress Club promotions to existing members.
One marketing email per recipient per day. No hard pitch on Day 8.

## Email copy backlog (not activated)
- Resource Day 2: "Try this before you change the whole routine" — pick one small responsibility; practice it together; link to a relevant guide.
- Resource Day 6: "A checklist can do the reminding" — replace one repeating verbal reminder with a visible cue; link to family responsibility system.
- One Small Win 01: "Stop reminding them to put their shoes away" — place shoes by the door, rehearse the arrival routine, one relevant free resource.
- One Small Win 02: "Five minutes before bedtime" — return toys, books and blankets to their spots; link to living room reset.
- Club Day 3: "One small way to get started" — choose one family problem to discuss together; link to member dashboard.
- Club Day 10: "Keep your family meeting short" — a recurring time, celebrate, choose one experiment; link to Family Meeting guide.
- Calendar follow-up after confirmed delivery: "Try this first with your family calendar" — choose shared activities and responsibilities.
- Calendar follow-up seven days later: "Make the schedule everyone's job" — review calendar together; optional Club link if consented and not a member.

## Deployment (not performed by this PR)
1. Review/merge PR. Apply `20261109000000_marketing_suppression.sql`.
2. Deploy `resend-marketing-webhook` and `resend-contact-sync`, both with JWT gateway verification disabled.
3. Set Supabase secrets: RESEND_WEBHOOK_SECRET, EMAIL_SYNC_SECRET; existing RESEND_API_KEY, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be available.
4. Add Resend webhook pointing to `/functions/v1/resend-marketing-webhook`, events `contact.updated`, `email.bounced`, `email.complained`. Configure the webhook signing secret.
5. Verify unsubscribe tests: existing opt-in -> Resend unsubscribe -> suppression row + opt-in false -> repeat free download with checkbox checked -> remains false.
6. Dry-run contact importer with a secret-authenticated POST and `{"offset":0,"limit":100,"dry_run":true}`. Run live with dry_run:false after consent/Resend settings checks. Run further offset pages until has_more is false.
7. Configure Resend marketing segment and broadcasts *after* approving copy, verifying unsubscribe footer and sender postal address. Never send via `/emails` endpoint to circumvent the free marketing/contact plan.
8. Add a scheduled sync/automation only after testing rate limits, webhook delivery and duplicate suppression.

## Technical safeguards
- DB trigger covers v1/v2 tool signups and Starter Kit (all write tool_email_contacts).
- Resend webhook validates raw body Svix HMAC and five-minute replay window.
- Resend contact sync does not change existing contacts' unsubscribe status.
- No automatic marketing sending; no database-driven reactivation after an unsubscribe.
- Do not import historical signups whose marketing checkbox was unchecked.

## Known next steps
- Track webhook event IDs for replay deduplication if processing grows beyond idempotent suppression.
- Add Club and Stripe buyer audience qualification in a separate migration and confirm marketing consent source.
- Build an email admin dashboard and scheduled Resend broadcasts after approval of copy and identity/permission checks.


## Automatic signup synchronization (2026-11-09)

**Deployed:** `supabase/migrations/20261109010000_marketing_signup_sync.sql` and `supabase/functions/resend-marketing-signup/index.ts` (active v2). This applies to every signup flow writing `tool_email_contacts`.

- A new opted-in row or an explicit transition from not-opted-in to opted-in enqueues a one-time token and asynchronously calls the Edge Function via `pg_net`. Non-opted-in signups are never queued. Repeated opted-in downloads do not enqueue duplicates.
- The Edge Function looks up the token using service-role credentials, rechecks the current consent and suppression table, and checks whether an existing Resend contact is unsubscribed. It never re-subscribes that contact.
- It creates missing global Resend contacts and adds eligible contacts to the existing `OMC | Free Resource Opt-Ins` segment through Resend's contacts/segments API. It does **not send email**. Result status and error code are recorded in `public.marketing_sync_jobs`, which is private and RLS-enabled.
- Existing transactional Resend credentials are preserved. The new function prefers a dedicated Supabase secret `RESEND_MARKETING_API_KEY`, falling back to `RESEND_API_KEY`. The dedicated key must have **full API access** to Resend's Contacts endpoints. A sending-only key is insufficient.

### Verified test and current blocker

A real existing opted-in contact was temporarily toggled off/on within one SQL transaction (ending in the original consent state). The trigger dispatched successfully; its Edge Function looked up the queued job and attempted Resend contact lookup. Resend returned `contact_lookup_401`. Thus **the complete end-to-end contact segment sync has NOT passed**. The likely cause is an outdated or sending-only `RESEND_API_KEY`, but the key's exact privileges are not readable through this connector.

Current baseline after the test: **3 opted-in contacts and 4 non-opted-in contacts**. One failed sync job exists; no marketing emails were sent.

### Required manual step

In [Resend API Keys](https://resend.com/api-keys), create a key named `OMC Marketing Contact Sync` with **Full access**; securely set it in [Supabase Edge Function Secrets](https://supabase.com/dashboard/project/uvqhmlqwmgnohhduttip/settings/functions) as `RESEND_MARKETING_API_KEY`. Do **not** rotate or replace `RESEND_API_KEY`, which may still be used for transactional email. Do not paste the key into chat or GitHub.

Then retry pending/failed job tokens from SQL using `net.http_post` (service-role/dashboard only):

```sql
select net.http_post(
  url := 'https://uvqhmlqwmgnohhduttip.supabase.co/functions/v1/resend-marketing-signup',
  body := jsonb_build_object('token', token),
  headers := '{"Content-Type":"application/json"}'::jsonb,
  timeout_milliseconds := 5000
)
from public.marketing_sync_jobs
where status = 'failed' and attempts < 5;
```

Confirm `status='synced'` and segment membership in Resend. Next test a new opted-in signup, a non-opt-in signup, a suppressed repeat signup, and a duplicate existing contact. Verify that unsubscribe from Resend still produces a permanent Supabase suppression row. No sending automation should be enabled until these tests pass and approved email compliance checks finish.

### Limitations before production scale

The HTTP event is async and best-effort; failed jobs require explicit retry. Add scheduled retries or a safe job-recovery worker before relying on this without monitoring. The old `resend-contact-sync` batch importer is separate and has not been qualified as a segment-aware recovery path. Do not use it for live backfills without updating/testing its segment handling and Resend credential permissions.


### Credential replacement and verification (2026-11-09, later test)

- Dedicated `RESEND_MARKETING_API_KEY` was set in Supabase by the owner. Replayed failed pg_net request ID 2.
- `public.marketing_sync_jobs` transitioned from `failed/contact_lookup_401` to **`synced`**, attempts 2, no error.
- Queried Resend segment `OMC | Free Resource Opt-Ins` (`7bf64eae-a8f7-4fb4-a18d-3578a2e1e557`): **3 contacts**, all not unsubscribed, matching the 3 consented Supabase records.
- Tested two non-opt-in/suppressed synthetic signups and one consented synthetic signup inside transactions that were rolled back. **PASS**: non-opt-in not queued, suppressed address remained blocked and not queued, consented address queued. No QA email addresses were retained and pg_net dispatches in rolled-back transactions are not delivered.
- No emails sent or scheduled. Old transactional `RESEND_API_KEY` unchanged.
- **Still outstanding before calling this fully hands-off:** add failed-job retries and monitoring, test an actual newly opted-in production signup from the website, confirm physical mailing address and live resource links, and configure send automation only after approval.


### Automatic retries installed and verified (2026-11-09)

- Applied `marketing_sync_retries_20261109` to production and committed the equivalent source as `supabase/migrations/20261109020000_marketing_sync_retries.sql`.
- Installed `pg_cron`. Job `omc-marketing-sync-retry` is **active** and runs every five minutes (`*/5 * * * *`).
- A private `marketing_private.retry_sync_jobs()` function re-dispatches stalled `pending` jobs after three minutes and `failed` jobs after a bounded delay. It caps both Edge Function attempts and dispatch attempts at five, handles no more than thirty jobs per cycle and uses `FOR UPDATE SKIP LOCKED` to avoid double-dispatch across overlapping jobs.
- Only contacts with a live opt-in and without a suppression are synced by the Edge Function. Failed dispatches never send a marketing email.
- Verified cron job existence, active schedule, and no changes to the previously synced contact. Ran a synthetic failed job test **inside a transaction rolled back**; confirmed a retry was enqueued and the dispatch count incremented with no QA record retained and no outbound network request committed.

#### Monitoring queries

Run in the [Supabase SQL Editor](https://supabase.com/dashboard/project/uvqhmlqwmgnohhduttip/sql/new) to see current health:

```sql
select status, count(*) as contacts, max(attempts) as max_worker_attempts,
       max(dispatch_attempts) as max_dispatch_attempts,
       min(queued_at) as oldest_queued_at
from public.marketing_sync_jobs
group by status order by status;

select email, status, attempts, dispatch_attempts, error_code, updated_at
from public.marketing_sync_jobs
where status in ('pending','failed') and queued_at < now() - interval '20 minutes'
order by queued_at limit 50;

select j.jobname, j.active, j.schedule, d.status, d.return_message, d.start_time
from cron.job j
left join lateral (
  select status, return_message, start_time
  from cron.job_run_details
  where jobid = j.jobid
  order by start_time desc limit 1
) d on true
where j.jobname = 'omc-marketing-sync-retry';
```

**Attention threshold:** Any `failed` or `pending` job older than twenty minutes needs investigation. A job that hits `attempts >= 5` or `dispatch_attempts >= 5` will stop retrying, by design. Check the error codes and credentials before manually re-enqueuing. **This phase provides scheduled recovery and inspectable failures, but not a push alert to the owner yet.**

No broadcasts or automated email sequences have been enabled. A real fresh opt-in from the public signup form is still needed for full end-to-end production acceptance.


### Repeat opt-in signup test, 2026-11-09

- With owner permission, called the same public `tool_email_signup_v2` RPC used by website tool flows for an **existing already-opted-in contact**. Returned `ok`.
- Post-check showed one existing contact record, original marketing consent still true, zero extra sync jobs for that contact, zero failed sync jobs. Resend confirmed the existing contact was still subscribed.
- This verifies the **RPC/business logic**, not that the public website form's browser code, network request, and confirmation UI all work. A fresh, never-before-seen opt-in through the actual public form remains untested.
- Did not send any marketing email. The two welcome-email drafts are available for review in `docs/operations/OMC_WELCOME_SEQUENCE_REVIEW_DRAFTS.md`; they are not in Resend or scheduled.
