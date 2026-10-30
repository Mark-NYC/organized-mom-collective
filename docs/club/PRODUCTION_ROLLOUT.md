# Club production rollout: Welcome Kit and family profile

Prepared Oct 30 2026. **Nothing here has been run on production.** Each stage that changes production needs the
owner's explicit go-ahead, given separately. Stripe stays in test mode throughout; going live is its own decision
(docs/club/MEMBERSHIP.md → Going live). Fulfillment isn't changed (PR #268 stays open).

What it fixes on production (docs/club/MEMBER_EXPERIENCE_AUDIT.md): onboarding steps 2–6 are skipped, Family Meetings
are generic, the admin Welcome Kit queue fails, the Welcome Kit emails aren't sent.

| Stage | What | Who | Needs approval |
| --- | --- | --- | --- |
| 0 | Rehearsal and read-only checks | done | — |
| 1 | Merge PR #269 (site: account saving, links, `/club/family` fix) | owner | yes (merge) |
| 2 | Back up the database | owner (needs the database password) | — |
| 3 | Apply the two migrations | owner or Claude | **yes** |
| 4 | Deploy `club-admin` and `club-webhook` | owner or Claude | **yes** |
| 5 | Production member-experience test (Stripe test mode) | together | — |

Stages 1 and 3 are independent: PR #269 works on production's current schema (tested), and the migrations don't need
#269. Do 3 before 4: the new functions call database functions that only exist after the migrations; the deployed
functions keep working with the migrated database in between (the return fields they read are unchanged).

## Stage 0: done (Oct 30 2026)

- **Production matches the repo.** `supabase/rollout/fingerprint.sql` run read-only on production: every object 20261108
  replaces, the queue view and `club_households`' columns are identical to the repo's migrations through 20261107,
  except a comment missing from production's `club_admin_set_fulfillment` (same logic). Saved as
  `supabase/rollout/production-fingerprint.txt`.
- **Migration history ends at `club_first_month_free`** (20261029223156). Neither file below is applied.
- **Rehearsal passes:** `bash scripts/rehearse-club-rollout.sh` on a production replay with a founding member's welcome
  print and January order: both apply in order; `verify.sql` all 11 checks; data snapshot identical before and after;
  the rollback refuses once a member saved profile answers; the rollback restores production's exact definitions and
  data; both apply again afterwards.
- **Also passing:** `bash scripts/verify-family-profile-upgrade.sh`, `npm run test:admin-sql`, `npm run test:club`
  (34/34), `node scripts/club-onboarding-e2e.mjs` (156/156) and `--only=months` (193/193) on every migration.
- **Edge Functions:** `supabase/dashboard/*.ts` are current (`npm run build:functions` changes nothing). Deployed
  `club-billing` (v8) matches it; `club-admin` (v9) and `club-webhook` (v7) were deployed Oct 29 from commit `163fb24`, before the Welcome Kit commits (`eaf68bd`, `08dee7d`:
  Welcome Kit admin actions, `kit_reminder` emails, Welcome Kit wording in the welcome email).
- **Backups:** the project is on the Free plan, which has no automatic or downloadable backups (Supabase docs:
  Platform → Database Backups). Stage 2 is a manual dump.

## Stage 1: merge PR #269

After the Cloudflare deploy finishes (a few minutes), on the live site:
- `/app/club/june` while signed out: "Sign in to see your plan" (no error).
- `/club/family` signed in as a test-mode member: the family form opens (before the migrations, without the profile summary).
- Nothing else changes for the public site.

## Stage 2: back up (owner)

The Supabase CLI needs Docker. Connection string: Supabase → **Connect** → session pooler (or direct), with the
database password.

```bash
supabase db dump --db-url "$DB_URL" -f backup-2026-10-30-roles.sql --role-only
```

```bash
supabase db dump --db-url "$DB_URL" -f backup-2026-10-30-schema.sql
```

```bash
supabase db dump --db-url "$DB_URL" -f backup-2026-10-30-data.sql --use-copy --data-only
```

Keep the three files off-site (not in the repo: they hold customer data). Neither migration changes an existing row,
and `supabase/rollout/rollback.sql` undoes the schema, so the dump is the safety net for the unexpected.

## Stage 3: apply the migrations (approval required)

1. **Pre-flight, read-only:**
   - Migration history still ends at `club_first_month_free`.
   - `supabase/rollout/fingerprint.sql` output equals `supabase/rollout/production-fingerprint.txt`. If anything
     differs, stop: someone changed production since Oct 30.
   - Run `supabase/rollout/snapshot.sql` and keep the output.
