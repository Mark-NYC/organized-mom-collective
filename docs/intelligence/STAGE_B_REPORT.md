# Household Intelligence Engine: Stage B report

**Date:** 2026-11-28 · **Branch:** `claude/dreamy-mendel-vhttkn` · **Status:** built and tested locally; **not applied to
production, no AI provider called, no real household data used.**

Stage B builds the engine's foundation: the behavioral log, recurrence-aware memory, continuous learning, consent and
controls, pseudonyms, the inference budget, sanitized calendar descriptions, 50 synthetic households and the core of
the Household Intelligence Lab. It follows the 12 approved decisions (§2) and the Stage A audit
([STAGE_A_AUDIT.md](STAGE_A_AUDIT.md)).

**What needs you:** review this report. Then approve (a) applying two migrations to production (§8) and (b) the OpenAI
setup (§9), including the Zero Data Retention request, before any real household data is sent. Three product decisions
are listed in §10.

**Revised 2026-11-28 (owner):** the AI evaluation budget is **$5.00 in total**, spent progressively, cheapest model
first. Full plan: [EVALUATION_PLAN.md](EVALUATION_PLAN.md). It supersedes the $40/month synthetic budget and the Luna
vs Terra benchmark below (§4.6, §7).

---

## 1. Summary

| Area | Result |
| --- | --- |
| Behavioral log (`household_signals`) | Closed vocabulary, opaque ids, product moments vs learning signals, consent-gated server-side |
| Memory (`household_memory` + evidence) | Confirmed > observed > tentative > retired/forgotten; recurrence-aware review windows; evidence capped at 40 |
| Learning (`src/lib/intel/learn.ts`) | Discovers any recurring pattern (no fixed categories), observed owner vs agreed, adult load, per-adult timing, preferences |
| 50 synthetic households | 6–12 months each, 18,257 signals, 18 scripted scenarios with ground truth |
| Engine vs ground truth | **574/574** on the default seed; **2,884/2,885 (99.97%)** across five seeds |
| Consent and controls | Explicit AI-help choice in onboarding; Account controls for learning, AI, my calendars, noticed rhythms, erase |
| Budget | $0.40/household/month cap (aim: under $0.05), server-side, serialized, retries counted; global $50/month; AI evaluation **$5.00 in total** (cumulative, $0.05 per call, unsettled reservations keep counting) |
| AI evaluation | `intel-infer` function (the only place a model is called), cache-first replay, progressive runner A → B → C → escalate with gates and approval requests; rehearsed end to end with a scripted model |
| Tests | SQL 92 + 20 checks; unit 71 new tests; 41 end-to-end checks on the website and the app bundle; full regression green |

Engine bugs the synthetic ground truth caught and that are now fixed (§5.3): stale owner beliefs, statistical beliefs that
never retired, two-sighting "seasons", monthly habits with skipped months, sparse weekly habits read as biweekly, a moved
routine lost after a skipped week, and a day-of-month anchor flipping to an nth weekday on a tie.

---

## 2. The 12 decisions, as built

