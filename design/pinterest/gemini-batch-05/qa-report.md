# Gemini batch 05: QA report (2026-10-21)

Reviewed against [PINTEREST_QA_CHECKLIST.md](../../../docs/editorial/PINTEREST_QA_CHECKLIST.md) and the owner's batch 05 rule: **nobody shown above the shoulders** (no faces, heads, necks or reflections). Results are **pass**, **fail** or **not received**. Mechanical checks, visual judgment and owner approval are separate. **No pin in this batch is owner-approved yet.**

## Received

Five of ten. The ten images were assigned in chat, but only five files reached the session (`originals/1.jpg`–`5.jpg`, 687 × 1024 JPEG). Order was set by inspecting each image, not by filename.

| File | Pin | Master ID | Headline on the image |
| --- | --- | --- | --- |
| `1.jpg` | 45 | OMC-P0183 | Give Laundry a Place in the Week |
| `2.jpg` | 41 | OMC-P0021 | 3 Chores a 7-Year-Old Can Own |
| `3.jpg` | 42 | OMC-P0271 | A Calendar Kids Check |
| `4.jpg` | 43 | OMC-P0227 | Your Family Planner Is Missing One Thing |
| `5.jpg` | 44 | OMC-P0477 | Don’t Organize Your Whole Life This January |
| none | 46–50 | OMC-P0139, P0389, P0095, P0345, P0026 | **Not received** |

## Verdicts

| Pin | Master ID | File | Verdict | Reason |
| --- | --- | --- | --- | --- |
| 41 | OMC-P0021 | `final-2026-10-21/omc-chores-for-7-year-olds-01.png` | **Pass** | Three jobs match the destination’s 7-year-old example table job for job (covers and pillow, plate and cup by the sink, clean clothes in drawers). No people. Nightstand book has no legible text. Bed shown rumpled, which reads as the before state. |
| 42 | OMC-P0271 | `held-2026-10-21/omc-kids-activity-calendar-01.png` | **Fail** | Back of the child’s head and hair visible (above-shoulders rule). Support line “Simple jobs. Clear expectations.” is pin 41’s line and doesn’t fit a calendar. Headline “A Calendar Kids Check” is a shortened, slightly awkward version of the assigned “A Kids’ Activity Calendar They Can Actually Check”. Fix: crop the child at the shoulders (arm pointing up into frame) and give it its own support line, e.g. “Pictures they can read. Plans they can check.” |
| 43 | OMC-P0227 | `held-2026-10-21/omc-family-planner-who-does-what-01.png` | **Fail** | No Organized Mom Collective wordmark (every approved pin carries it). White header panel instead of brand cream. Crumpled list has garbled pseudo-text (incidental). Fridge drawings show drawn stick-figure faces: illustration, not photographic faces, noted only. Fix: regenerate with the cream panel and wordmark. |
| 44 | OMC-P0477 | `final-2026-10-21/omc-new-year-weekly-reset-01.png` | **Pass (seasonal hold)** | Copy correct, no people. Timer numerals garbled but incidental. The destination has no January section, but the pin promises “15 minutes and a shared plan”, which it delivers. Held out of the current import file because it’s a New Year pin; suggested date 2026-12-28 in `pinterest-import-seasonal-hold.csv`. |
| 45 | OMC-P0183 | `final-2026-10-21/omc-family-laundry-schedule-01.png` | **Pass** | Four stages (wash, dry, fold, put away) match the new HC-10 article. Arm and hand only, grip on the laundry natural, washer and dryer plausible. “Put away” label slightly overlaps the drawer front; legible. |

## Checklist, received files

| Check | 41 | 42 | 43 | 44 | 45 |
| --- | --- | --- | --- | --- | --- |
| 1000 × 1500, 2:3 portrait, PNG, RGB, sRGB profile (final files) | pass | pass | pass | pass | pass |
| Spelling and grammar | pass | pass (headline awkward) | pass | pass | pass |
| Readable at full size and ~250 px | pass | pass | pass | pass | pass |
| Brand colors and wordmark | pass | pass | **fail** | pass | pass |
| Nobody above the shoulders | pass (no people) | **fail** | pass (no people) | pass (no people) | pass (arm only) |
| Hands, limbs, furniture, objects undistorted | pass | pass | pass | pass | pass |
| No fake product imagery, no OMC product shown | pass | pass | pass | pass | pass |
| No third-party logos or watermarks | pass | pass (generic backpack patch) | pass | pass | pass |
| Copy fits the pin and destination | pass | **fail** | pass | pass | pass |
| Distinct concept within the batch | pass | pass | pass | pass | pass |

## Export

Gemini delivered 687 × 1024 (ratio 0.671, slightly wider than 2:3). Each final PNG is the original scaled uniformly with Lanczos to 1006 × 1500, then 3 px trimmed from each side to 1000 × 1500. No text or subject is within 3 px of an edge; nothing else was changed. **This is an upscale (×1.46): it adds no detail**, so type is a little softer than a native 1000 × 1500 export. Native-resolution Gemini exports would be better for future batches. Each PNG carries the same sRGB profile bytes as batches 01–04. Hashes are in `production-manifest.csv`.

## Duplicate scan

- SHA-256: no match among 544 design and public image files.
- Perceptual (256-bit dHash): closest repository image 89 bits away (near-duplicate would be under ~10); the five pins differ from each other by at least 88 bits.
- Concept: pin 41 and batch 04 #40 (chores for 5-year-olds) share a board and destination; dated two days apart.

## Destinations

| Pin | Destination | Status |
| --- | --- | --- |
| 41, 50 | /resources/chores-for-kids-by-age | Live (308 → 200), source verified; 7-year-old example and 8-year-old FAQ |
| 42 | /resources/how-to-organize-a-family-calendar | Live, source verified; “Teach the family to check and update it” |
| 43 | /resources/free-weekly-family-planner-printable | Live, source verified; “Add who owns the pickup, dinner or task” |
| 44 | /resources/weekly-family-reset | Live, source verified |
| 45 | /resources/family-laundry-schedule | **New (HC-10)** |
| 46 | /resources/daily-cleaning-routine | Live, source verified; shared Daily Reset with WhoCanHelp |
| 47 | /resources/weekly-meal-planning-for-families | Live, source verified; plan dinners and agree who owns groceries |
| 48 | /resources/chore-chart-without-rewards | **New (IF-11)** |
| 49 | /resources/weekend-routine-for-kids | **New (FP-22)** |

## Not verified

- Native Pinterest autocomplete, Trends and search volume; keywords are hypotheses.
- Board spellings against the live account (registry from the 2026-10-19 screenshot).
- Pinterest’s current import template; the batch 03–04 column set was reused.
