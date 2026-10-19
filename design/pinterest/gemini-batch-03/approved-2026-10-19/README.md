# Gemini batch 03: approved pins (2026-10-19)

Ten owner-approved Pinterest pins (numbered 21–30, continuing batches 01 and 02) made with Gemini. Each pin carries its ID from the original 500-pin editorial calendar (`OMC_500_Pin_Content_Calendar.xlsx`). Nothing here has been imported, scheduled or published on Pinterest.

**Import-ready: 8 pins (21, 22, 23, 25, 26, 27, 28, 30). Held: 2 pins (24, 29).** See [blocked-pins.md](blocked-pins.md).

| # | Master ID | Headline | File | Destination | Board | State |
| --- | --- | --- | --- | --- | --- | --- |
| 21 | OMC-P0163 | A Bathroom Reset You Can Actually Finish | `omc-bathroom-reset-checklist-01.png` | /resources/bathroom-reset-checklist | Cleaning Schedules for Busy Moms | Import-ready (destination switched by owner) |
| 22 | OMC-P0413 | Shop Your Pantry Before the Store | `omc-shop-your-pantry-01.png` | /resources/grocery-list-from-meal-plan | Meal Planning for Families | Import-ready |
| 23 | OMC-P0119 | When the Chore Chart Stops Working | `omc-chore-chart-stops-working-01.png` | /resources/chores-for-kids-by-age | Chores & Shared Responsibilities | Import-ready |
| 24 | OMC-P0369 | Tomorrow Starts Tonight | `omc-evening-routine-for-kids-01.png` | /routine-chart | Family Organization Ideas | Held: owner decision (book cover) |
| 25 | OMC-P0075 | Small Bathroom Jobs Kids Can Own | `omc-bathroom-jobs-for-kids-01.png` | /resources/bathroom-chores-for-kids | Chores & Shared Responsibilities | Import-ready (new IF-07 article) |
| 26 | OMC-P0325 | The After-School Drop Zone | `omc-after-school-drop-zone-01.png` | /resources/after-school-routine-for-kids | Family Organization Ideas | Import-ready (new FP-13 article) |
| 27 | OMC-P0006 | Chores for 4-Year-Olds | `omc-chores-for-4-year-olds-01.png` | /resources/chores-for-kids-by-age | Chores & Shared Responsibilities | Import-ready |
| 28 | OMC-P0256 | Your Family Schedule and Meals Belong Together | `omc-family-schedule-and-meals-01.png` | /resources/how-to-organize-your-familys-week | Family Organization Ideas | Import-ready |
| 29 | OMC-P0212 | A Small Home Still Needs a Simple Cleaning Rhythm | replacement pending | /resources/zone-cleaning-schedule | Cleaning Schedules for Busy Moms | Held: replacement file not received |
| 30 | OMC-P0462 | The Best Family Routine Is One You Can Repeat | `omc-repeatable-family-routine-01.png` | /resources/weekly-family-reset | Weekly Reset Routines | Import-ready (owner override, see QA) |

## Files

- `omc-*.png`: the approved pins.
- `originals/`: the files exactly as supplied, unchanged, named in chat-attachment order. Pin 21 is `6.jpg`, the owner's corrected replacement. The first pin 21 (`1.jpg`, SHA-256 `e4590b32…0261`) read “Actualy” and isn't stored. The first pin 29 (`10.jpg`, vertical headline) was replaced by the owner; it is only in asset commit `655c945` and isn't shipped.
- `production-manifest.csv`: master ID, original and new filenames, headline, topic, dimensions, SHA-256 hashes, repository path, public image URL, destination, validation state, board and approval/publish status.
- `pinterest-metadata.csv`: internal production metadata for all 10 pins (master ID, title, description, alt text, board, destination and its status, article section, media URL, keywords, status, hold reason, QA note). **It is not a Pinterest import file.**
- `pinterest-import-ready.csv`: the Pinterest Import Content file. Only the 8 pins that passed every gate.
- `blocked-pins.md`: the 2 held pins, why, and what clears each.
- `master-calendar-update-proposal.csv`: proposed rows for the 500-pin calendar, keyed by master ID (see below).
- `import-validation.json`: conversion results per image, the duplicate scan and the mechanical checks on the import file.

Headlines were matched from the visible text on each image, not from filenames or attachment order.

## Pinterest Import Content CSV

`Title,Media URL,Pinterest board,Thumbnail,Description,Link,Publish date,Keywords`

| Column | What's in this batch |
| --- | --- |
| Title | Unique, 49–67 characters (limit 100). Leads with the article's search phrase. |
| Media URL | Immutable GitHub links at asset commit `655c945`. All 8 returned HTTP 200 `image/png`, byte-identical to the committed files. |
| Pinterest board | Exact names from `docs/editorial/PINTEREST_BOARDS.md` (branch `docs/pinterest-actual-boards-2026-10-19`, not yet merged). No new boards. |
| Thumbnail | Blank (video pins only). |
| Description | Unique, 275–316 characters (limit 500). Built from the destination's own copy. No hashtags. |
| Link | Canonical `https://www.organizedmomcollective.com/…` paths, no trailing slash, no tracking parameters. |
| Publish date | Blank. Not scheduled yet. |
| Keywords | 4 phrases per pin. The master-plan keyword and the article's primary keyword are **hypotheses**, not checked against Pinterest autocomplete or Trends. No search volume is claimed. |

UTF-8 without BOM, CRLF line endings, RFC 4180 quoting. Re-read with a CSV parser and confirmed to round-trip.