| # | Decision | Implementation |
| --- | --- | --- |
| 1 | 50 diverse synthetic households, 6–12 months, from the 8 samples and scripted scenarios | `src/lib/intel/synthetic.ts`: seeded from the 7 non-empty sample families; 20 two-parent, 23 single-parent, 7 multigenerational; children aged 1–17; engagement high 20 / medium 16 / low 14; 18 scenario kinds (§5) |
| 2 | OpenAI first, provider-independent; ZDR before real data | No provider code in Stage B. Setup steps and the ZDR request: §9. Synthetic evaluation needs no key |
| 3 | Benchmark Luna and Terra; cheap model by default, escalate only when warranted | Revised: luna by default; terra only on title groups where luna falls short, each distinct title once ([EVALUATION_PLAN.md](EVALUATION_PLAN.md) §5) |
| 4 | Retire the unused pilot activity table; consolidate observation into the new log | `app_events` removed from `20261210` (it was never applied in production) and renamed `20261210000000_app_feedback.sql`; product moments now go to `household_signals`; `pilot_funnel` rewritten on it; `track()` sends through the new log. Dependencies checked: §4.4 |
| 5 | Explicit AI consent in onboarding, Account controls, individual consent for personal calendars, full function without AI | §4.3. AI is off by default; "Not now" stores nothing; personal-calendar consent is per adult; everything deterministic works with all of it off |
| 6 | Sanitized descriptions ≤280 characters; minimize; respect visibility; untrusted; never sent automatically | `calendar_feed_descriptions` (service role only), `sanitize.ts` (§4.5). Nothing reads them for a provider |
| 7 | $0.40/month cap, server-side, retries and concurrency; separate global and synthetic budgets | `intel_private.budget_reserve / budget_settle`, `intel_usage`, `intel_budget_scopes` (§4.6); evaluation revised to a $5.00 cumulative cap |
| 8 | Recurrence-aware memory; agreements persist; contradictions weaken inferences | `cadence.ts`, `memory.ts`: daily / weekly / biweekly / monthly / seasonal / annual windows; confirmed memory never decays; contradiction lowers confidence and can move an anchor |
| 9 | Consistent household-scoped pseudonymous identifiers | `intel_private.pseudonym` (HMAC with a per-household salt, `M/P/S/L/C` tokens), `pseudonyms.ts`; erase rotates the salt |
| 10 | Preserve V21, MAWL, agreements, restraint, design, deterministic fallback | No V21 behavior changed. Signals are a side effect of existing writes. Account uses the existing switch and row styles |
| 11 | The Household Intelligence Lab in the roadmap | Core built (`lab.ts`: replay, advance time, apply family actions, inspect memory). UI: §6 |
| 12 | Ongoing learning that finds unanticipated patterns, evidence-grounded, privacy- and quality-checked | Section 1 of `learn()` tests every (kind × subject × visibility) group for every cadence, with evidence minimums, regularity, confidence and privacy gates (§5.4) |

---

## 3. Files

**Database**
- `supabase/migrations/20261216000000_household_intelligence_engine.sql` (new; rollback statements at the end)
- `supabase/migrations/20261210000000_app_feedback.sql` (renamed from `app_events`; keeps `pilot_cohort`, `app_feedback`, `pilot_feedback`)
- `supabase/rollout/household/rollback.sql` (new 20261216 section), `supabase/rollout/app-feedback/*` (renamed, updated)
- `supabase/tests/household-intelligence-engine.sql` (new, 92 checks), `supabase/tests/app-feedback.sql` (renamed, 20 checks)
- `scripts/test-intel-budget-concurrency.sh` (new), `scripts/test-household-sql.sh`, `scripts/rehearse-launch-migrations.sh`

**Engine (pure TypeScript, shared by the app, the Lab and tests)**
- `src/lib/intel/signals.ts`: vocabulary, `validSignal`, `localStamp`
- `src/lib/intel/cadence.ts`: cadence detection, evidence minimums, review windows
- `src/lib/intel/memory.ts`: identity, confidence, status, review dates
- `src/lib/intel/learn.ts`: continuous learning and discovery
- `src/lib/intel/pseudonyms.ts`: tokens in text that may reach a provider
- `src/lib/intel/synthetic.ts`, `src/lib/intel/lab.ts`: synthetic households and the Lab core
- `supabase/functions/_shared/calendar/sanitize.ts`: description sanitizer

**App**
- `src/lib/intel/client.ts`: the signal queue, `signalsFor` (what a V21 write teaches), settings / memory / erase
- `src/lib/intel/describe.ts`: what was learned, in plain words
- `src/components/intel/HouseholdIntelligence.tsx`: onboarding consent and Account controls
- `src/lib/app/events.ts`: `track()` on the new log; `src/components/v20/LiveFamily.tsx`, `OurWeekFamilySetup.tsx`, `AppFeedback.tsx`

