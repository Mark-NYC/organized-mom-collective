# Gemini batch 05: QA report (2026-10-21)

Reviewed against [PINTEREST_QA_CHECKLIST.md](../../../docs/editorial/PINTEREST_QA_CHECKLIST.md) and the owner's batch 05 rule: **nobody shown above the shoulders** (no faces, heads, necks or reflections). Results are **pass**, **fail** or **not received**. Mechanical checks, visual judgment and owner approval are separate. > **Owner approval, 2026-10-21:** all ten approved. 47 after its second replacement; **42, 43 and 46 by owner override** (“the rest of the pins pass and are approved”). The fail findings below stand as recorded: 42 shows the back of a child’s head and borrows pin 41’s support line; 43 has no wordmark; **46 shows a woman’s face in profile**, which the QA checklist lists as an automatic rejection.

## Received

All ten. Pins 41–45 arrived first (`1.jpg`–`5.jpg`), 46–50 later the same day (`6.jpg`–`10.jpg`). Nine are 687 × 1024 JPEGs; `9.jpg` (pin 47) is a native 1000 × 1500 JPEG with camera EXIF. Order was set by inspecting each image, not by filename.

| File | Pin | Master ID | Headline on the image |
| --- | --- | --- | --- |
| `1.jpg` | 45 | OMC-P0183 | Give Laundry a Place in the Week |
| `2.jpg` | 41 | OMC-P0021 | 3 Chores a 7-Year-Old Can Own |
| `3.jpg` | 42 | OMC-P0271 | A Calendar Kids Check |
| `4.jpg` | 43 | OMC-P0227 | Your Family Planner Is Missing One Thing |
| `5.jpg` | 44 | OMC-P0477 | Don’t Organize Your Whole Life This January |
| `6.jpg` | 50 | OMC-P0026 | 5 Chores an 8-Year-Old Can Learn to Own |
| `7.jpg` | 49 | OMC-P0345 | Weekends Need a Rhythm, Not a Schedule |
| `8.jpg` | 48 | OMC-P0095 | Kids Can Do Chores Without Earning Prizes |
| `9.jpg` | 47 | OMC-P0389 | Your Family’s Organized Week |
| `10.jpg` | 46 | OMC-P0139 | A Cleaning Routine the Whole Family Shares |
| `11.jpg` | 47 (replacement) | OMC-P0389 | Plan Dinner and Groceries Together |
| `12.jpg` | 47 (approved replacement) | OMC-P0389 | Plan Dinner and Groceries Together |

## Verdicts

| Pin | Master ID | File | Verdict | Reason |
| --- | --- | --- | --- | --- |
| 41 | OMC-P0021 | `final-2026-10-21/omc-chores-for-7-year-olds-01.png` | **Pass** | Three jobs match the destination’s 7-year-old example table job for job (covers and pillow, plate and cup by the sink, clean clothes in drawers). No people. Nightstand book has no legible text. Bed shown rumpled, which reads as the before state. |
| 42 | OMC-P0271 | `held-2026-10-21/omc-kids-activity-calendar-01.png` | **Fail** | Back of the child’s head and hair visible (above-shoulders rule). Support line “Simple jobs. Clear expectations.” is pin 41’s line and doesn’t fit a calendar. Headline “A Calendar Kids Check” is a shortened, slightly awkward version of the assigned “A Kids’ Activity Calendar They Can Actually Check”. Fix: crop the child at the shoulders (arm pointing up into frame) and give it its own support line, e.g. “Pictures they can read. Plans they can check.” |
| 43 | OMC-P0227 | `held-2026-10-21/omc-family-planner-who-does-what-01.png` | **Fail** | No Organized Mom Collective wordmark (every approved pin carries it). White header panel instead of brand cream. Crumpled list has garbled pseudo-text (incidental). Fridge drawings show drawn stick-figure faces: illustration, not photographic faces, noted only. Fix: regenerate with the cream panel and wordmark. |
| 44 | OMC-P0477 | `final-2026-10-21/omc-new-year-weekly-reset-01.png` | **Pass (seasonal hold)** | Copy correct, no people. Timer numerals garbled but incidental. The destination has no January section, but the pin promises “15 minutes and a shared plan”, which it delivers. Held out of the current import file because it’s a New Year pin; suggested date 2026-12-28 in `pinterest-import-seasonal-hold.csv`. |
| 45 | OMC-P0183 | `final-2026-10-21/omc-family-laundry-schedule-01.png` | **Pass** | Four stages (wash, dry, fold, put away) match the new HC-10 article. Arm and hand only, grip on the laundry natural, washer and dryer plausible. “Put away” label slightly overlaps the drawer front; legible. |
| 46 | OMC-P0139 | `held-2026-10-21/omc-family-cleaning-routine-01.png` | **Fail** | The woman’s face is visible in profile (eye, nose, mouth). The man’s and boy’s heads are visible from behind. Breaks the no-faces and above-shoulders rules outright. Support line “Real jobs. Growing independence.” duplicates pin 50. Fix: regenerate with hands and torsos only (a child’s hands carrying a plate, an adult’s hands at the sink). |
| 47 | OMC-P0389 | `held-2026-10-21/omc-meal-planning-and-groceries-01.png` | **Fail** | Headline is not the assigned “Plan Dinner and Groceries Together”; support line “Simple, delicious meal planning and shopping” is generic. The focal “Weekly Meal Plan” sheet is a third-party printable with its own menu, not an OMC planner: under our wordmark it reads as our product (misleading product imagery, possible design rights). Nothing shows dinner and groceries planned together. Unlike the other nine, it’s a native 1000 × 1500 photo with camera EXIF; source and license unknown. Fix: regenerate around the real `/meal-planner` output or a blank list, with the assigned headline. |
| 47 (replacement) | OMC-P0389 | `held-2026-10-21/omc-meal-planning-and-groceries-02.png` | **Fail** | Fixes everything wrong with -01: correct headline, “One plan. One shopping list.”, arm and hand only, wordmark, no third-party printable, generic unbranded groceries. But the handwritten list is the focal point and it’s legible and wrong: “Dianer”, “Tomatoas”, and “Tortillas” twice. It also arrived at 765 × 1024 (0.75), not 2:3; cropping to 1000 × 1500 would clip the headline, so the held export pads the top and bottom bands with their own edge color, which changes no content. Fix: regenerate at 2:3 with a correctly spelled list. |
| 47 (approved) | OMC-P0389 | `final-2026-10-21/omc-meal-planning-and-groceries-03.png` | **Pass; owner-approved 2026-10-21** | No people. Headline, support line and wordmark correct. Both handwritten lists are spelled correctly (Tomatoes, Peppers, Onions, Pasta, Tortillas, Lemons, Coffee; Tue Tacos, Wed Chicken, Thu Salad, Fri Pizza) and sit upside down to the viewer, so they’re incidental. Groceries unbranded. 687 × 1024, exported like the others. |
| 48 | OMC-P0095 | `final-2026-10-21/omc-chores-without-rewards-01.png` | **Pass** | Three labels (own your things, help with meals, put things away) and “Teach the job. Practice together. Build the habit.” match IF-11. No people. Toys in the basket are generic, no logos. |
| 49 | OMC-P0345 | `final-2026-10-21/omc-weekend-routine-for-kids-01.png` | **Pass** | Flat lay with breakfast, play and sports gear fits the rhythm; support line matches FP-22. No people. Shin guards carry a small generic white mark, not a recognizable logo; sneakers unbranded. |
| 50 | OMC-P0026 | `final-2026-10-21/omc-chores-for-8-year-olds-01.png` | **Pass (minor artifact)** | All five jobs match the destination’s ages 6–8 list (“Help unload the dishwasher” matches its “with help”). Minor: thin silver fringing inside the big “8” (generation artifact, visible at full size, not at feed size) and an unlabeled second clothes stack beside job 3. Your call whether to re-export. |