**Scheduling note:** pins 23 and 27 both go to IF-03 on the same board. Put them on different days. Pin 21 shares a hand-wiping-a-bathroom-counter scene with the earlier “Clean One Zone” concept (inventory); space them. Pin 30 shares an entryway/backpack scene with batch 01 #4 (“Mornings without the hunt”); pin 22 shares a pantry-shelf idea with batch 02 #12 (same article, FP-06). Space those too.

## How the files were produced

Each image was decoded and saved as PNG with no resizing, cropping, recoloring or retouching. Reopening each PNG gives the same pixels as the decoded source (`pixel_identical_to_source: true` for all). JPEG sources were untagged, so each got the same sRGB profile bytes as batches 01/02; pin 24 (`4.webp`) already carried an sRGB profile, which was kept. Tags change no pixels.

**Dimensions exception:** all are 687 × 1024, the size the chat attachments arrived at. Close to 2:3 but not exact (0.671 vs 0.667). Kept native rather than stretched or trimmed, as in batches 01/02. Full-resolution Gemini exports would solve this.

**Duplicate check:** no PNG or original matches any of the 610 image files tracked in the repository by SHA-256. Perceptual difference hash found no near-duplicates (closest 92 of 256 bits; a near-duplicate would be under ~10). The pins differ from each other by at least 109 bits.

## QA

| Check | Result |
| --- | --- |
| Headlines and spelling | All correct on the shipped files. Pin 21's first version (“Actualy”) was replaced. Pin 28 has no repeated “and”; pin 30 has no repeated “You”. |
| Duplicated words | None. |
| Phone readability | Headlines readable at ~250 px wide. Pin 24's subhead sits over a dark wall and is the weakest; still legible. |
| Image–headline relevance | All match. Pin 30's scene (backpack on a peg rail) is a daily routine; its destination is the weekly reset. The headline carries it. |
| Faces | Pin 27: back view; ear and cheek edge only, no features (same level as batch 02 pin 14). **Pin 30: a generated adult's nose, lips and chin are visible at the top-right edge.** The QA checklist bans this. **The owner approved pin 30 as is on 2026-10-19**; recorded as an override, not a pass. |
| Anatomy and objects | Hands and grips plausible in all. Gemini prop text is garbled in places (planner day labels in pin 28, papers in pin 26); not presented as real information. |
| Branding | “Organized Mom Collective” wordmark on all ten. No fictional OMC products; no OMC calendar or companion shown or claimed. |
| Third-party IP | **Pin 24 shows the cover of “Where the Wild Things Are” with Maurice Sendak's name legible.** Held for an owner decision. |
| Product claims | No description mentions the wall calendar or cleaning companion. Pin 24 and 27 descriptions describe the free routine chart and free responsibility chart, both verified in site source. |

## What was verified and what wasn't

- **Destinations:** read in site source (`src/content/articles/`, `src/pages/routine-chart/`, `src/data/routines.ts`, `src/data/chores-by-age.ts`). 25 → IF-07 `bathroom-chores-for-kids` (written for this pin; age table built on towel, toothbrush cup and sink wipe; “Teach one job, then hand it over”). 26 → FP-13 `after-school-routine-for-kids` (written for this pin; drop zone for bags, “Needs attention” papers and lunchbox/gear, then a five-step arrival checklist). 21 → HC-07 (owner switched it from `/resources/zone-cleaning-schedule`, which has no bathroom checklist); the article's title is the headline and its checklist is the six-job, 15-minute reset. 22 → FP-06 step 2 “Check the kitchen before adding more”; 23 → IF-03 “When the chart stops working”; 24 → routine chart Bedtime template (“Lay out tomorrow's clothes”); 27 → IF-03 “Chores for preschoolers (ages 4–5)”; 28 → FP-01 sections 3 and 4 (“Label each night full, short or zero”, “Dinners decided once”); 29 → HC-03 “A zone is a time limit, not a room” (small spots get combined; the article doesn't address small homes specifically); 30 → FP-04 15-minute reset and five-minute version. **The live site was not checked.**
- **Boards:** all 10 match the registry exactly.
- **Media URLs:** checked for the 8 import rows.

## 500-pin master calendar

`OMC_500_Pin_Content_Calendar.xlsx` is not in this repository on any branch, and no other master-plan file exists in GitHub. **The workbook was not edited.** `master-calendar-update-proposal.csv` holds the update for the ten master IDs: final headline, asset path, board, destination and its validation state, creative approved, Pinterest status unverified. Original concept and keyword columns say to keep the workbook values; they weren't available here and weren't invented.

**Pins 1–20 are not reconciled.** Batches 01 and 02 never recorded master IDs, and without the workbook their concepts can't be matched to IDs. Upload the workbook (or the ID list for pins 1–20) to close this.

## Remaining launch checks

1. Fix the broken pin image on the HC-07 destination: `bathroom-reset-checklist.mdx` embeds `/images/pinterest/HC-07-search-1000x1500.webp`, which isn't in the repository.
2. Re-send the replacement pin 29 on its own; it then goes through the same conversion, a new asset commit and the import file.
3. Resolve the held pins in `blocked-pins.md`.
4. Open the destination URLs on the live site and confirm each returns 200 and shows what its pin promises.
5. Confirm the exact board spellings in the live account (the registry notes truncated profile cards).
6. After importing, update `docs/editorial/PINTEREST_PIN_INVENTORY.md` and the master calendar only from real Pinterest evidence (pin URL and date).