**Calendar import:** `ics.ts`, `google.ts`, `handlers/calendar-feeds.ts` (descriptions sanitized, stored separately, errors never block the import)

**Tests and CI:** `tests/intel-engine.test.ts`, `tests/intel-synthetic.test.ts`, `tests/intel-client.test.ts`,
`scripts/e2e/intel-e2e.mjs` (new CI step in `ios-app.yml`), `tests/pilot-readiness.test.ts`, `tests/calendar-google.test.ts`

---

## 4. Implementation

### 4.1 The behavioral log

`household_signals`, written only through `household_signal_log(p_signals)` (≤50 per call, ≤2,000 per adult per day):

- **Product moments** (`app_open`, onboarding, first actions, meeting, feedback): kept even with learning off, stripped
  to the moment only (no subject, value, member or visibility); once per adult per day (`app_open` once per hour).
- **Learning signals** (task done, agreement saved or changed, priority chosen, development decided, event occurred,
  handoff covered, request asked, recommendation response, …): kept only when the adult has a household and its
  learning is on. A private signal (`private: true`) is kept only with that adult's own personal-calendar consent and
  becomes `visible_to` that adult.
- Closed `kind` and `subject_kind`; `subject_ref` matches `[A-Za-z0-9:_@.-]{1,96}`; `value` is a short slug. A member id
  outside the household is dropped. Timestamps are clamped to the last three days. Malformed signals are dropped, never
  an error for the family.
- The app validates the same rules before sending (`validSignal`) and turns ids that might carry text (imported
  calendar UIDs can hold an email) into opaque hashes (`opaqueRef`).
- Retention (`intel_private.prune`, daily `omc-intel-prune`): learning signals 180 days, product moments 400 days,
  `event_occurred` / `intent_chosen` 800 days (two cycles of annual occasions); retired memory 180 days.

### 4.2 Memory

`household_memory` holds one row per belief, identified by (household, category, subject key, member scope,
visibility), with evidence rows (`household_memory_evidence`, newest 40).

- **Confirmed** (the family said so): never decays, never overwritten by inference; contradicting behavior only
  updates counters. Lasts until changed, forgotten or past its own `expires_at`.
- **Observed / tentative:** from statistics. Confidence = Beta posterior (support vs contradictions) × regularity ×
  freshness. Freshness is full within the cadence's review window and fades to zero over a second window.
- **Review windows:** daily 10 days, weekly 28, biweekly 42, monthly 100, seasonal 200, annual 400. A birthday isn't
  forgotten after 60 days, and a dropped weekly habit is reconsidered after four weeks.
- **Minimum evidence (days / cycles):** daily 7/7, weekly 3/3, biweekly 3/3, monthly 3/3, seasonal 3/3 (raised from 2:
  two sightings a quarter apart are as likely coincidence), annual 2/2.
- **Absence is not neglect:** missing days are never negative evidence. Only behavior that contradicts a pattern
  (it happened, but differently) is.
- **Forgotten:** content and evidence deleted; it returns only from at least two new pieces of evidence after it was
  forgotten (enforced in `memory_apply`).
- `memory_apply` (service role) re-checks every rule whatever the caller sends: learning on, model-sourced memory needs
  AI consent, personal-calendar memory needs that adult's consent, confirmed precedence, forgotten needs fresh evidence.

### 4.3 Consent and controls

