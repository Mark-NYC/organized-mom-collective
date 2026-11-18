# Merge plan: the redesign and PR #487

Status 2026-11-18. **Nothing to merge until the owner explicitly approves.** Merging to `main` deploys the website
(Cloudflare builds `main`); the iPhone app changes only with a new TestFlight build.

## Where things stand

| PR | Branch | State |
| --- | --- | --- |
| #484 web/app parity | `claude/stoic-albattani-esdhkp` | **Merged** 2026-11-17 23:40 UTC |
| #485 premium redesign | `claude/premium-app-design` (head `dd22bba`) | **Open but already in `main`**: the same branch and head were merged through **#486** on 2026-11-18 04:51 UTC by the owner's account. `main` contains every commit of #485; nothing is left to merge |
| #487 Club integration + one Family Meeting | `claude/unified-family-meeting` | Open, base `claude/premium-app-design`. 64 files over `main`; merges cleanly into today's `main` (checked with `git merge-tree`) |

So the order "#485, then #487" is already half done: the redesign is live.

## Steps (after the owner's go)

1. **Close #485** as superseded by #486 (no merge; its content is already in `main`).
2. **Retarget #487 to `main`.** Its diff stays the same 64 files. Wait for the PR checks on the new base: `Verify Astro
   build` and the iPhone app workflow (`household-db`, `web-shell`, `family-e2e`; on PRs from `claude/` branches the
   iOS simulator runs on the branch's push run, which last passed in run 120, all four jobs).
3. **Merge #487** (merge commit, like #484/#486). Cloudflare deploys the website from `main`.
4. **Post-merge website check (production, read-only):** signed out, `/app`, `/app/family`, `/app/family/meeting`
   (four parts), `/app/club` (sign-in), a month page, `/club/resources/2026-11-family-ownership` (sign-in prompt, app
   header); with the owner's account, the weekly meeting shows this month's plan; Club Home's "Prepared for your
   family"; nothing about follow-through appears (20261204 not applied).
5. **iPhone app:** a TestFlight build from `main` when wanted (`ios-testflight.yml`); the app bundle is the same code.

**Rollback:** revert the #487 merge commit on `main` (code only; no database change to undo).

## Do the features need a migration to work?

**No.** Checked against production (read-only, 2026-11-18): every database function the code calls exists in
production, except these, and each is guarded so the feature simply stays off:

| Functions the code calls | Migration (not in production) | Without it |
| --- | --- | --- |
| `household_agreement_check_in`, `household_follow_through` | `20261204_agreement_follow_through` (approved; plan in `FOLLOW_THROUGH_ROLLOUT.md`) | Weekly follow-through hidden; the meeting works |
| `household_invite_preview`, `household_invite_accept_leaving` | `20261130_household_join_from_own` (already on `main` before #487) | The invite preview returns nothing and the plain accept runs, as on `main` today |

Everything else the PR relies on is already in production: the household tables and sharing (`20261124`), calendar
(`25`), member colors (`26`), agreements (`27`), household Club access including **both adults saving monthly
resources** (`28`), the deletion guard (`29`), shared cleaning (`20261201`). `20261202` (kit titles) stays on hold and
nothing depends on it; `20261203` (billing for either adult) is not used by this PR.

Merging the PR **applies no migration**: no workflow runs migrations or deploys Supabase functions.
`supabase/dashboard/support-request.ts` is regenerated in the PR (a new route constant only); redeploying that
function is not needed.

## After merge (separate approvals)

- Apply `20261204` per `docs/product/FOLLOW_THROUGH_ROLLOUT.md` (backup, preflight, apply, verify).
- Printed wording: the approved meeting-sheet names are in this PR; the February and October mailer letters and the
  kit-registry themes wait for your review (`docs/club/mailers/REVIEW-2027-02-2027-10-letters.md`).
- Before November 2027: the checklist in `UNIFIED_FAMILY_ARCHITECTURE.md` §15 (a test enforces step 2).
- Next priority (not started): external calendar integration.
