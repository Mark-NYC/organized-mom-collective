# Resend email marketing foundation, November 9, 2026

> **CURRENT STATUS | November 9, 2026. Read this before historical notes below.**
>
> - **Live:** Day 2 and Day 6 automated welcome for **new explicitly opted-in contacts**. Templates are published; real one-recipient tests were delivered; Supabase DB launch gate is enabled. The previous `WELCOME_DELIVERY_ENABLED` secret check was removed from the worker because the database claim controls eligibility. No historical backfill.
> - **Drafts only:** Sunday Family Reset (4 issues) and Wednesday One Small Win (8 usable issues). Neither broadcast series has been scheduled or sent. Cadence reflects the Clean Mama-informed decision to start with **two recurring value emails each week**, not three.
> - **Subscriber Access backend deployed:** RLS-protected per-subscriber access passes, Resend contact `RESOURCE_PASS` property, 15-minute sync cron and verification Edge Function. Three existing opted-in contacts synced successfully; valid/invalid verifier tests passed. `src/lib/tool-email.ts` and `src/layouts/PublicLayout.astro` now recognize the token on free resources. Site deployment and the end-to-end click-tracking/browser experience remain unverified.
> - **Do not launch broadcasts yet:** The current Free Resource Opt-Ins broadcast segment has not been separated from welcome-incomplete readers. Resend dashboard sends may bypass Supabase day reservations. Complete audience segmentation and a real personalized click-through test first.
> - For the editorial plan see [OMC_EMAIL_MARKETING_GAME_PLAN.md](./OMC_EMAIL_MARKETING_GAME_PLAN.md), [SUNDAY_FAMILY_RESET_LAUNCH_PLAN.md](./SUNDAY_FAMILY_RESET_LAUNCH_PLAN.md), and [SUBSCRIBER_RESOURCE_ACCESS.md](./SUBSCRIBER_RESOURCE_ACCESS.md).
>
> **History note:** Earlier sections below describe successive deployments and may say `sending off`, `draft templates`, or `no automation`. These are historical snapshots, not the current state above.


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

### Welcome scheduling staged, not active (2026-11-09)