- **Onboarding** ("You're set up"): an "AI help (optional)" card that says what would be sent (plan names, with people's
  names swapped for codes), what never is (descriptions, notes, addresses, children's ages), that it isn't used for
  training, that it's off unless she says yes, how to turn it off (which erases what the AI worked out), and that
  everything else works the same. **Yes** records `ai_enabled`, the consent version (`1`), who agreed and when.
  **Not now** stores nothing. The card also explains rhythm learning and where to change it.
- **Account → Household intelligence**, in the existing switch style:
  - **Learn our family's rhythms** (household): off means nothing new is recorded or learned;
  - **AI help** (household): off withdraws consent, deletes model-derived memory and interpretations, releases reserved
    budget;
  - **Learn from my personal calendars** (this adult only): off deletes this adult's private memory, signals and
    interpretations;
  - **Rhythms we've noticed**: plain-language rows ("A plan that happens every Tuesday."), with **That's right**
    (confirm), **Wrong day?** (correct) and **Forget**;
  - **Erase everything learned** (memory, signals, interpretations, pseudonyms; the salt is rotated; the family,
    calendar and agreements stay).
- If the database doesn't have the engine (production today), the component renders nothing.

### 4.4 Retiring `app_events` (decision 4)

Before: `track()` called `app_event` into `app_events`, and `pilot_funnel` read it. Production never had it (the
migration was not applied).

Callers checked: `AppLayout` (app_open), `WeeklyMeeting`, `OurWeekFamilySetup`, `family-meeting-client`, `cleaning-sync`,
the calendar client, `AppKitLibrary`, `AppFeedback`, `PilotAdmin` (`pilot_funnel`, `pilot_feedback`; RPC names
unchanged), `first-session-e2e`, `pilot-readiness`.

Now: `track()` keeps its signature and sends product moments through the signal queue. `app_feedback` no longer writes
an event, so `AppFeedback` tracks `feedback_sent` itself after a successful send. `pilot_funnel` reads
`household_signals`, and its numbers and owner-only check are unchanged.

### 4.5 Calendar descriptions (decision 6)

- iCal `DESCRIPTION` and Google `description` go through `sanitizeDescription`:
  - markup and entities removed;
  - video-meeting join, dial-in and passcode lines dropped;
  - URLs, emails, phone numbers, street addresses and ZIP codes removed;
  - control and bidi characters removed;
  - cut to ≤280 characters on a word boundary.
- They're stripped from the events before `calendar_feed_store`. They're stored separately in
  `calendar_feed_descriptions`: service role only, scrubbed again server-side, and deleted with their feed.
- A failure there never fails an import.
- Nothing displays them or sends them anywhere. A future interpreter may read one only with AI consent, as untrusted
  data, through closed-vocabulary outputs.

### 4.6 Budget (decision 7)

- `budget_reserve(household, scope, request_key, attempt, estimate, job, model)` checks the budget before any model
  call.
- **Concurrency:**
  - serialized per scope with an advisory lock;
  - the household and global caps are both checked;
  - reservations expire after 10 minutes.
- **Retries:**
  - up to 3 attempts per request, each counted;
  - the same (request, attempt) is idempotent.
- `budget_settle` records actual cost.
- **Scopes:** household cap $0.40/month (`intel_settings.monthly_budget_micro_usd`), global $50/month, and synthetic
  evaluation **$5.00 in total** (`lifetime_cap_micro_usd`, never resets) with at most $0.05 per call.
- **Unsettled reservations:** a reservation that expires without being settled keeps counting at its estimate (a sent
  call may have cost it). Only a call that never left is released. `intel_private.budget_status` reports where a scope
  stands.
- **Who can call it:** the inference function reaches the budget and the evaluation cache through service-role-only
  wrappers (`public.intel_budget_*`, `public.intel_cache_*`).
- `scripts/test-intel-budget-concurrency.sh`:
  - two concurrent $0.20 reservations under a $0.30 household cap → exactly one;
  - ten concurrent $0.01 evaluation reservations with $0.05 left of the $5 → exactly five, total exactly $5.00.

---

## 5. Synthetic households and longitudinal evaluation

Full generated report: [SYNTHETIC_EVALUATION.md](SYNTHETIC_EVALUATION.md)
(regenerate: `INTEL_REPORT=docs/intelligence/SYNTHETIC_EVALUATION.md npx vitest run tests/intel-synthetic.test.ts`).

### 5.1 The households

- **How they're built:** deterministic (seed 20261216); shapes varied from the sample families; 6–12 months each; no
  names or free text in any signal.
- **Every household includes:**
  - a weekly activity;
  - a daily agreement;
  - one-off noise;
  - background app opens.
- **Rotating scenarios, five per household:**
  - a routine that moves to another day;
  - a season that ends;
  - a two-week vacation gap;
  - an nth-weekday monthly event;
  - a day-of-month routine with jitter;
  - an annual birthday with prior-year history;
  - every-other-Friday custody handoffs;
  - a chore agreed to one adult but done by mom;
  - one adult carrying ~90% of recorded work;
  - a confirmed agreement contradicted by behavior;
  - "forget this" followed by one stray occurrence;
  - a private personal-calendar event;
  - plain, "already handled" and "later" dismissals;
  - a preference that changed.
- **Learning switched off part-way:** every tenth household. Its memory must freeze.
- **Ground truth follows the realized history:** if a low-engagement family happens to go quiet longer than a cadence's
  review window, the truth becomes "reconsidered". The report counts these adjustments; there were 0 on the default
  seed.

### 5.2 Results

- **Default seed:** 574/574 expectations met, all 18 scenario kinds.
- **Seeds 1, 7, 42, 2026, 99991:** 575/575, 578/579, 579/579, 576/576, 576/576. The one miss is an honest edge case: after
  a routine moved, the new day happened every other week, and the engine called it "tentative, every other Wednesday"
  (right day, cautious status).
- **Unscripted discoveries (observed, default seed):** app-open timing per adult (70 adults), the weekly rhythm of the
  trash chore (15), who does chores (10), the rhythm of load chores (7), adult load (2). All were reviewed as legitimate
  derivations, not noise.
- **One-offs:** none became a belief.
- **Speed:** a full replay of all 50 households with weekly learning passes takes about 2 seconds.

### 5.3 Engine fixes found by ground truth

1. **Ownership duplicated when the doer changed.** Ownership memories now have one row per chore; the doer is content.
2. **Statistical beliefs never retired once their evidence aged out.** Learning section 5 retires them after their
   review date.
3. **Two sightings a quarter apart counted as "seasonal".** Seasonal now needs 3/3.
4. **A monthly habit with skipped months failed the median-gap gate.** Gaps are now judged as multiples of a month.
5. **A sparsely attended weekly activity (gaps of 7/14/21) was read as biweekly.** Weekly and biweekly are now judged
   from gap multiples: biweekly requires no odd multiples of a week.
6. **A moved routine was lost when the new day was skipped recently.** The learner now also checks what happened since
   the old pattern last held.
7. **A day-of-month anchor could flip to an nth weekday on a tie.** The day-of-month window is compared fairly, and the
   weekday wins only when it explains at least as much.

### 5.4 Invariants checked on all 50 histories

- Private-calendar signals only produce memory visible to that same adult, never household memory.
- Nothing is learned from the engine's own outputs.
- Family-confirmed memory is never overridden by behavior.
- Forgotten memory stays forgotten without enough new evidence.
- With learning off, no learning signals are recorded afterwards and memory freezes.
- Withdrawing personal-calendar consent deletes that adult's private memory and signals, and leaves household memory
  untouched.
- Observed ownership never becomes an assignment.
- Every inferred belief has a review date, and no observed belief is stale while learning is on.
- Memory stays bounded (≤40 rows per household).

---

## 6. Household Intelligence Lab (roadmap; core built)

Private, owner-only, synthetic or exported histories only.

- **Built (`src/lib/intel/lab.ts`):**
  - replays a household day by day;
  - applies family actions (confirm, forget, learning on/off, personal calendars on/off) on their dates;
  - runs the real learner on a schedule;
  - keeps memory exactly as `memory_apply` would;
  - returns a timeline of memory states;
  - `evaluate()` scores a run against ground truth.
- **Next (Stage C/D):** an owner page in the admin dashboard (`is_admin('owner')`, noindex) to:
  1. pick a synthetic household, or generate one from a scenario list;
  2. advance time by day, week or month, and see signals arrive;
  3. inspect memory with evidence, confidence, review date and why;
  4. compare Today and the Family Meeting with and without the engine (and later with the AI interpreter), side by
     side, on the real V21 components;
  5. inject events (a moved practice, a vacation, a confirm) and watch the response;
  6. export a run as a regression fixture.

---

## 7. Model evaluation (revised: $5 total, progressive)

Superseded by [EVALUATION_PLAN.md](EVALUATION_PLAN.md):
- API validation first, then five representative households, then the rest only if the gate passes;
- the cheap model everywhere by default; the strong model only on groups where the cheap one falls short;
- cache-first replay;
- the database-enforced $5.00 total.

The whole sequence is rehearsed in CI with a scripted model. At the recorded prices, phases A–C cost about $0.02 worst
case.

---

## 8. Production rollout (not done; needs your approval)

1. **Preflight:** `supabase/rollout/app-feedback/preflight.sql` (confirms `app_events` was never applied).
2. **Apply in order:** `20261210000000_app_feedback.sql`, then `20261216000000_household_intelligence_engine.sql`.
3. **Verify:** `supabase/rollout/app-feedback/verify.sql`; check that `omc-intel-prune` is scheduled.
4. **Deploy:** the `calendar-feeds` Edge Function (description sanitizing and storage) and the site.
5. **Expected result:** AI stays off for every household until someone says yes, and no provider code exists yet.
   Learning starts recording for households, and families see the new Account section and onboarding card.
6. **Rollback:** `supabase/rollout/household/rollback.sql` (20261216 section), then
   `supabase/rollout/app-feedback/rollback.sql`. Both are rehearsed (`scripts/rehearse-household-rollback.sh`,
   `scripts/rehearse-launch-migrations.sh`).

---

## 9. OpenAI setup (when you're ready; nothing is needed for Stage B)

I can't see OpenAI's dashboard, so menu names may differ slightly. Tell me if a step doesn't match.

1. **Account and organization.** At platform.openai.com, sign in with the business account. Under organization
   settings, set the legal business name and billing, then add a prepaid credit or a payment method with a low
   auto-recharge.
2. **Two projects:**
   - `organized-family-eval` for synthetic evaluation only;
   - `organized-family-prod` for real households, later.

   Keeping them separate keeps keys, limits and retention settings apart.
3. **Limits per project.** Set budgets that match the server-side caps: eval $5 (total), prod $50 a month. Turn
   on email alerts at 50% and 80%. Restrict each project to the models we use (luna and terra) if the dashboard
   offers model restrictions.
4. **API key.** In `organized-family-eval`, create a key owned by a service account (not your personal user) with the
   least permissions that allow the Responses API. **Do not paste it in chat or commit it.** When I need it, I'll ask
   through the secure credential form, or you set it as a Supabase Edge Function secret:
   - dashboard: Project Settings → Edge Functions → Secrets, name `OPENAI_API_KEY`;
   - or, from your machine:

     ```bash
     supabase secrets set OPENAI_API_KEY=… --project-ref uvqhmlqwmgnohhduttip
     ```

   It is used only in Edge Functions, never in the app or the website.
5. **Data controls.** In the prod project's data controls, confirm that API data is not used for training (the
   default), and turn off any optional sharing.
