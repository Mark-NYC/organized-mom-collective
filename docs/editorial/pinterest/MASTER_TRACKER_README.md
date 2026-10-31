# OMC 500-pin master tracker

**Morning production:** [PINTEREST_DAILY_PRODUCTION_DESK.md](../PINTEREST_DAILY_PRODUCTION_DESK.md) defines the cross-lane daily selection, 30/30/25/15 rolling new-creative hypothesis and intermittent 39+10 long-gallery sprints. This 500-row CSV remains an immutable historical campaign inventory, not the complete combined daily production queue. Do not rewrite permanent IDs or original schedule to satisfy the new rolling mix; reconcile all new pin batches and separate gallery OMC-V records.

**Source of truth:** [OMC_500_Pin_Content_Calendar.csv](OMC_500_Pin_Content_Calendar.csv). This is the original owner-approved planning spreadsheet recovered from the October 17, 2026 file. Do not regenerate it or reorder IDs when tracking production.

## Scope and important limitations

- Exactly **500 planned pin rows**, with permanent IDs `OMC-P0001` through `OMC-P0500`. Rows are intentionally arranged in **scheduled publication order**, not ID order. Never infer progress from the row number.
- 100 concepts, five drafts per concept, 10 planned pins/day over October 26 to December 14, 2026. Dates are original **proposed** dates, not evidence of a scheduled or published pin.
- Existing **Production status** and **Approval status** fields are original planning statuses, not a retrospective audit of pins already designed. **Do not claim all planned pins are unproduced:** reconcile previously approved assets before changing statuses. **Historical Gemini batches 01–03 were mapped on 2026-10-20: 30 distinct IDs, including three documented adapted concept slots (OMC-P0135, OMC-P0433, OMC-P0294).** **Gemini batch 04 (pins 31–40) was reconciled on 2026-10-20 against owner-assigned IDs: 7 approved (QA pass, including the owner's replacement for OMC-P0251), 3 created and held (OMC-P0374 owner decision; OMC-P0080 and OMC-P0011 copy fixes).** **Gemini batch 05 (pins 41–50) was reconciled on 2026-10-21: all 10 approved by the owner on 2026-10-21: 7 QA pass (OMC-P0389 after two replacements; OMC-P0477 on seasonal hold for January) and 3 by owner override of a QA fail (OMC-P0271, P0227, P0139). The current approved set is 50 distinct IDs. Three missing destinations were built (HC-10, IF-11, FP-22).** **Gemini batch 06 (pins 51–60) was reconciled on 2026-10-22: all 10 approved by the owner on 2026-10-22: 7 QA pass (OMC-P0276, P0232, P0482, P0438, P0144, P0394, P0350) and 3 by owner override (P0100 headline contrast; P0028 and P0189 assigned because the planned slots P0026 and P0188 were already approved). P0026 and P0188 rows were not changed. The current approved set is 60 distinct IDs. See `design/pinterest/gemini-batch-06/qa-report.md`.**
- Proposed boards in this historic sheet are not all real Pinterest boards. Map each approved pin to an actual account board per [PINTEREST_BOARDS.md](../PINTEREST_BOARDS.md).
- Existing hub URLs are placeholders until the exact destination page is verified; never substitute a generic hub for a destination page that does not deliver the pin's promise.
- The sheet is an **internal tracker**, not a Pinterest bulk-upload CSV.

## Mandatory workflow

1. Find the pin by **Pin ID**, never its row position, approximate headline, or production batch number.
2. Before generating a new asset, inspect the master status, existing approved PNGs/manifests, and [production reconciliation](PRODUCTION_RECONCILIATION.csv). If a pin is already produced, use/revise that same ID instead of duplicating it.
3. Reserve the ID and record the corresponding final asset path, exact headline and destination in the reconciliation file. If matching a prior asset to a plan ID is uncertain, mark `needs_review`, do not guess.
4. Update the master row only when the stage is supported by an actual artifact or account evidence. Prefer `Idea` → `In production` → `Created` → `Approved` → `Scheduled` → `Published`; keep approval and production fields distinct.
5. For revisions, **reuse the existing ID**, preserve the old filename in notes or Git history, and make the approved latest asset explicit.
6. For new pins beyond the plan, do not silently create 501st entries. Amend the plan explicitly and run validation.
7. No auto-publishing or retroactive publishing claims.

## Quick checks

Run `python3 scripts/validate_pinterest_500.py` to validate the master and reconciliation. It fails on missing/duplicate master IDs, invalid slot coverage, duplicate final filenames, or conflicting confirmed production mappings.

Before any new 10-pin batch, identify and report the exact 10 **master IDs and headlines** and reconcile their state first. The current approved set is 50 distinct IDs (30 from batches 01–03, 10 from batch 04, 10 from batch 05), leaving 450 master slots not marked approved. Batch 06 adds 10 approved IDs (60 total). This is a planning count, **not** proof that all remaining pins have never been designed outside the recorded Gemini batches. Three adapted slots have a finished approved creative that supersedes the old draft concept.

## Progress reporting

Report three counts separately: **planned (500)**, **confirmed unique created**, and **confirmed published**. Never add “created” counts from separate batches without de-duplicating by master ID. If prior approved files cannot be matched, report them as an **unmapped backlog**, not completed IDs. On 2026-10-20 all 20 historical Gemini 01–02 entries in `UNMAPPED_APPROVED_PINS.csv` were resolved, including three annotated editorial adaptations; that file now serves as the audit mapping log.


## Tony Hill-inspired 6/3/1 research fields

Before assigning another ten master IDs, read [PINTEREST_RESEARCH_LOOP.md](../PINTEREST_RESEARCH_LOOP.md). The master includes seven **new, non-destructive research columns**. Slots 1–6 are proposed proven keyword, 7–9 specific audience/situation, and 10 experimental. This is a future testing allocation, not proof of past creative types. Blank verified-keyword, competitor, audience, format, conversion, or evidence cells mean **not yet researched**. Don't backfill guesses. Preserve all prior master rows, statuses, IDs, and reconciliation data.


## Seasonal acquisition overlay (2026-10-30)

Read [SEASONAL_ACQUISITION_PLAN.md](../../SEASONAL_ACQUISITION_PLAN.md) alongside the master and [PINTEREST_RESEARCH_LOOP.md](../PINTEREST_RESEARCH_LOOP.md). New companion planning columns classify the three content lanes, season of need, recommended publication window and contextual downstream offer/action. These are **not** evidence of research, a moved schedule, publishing, or measured conversions. Preserve all 500 permanent IDs, the 50-day original schedule and historic statuses. Seasonal adjustments for not-yet-published pins must be separately reviewed against the real Pinterest account, landing-page readiness and Club enrollment cutoff. Do not silently rewrite existing proposed dates or reschedule published pins.