- Applied migration `marketing_welcome_queue_hold_20261109`, source `supabase/migrations/20261109030000_marketing_welcome_queue_hold.sql`.
- New `public.marketing_welcome_queue` is private (RLS enabled, no anon/authenticated table permissions), with one row per address and step (Day 2 and Day 6).
- Net-new marketing opt-in enqueues two `held` records using first consent timestamp. Repeated downloads/opt-ins don't duplicate them. A switch from opt-in to no consent cancels pending steps.
- **No delivery worker, API sender, or automatic launch is installed.** Status defaults to `held`; no sending can happen from the new queue.
- Verified one synthetic opt-in generated exactly two held rows, repeat signup stayed at two, and opt-out cancelled both; all tests were rolled back.
- Post-check: **zero real queue rows**; three historical opted-in subscribers were not enrolled; no QA rows remain.
- Resend templates are still drafts: [Day 2](https://resend.com/templates/a70163c4-3c72-4cd8-9b89-17e089282af1) and [Day 6](https://resend.com/templates/105ee0e7-9078-4372-8ef3-4aa2cd3dedc2).
- Before enabling sends: approve template content, replace the postal-address placeholder, finish a real browser signup test with a genuinely new opted-in address, implement a gated delivery worker with idempotency, suppression/recheck and one-marketing-email-per-day, then perform controlled delivery acceptance tests.

### Welcome drip staging, 2026-11-09

- Added `public.marketing_welcome_queue` with a unique `(email, step)` key, RLS, restricted access, and two status-`held` entries for net-new explicit marketing opt-ins, due 2 and 6 days after recorded consent.
- Database trigger `marketing_welcome_signup` calls the private `marketing_private.stage_welcome_signup()` function. Existing subscribers and repeat downloads do not restart the sequence. Consent removal cancels held/ready/failed jobs, while the earlier permanent suppression guard continues to operate.
- Applied to the production Supabase project and versioned in `supabase/migrations/20261109030000_marketing_welcome_queue_hold.sql`.
- Verified within a rolled-back SQL transaction: 2 welcome jobs created, repeat signup stayed at 2, consent revocation cancelled both. After rollback: **0 welcome jobs**, **0 QA records**, **0 scheduled welcome sending jobs**.
- **Not yet implemented:** sending worker, template publishing, sender physical address, per-recipient daily send cap, scheduled send times, delivery reconciliation, site browser-level fresh-signup test, and coordination with One Small Win broadcasts. Do not flip statuses to ready or publish templates before the owner approves sending.


### Paused welcome delivery worker built and tested (2026-11-09)

**Deployed:** `supabase/functions/resend-welcome-delivery/index.ts` version 1. Migration files:
- `supabase/migrations/20261109040000_welcome_delivery_worker_guardrails.sql`: settings, daily send ledger, atomic claim/finish functions and cron every 5 minutes.
- `supabase/migrations/20261109050000_marketing_welcome_service_rpc.sql`: public-schema RPC wrappers callable **only by service_role**, with no execute access for anon/authenticated.
- `supabase/migrations/20261109060000_marketing_welcome_due_promotion.sql`: safe promotion of held jobs, cancellation of jobs over 14 days overdue or no longer consented; Day 6 only after Day 2 status = sent.

**Two independent send locks:** Supabase `marketing_delivery_settings` must have all `enabled`, `postal_address_verified`, and `broadcasts_coordinated` true, AND the Edge Function must have `WELCOME_DELIVERY_ENABLED=true`. Current database settings are all **false**. This is deliberately not a production send activation.

**Worker behavior:** Receives a 64-hex opaque dispatch token, no email address in the HTTP request. Uses an atomic service-only RPC to lock the queue and reserve the date in `marketing_send_ledger`, unique on `(email,local_day)` (America/New_York). Rechecks the live Supabase opt-in and suppression row and Resend contact's unsubscribe state. Requires its Resend template to be **published**. Sends via Resend `POST /emails` with a stable Idempotency-Key, then records Resend message ID. If a request may have been accepted but cannot be confirmed, sets `uncertain` and does not auto-resend. Resend idempotency keys only cover 24 hours; SQL ledger is permanent.

**Tests passed:**
- Disabled lock prevented claiming and dispatch.
- Day 6 could not precede a Day 2 sent confirmation.
- First claim succeeded while repeat claim failed.
- Second welcome step on same NYC calendar day was blocked by daily ledger.
- Held Day 2 entry was promoted and dispatched under simulated launch flags while Day 6 remained held.
- All stateful SQL tests ran in transactions subsequently **rolled back**, with zero QA records retained or HTTP dispatch committed.
- A real HTTP call to the deployed Edge Function returned `200 {"status":"disabled"}`.
- Final DB verification: **0 welcome jobs**, **0 ledger entries**, cron active, all launch settings false, anon/authenticated cannot call claim RPC, service_role can.

**Before a real email test / production launch:**
1. Replace the placeholder `[Physical mailing address required before publishing]` in both Resend templates with a valid postal mailing address; verify unsubscribe functionality and publish templates.
2. Coordinate One Small Win broadcasts with the welcome ledger. Currently, the ledger protects **welcome emails**, not the manually sent broadcast list. The third settings lock (`broadcasts_coordinated`) must remain false until this is solved.
3. Review use of the Resend email API for marketing-category lifecycle emails against Resend plan and contact suppression requirements.
4. Run a deliberately scoped test to the authorized test address after compliance and above conditions are complete, then review email delivery status in Resend.
5. Only after approval, explicitly set all three database flags true and the `WELCOME_DELIVERY_ENABLED` Edge Function secret to `true`. No launch switch was changed during this build.

**Important operational note:** Staged new opt-ins are **held** until launch. Do not manually mark queue entries as sent to bypass locks. Events with uncertain send outcomes require operator investigation before further sends.


### Postal footer verified (2026-11-09)

The owner supplied the mailing address for the marketing footer. Both draft Resend welcome templates (Day 2: `a70163c4-3c72-4cd8-9b89-17e089282af1`; Day 6: `105ee0e7-9078-4372-8ef3-4aa2cd3dedc2`) were updated with the address in both HTML and plain text. Retrieved both saved templates: footer present twice (HTML and text), unsubscribe placeholder preserved, no old placeholder, and both remain drafts. The `marketing_delivery_settings.postal_address_verified` flag was set true, while `enabled=false` and `broadcasts_coordinated=false` remain unchanged.

**Do not activate:** One Small Win overlap handling remains unverified. This DB address-verification flag only confirms footer presence, not legal assessment of postal-address use. No email sent.


### One Small Win / welcome overlap exclusions (2026-11-09)

The eight existing One Small Win broadcasts in Resend remain in **draft** status, with no scheduled or sent dates.

Applied to production and committed `supabase/migrations/20261109070000_marketing_broadcast_day_guard.sql`:

- **Provisional weekly newsletter day:** Wednesday in America/New_York is always reserved. Every welcome claim checks the date before reserving any recipient's daily send entry, and the five-minute dispatcher skips those dates.
- **Explicit exceptions:** `public.marketing_broadcast_calendar(local_day, broadcast_id, title, status)` is a private RLS-protected reservation table. `reserved`, `scheduled`, or `sent` dates block welcome emails on that date. `cancelled` dates do not. If a newsletter needs a different day, reserve that day **before scheduling or sending the Resend broadcast**.
- **Coordination limitation:** Resend's dashboard broadcasts are outside the database and can be sent manually on any date without inserting a calendar reservation. Thus the database cannot guarantee protection against an **unregistered off-cycle broadcast**. To claim stronger enforcement, route broadcast scheduling through an integrated sender/approval flow or require an operational process that records every broadcast date first. Keep `broadcasts_coordinated=false` until that process and end-to-end test are in place.
- If a newsletter is ever sent in a different segment or via a custom email API, it must also honor the same recipient/day ledger to uphold the broader one-message-per-day policy.

QA ran in a rolled-back transaction: the Wednesday check passed; an explicit reservation on the current local date returned `broadcast_day`; removing it allowed the initial claim; a repeated claim was rejected. All QA data was rolled back. No email was sent.

**Current planned next step:** Decide whether to maintain Wednesday broadcasts as a manual scheduling policy, or build a coordinated One Small Win sender. Then run the controlled end-to-end test to the approved test address after templates are published and sending is deliberately enabled under supervision. Do not enable welcome delivery on the strength of the calendar exclusion alone.


### Guarded newsletter scheduler integrated, not activated (2026-11-09)

Created and deployed `supabase/functions/resend-broadcast-scheduler/index.ts` (v2) and applied the versioned `supabase/migrations/20261109080000_marketing_broadcast_reservation_protocol.sql`.

- Scheduler requires the **service-role authorization header**, an existing approved One Small Win broadcast ID, matching marketing segment, draft status, and future timestamp. An additional `BROADCAST_SCHEDULING_ENABLED=true` environment flag is required for non-dry-run scheduling. It has **not been enabled**.
- A database reservation is written **before** invoking Resend's broadcast scheduling endpoint. The reservation blocks welcome emails on that NYC calendar date. If Resend is unavailable or scheduling is uncertain, the date remains blocked and a status/error is recorded for investigation.
- Database reservation/record RPCs are executable by service_role only, not anon or authenticated. Production tests inside a rolled-back transaction passed: initial reservation, duplicate-date rejection, scheduled status, and uncertain-result fail-closed behavior. Unauthenticated request to Edge Function returned HTTP 401.
- All 8 One Small Win editor documents now contain the business postal footer. **Critical rendering problem discovered:** Only two broadcasts (02 and 03) return rendered HTML and text from Resend. The other six retain TipTap editor text but the Resend get-broadcast response says plain text `(none)`; re-composing one did not restore the rendered body. Do not schedule those six until rendering is repaired and re-verified. Scheduler v2 explicitly checks for nonempty rendered HTML and text, mailing address, and unsubscribe placeholder and rejects any draft lacking them.
- Current state: eight broadcasts **draft**, zero scheduled, zero database reservations, zero queue/ledger rows, `marketing_delivery_settings.enabled=false`, `broadcasts_coordinated=false`; no sends.
- **Still not guaranteed:** A person clicking Send directly in Resend dashboard can bypass the reservation protocol; only campaigns scheduled through the integrated worker are covered. Publishing or scheduling must not begin until the owner agrees to the controlled process.
- **Test-address delivery not performed:** A full-cycle welcome email test requires the two welcome templates to be published and the delivery locks selectively configured. The currently deployed worker is fail-closed and not capable of a test-only address bypass; do not enable production sending merely to test one mailbox.

Recommended next operation: repair six broken rendered newsletters with owner approval if conversion to raw HTML is required, then add a dedicated one-recipient test mode that does not change production flags or send to the audience.


### Six broken One Small Win broadcasts replaced (2026-11-09)

Resend rejected raw HTML updates to the six editor-composed drafts (422: `html` and `text` cannot be updated on editor-composed broadcasts). Their original TipTap content was preserved and recovered. We created new HTML broadcasts with identical subjects/body text, original links, brand styling, postal footer, and unsubscribe placeholder:

| Issue | Original draft | Verified replacement |
|---|---|---|
| 01 | `0e1b9464-3c43-4c28-a917-7a4bb6472123` | `36761fdf-d316-4921-9c20-bdf44bce02fd` |
| 04 | `71d5e3a8-511c-4e6a-b4bd-ff2a01f172cf` | `cb6b9c36-696c-4006-a039-93519616db73` |
| 05 | `6b2252e0-bfb7-4557-863c-e6cccb64e098` | `5745766c-36c5-4ab1-a3c1-0becd37ba0a5` |
| 06 | `c7cd24b9-f52e-4d13-9e75-745e08102eaa` | `f821718f-f926-4b09-b3bf-baf17d5d89e6` |
| 07 | `9e20b95f-d77a-4b69-be09-3b78316769af` | `ce4ae542-4759-438d-a422-077c35c582a8` |
| 08 | `507efb45-222f-4d38-9b38-fec86ebd54b3` | `fa2fb8e7-1305-449e-a0e6-816e99f259f3` |

Issues **02** (`71b315ae-e4b4-41d5-b2c1-f67769eb310b`) and **03** (`f754f259-ad49-450e-95fc-c490b5f38298`) were already rendering correctly and remain unchanged.

Verification: all eight usable broadcasts returned nonempty HTML and plain text from Resend, contained the mailing address `14839 61st Road, Flushing, NY 11367` and `{{{RESEND_UNSUBSCRIBE_URL}}}`, and remained in draft status. Old broken originals are still in Resend for reference but **must not be used for scheduling**.

Updated the approved-broadcast allowlist in `supabase/functions/resend-broadcast-scheduler/index.ts`; deployed v3 with these six verified replacement IDs. Scheduling remains locked behind `BROADCAST_SCHEDULING_ENABLED=true`, and welcome delivery is still disabled. No broadcasts sent or scheduled.


### Mobile adjustment, Day 6 delivery test and activation handoff (2026-11-09)

- Both welcome templates have a mobile-only media query reducing inner horizontal padding from 34px to 22px, keeping desktop spacing. Existing copy and footer preserved.
- One-recipient Day 6 test delivered to the authorized test mailbox; Resend ID `01a1c1b2-a525-70a7-ae17-8fe4686e25cd`, subject `[TEST] Give the reminder a place to live`; did not use the production queue or Resend broadcasts. Earlier Day 2 test also delivered.
- Both templates **published** in Resend, confirmed by retrieving their published status and timestamps:
  - Day 2 `a70163c4-3c72-4cd8-9b89-17e089282af1`
  - Day 6 `105ee0e7-9078-4372-8ef3-4aa2cd3dedc2`
- `marketing_delivery_settings.postal_address_verified=true` and `broadcasts_coordinated=true` reflect verified footer and the Wednesday + reserved-date newsletter coordination policy. Newsletter broadcasts still remain drafts; **manual off-cycle sends directly through the Resend dashboard bypass the reservation protocol**, so always reserve such dates first.
- **Production welcome sending remains OFF:** `marketing_delivery_settings.enabled=false` and the deployed Edge Function returns `{"status":"disabled"}`. This prevents queued jobs from exhausting their capped dispatch attempts before the environment lock can be enabled.
- **Manual step required to finish launch:** In the Supabase dashboard, Edge Functions → Secrets, set `WELCOME_DELIVERY_ENABLED` to the literal string `true` (not a credential). It is not manageable using currently connected Supabase tools. Once set, update `public.marketing_delivery_settings.enabled=true`, then verify the live worker, cron and a net-new opt-in in production. DO NOT switch DB flag first, because jobs due while the function lock is off could consume all 5 dispatch attempts.
- This is a first-email contact opt-in flow, not historical backfill. There is no scheduled One Small Win send yet.



### Welcome sequence activation, 2026-11-09

**Activated** database-controlled sending for new explicit marketing opt-ins only. The previous standalone `WELCOME_DELIVERY_ENABLED` Edge Function check was redundant and repeatedly returned `disabled`; the current `supabase/functions/resend-welcome-delivery/index.ts` relies instead on the atomic database claim and the `marketing_delivery_settings` launch gate. The current GitHub version was redeployed as Edge Function v8.

Production `public.marketing_delivery_settings` now has all three fields `enabled=true`, `postal_address_verified=true`, and `broadcasts_coordinated=true`. The five-minute `omc-welcome-delivery-dispatch` cron is active. An HTTP request to the deployed worker using an invalid (nonexistent) 64-character token returned `{"status":"not_found"}`, confirming the worker is not stuck behind the old flag.

**QA:** A new explicitly opted-in test contact created held Day 2 and Day 6 jobs with the correct due dates. Test insertion was run inside a transaction and rolled back; no test contact, dispatch, or email remained. Production queue and send ledger were each empty at completion.

**Outstanding live observation:** No real new subscriber has reached the Day 2 due time since activation. End-to-end scheduled live delivery, recipient unsubscribe handling, and provider confirmation for a queued welcome have not yet been observed. Review first real due job, `marketing_send_ledger`, and Resend delivery status; if a job becomes uncertain, investigate rather than retry blindly. Keep One Small Win broadcasts unscheduled unless the reservation-first process is followed.

Old written instructions requiring a `WELCOME_DELIVERY_ENABLED` function secret are superseded by this entry. The database switch `marketing_delivery_settings.enabled` is the operative production kill switch.

## Subscriber Access implementation and editorial transition (November 9, 2026)

The research sample from the owner's Clean Mama Gmail showed three recurring editorial types (Sunday routine, Tuesday quick tip, Friday catch-all), a multi-day onboarding/education series, and separate product/membership promotions. OMC has chosen a **two-email/week starting target**: Sunday Family Reset (Family Meeting rhythm + Club monthly theme) and Wednesday One Small Win (a self-contained actionable tip). Longer onboarding or additional promotions remain proposals, not deployed drips. Sunday and Wednesday broadcasts are still unscheduled.

### Access without repeat guide email capture

- Existing same-browser access: `omc:tool-download-access:v1` in localStorage.
- New cross-browser email-link access: Resend contact property `RESOURCE_PASS`, 64-hex per-subscriber pass renewed at expiry. In emails, link to free resources with `#omc_pass={{{RESOURCE_PASS}}}` rather than including an address in the URL.
- SQL source mirror: `supabase/migrations/20261109090000_subscriber_resource_passes.sql`. Tables: `public.subscriber_resource_passes` and `public.subscriber_resource_pass_sync_jobs`, each RLS-protected and not granted to anon/authenticated. Private signup trigger and 15-minute `omc-resource-pass-sync` cron provision and update eligible opt-in passes.
- Deployed Edge Functions: `resend-resource-pass-sync` (syncs contact property with consent/suppression/re-unsubscribe checks, **does not send mail**) and `subscriber-resource-access` (validates hashed pass + expiry; responds only `ok`).
- Website: `src/lib/tool-email.ts` recognizes the fragment, verifies via POST, clears it from the browser address and reuses the existing remembered free-download state; `src/layouts/PublicLayout.astro` loads this path on public pages. This is not authorization for Club or paid/member resources. Static PDF files remain publicly reachable.
- Resend draft changes: Sunday Family Reset 01, 02, 03 and One Small Win 05 now use personalized access links; Sunday 04's Club offer link intentionally does not.
- Verified: three eligible passes synced into Resend on first attempt; valid token returned `200 {ok:true}`; invalid token returned `200 {ok:false}`; those four drafts are still draft and retain mailing/unsubscribe footers.
- **Not yet verified:** Real Resend merge/click-tracking behavior, actual deployed browser behavior on a clean device, email-link expiration in browser, and newsletter-ready audience separation. These are blockers to scheduling.

Detailed record and QA: [SUBSCRIBER_RESOURCE_ACCESS.md](./SUBSCRIBER_RESOURCE_ACCESS.md).