6. **Evaluation spending ($5 total):** set the `organized-family-eval` project's budget to $5 with alerts, as a
   backstop only. The cap that actually holds is ours, in the database
   ([EVALUATION_PLAN.md](EVALUATION_PLAN.md) §1).
7. **Zero Data Retention: request it before any real household data.**
   - Contact OpenAI (sales, or the ZDR / data-retention request form linked from the data-controls page).
   - Ask for ZDR for `organized-family-prod`; mention we use the Responses API with `store: false` and no Batch API.
   - If ZDR isn't granted, ask for Modified Abuse Monitoring as the fallback.
   - Also ask for their Data Processing Addendum (DPA) and sign it.
   - Keep the confirmation email; I'll record it in `docs/intelligence/`.
   - Until it's confirmed in writing, the prod key stays unused and only synthetic data is processed.
8. **Tell me when (1)–(4) and (6) are done for the eval project.** The provider adapter is already built and tested
   (`supabase/functions/intel-infer`: Responses API, `store: false`, strict JSON schemas, reservation before every
   call). Running it also needs the engine migration in a Supabase project and the function deployed with its two
   secrets ([EVALUATION_PLAN.md](EVALUATION_PLAN.md) §7). Then I run phase A (well under a cent) and report before
   going further.

---

## 10. Decisions for you

