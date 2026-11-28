# Interpreter evaluation data (synthetic only)

- `cache/<fingerprint>.json`: every model answer the evaluation has paid for, keyed by (task, prompt version, model,
  exact minimized input). Committed so replays, the Lab and CI never pay for the same answer twice. Synthetic
  households only, never real family data.
- `results/<phase>.json`: the latest score for each phase (A, B, C, escalate).

Written by `scripts/intel-eval.mjs`. Plan and budget: `docs/intelligence/EVALUATION_PLAN.md`. Empty until the first
approved live run.
