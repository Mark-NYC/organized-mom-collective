# Gemini batch 06: QA report (2026-10-22)

Reviewed against [PINTEREST_QA_CHECKLIST.md](../../../docs/editorial/PINTEREST_QA_CHECKLIST.md), [PINTEREST_CREATIVE_DIRECTION.md](../../../docs/editorial/PINTEREST_CREATIVE_DIRECTION.md) and [PINTEREST_STRATEGY.md](../../../docs/editorial/PINTEREST_STRATEGY.md). Results are **pass**, **fail**, **held** or **not received**. Mechanical checks, visual judgment and owner approval are separate. **Nothing in this batch is owner-approved yet.**

## Received

**Five of the ten.** The owner's message said ten; five JPEGs arrived (`1.jpg`–`5.jpg`), all 687 × 1024, RGB, no ICC profile, no EXIF. Pins 56–60 were not received. Matching was done from each image's headline and subject, not upload order.

| File | Pin | Master ID | Headline on the image |
| --- | --- | --- | --- |
| `1.jpg` | 55 Paper clutter organization | **held, unassigned** (planned slot OMC-P0188 already approved) | The Paper Pile Needs Two Places |
| `2.jpg` | 54 Holiday family planning checklist | OMC-P0482 | The Holiday List Needs Names |
| `3.jpg` | 53 Family command center ideas | OMC-P0232 | A Paper Station Needs an Exit |
| `4.jpg` | 52 School paperwork organization | OMC-P0276 | Every School Paper Needs a Place |
| `5.jpg` | 51 Chores for 8-year-olds | **held, unassigned** (planned slot OMC-P0026 already approved) | 5 Chores an 8-Year-Old Can Own |

## ID conflicts in the requested batch

The ten topics map to master rows 50–59 (2026-10-31, slots 1–10). Two of those slots are already approved, so the requested 51–60 numbering overlaps earlier work:

- **OMC-P0026** (chores for 8 year olds, row 50) is batch 05 #50, *5 Chores an 8-Year-Old Can Learn to Own*, owner-approved 2026-10-21, same destination. The new image is a different photo with a near-identical headline.
- **OMC-P0188** (paper clutter organization, row 54) is batch 02 #18, *The Paper Pile Needs Two Places*, approved 2026-10-19, same destination (`/resources/home-command-center`). The new image carries the **identical headline**.

Neither approved row was changed. Both new images are stored in `held-2026-10-22/` with no master ID. Proposed slots if the owner wants them: chores → **OMC-P0028** (“Meaningful tasks they can own”, 2026-11-18); paper clutter → **OMC-P0189** or **OMC-P0190**, after a new headline.

## Verdicts