1. **Consent copy vs Stage A minimization.** The consent text says children's ages are never sent. Stage A planned to
   send age bands ("Child, 9–12"). I recommend keeping the stricter promise and sending only "child" / "teen" roles. The
   alternative is to change the copy and bump the consent version before Stage C.
2. **Learning on by default.** Rhythm learning (deterministic, on our servers, no AI) is on by default, disclosed in
   onboarding, and can be switched off in Account. AI help is off by default. Confirm you're comfortable with learning
   on by default.
3. **Erase is household-wide.** Either adult can erase everything learned for the family. The alternative is limiting
   it to the owner role.

---

## 11. Testing report

All run locally on 2026-11-28 against throwaway databases. Nothing touched production.

| Suite | Result |
| --- | --- |
| Unit (`npx vitest run`) | **1,809 passed**, 107 skipped (existing skips), 0 failed. New: `intel-engine` 39, `intel-synthetic` 18, `intel-client` 17; updated `pilot-readiness` 18, `calendar-google` |
| Type check (`astro check`) | 0 errors, 0 warnings |
| Build (`npm run build`, `npm run build:app`, test-backend builds) | Pass |
| SQL (`scripts/test-household-sql.sh`) | Pass: 27 suites, including `household-intelligence-engine` (92 checks) and `app-feedback` (20). Only the known pre-existing `admin-access` grant check remains |
| Engine SQL coverage | Household isolation, permissions, signal rules (product vs learning, consent, private), learning off, memory confirm / visibility / forget / correct, AI-consent withdrawal, personal-calendar withdrawal, pseudonyms (stable, scoped, salt rotation), budget (caps, scopes, retries, idempotency, expiry, serialization), descriptions (service role only, scrub, cascade), erase and account-deletion cascades, retention, funnel |
| Budget concurrency (`scripts/test-intel-budget-concurrency.sh`) | Pass: exactly one of two concurrent reservations under the cap |
| Rehearsals | `household-rollback`, `launch-migrations`, `calendar-rollout`, `calendar-google-rollout`, `follow-through`, `kit-titles` pass. `club-rollout` fails identically at the previous commit (the known `shop_gelato_private_storage` migration) and isn't in CI |
| End to end (`scripts/e2e/intel-e2e.mjs`, website + app bundle, iPhone sizes) | **41/41**: sign-in, setup, consent (yes and not now), product moments carry nothing but the moment, V21 Today unchanged, learning signal kept, learning off drops signals server-side, controls reflect choices, personal-calendar consent per adult, noticed rhythms in plain words, confirm, change the day, forget (no evidence kept), AI withdrawal erases model memory, erase everything, isolation, no page errors, no sideways scroll |

**Two existing CI problems, not caused by Stage B:**

- The `family-e2e` job was already failing at its calendar step on the previous commit (87360995).
- `scripts/e2e/first-session-e2e.mjs` still expects the pre-V21 Today, so it stops at its first step. I only updated
  its table name (`app_events` → `household_signals`). The new Stage B checks live in `intel-e2e.mjs`.

Both need a separate fix.

**Not tested:** real devices (iPhone simulator CI is skipped when `family-e2e` fails), any provider call (none exists),
production data (none used).
