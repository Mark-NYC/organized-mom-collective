# Gemini batch 04: QA report (2026-10-20)

> **Update, later 2026-10-20:** pin 31 was replaced by the owner (`6.jpg`, seven-day Sun–Sat grid, dates in order, no faces, hands plausible): **pass**. Files for 36–40 arrived in commit `8cb00ea` and were checked at full resolution: 36 and 39 **pass**; 37 (needs owner decision), 38 and 40 (revise) still carry the issues below. Import-ready: 31–36 and 39.

Reviewed against [PINTEREST_QA_CHECKLIST.md](../../../../docs/editorial/PINTEREST_QA_CHECKLIST.md). Each result is **pass**, **fail**, **needs owner decision** or **not verified**. Mechanical checks, visual judgment and owner approval are recorded separately. No owner override has been given for any batch 04 pin.

## Received

| # | Master ID | File received | Reviewed at |
| --- | --- | --- | --- |
| 31–35 | OMC-P0251, P0207, P0457, P0168, P0418 | Yes (`1.jpg`–`5.jpg`, 687 × 1024 JPEG) | Full resolution, 2× zoom crops, ~250 px |
| 36–40 | OMC-P0124, P0374, P0080, P0330, P0011 | **No.** Shown in chat, but the files never reached the session (same failure as batch 03 pin 29). | Chat preview only. Not a full-resolution review. |

## Verdicts

| # | Master ID | Headline | Verdict | Reason |
| --- | --- | --- | --- | --- |
| 31 | OMC-P0251 | Busy Family Calendar | **Needs owner decision** | The calendar prop is the focal point and is wrong: Monday–Saturday columns only (no Sunday, so 7, 14, 21 and 28 never appear) and no 27. A mom will notice. Approve as is, or regenerate with a seven-day grid. Everything else passes. |
| 32 | OMC-P0207 | Missed a Cleaning Day? | **Pass** | Copy correct. Hand, ring and towel grip natural. No face. Hook repeats batch 01 #1 (OMC-P0122) on a similar counter-and-towel scene. Different ID, destination and composition, but schedule them at least a week apart. |
| 33 | OMC-P0457 | Teaching Kids Independence | **Pass** | Three steps match the article's checklist and backpack example; same backpack in every panel. Adult shows ear, cheek and stubbled jaw from behind: no eyes, nose or mouth (same standard as batch 03 #27). Child back of head only. Prop text (snack bag, book) is garbled but incidental. |
| 34 | OMC-P0168 | 10-Minute Living Room Reset | **Pass** | Child and adult hands on the same stack of books, plausible. Four paraphrased steps; the article has five (adds “open the walking path”). Nothing contradicts it. |
| 35 | OMC-P0418 | Kids Can Help Make Dinner | **Pass** | Child cropped at the shoulder, no face. Adult holds the knife, matching the article's safety rule. Icons match starter jobs; “Carry plates” isn't listed word for word but the article's place setting includes a plate. |
| 36 | OMC-P0124 | A Weekly Cleaning Schedule for Real Life | **Not verified** (preview passes) | No file. Preview: spelling correct; toddler back view; adult hand wiping. Zone bar says “Wed Bathroom”, “Thu Kitchen”; the site says “Entry/Bathroom”, “Kitchen Reset” (acceptable shorthand). Hook close to batch 01 #9 “One zone each day.” |
| 37 | OMC-P0374 | A Screen Time Routine Kids Can Follow | **Needs owner decision** | No file. Preview: *The Wild Robot* cover and a *CLUE* game box are legible third-party IP. Same class as batch 03 #24, which you overrode, but each pin needs its own call. Sign text spelled correctly. |
| 38 | OMC-P0080 | Kitchen Chores Kids Can Own | **Revise** | No file. “Put away sauces and things from the fridge” is awkward and reads as taking things out. Suggest “Put sauces back in the fridge.” Panel 4 says “Wipe the table” over a kitchen counter. Suggest “Wipe the counter.” The destination has no kitchen section, and the fridge job is only loosely supported. |
| 39 | OMC-P0330 | School Morning Checklist | **Not verified** (preview passes) | No file. Steps match the generator's School morning template. Entryway scene is close to batch 01 #4 and #5, so space them. |
| 40 | OMC-P0011 | Chores for 5-Year-Olds | **Revise** | No file. “Make the bed” contradicts the destination: the guide puts “Make their bed” at ages 6–8; ages 4–5 is “Pull up the covers and put the pillow back.” Suggest “Pull up the covers.” |

## Checklist results for the received files (31–35)

| Check | 31 | 32 | 33 | 34 | 35 |
| --- | --- | --- | --- | --- | --- |
| Spelling, grammar, headline matches assignment | pass | pass | pass | pass | pass |
| All text readable at full size and ~250 px | pass | pass | pass (step labels smallest) | pass | pass (icon labels small, not mandatory) |
| No visible generated face | pass | pass | pass | pass | pass |
| Anatomy, hands, grips, objects | pass | pass | pass | pass | pass |
| Generated prop text not presented as real info | **fail** (calendar grid) | n/a | pass | n/a | n/a |
| No OMC product shown, rebuilt or claimed | pass | pass | pass | pass | pass |
| Branding: “Organized Mom Collective” wordmark | pass | pass | pass | pass | pass |
| Unsupported claims | pass | pass | pass | pass | pass |
| Destination delivers the promise | pass | pass | pass | pass | pass |
| PNG opens, RGB, sRGB profile, pixel-identical to source | pass | pass | pass | pass | pass |
| 1000 × 1500 | **not met** (687 × 1024 native, all five) | | | | |

**Dimensions exception:** like batches 01–03, the files arrived at 687 × 1024 (0.671 ratio vs 0.667). Kept native, not stretched or cropped. Full-resolution Gemini exports would fix this.

**Brand consistency:** cream panels, serif or sans headlines, sage/blue/blush accents and the wordmark are consistent with batches 01–03. Pin 32's wordmark is in all-caps sans; others use serif. Acceptable variation.

**Repetition inside the batch:** three toy-basket scenes (34, 36, 40) and three backpack/entryway scenes (31, 33, 39). Different compositions, but spread them across days.

## Duplicate scan

- SHA-256: no match among 1,557 image files tracked in the repository.
- Perceptual (256-bit dHash): closest repository image 85 bits away (near-duplicate would be under ~10). The five received pins differ from each other by at least 106 bits.
- Concept-level: pin 32 vs batch 01 #1, pin 36 vs batch 01 #9, pin 39 vs batch 01 #4/#5 (see above). Not ID duplicates.

## Destinations

All 10 articles exist in `src/content/articles/` and are published. At the start of review three returned **404 live** (`ten-minute-living-room-reset`, `kids-helping-with-dinner`, `screen-time-routine-for-kids`). Cause: every Vercel production build since HC-09 failed on two meta descriptions over the schema's 160-character limit. Fixed in commit `e8de32f` (two descriptions trimmed; `npm run build` passes). After the deploy, all 9 distinct URLs returned HTTP 200 with the expected titles, and their internal links all resolved.

`npm run verify`: build passes. `check:site` reports one pre-existing error unrelated to this batch (`docs/editorial/pinterest/MASTER_TRACKER_README.md: file name is not a tracker ID`) and two warnings (no incoming article links to `kids-helping-with-dinner` or `screen-time-routine-for-kids`).

## Not verified

- Native Pinterest autocomplete, Trends and search volume: not checked; keywords are hypotheses.
- Board spellings against the live Pinterest account (registry from the 2026-10-19 screenshot).
- Pinterest's current import template was not re-checked today; the batch 03 column set was reused.