| Pin | Master ID | File | Verdict | Reason |
| --- | --- | --- | --- | --- |
| 51 | unassigned | `held-2026-10-22/omc-chores-for-8-year-olds-02.png` | **Held (ID conflict); visual QA pass** | Boy seen from behind, whole head and ear visible, no facial features (meets the checklist's complete back-view rule). Hand and towel grip natural. Wordmark, cream and sage bands, oversized serif “5”. Minor: the scene is a towel put-away job; the destination's 6–8 list has “Put clean clothes in their drawers”, not linen cupboard towels. Pin promises five chores and shows one; the destination delivers the list. |
| 52 | OMC-P0276 | `final-2026-10-22/omc-school-paperwork-organization-01.png` | **Pass** | ACT / SAVE / RECYCLE are the destination's exact folder names; “One landing spot” is its summary. No people. “Signature required / Field trip details” legible and correct; the sheet's body copy is pseudo-text (incidental, not focal). Frost-blue header is a brand month tone. |
| 53 | OMC-P0232 | `final-2026-10-22/omc-command-center-paper-station-01.png` | **Pass (minor notes)** | “Needs attention” and “Ready to go” are the article's exact pocket labels; “Give every paper an exit” is its Shift heading. Arm and hand only, natural grip on the paper. Minor: headline is a regular-weight serif, not Georgia Bold; the two labels sit at staggered heights; concept is close to the FP-03 curiosity pin already embedded in the article (two pockets, hand, backpack), though the image is different. |
| 54 | OMC-P0482 | `final-2026-10-22/omc-holiday-family-planning-checklist-01.png` | **Pass** | Card copy “Dates, People, Food, Tasks. Give every job an owner.” repeats the article's four lists and step 5. Two adults' hands only; ten natural fingers each pair, grips believable; shows shared work. Seasonal, but in season for import now. |
| 55 | unassigned | `held-2026-10-22/omc-paper-clutter-organization-01.png` | **Fail (held)** | Identical headline to approved OMC-P0188 at the same destination. Repeats pin 53's two labels and destination inside this batch (rejection criterion 6). Also: the “Needs attention” half is a messy pile, not a pocket, so it reads as before/after rather than “two places”; the pen appears stuck to the cabinet with no clip; visible split seam. Fix: new headline and angle (for example what to recycle), then assign P0189 or P0190. |
| 56 | OMC-P0438 | — | **Not received** | Destination verified: `/resources/how-to-share-the-mental-load`. |
| 57 | OMC-P0144 | — | **Not received** | Destination verified: `/resources/cleaning-schedule-for-working-moms`. |
| 58 | OMC-P0394 | — | **Not received** | Destination verified: `/resources/easy-dinner-planning-system`. |
| 59 | OMC-P0100 | — | **Not received** | Destination verified: `/resources/chore-chart-reward-ideas`. |
| 60 | OMC-P0350 | — | **Not received** | Destination verified: `/resources/getting-kids-out-the-door`. |

## Checklist, received files

| Check | 51 | 52 | 53 | 54 | 55 |
| --- | --- | --- | --- | --- | --- |
| 1000 × 1500, 2:3, PNG, RGB, sRGB (exports) | pass | pass | pass | pass | pass |
| Spelling and grammar | pass | pass | pass | pass | pass |
| Serif headline + sans support (Georgia Bold / Montserrat) | pass (visual match) | pass (visual match) | **regular-weight serif** | pass (visual match) | pass (visual match) |
| Readable at full size and ~250 px | pass | pass | pass (labels small) | pass | pass |
| Brand colors and wordmark | pass | pass | pass | pass | pass |
| No visible faces; complete back-view heads | pass | n/a | pass | pass | n/a |
| Hands, objects undistorted | pass | pass | pass | pass | **minor** (floating pen) |
| No fake product, calendar or invented feature | pass | pass | pass | pass | pass |
| Copy fits pin and destination | pass (minor) | pass | pass | pass | **fail** (duplicate headline) |
| Distinct concept within batch and library | **fail** (dupes approved P0026 angle) | pass | pass (near FP-03 pin) | pass | **fail** |

Fonts are judged from the raster only; the actual font files used by Gemini can't be verified.

## Export

Same method as batch 05: each original scaled uniformly with Lanczos to 1006 × 1500, 3 px trimmed from each side to 1000 × 1500, saved as PNG with the same sRGB profile bytes as batches 01–05. Nothing sits within 3 px of the side edges. **This is a ×1.46 upscale and adds no detail.** Originals are kept unchanged in `originals/`. Hashes are in `production-manifest.csv`.

## Duplicate scan

- SHA-256: no match among 1,804 design and public image files.
- Perceptual (256-bit dHash): closest repository image 94 bits away (near-duplicate would be under ~10); the five images differ from each other by at least 119 bits.
- Concept duplicates are a different matter and are listed above (51, 55, and 53's closeness to the FP-03 pin).

## Destinations

All checked live 2026-10-22 (HTTP 308 → 200, expected titles) and read in source.

| Pin | Destination | Delivers the promise |
| --- | --- | --- |
| 51 | /resources/chores-for-kids-by-age | Yes, ages 6–8 list |
| 52 | /resources/school-paperwork-organization (new FP-23) | Yes, three-folder chart |
| 53, 55 | /resources/home-command-center | Yes, two-pocket setup |
| 54 | /resources/holiday-family-planning-checklist (new FP-24) | Yes, four lists and owners |

## Not verified

- Native Pinterest autocomplete, Trends and search volume; keywords are hypotheses.
- Board spellings against the live account (registry from the 2026-10-19 screenshot).
- Pinterest's current import template; the batch 03–05 column set was reused.
