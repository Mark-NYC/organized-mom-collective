# OMC 500-pin master tracker

**Source of truth:** [OMC_500_Pin_Content_Calendar.csv](OMC_500_Pin_Content_Calendar.csv). This is the original owner-approved planning spreadsheet recovered from the October 17, 2026 file. Do not regenerate it or reorder IDs when tracking production.

## Scope and important limitations

- Exactly **500 planned pin rows**, with permanent IDs `OMC-P0001` through `OMC-P0500`. Rows are intentionally arranged in **scheduled publication order**, not ID order. Never infer progress from the row number.
- 100 concepts, five drafts per concept, 10 planned pins/day over October 26 to December 14, 2026. Dates are original **proposed** dates, not evidence of a scheduled or published pin.
- Existing **Production status** and **Approval status** fields are original planning statuses, not a retrospective audit of pins already designed. **Do not claim all planned pins are unproduced:** reconcile previously approved assets before changing statuses.
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

Before any new 10-pin batch, identify and report the exact 10 **master IDs and headlines** and reconcile their state first. The total remaining count can only be called *verified* after historic approved batches have been mapped to their IDs.

## Progress reporting

Report three counts separately: **planned (500)**, **confirmed unique created**, and **confirmed published**. Never add “created” counts from separate batches without de-duplicating by master ID. If prior approved files cannot be matched, report them as an **unmapped backlog**, not completed IDs.
