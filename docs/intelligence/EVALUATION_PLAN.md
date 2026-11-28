# Interpreter evaluation plan: $5 total, progressive, cheapest model first

**Owner decision (2026-11-28):** the AI evaluation budget is **$5.00 in total**, not $40 a month.

- Evaluate progressively and expand only when results justify it.
- Use the cheapest suitable model by default; benchmark a stronger model only where the cheap one falls meaningfully
  short.
- Reuse cached outputs, keep payloads minimal, and stay deterministic wherever AI isn't needed.
- The Lab replays saved AI outputs at no cost; live inference is an explicit development action.
- The cap is enforced in our backend, not only by provider alerts, and counts retries and concurrent requests.
- Any spending beyond $5 needs a results report and the owner's approval.
- **Production:** below $0.40 per active household per month, aiming substantially lower.

Synthetic households only. Nothing here touches real household data.

---

## 1. How spending is capped (three layers, the database is the authority)

| Layer | Where | What it stops |
| --- | --- | --- |
| **Database** (authority) | `intel_private.budget_reserve` (migration `20261216`), scope `synthetic` | **$5.00 cumulative** (all months, never resets), **$0.05 per call**. Serialized with an advisory lock, so concurrent requests can't both pass the check. Every retry is its own counted reservation (max 3). A reservation that expires without a report **keeps counting at its estimate**. Only a call that never left is released |
| **Inference function** | `supabase/functions/intel-infer` | Reserves before every provider call and settles after. Closed task list. Input size and content checks. A model without a price is never called. Replay requests (no `live: true`) never reserve |
| **Runner** | `scripts/intel-eval.mjs` | A worst-case ceiling per phase, checked before anything is sent. Phase order (each phase needs the previous one's gate). Over the ceiling or what's left: **sends nothing and writes an approval request** |

**Provider alerts:** set a $5 budget and alerts on the OpenAI project too, but only as a backstop.

**Raising the cap is an owner decision**, recorded on the scope row:

```sql
update public.intel_budget_scopes set lifetime_cap_micro_usd = <new total>, approved_note = 'Owner, <date>: <why>' where scope = 'synthetic';
```

**Tested:**
- `supabase/tests/household-intelligence-engine.sql`: the total holds across months; expired reservations still count;
  the per-call max; release; service-role-only access.
- `scripts/test-intel-budget-concurrency.sh`: 10 parallel workers against $0.05 of headroom → exactly 5 fit, total
  exactly $5.00.
- `scripts/test-intel-infer-db.mjs`: the real handler on the real rules; 30 concurrent live requests with $0.001 left →
  10 ran, 20 stopped, never over $5.00; retries counted; timeouts charged in full.
- `scripts/test-intel-eval-pipeline.mjs`: the whole progressive run, rehearsed with a scripted model.

---

## 2. Deterministic first

The model is asked only what the rules can't settle.

- **Event kinds:**
  - the rules (`classify()` in `src/lib/v18/playbooks.ts`) decide at confidence ≥ 0.75;
  - only the rest go to the model;
  - one deliberate exception: a "birthday" title without party words is second-guessed, because the rules are
    confidently wrong about reminders.
  - On the synthetic calendars, the rules settle 163 of 698 titles with no model, and they're always right on those.
- **Patterns:** observed and confirmed beliefs need no model; only **tentative** statistical candidates are offered for
  review.
- **Everything the Stage B engine does** (cadence, memory, ownership, load, timing, preferences, privacy) is
  deterministic and costs nothing.

---

## 3. Minimal payloads

- **What goes in:** the title with people as tokens (P2, S1), whether it repeats, and the part of the day. That's all.
  `validInput()` rejects extra fields, links, emails, phone numbers and street addresses.
- **What stays out:** descriptions, notes, ages, locations and household ids.
- **Batching:** ≤20 titles per request.
- **Short, stable prompts** (cache-friendly prefix), strict JSON schemas, a hard `max_output_tokens` per task.
- **Measured input:**
  - 2,938 characters for all of phase B (six requests);
  - 24,347 characters for phase C (49 requests).

---

## 4. Reuse: cached outputs and replay

- **Fingerprint:** every answer is keyed by a SHA-256 fingerprint of (task, prompt version, exact model, exact
  minimized input).
- **Two caches:**
  - **server:** `intel_inference_cache` (service role only; synthetic evaluation only), so a repeat is free even if a
    local cache is lost;
  - **local:** `evals/intel/cache/<fingerprint>.json`, committed (synthetic data only). Runs and the Lab read it
    without any network.
- **Replay** (`node scripts/intel-eval.mjs run <phase>` without `--live`):
  - scores from saved answers;
  - a miss falls back to the rules;
  - no request, no reservation, no cost.
- **Lab:** `interpretWithReplay()` in `src/lib/intel/lab.ts` gives any household's calendar as the engine would read it,
  using only saved answers. There is no provider code in the Lab.
- **Escalation** asks each distinct title once, however many households have it. In the rehearsal that was 1 call
  instead of 50.
- **Invalid answers** (outside the closed vocabularies) are cached too, marked invalid and never used. A replay
  reproduces exactly what the model did, without paying again.

---

## 5. Phases and gates

| Phase | What | Model | Worst case (at the recorded prices) | Ceiling | Gate to go on |
| --- | --- | --- | --- | --- | --- |
| **A** API validation | One `validate` call and one 2-title `interpret-event` | cheap | $0.0002 | $0.01 | Both valid: key, model id, structured output and usage accounting work |
| **B** five representative households | Their routed titles and tentative patterns | cheap | $0.002 | $0.10 | ≥95% valid answers **and** ≥10 points better than the rules on the same titles |
| **C** the other 45 | Same, only after B passed | cheap | $0.02 | $0.50 | Same gate; reports title groups where the cheap model is <80% right (≥5 titles) |
| **escalate** | Only the short groups' distinct titles | strong | depends on the groups (cents) | $0.50 | Escalate a task in production only if the strong model is meaningfully better there |
| meeting brief (later) | Not built yet | cheap first | estimated before running | needs approval | Same rule: cheap first; strong only for a shown shortfall |

**The five households** (`representative()`):
- syn-34: single-parent, low engagement;
- syn-04: two-parent, high engagement;
- syn-36: two-parent, medium engagement;
- syn-10: multigenerational, medium engagement, learning switched off;
- syn-01: two-parent, medium engagement.

Together they cover every family shape and engagement level, 15 of the 18 scenarios, and every title group.

**If a gate fails, spending stops.** A model that doesn't beat the rules by a meaningful margin isn't worth paying for.
The result is reported, and the rules stay.

**Model ids and prices:** `gpt-6-luna` (cheap) and `gpt-6.1-terra` (strong), with prices from Stage A (OpenAI's pricing
page, read 2026-11-28). Phase A is what confirms the ids work. If OpenAI's names or prices differ when we start, update
`PRICES` and `DEFAULT_TIERS` in `supabase/functions/_shared/intel/provider.ts` (or set `INTEL_MODEL_CHEAP` /
`INTEL_MODEL_STRONG`). An unpriced model is refused.

---

## 6. When more money is needed

`scripts/intel-eval.mjs` won't send a phase whose worst case exceeds its ceiling or what's left of the total. Instead it
writes `docs/intelligence/EVAL_APPROVAL_REQUEST.md` with:
- the results so far;
- why more inference is needed;
- the exact amount;
- the SQL to approve.

I bring that to you before anything else is spent. The same happens if the database refuses a reservation mid-phase.

---

## 7. Running it (once the setup below is approved and done)

```bash
node scripts/intel-eval.mjs plan
```

```bash
INTEL_INFER_URL=https://uvqhmlqwmgnohhduttip.supabase.co/functions/v1/intel-infer INTEL_EVAL_SECRET=… node scripts/intel-eval.mjs run A --live
```

Then B, C and escalation the same way, each only after the previous gate passed. Results go to
`evals/intel/results/<phase>.json` and `docs/intelligence/EVAL_LOG.md`.

```bash
node scripts/intel-eval.mjs status
```

**Setup this needs** (none of it is done; each step needs your approval):
1. **The engine's database objects in a Supabase project.** I recommend applying the reviewed migrations
   (`20261210_app_feedback`, then `20261216_household_intelligence_engine`) to production. Both are additive and
   rehearsed, AI is off for every household, and the evaluation uses only its own synthetic-scope tables. The
   alternative is a separate evaluation project.
2. **Deploy `intel-infer`** with `--no-verify-jwt`. It accepts only requests carrying `x-intel-eval` with the secret.
3. **Function secrets (dashboard or `supabase secrets set`; never in chat or the repository):**
   - `OPENAI_API_KEY` from the `organized-family-eval` project, owned by a service account;
   - `INTEL_EVAL_SECRET`, a long random string.
4. **On OpenAI:** set the evaluation project's budget to $5 with alerts, as the backstop.

---

## 8. Production cost: aim well under $0.40

$0.40 stays the hard cap per household (`intel_settings.monthly_budget_micro_usd`). **The aim is under $0.05 per active
household per month.**

**Levers:**
1. **Rules first, as above.** Most recurring titles are settled once.
2. **Interpret a recurring series once,** cached per household (`intel_interpretations`), not every occurrence.
3. **Generic titles across households.** Titles with no person or series tokens ("Picture day", "Early dismissal") can
   share one cached interpretation. Only the interpretation is reused, and only titles seen in at least 5 households
   (proposal; it needs your sign-off because it pools across families).
4. **The cheap model for everything by default,** including the weekly meeting brief. The strong model only for a task
   where evaluation shows a meaningful shortfall.
5. **Small context:**
   - the meeting brief gets code-computed facts and ≤30 memory rows (target ≤10k input tokens);
   - stable system prompts, which prompt caching discounts;
   - background mode for weekly jobs (30–40% off). No Batch API, because it isn't eligible for Zero Data Retention.
6. **The cap's own behavior:**
   - at 80% of a household's month, everything runs on the cheap model;
   - at 100%, rules only until the month resets;
   - the global monthly cap backs it up.

**Estimate per active household per month** (cheap model, the levers above):

| Job | Estimate |
| --- | --- |
| New-title interpretation | about $0.001 |
| Pattern review | about $0.001 |
| Weekly meeting brief (~10k in / 3k out, 4.3 a month) | about $0.011 |
| **Total** | **≈ $0.015**, roughly 1/25 of the cap |

Phase B/C measurements replace these estimates with real token counts.