## Checklist, received files

| Check | 41 | 42 | 43 | 44 | 45 | 46 | 47 | 48 | 49 | 50 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1000 × 1500, 2:3, PNG, RGB, sRGB (final files) | pass | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| Spelling and grammar | pass | pass (awkward) | pass | pass | pass | pass | pass | pass | pass | pass |
| Readable at full size and ~250 px | pass | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| Brand colors and wordmark | pass | pass | **fail** | pass | pass | pass | pass | pass | pass | pass |
| Nobody above the shoulders | pass | **fail** | pass | pass | pass | **fail** | pass | pass | pass | pass |
| Hands, limbs, furniture, objects undistorted | pass | pass | pass | pass | pass | pass | pass | pass | pass | pass (“8” fringe) |
| No fake or misleading product imagery | pass | pass | pass | pass | pass | pass | **fail** | pass | pass | pass |
| No third-party logos or watermarks | pass | pass | pass | pass | pass | pass | **fail** (third-party printable) | pass | pass | pass |
| Copy fits the pin and destination | pass | **fail** | pass | pass | pass | **fail** (duplicate line) | **fail** | pass | pass | pass |
| Distinct concept within the batch | pass | pass | pass | pass | pass | pass | pass | pass | pass | pass |

## Export

Nine files arrived at 687 × 1024 (ratio 0.671, slightly wider than 2:3). Each final PNG is the original scaled uniformly with Lanczos to 1006 × 1500, then 3 px trimmed from each side to 1000 × 1500. No text or subject is within 3 px of an edge; nothing else was changed. **This is an upscale (×1.46): it adds no detail**, so type is a little softer than a native 1000 × 1500 export. Native-resolution Gemini exports would be better for future batches. Each PNG carries the same sRGB profile bytes as batches 01–04. Pin 47 arrived at 1000 × 1500 and was only converted to PNG. Hashes are in `production-manifest.csv`.

## Duplicate scan

- SHA-256: no match among 544 design and public image files.
- Perceptual (256-bit dHash): closest repository image 89 bits away (near-duplicate would be under ~10); the ten pins differ from each other by at least 88 bits.
- Concept: 41 and 50 are sibling by-age chore pins to the same destination (4 days apart); 41 is two days after batch 04 #40.

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

Pins 45, 48 and 49 point at articles created in this batch; their live status is recorded in the README.

## Not verified

- Native Pinterest autocomplete, Trends and search volume; keywords are hypotheses.
- Board spellings against the live account (registry from the 2026-10-19 screenshot).
- Pinterest’s current import template; the batch 03–04 column set was reused.