2. **Apply, in order**, each in its own call (both files wrap themselves in `begin`/`commit`):
   - `supabase/migrations/20261108000000_club_welcome_kit.sql`, name `club_welcome_kit`
   - `supabase/migrations/20261109000000_club_family_profile.sql`, name `club_family_profile`

   (Supabase MCP `apply_migration`, or the dashboard SQL editor. If the first fails, it changes nothing; stop there.)
3. **Verify, read-only:**
   - `supabase/rollout/verify.sql`: every check `ok = true`. Its `queue:` lines show the founding members' welcome
     prints and January orders grouped as `welcome_kit` packages (expected; that's the Welcome Kit).
   - `supabase/rollout/snapshot.sql`: identical to the pre-flight output, line for line.
   - Migration history now ends with `club_welcome_kit`, `club_family_profile`.
   - Supabase security advisors: no new warnings for `club_activities`, `club_responsibilities` or the new functions.

**Rollback** (only if verify fails, with the owner's go-ahead): run `supabase/rollout/rollback.sql`. One transaction;
it restores production's exact definitions of Oct 30 (rehearsed). It refuses and changes nothing if members have
saved profile answers or a `kit_reminder` email is logged; then decide from the backup.

## Stage 4: deploy the Edge Functions (approval required)

Deploy `club-admin` and `club-webhook` only (`club-billing` is already current). Source: the committed one-file builds
`supabase/dashboard/club-admin.ts` and `supabase/dashboard/club-webhook.ts` (regenerate with `npm run build:functions`
first; it must change nothing). Supabase → Edge Functions → the function → paste the whole file → Deploy, then confirm
**Verify JWT is off** (both are called without a Supabase JWT: Stripe for the webhook, the admin's own token check for
`club-admin`). Or the Supabase MCP `deploy_edge_function` with `verify_jwt: false`.

Verify:
- Versions bump (`club-admin` past v9, `club-webhook` past v7) and the deployed `club-admin` contains `kit_reminder`.
- `/admin/club` → Setup: status loads (Stripe **test**, webhook secret present, prices present).
- `/admin/club` → Welcome Kits: the founding members' kits are listed.
- Stripe test dashboard → the Club webhook endpoint: next event delivered with 200.

What members see change (44 lines, `git diff 163fb24 HEAD -- supabase/dashboard/club-admin.ts supabase/dashboard/club-webhook.ts`):
- The welcome email describes the Welcome Kit ("your family's first resource, plus a personalized Family Vision
  watercolor print … in one package") and its steps end with "Approve your Family Vision print, look over your first
  resource, and we'll prepare your Welcome Kit."
- A new `kit_reminder` email ("One quick look before we prepare your Welcome Kit"), sent only when the owner sends that
  batch from `/admin/club`. Its button opens her copy at `/club/resources/<slug>`, where the Welcome Kit confirmation
  lives today (fulfillment flow, unchanged by PR #269).

Rollback: paste the bundles from commit `163fb24` (what's deployed today: `git show 163fb24:supabase/dashboard/club-admin.ts`,
same for `club-webhook.ts`).

## Stage 5: production member-experience test (Stripe test mode)

A fresh test email (a real inbox you can read; never a customer's). Stripe test card `4242 4242 4242 4242`, any future
date, any CVC. Nothing is charged.

1. `/club` → **Get My First Month Free** → Stripe Checkout shows **$5.90/month** after the free month, test mode banner.
2. Pay with the test card, U.S. address → back on `/club/welcome` ("You're in").
3. Welcome email arrives (subject marked `[Test]`) → sign in with the emailed 6-digit code.
4. Family: two grown-ups, two children with ages → save. Profile steps 2–6: add an activity, mark one job "Owns it" and
   one "Helps with it", skip one step, close the tab midway, sign in again: setup resumes at the first open step.
5. Address → Family Vision print → approve.
6. `/app/club` → **Open your January plan** → `/app/club/january`. Make a change → "Changes save to your account".
7. Close the browser, open it on another device, sign in → `/app/club/january` shows the change.
8. **Family Meeting** switch → names, ages and activities are hers; back to **Monthly Tool**: the change is still there.
9. Print the tool and the meeting (one Letter page for the meeting).
10. Sign out → `/app/club/january` asks her to sign in; sign back in → still her plan.
11. `/club/family` → edit an answer, reload: kept.
12. A second test account: can't see the first one's family or plan.
13. Admin, read-only: `/admin/club` → Welcome Kits lists her kit; nothing is approved for print.

Afterwards: cancel the test subscription from `/club/dashboard` → Manage billing (no charge), and note the test emails
in `/admin/club` so they're never mistaken for members.
