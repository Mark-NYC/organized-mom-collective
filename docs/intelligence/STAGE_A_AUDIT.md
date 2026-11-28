# Household Intelligence Engine · Stage A: audit and proposal (2026-11-28)

**Status: for owner review.** Nothing has been built, deployed or migrated. No household data has been sent to any AI
provider. Branch `claude/dreamy-mendel-vhttkn`, from `main` at `0ce4949a`. Production `/app` (V21) is untouched.

**Provider:** the owner expects to use **OpenAI** for inference. Sections 6 and 8 are written for that, behind a
provider-independent interface.

**Contents:**
1. [The short version](#1-the-short-version)
2. [Audit: what exists](#2-audit-what-exists)
3. [Audit: against the vision](#3-audit-against-the-vision)
4. [Calendar and reminder access, by platform](#4-calendar-and-reminder-access-by-platform)
5. [Proposed architecture](#5-proposed-architecture)
6. [The AI interpreter (OpenAI first, provider-independent)](#6-the-ai-interpreter-openai-first-provider-independent)
7. [Learning rules](#7-learning-rules)
8. [Cost estimate](#8-cost-estimate)
9. [Privacy, safety and consent](#9-privacy-safety-and-consent)
10. [Longitudinal evaluation (Stage F)](#10-longitudinal-evaluation-stage-f)
11. [Stages, deliverables and approval gates](#11-stages-deliverables-and-approval-gates)
12. [Risks](#12-risks)
13. [Decisions needed from the owner](#13-decisions-needed-from-the-owner)

---

## 1. The short version

- **There is no AI in the product today.** No provider SDK, no API key, no model call anywhere in `src/`,
  `supabase/functions/` or `scripts/`. I checked for `api.openai`, `api.anthropic`, `generativelanguage`,
  `@anthropic-ai` and `openai`; none appear. `package.json` has no AI dependency.
- **What exists is a substantial deterministic intelligence layer:**
  - V18 playbooks and household memory;
  - V19 attention routing and feedback;
  - V20 notification rules;
  - V21 requests, event choices and remembered decisions;
  - the MAWL development engine.

  It is all TypeScript running in the browser. Its shared state lives in one JSON document per household
  (`household_intelligence`).
- **An AI seam already exists and is the right shape:** `src/lib/v18/interpret.ts`. It minimizes what is sent, treats
  event notes as untrusted, validates output against a closed vocabulary, caches by fingerprint and never writes. It
  has only ever run a **simulated** interpreter, and production switches it off (`ctx.s.live`,
  `src/components/v19/TodayV19.tsx`).
- **Learning is real but shallow.**
  - Memory needs three consistent observations before it says "usually" (`MIN_EVIDENCE = 3`,
    `src/lib/v18/memory.ts`).
  - Feedback distinguishes handled, not relevant, later, never and plain dismiss (`src/lib/v19/attention.ts`).
  - Preparation reminders stop after the family twice says it was already handled (`independentAt`).

  But this all lives in one client-side document. It is not queryable on the server, has no confidence decay, no
  per-person visibility and no evidence references, and only covers the event-kind × need × owner shape.
- **There is almost no real behavioral data yet, and little to learn from in production.** Production has:
  - 11 households, **none with two adults**;
  - 4 confirmed agreements;
  - 1 connected Google account (1,341 imported events);
  - 1 household-intelligence document;
  - 0 push devices.

  The pilot event table `app_events` (`20261210`) **is not applied in production**, and neither is
  `household_archives` (`20261130`). Learning has to be designed for a cold start, and evaluation has to be synthetic
  until a real pilot runs.
- **The 50 modeled households are not in this repository.** The repo has:
  - 8 sample households (`src/data/club/samples.ts`);
  - 35 V18/V19 scenarios (`src/lib/v18/scenarios.ts`, `src/lib/v19/scenarios.ts`);
  - V20 notification scenarios and V21's 16 scenarios (`src/lib/v21/household.ts`);
  - the Rivera demo (`20261209`);
  - five first-session families (`scripts/e2e/first-session-e2e.mjs`).

  See [decision D1](#13-decisions-needed-from-the-owner).
- **Calendar history is thin.** Imported calendars keep only:
  - title, location and times;
  - tentative / confirmed status;
  - one month back to one year ahead.

  They keep no description, attendees or series rule, and older events are dropped on refresh. Learning
  "what this event usually needs" requires us to retain our own compact history ([§5.2](#52-data-model-additive-reversible)).
- **Proposal.**
  - Keep the client engine as the presentation layer and the always-available fallback.
  - Add a server-side pipeline as a Supabase Edge Function, scheduled with the same pg_cron + pg_net pattern the push
    dispatcher already uses.
  - It writes to four new tables: an evidence-backed memory, a behavioral signal log, an interpretation cache and a
    recommendation ledger with usage accounting.
  - AI (OpenAI `gpt-6-luna` routinely, `gpt-6.1-terra` for the weekly meeting brief) only interprets and proposes.
  - Deterministic code validates every claim before anything can reach Today or the Family Meeting.
  - Estimated cost: **about $0.05–$0.15 per active household per month** at OpenAI's current published prices. There
    is headroom for 3× underestimation before reaching $0.50.

---

## 2. Audit: what exists

### 2.1 Intelligence code (all deterministic, all in the browser)

| Layer | Files | What it does | Learns from use? |
| --- | --- | --- | --- |
| V18 playbooks | `src/lib/v18/playbooks.ts` | Keyword `classify()` of event titles into 9 kinds (field trip, birthday party, party, sports game or practice, performance, appointment, routine, other); per-kind needs (lunch, RSVP, gift, card, ride, gear, outfit), each with lead days and a likely owner (child / adult / either). `core` needs surface on their own. | No |
| V18 engine | `src/lib/v18/engine.ts` | `needsWork()` (missing preparation), `looseLoops()` (talked about, never agreed), `capacity()` (busy days), `development()` (MAWL topics), `snapshot()` baseline for "what changed since we planned", `observe()`, `possibleOwner()` | Only through memory |
| V18 memory | `src/lib/v18/memory.ts` | Confirmed memories (the family said so) plus observations; an inference only after 3 consistent observations and no contradiction; `forget()` blocks re-learning from the same evidence. Effects: `owner` (X usually has it) and `not-needed`. | **Yes, narrowly** |
| V18 interpreter seam | `src/lib/v18/interpret.ts` | `minimize()` (names, emails, phone numbers and URLs stripped; age bands, not ages), `validateInterpretation()` (known kinds and need ids only), `EventInterpreter` interface, `ASK_BELOW = 0.75` | Cache only |
| V19 attention | `src/lib/v19/attention.ts`, `engine.ts`, `resolve.ts` | Cascading change consequences, backup, "Something changed?" → simplify, recurring friction from completion history, growing ownership, intentions, seasons; `worthOf()` scoring with `THRESHOLD = 0.55`, destination routing (today / meeting / remembered), an attention budget (`shown`), preparation windows per need (`WINDOW`, `windowFor()` adjusted by the family's assistance level) | **Yes:** feedback kinds gate future insights; `independentAt()` stops reminders a family handles on its own |
| V20 notifications | `src/lib/v20/notify.ts`, `push.ts`, `supabase/functions/push-delivery/` | Three purposes only (needs you / changed / handled) plus an optional meeting reminder; quiet hours; at most 4 non-urgent alerts per adult per day; dedupe per household and key (`household_notify`) | Uses preferences, does not learn timing |
| V21 shared responsibility | `src/lib/v21/model.ts`, `today.ts` | Requests (ask / accept / decline, idempotent, deterministic ids), event intents with "Nothing needed", remembered preferences and decisions made each time, per-date completion, one-date covers, a personal Today per adult, `carryForward()` into the meeting, `widgetFor()` | **Yes, explicitly:** remembered decisions inform suggestions |
| MAWL development | `src/lib/family-development/` (`framework.ts`, `engine.ts`, `records.ts`, `skills.ts`), tables `household_development`, `household_development_events` (`20261207`) | Model → Assist → Watch → Launch stages per child and skill; every family decision logged with from/to stage and signal (performance / consistency / ownership × strong / partial / not-yet) | **Yes:** the only server-side longitudinal log of family decisions |
| Monthly Family Meeting | `src/lib/club/family-meeting.ts`, `src/data/club/family-meeting.ts` | The Club month's questions and suggested parts per person, from the family profile | No |
| Personalization | `src/lib/club/personalize/` (assignment, cues, colors), `src/lib/club/family-profile.ts` (`club_activities`, `club_responsibilities`, `20261109`) | Setup answers → printable suggestions, cues and colors | No |

### 2.2 Where household knowledge is stored

| Store | Migration | Contents | Server-queryable | Notes |
| --- | --- | --- | --- | --- |
| `household_intelligence` | `20261215000000` | One JSON document per household: V18 memory, feedback, reports, history, shown, talked, interpretations, baseline, notification preferences, sent, claims, V21 requests / intents / decisions / done / covers / cards / acked | Only as one opaque document | Revision-checked; merged three ways on the client (`src/lib/v20/intel-sync.ts`); pruned (`prune()` + `pruneV21()`). **Readable by every adult in the household**: it can't hold per-person-private memory. Largest production document: 2.2 KB. |
| `club_responsibilities` (agreements) | `20261109`, `20261126`, agreement follow-through | The family's agreed responsibilities: text, owners, when, done-means, revision, `confirmed_at` | Yes | The source of truth for **intentional** ownership |
| `household_development(_events)` | `20261207` | MAWL records and decision log | Yes | Club households |
| `household_priorities` | `20261212` | This week's chosen focus | Yes | One row per choice |
| `household_meeting_progress` | `20261213` | The shared meeting checkpoint | Yes | Step and completion times |
| `household_cleaning_marks`, `household_cleaning_rhythm` | `20261201`, `20261214` | Shared cleaning checks (with dates); rhythm and one-week moves | Yes | A real behavioral signal (who / when) |
| `calendar_events` | `20261125` | The family's own events: title, notes, location, recurrence, `member_ids`, `owner_member_id`, revision | Yes | Full history kept (soft delete) |
| `calendar_feed_events` | `20261205` | Imported occurrences: title (≤120), location, times, status | Yes | **No description, attendees or RRULE; one month back to one year ahead; older ones dropped on refresh** |
| `calendar_event_tasks` | `20261211` | Responsibilities on imported events (who, done) | Yes | |
| `household_notifications` | `20261215000000` | Queued and sent notices (kind, recipient, status) | Yes | 0 rows in production |
| `app_events` | `20261210` | Pilot analytics: once per user per event per **day** (no hour) | — | **Not applied in production** |

### 2.3 Behavioral signals available today

**Available now on the server:**
- agreement saves and revisions;
- MAWL decisions;
- priority choices;
- meeting checkpoints;
- cleaning checks with dates;
- event-responsibility completion;
- calendar edits (revision and `updated_at`);
- notification status.

**Available only inside the client document** (not queryable, no timestamps finer than a day):
- first time an insight was shown;
- feedback kind;
- completion history (`history`, last 200);
- reports;
- V21 request lifecycle.

**Missing entirely:**
- what time each adult opens the app;
- whether a recommendation was shown versus acted on, per adult;
- edits to suggestions;
- per-adult response latency to requests;
- reminder data (no integration).

### 2.4 Server infrastructure that can be reused

- **Edge Functions on Deno.** Production limits: 2 s CPU and 150 s wall clock per request
  (`docs/calendar/CALENDAR_INTEGRATION.md`). Model calls are I/O, so they fit.
- **Scheduling: pg_cron + pg_net with one-time tokens.** The existing example is `push_private.dispatch()` →
  `push-delivery`.
- **Server-side secrets** (the VAPID pattern) and the Vault (calendar links).
- **Security model:**
  - SECURITY DEFINER RPCs that check household membership;
  - row-level security on every table;
  - private / household visibility on connected calendars;
  - the database backup workflow (`.github/workflows/db-backup.yml`) with restore verification;
  - rollback rehearsal scripts (`scripts/rehearse-*.sh`).

---

## 3. Audit: against the vision

| Vision area | Implemented | Short of the vision |
| --- | --- | --- |
| Event intelligence | Keyword classification into 9 kinds; needs per kind; V21 removed automatic needs from Today and lets the family choose ("Plan something", "Nothing needed") | No semantic understanding: "Johan's birthday" (a text) and "Johan's birthday party" (a gift and a ride) are distinguished only by keywords; tournament versus practice only by the words "game" or "tournament"; no understanding of exceptions within a series |
| Habit intelligence | Completion history and friction (V19); cleaning rhythm | No pattern detection over time (grocery day, laundry rhythm); no disruption detection |
| Collaboration intelligence | Agreements (intentional ownership), V21 requests, covers and "make it the usual"; V18 `possibleOwner()` phrases possibilities only | No measure of who actually carries what (observed versus agreed); nothing notices when one adult carries most of a category; no learning of handoff habits |
| Relationship and occasion intelligence | V21 remembered preference per event title ("We usually send Johan a text") | Per-title only; no generalization ("cousins' birthdays → a text") |
| Timing intelligence | Quiet hours; preparation windows per need; assistance level | Nothing learns when each adult opens the app or responds |
| Preference intelligence | Five feedback kinds; never / not-relevant suppression; "later" with a date; undo in Account | No learning across similar items; no decay; edits to suggestions are not captured as feedback |
| Persistent memory | V18 memory + V21 decisions, correctable and forgettable | One shared client document: no evidence references, confidence, review date, per-person visibility or contradiction counts |
| AI interpretation | Seam, minimization, validation and cache (simulated) | No provider, no server function, no structured-output contract beyond event kind and needs |
| Recommendation validation | Deterministic engines only produce valid items by construction | No validation layer for model proposals (needed before any AI output reaches a family) |
| Shadow mode and evaluation | Unit and e2e scenario suites | No recommendation ledger, no shadow comparison, no longitudinal harness |
| Cost controls | — | No usage ledger, budgets or prompt-version tracking |

**Conclusion.** The vision's product rules are largely in place: restraint, the attention budget, correctable memory,
explicit agreement over inference, "Nothing needed". What is missing is the server-side substrate (signals, memory
rows, a recommendation ledger) and the interpreter itself.

---

## 4. Calendar and reminder access, by platform

| Source | Available today | Fields | What it would take | Website (PWA) | Native iOS (Capacitor) |
| --- | --- | --- | --- | --- | --- |
| Family calendar (ours) | **Yes** | Everything, including notes, people, owner, recurrence, history | — | ✓ | ✓ |
| iCal / webcal links (school, Apple iCloud shared or public, Outlook) | **Yes**, refreshed server-side | Title, location, times, status; DESCRIPTION, ATTENDEE and the RRULE are parsed but **not stored** | Store a sanitized description (≤300 characters) and the series UID; keep a compact history (§5.2) | ✓ | ✓ |
| Google Calendar | **Yes**, read-only (`calendar.events.readonly`, `calendar.calendarlist.readonly`), 1 account in production | Same as iCal; Google also exposes description, attendees and `recurringEventId` (not stored) | Same as above. **Google app verification for the sensitive scope** is needed beyond 100 users (2–6 weeks, `docs/calendar/GOOGLE_CALENDAR.md`) | ✓ | ✓ |
| Google Tasks | No | — | `tasks.readonly` scope (sensitive; verification), a server sync like Calendar | ✓ (server-side) | ✓ |
| Apple Calendar (device) | Only via iCal links the user shares | — | EventKit through a Capacitor plugin (device read, user permission); data stays on the device unless the app uploads it | ✗ | ✓, native only |
| Apple Reminders | **No** | — | EventKit reminders (native only). No web API exists. | ✗ (impossible) | ✓, native only |
| Microsoft / Outlook | Via iCal link only | Same as iCal | Microsoft Graph (separate OAuth) | ✓ (server-side) | ✓ |

**The app must work with none of these.** The family calendar, agreements, requests and the meeting are enough for
every rule in §7. Integrations only add evidence.

---

## 5. Proposed architecture

```text
 Ingestion            Observation          Memory               Analysis              Interpretation        Validation           Surfaces
 calendar_events  ┐                                                                                                              Today (V21)
 feed events      ├─► household_signals ─► household_memory ─► deterministic stats ─► AI interpreter ──────► validator ─► intel_recommendations ─► Family Meeting
 agreements       │   (append-only)        (rows + evidence)    (patterns, conflicts,  (only when rules     (facts, permissions,    (shadow → live)     Notifications
 MAWL, meeting,   │                                             windows, ownership)    are unsure)          privacy, dedupe,                           Widget state
 cleaning, V21    ┘                                                                    + cache              timing, budget)
                                                                                           ▲
                                                 feedback ─────────────────────────────────┘ learning rules (§7)
```

### 5.1 Where things run

**Browser (unchanged role).**
- Runs today's deterministic engines and renders Today and the meeting.
- Writes signals (a new RPC `household_signal_log`).
- Reads validated recommendations (a new RPC `household_recommendations(surface)`) and merges them into the existing
  V21 matter list and meeting agenda.
- If the server has nothing, or the AI is down, the client engine behaves exactly as it does today.

**Edge Function `household-intelligence` (new).**
- **Job types:**
  - `interpret-events`: new or changed events, batched, cached;
  - `learn`: memory updates from new signals, deterministic, no AI;
  - `daily-prepare`: before each household's learned usage window;
  - `meeting-brief`: 24 hours before the household's meeting, or Sunday morning by default;
  - `pattern-review`: weekly.
- **Queue:** jobs come from an `intel_jobs` table, filled by triggers on the source tables and by pg_cron. They are
  processed by a dispatcher modeled on `push_private.dispatch()`.
- **Batching:** the scheduled jobs (`meeting-brief`, `pattern-review`) can use OpenAI's background mode at 30–40% off
  (§8). The Batch API is avoided if Zero Data Retention is required (§9).

### 5.2 Data model (additive, reversible)

One migration, `2026121600…_household_intelligence_engine.sql`, with the rollback statements in the file. It is
rehearsed by an extended `scripts/rehearse-household-rollback.sh`. All new tables use the established pattern:
- row-level security on;
- no direct grants to `authenticated`;
- SECURITY DEFINER RPCs that check household membership;
- the service role only for the Edge Function.

| Table | Purpose | Key columns |
| --- | --- | --- |
| `household_signals` | Append-only behavioral log, minimal and bounded | `id`, `household_id`, `member_id` (nullable), `user_id`, `kind` (closed vocabulary, §7.1), `subject_kind` + `subject_ref` (an opaque id, never text), `at`, `local_hour`, `local_dow`, `props` jsonb (a whitelisted handful of fields). **Retention: 180 days**, then rolled up into memory |
| `household_memory` | Evidence-backed memory, one row per belief | `id`, `household_id`, `member_scope` (null or member id), `visible_to` (`household` or one adult user id), `category` (`event-meaning`, `occasion`, `routine`, `responsibility`, `timing`, `preference`, `temporary`), `subject_key` (normalized, e.g. `series:<uid>`, `title:<normalized>`, `need:pickup`, `category:meals`), `content` jsonb (validated per category), `status` (`confirmed`, `observed`, `tentative`, `temporary`, `retired`), `source` (`family`, `rules`, `stats`, `model`), `confidence`, `support`, `contradict`, `first_seen`, `last_seen`, `review_after`, `expires_at`, `confirmed_by`, `revision`. Unique on (`household_id`, `category`, `subject_key`, `member_scope`) |
| `household_memory_evidence` | Why a memory exists (capped, for example the last 20 per memory) | `memory_id`, `signal_id` or `ref` (event key, agreement id), `polarity` (+ / −), `at` |
| `intel_interpretations` | Model and rules interpretation cache per household | `household_id`, `fingerprint` (normalized title + series + context version), `result` jsonb, `source`, `model`, `prompt_version`, `created_at`, `expires_at` |
| `intel_recommendations` | Ledger of every proposal, in shadow and live | `id`, `household_id`, `dedupe_key` (unique), `type`, `subject_refs`, `evidence_refs`, `facts` jsonb (code-verified), `inferred` jsonb (model), `confidence`, `significance`, `urgency`, `action` jsonb, `recipient_member`, `surface`, `earliest_at`, `expires_at`, `status` (`shadow`, `rejected:<reason>`, `validated`, `presented`, `accepted`, `edited`, `dismissed:<kind>`, `expired`), `source` (`rules` / `model`), `model`, `prompt_version`, `run_id` |
| `intel_runs` | Usage and cost accounting | `id`, `household_id`, `job`, `model`, `prompt_version`, `input_tokens`, `cached_tokens`, `output_tokens`, `reasoning_tokens`, `cost_micro_usd`, `latency_ms`, `outcome`, `at` |
| `intel_settings` | Per household | `ai_enabled` (consent, **off by default**), `monthly_budget_micro_usd`, `shadow` (true until activation), `paused_until` |

**What stays the same:**
- `household_intelligence` stays as the **client's working document**: shown, sent, acked, V21 requests and covers.
  V18 memory and V21 decisions are **migrated** into `household_memory` as confirmed rows (decisions) and signals
  (observations). The client reads them through the new RPC. Nothing is duplicated after migration.
- `app_events` is **not applied as a separate table**: app-open signals go into `household_signals`, now with the hour.
  Its pilot dashboard (`docs/pilot/ANALYTICS.md`) reads a view over the signals instead
  (see [decision D3](#13-decisions-needed-from-the-owner)).
- Compact event history: `household_signals` records `event-occurred` for shared events, with series UID, normalized
  title hash and day. Learning keeps working after the iCal window drops old occurrences.

---

## 6. The AI interpreter (OpenAI first, provider-independent)

**Interface.** It lives in `supabase/functions/_shared/intel/`. It reuses the shape of V18's `EventInterpreter`,
moved to the server.

```ts
interface Interpreter {
  readonly provider: string; readonly model: string;
  run<T>(task: TaskSpec<T>, input: unknown): Promise<{ output: T | null; usage: Usage; error?: string }>;
}
// TaskSpec = { name, promptVersion, systemPrompt, jsonSchema, maxOutputTokens, validate(raw): T | null }
```

**Adapters.**
- `openai.ts` (first): Responses API, `store: false`, strict JSON-schema structured output.
- `anthropic.ts` (optional later).
- `null.ts`: the deterministic fallback, which always returns null.

Prompts are versioned files. Every call is logged in `intel_runs`.

**Tasks.** Each has a closed output schema and is validated by code.

| Task | When | Input (minimized) | Output (closed vocabulary) | Model |
| --- | --- | --- | --- | --- |
| `interpret-event` | A new or materially changed event title or series the rules can't classify with ≥ 0.75 confidence; batched up to 20 per call | Title, sanitized description (≤280 characters), day part, duration, whether it repeats, attendee counts and age bands, relevant household memory for the same `subject_key` (≤5 rows) | `kind` (the extended playbook kinds: + birthday-reminder versus birthday-party, tournament, special school event, unusual appointment), `needs[]` (known ids), `is_exception`, `confidence`, short `reason` | `gpt-6-luna` |
| `interpret-change` | A shared event moved, was cancelled or newly overlaps an agreement (the conflict itself is established by code) | The code-built change facts and the affected agreements | `significance`, `who_is_affected` (roles), `suggested_response` from a closed set | `gpt-6-luna` |
| `meeting-brief` | Weekly, before the meeting | Next week's code-computed facts: events, conflicts, unowned needs, routine disruptions, unresolved requests, observed-versus-agreed load per category, MAWL due check-ins, ≤30 memory rows | ≤5 ranked agenda items, each with `evidence_refs` (only ids that were in the input), `why`, a suggested question | `gpt-6.1-terra` |
| `pattern-review` | Weekly, only when stats found a candidate | The statistical candidate (counts, regularity, recency) | Whether the pattern is meaningful, a human-readable label, whether to ask the family to confirm | `gpt-6-luna` |

**Guardrails in code (the validator).**
1. **Untrusted input.**
   - Imported text is wrapped as data with a fixed delimiter.
   - Instructions inside it are ignored by contract, and the schema leaves no free-form action field.
   - Every output field is checked against the closed vocabulary.
2. **Facts and permissions.**
   - Every `evidence_ref` must have been in the input.
   - Every event must exist and be visible to the recipient: private calendars only to their owner.
   - Every person must be a member.
   - Times and conflicts must be recomputed by code.
3. **Agreements win.** A proposal that contradicts a confirmed agreement or memory is rejected (`rejected:contradicts-agreement`).
4. **Restraint.**
   - Confidence must be at least the task's threshold.
   - No duplicate key within its window.
   - Nothing for a need the family marked "Nothing needed" or "never".
   - V19's attention budget and the notification caps still apply.
5. **Writing.** The model never writes. Accepting a proposal runs the existing deterministic actions (agreement save,
   V21 `askHelp`, `chooseIntent`).
6. **Failure.**
   - Timeouts at 20 s, at most 2 retries with backoff, and a circuit breaker per provider.
   - On failure the job completes with rules only, and Today is unaffected.

---

## 7. Learning rules

All learning rules are deterministic code. AI only labels candidates.

### 7.1 Signals (closed list)

- `app-open` (with hour);
- `today-viewed`;
- `rec-presented`;
- `rec-response` (accepted / edited / dismissed-kind / already-handled / later);
- `request-asked` / `answered`;
- `agreement-saved` / `changed` / `removed`;
- `task-done`;
- `cleaning-checked`;
- `meeting-started` / `finished`;
- `meeting-decision`;
- `intent-chosen` (including nothing);
- `memory-confirmed` / `corrected` / `forgotten`;
- `event-occurred` (series hash, day);
- `event-changed`.

Payloads hold ids and enums, never free text.

### 7.2 Memory updates

| Rule | Detail |
| --- | --- |
| Confirmed beats everything | `status = confirmed` rows come only from explicit family actions: agreements, "remember this", "make it the usual", "Nothing needed" with remember, a meeting decision. Observed or model memories never override them. |
| Observed needs evidence | At least 3 supporting observations in at least 2 distinct weeks, with no contradiction in the last 2. Confidence = Beta(support + 1, contradict + 1) weighted by recency (half-life 60 days). |
| Patterns adapt | Each weekly review decays confidence. `review_after` lapses without new support → `retired`. A run of 2 contradictions retires an observed memory at once. |
| Observed is not agreed | Collaboration memories record **observed share per category** separately from agreements. When one adult has carried more than 75% of a category for 4 weeks with no agreement, the rule produces a **meeting topic** ("Who'd like to own Friday pickup?"), never an assignment and never a Today card. |
| Dismissals are not all the same | `already-handled` → evidence the family copes (stops preparation reminders for that need after 2). `not-relevant` → suppress that kind for that subject. `never` → suppress the pattern. `later` → reschedule. A plain dismiss → no learning beyond today (V19 semantics, kept). `edited` → store the edit as a preference candidate. |
| No activity is not neglect | Missing completions never create negative evidence. Only explicit signals (declined, cancelled, reported) or calendar facts do. |
| Correction | Forgetting a memory retires it and blocks re-learning from the same evidence (V18's rule, kept). Correcting it writes a confirmed row. |
| Timing | Each adult's usage window = the 70th-percentile hour band of `app-open` over 28 days (at least 8 opens). Used to schedule `daily-prepare` and opted-in reminders, never to add notifications. |

---

## 8. Cost estimate

**OpenAI prices (official pricing page, read 2026-11-28),** per million tokens:

| Model | Input | Cached input | Output |
| --- | --- | --- | --- |
| `gpt-6-luna` | $0.10 | $0.01 | $0.50 |
| `gpt-6.1-terra` | $1.00 | $0.05 | $5.00 |

- **Batch:** half price, but `/v1/batches` is **not** eligible for Zero Data Retention.
- **Background mode:** 30% off with a 2-hour window, 40% off with an 8-hour window, on luna and terra.

**Per active household per month** (two adults, about 25 shared events a week, 70% of titles recurring):

| Job | Calls | Input (k tokens) | Output, including reasoning (k tokens) | Model | Cost |
| --- | --- | --- | --- | --- | --- |
| `interpret-event` (new or changed titles only, batched 20, cached system prompt 60%) | ~4 | 16 | 8 | luna | $0.005 |
| `interpret-change` | ~6 | 9 | 3 | luna | $0.003 |
| `pattern-review` | ~4 | 12 | 4 | luna | $0.003 |
| `meeting-brief` | ~4.3 | 40 | 15 | terra, 8-hour background (−40%) | $0.069 |
| **Total** | | | | | **≈ $0.08** |

- **Range:** $0.05–$0.15 depending on calendar volume and reasoning tokens.
- **Safety margin:** about 3× before the $0.50 target.
- **Budget control:**
  - a default cap of $0.40 per household per month in `intel_settings`;
  - at 80% of the cap, `meeting-brief` drops to luna;
  - at 100%, rules only until the month resets.
- **Evaluation (Stage F, synthetic data only):** 50 households × 26 weeks × 4 arms is roughly
  25M input and 9M output tokens. That is **about $10–$40** at these prices; the owner approves the spend first.

These are estimates. Stage F measures real token counts from logs.

---

## 9. Privacy, safety and consent

**What goes to the provider.** `minimize()` rules on the server:
- no member names (roles "Adult A", "Child, 9–12");
- no email, phone, URL or address in titles, notes or descriptions;
- no locations by default (only "has location" / "school" if the family calendar says so);
- no household id;
- per task, only the memory rows for the subject.

**Private calendars.**
- Events from a calendar marked private are interpreted only for their owner.
- They never enter shared memory, signals visible to the other adult, the meeting brief or recommendations to
  anyone else.
- `visible_to` on memory rows enforces this in SQL.

**Children.**
- Age bands only.
- No developmental judgments beyond the family's own MAWL decisions.
- No "struggles", diagnoses or behavior labels in any memory or prompt. The schema has no field for them.

**Consent.**
- `ai_enabled` is off by default per household.
- One plain disclosure in Account: "Smarter suggestions use an AI service to understand event names. Names and contact
  details are removed first."
- Turning it off stops all calls, and the family can delete the AI-derived memories.
- Shadow mode (Stage E) runs only on synthetic and internal test households until the owner approves real ones.

**Provider terms (OpenAI, read 2026-11-28).**
- API data is not used for training by default.
- Abuse-monitoring logs are kept for up to 30 days.
- Zero Data Retention needs sales approval, and the batch endpoint is excluded from it.
- **Recommendation:** request Zero Data Retention (or Modified Abuse Monitoring) for the production project, and call
  the Responses API with `store: false` before any real household data is sent.

**Deletion.**
- Deleting an account or household cascades through every new table.
- "Forget" on a memory retires it.
- `intel_runs` stores token counts and outcomes only, never prompts or outputs.

---

## 10. Longitudinal evaluation (Stage F)

**Simulator.** A deterministic TypeScript simulator, `scripts/intel-sim/`, builds 50 households × 26 weeks:
- **Calendars:** school terms, sports seasons, birthdays (some needing nothing, some a gift), appointments, travel and
  holidays.
- **Agreements and meetings:** agreements and meeting decisions, plus routines that change mid-run (a work schedule
  change in week 12).
- **Behavior:** completion and response behavior from household parameters: engagement low / mid / high, one-parent
  load skew, integration coverage.
- **Feedback:** each recommendation's response is decided by a ground-truth "household intent" model held outside the
  engine, so arms can be scored objectively, not by asking a persona.

**Arms:**
1. today's deterministic engine;
2. AI interpretation, no memory;
3. AI and memory;
4. the full hybrid pipeline.

**Measures, per week:**
- precision (helpful / presented);
- recall of ground-truth needs;
- false positives on "nothing needed" events;
- repeated suggestions;
- specificity (an action with an owner and a date);
- timeliness (inside the useful window);
- privacy violations (must be 0);
- injection success (must be 0);
- cost per household.

**Success condition:** arms 3 and 4 improve week over week and beat arm 1 by week 8, with no privacy failures.

**Hard cases (all required):**
- a birthday needing nothing;
- a birthday needing a gift;
- a series exception;
- a changed routine;
- a parent who wants to share a load they carry;
- an event already covered by a reminder (where integrated);
- "already handled";
- a private event;
- a low-engagement family;
- no integrations;
- contradictory evidence;
- injected instructions in a calendar description;
- the provider down for a week.

Synthetic results are engineering evidence only. A real pilot with consenting households follows Stage G.

---

## 11. Stages, deliverables and approval gates

| Stage | Deliverables | Tests | Gate |
| --- | --- | --- | --- |
| **B. Observation and memory** | Migration (signals, memory, evidence, interpretations, recommendations, runs, settings) + rollback; RPCs; client signal logging; migration of V18 memory and V21 decisions into rows; Account "What we've learned" reads rows (correct / forget); pruning job | SQL suites (isolation, visibility, deletion cascade, rollback rehearsal); unit tests for the learning rules | Owner approves the migration; verified backup; applied to production with no behavior change (signals only) |
| **C. Interpreter** | `household-intelligence` Edge Function; the provider interface; OpenAI adapter; `null` adapter; prompts v1; validator; job queue and dispatcher; budget and circuit breaker | Contract tests with recorded responses; injection corpus; validator rejects; failure fallback | Owner approves the provider account, Zero Data Retention request, secret placement and consent copy |
| **D. Continuous learning** | Statistical pattern detectors (routines, ownership share, timing windows, disruption); memory update rules; feedback → memory | Unit and property tests over synthetic histories | — |
| **E. Shadow mode** | Pipeline writes `intel_recommendations` with `status = shadow` for internal test households only; comparison report against the client engine | Daily shadow diff | Owner reviews shadow output |
| **F. Evaluation** | The 50-household simulator, 4 arms, metrics, cost report | As in §10 | Owner approves the evaluation spend (~$10–$40) |
| **G. Controlled activation** | `household_recommendations(surface)` merged into the V21 matter list and meeting agenda behind the per-household `ai_enabled` consent; widget state includes validated items | Existing V21 / V20 / family / e2e suites stay green; new live e2e | Owner approval per cohort |

**Sequencing.** B can start immediately and has value on its own: real signals and a queryable memory, even without
AI. C needs the provider decisions (§13). D and E can run in parallel once B and C are done.

---

## 12. Risks

| Risk | Mitigation |
| --- | --- |
| Too little real data (11 households, none with two adults) to tune anything | Cold-start rules are explicit (the "usually" threshold, confirmation first); synthetic evaluation; a recruited pilot before tuning |
| Client engine and server pipeline disagree | One source of truth per concern: the server owns memory and model proposals, the client owns presentation and deterministic fallback; shadow diff before activation |
| Prompt injection through calendar text | Data delimiting, closed schemas, no action fields, validator, injection corpus in CI |
| Private event leakage to the other adult | `visible_to` enforced in SQL; private events never in shared prompts; tests that try to leak |
| Cost growth from reasoning tokens | Token caps per task, budget per household, logging of reasoning tokens, luna by default |
| Provider change or price change | Provider-independent interface; memory in Postgres; prompts versioned |
| Edge Function limits (2 s CPU) | Batching; I/O-bound calls; jobs claim small batches like the calendar refresher |
| Structured-output support on luna not yet confirmed from OpenAI's model page | Verify in Stage C; the validator re-checks the JSON regardless |
| Google verification and native reminders | The engine never depends on them |
| Learning reinforces one parent carrying everything | Observed share only ever becomes a meeting question, never an assignment (§7.2) |

---

## 13. Decisions needed from the owner

**D1. The 50 modeled households.**
- **Question:** where do they live? They aren't in this repository.
- **My recommendation:** if they're external documents, I'll encode them into the simulator in Stage F. Otherwise I'll
  generate 50 from the household parameters in §10, seeded from the 8 sample households and the V18–V21 scenarios.

**D2. Provider setup (OpenAI).**
- **Questions:**
  - Who creates the project and key?
  - Should we request Zero Data Retention or Modified Abuse Monitoring?
  - Is luna for routine work and terra for the weekly brief acceptable?

**D3. `app_events`.**
- **My recommendation:** retire migration `20261210` (never applied in production) and derive the pilot dashboard
  from `household_signals`. The alternative is to apply both.

**D4. Consent default.**
- **My recommendation:** AI off until a household opts in, with the disclosure copy in §9. The alternative is on by
  default with a disclosure.

**D5. Description storage.**
- **Question:** may we store a sanitized event description (≤280 characters) from iCal and Google feeds for
  interpretation? Today none is kept.

**D6. Monthly budget per household.**
- **My recommendation:** $0.40 cap, $0.08 expected.

**D7. Start Stage B.**
- **Question:** may I build the observation and memory layer? It is additive, with rollback, and changes no behavior
  until signals flow. It would be built on this branch, with production application only after your review.
