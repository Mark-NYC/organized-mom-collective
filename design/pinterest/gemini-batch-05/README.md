# Gemini batch 05: pins 41–50 (2026-10-21)

Ten Gemini pins assigned by the owner to master IDs from the 500-pin calendar ([`OMC_500_Pin_Content_Calendar.csv`](../../../docs/editorial/pinterest/OMC_500_Pin_Content_Calendar.csv)). Batch numbers are not master IDs. **Nothing here is owner-approved, imported, scheduled or published.**

**Five of ten images received.** 41 and 45 are import-ready pending approval, 44 passes but is held for January, 42 and 43 fail QA, 46–50 never reached the session. Details in [qa-report.md](qa-report.md).

| # | Master ID | Headline on image | File | Destination | Board | State |
| --- | --- | --- | --- | --- | --- | --- |
| 41 | OMC-P0021 | 3 Chores a 7-Year-Old Can Own | `final-2026-10-21/omc-chores-for-7-year-olds-01.png` | /resources/chores-for-kids-by-age | Chores & Shared Responsibilities | QA pass; import-ready; awaiting approval |
| 42 | OMC-P0271 | A Calendar Kids Check | `held-2026-10-21/omc-kids-activity-calendar-01.png` | /resources/how-to-organize-a-family-calendar | Family Organization Ideas | **QA fail** (child’s head visible; copy) |
| 43 | OMC-P0227 | Your Family Planner Is Missing One Thing | `held-2026-10-21/omc-family-planner-who-does-what-01.png` | /resources/free-weekly-family-planner-printable | Family Organization Ideas | **QA fail** (no wordmark) |
| 44 | OMC-P0477 | Don’t Organize Your Whole Life This January | `final-2026-10-21/omc-new-year-weekly-reset-01.png` | /resources/weekly-family-reset | Weekly Reset Routines | QA pass; seasonal hold (Dec 28) |
| 45 | OMC-P0183 | Give Laundry a Place in the Week | `final-2026-10-21/omc-family-laundry-schedule-01.png` | /resources/family-laundry-schedule (new HC-10) | Cleaning Schedules for Busy Moms | QA pass; import-ready; awaiting approval |
| 46 | OMC-P0139 | A Cleaning Routine the Whole Family Shares | not received | /resources/daily-cleaning-routine | Cleaning Schedules for Busy Moms | Not received |
| 47 | OMC-P0389 | Plan Dinner and Groceries Together | not received | /resources/weekly-meal-planning-for-families | Meal Planning for Families | Not received |
| 48 | OMC-P0095 | Kids Can Do Chores Without Earning Prizes | not received | /resources/chore-chart-without-rewards (new IF-11) | Chores & Shared Responsibilities | Not received |
| 49 | OMC-P0345 | Weekends Need a Rhythm, Not a Schedule | not received | /resources/weekend-routine-for-kids (new FP-22) | Family Organization Ideas | Not received |
| 50 | OMC-P0026 | 5 Chores an 8-Year-Old Can Learn to Own | not received | /resources/chores-for-kids-by-age | Chores & Shared Responsibilities | Not received |

## Headline adaptations vs. the master drafts

| # | Master draft | On the image |
| --- | --- | --- |
| 41 | Chores for 7 year olds | 3 Chores a 7-Year-Old Can Own |
| 42 | Kids activity calendar | A Calendar Kids Check (assigned: “A Kids’ Activity Calendar They Can Actually Check”) |
| 43 | The part of weekly family planner families often miss | Your Family Planner Is Missing One Thing |
| 44 | The part of new year family organization families often miss | Don’t Organize Your Whole Life This January |
| 45 | Give loads a repeatable place in the week | Give Laundry a Place in the Week |

Metadata is written from the actual images, not the drafts.

## Files

- `originals/`: the five JPEGs exactly as supplied (`1.jpg` = pin 45, `2.jpg` = 41, `3.jpg` = 42, `4.jpg` = 43, `5.jpg` = 44).
- `final-2026-10-21/`: QA-passed 1000 × 1500 sRGB PNGs (41, 44, 45).
- `held-2026-10-21/`: same export of the failed pins (42, 43), for review only.
- `production-manifest.csv`: master ID, original and final filenames, dimensions, SHA-256 of both, path, immutable media URL, destination, board, QA and publish state. Rows for 46–50 record “not received”.
- `pinterest-metadata.csv`: internal metadata for every received pin, including held ones. **Not a Pinterest import file.**
- `pinterest-import-ready.csv`: Pinterest Import Content file, pins **41 and 45 only**.
- `pinterest-import-seasonal-hold.csv`: pin 44, dated 2026-12-28. Import in December, not now.
- `qa-report.md`, `contact-sheet-2026-10-21.png`.

## Pinterest Import Content CSV

Columns `Title,Media URL,Pinterest board,Thumbnail,Description,Link,Publish date,Keywords`, same as batches 03–04. UTF-8 without BOM, CRLF.

| Column | This batch |
| --- | --- |
| Title | 43–80 characters (limit 100). |
| Media URL | Raw GitHub links at commit `7e6a2ed`; HTTP 200 `image/png`, byte-identical to the committed files. |
| Pinterest board | Exact names from [PINTEREST_BOARDS.md](../../../docs/editorial/PINTEREST_BOARDS.md). |
| Description | Two sentences, 175–286 characters, built from each destination’s own copy. No hashtags. |
| Link | Canonical, no trailing slash (the live site 308-redirects to the trailing-slash URL, then 200). |
| Publish date | Proposed: **41 on 2026-11-01** (two days after batch 04 #40, same board and destination), **45 on 2026-11-02**, 12:00. Assumes batch 04 is queued through Oct 30; not checked in the live account. A blank date would publish on import. |
| Keywords | Four phrases per pin; hypotheses, not checked against Pinterest search. |

**Pin 45 links to a page created in this batch.** Confirm `/resources/family-laundry-schedule` returns 200 before importing (see the live check below).

## Live check

Recorded at the end of the batch session; see the final commit message for the result.
