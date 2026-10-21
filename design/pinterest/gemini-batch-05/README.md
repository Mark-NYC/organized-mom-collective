# Gemini batch 05: pins 41–50 (2026-10-21)

Ten Gemini pins assigned by the owner to master IDs from the 500-pin calendar ([`OMC_500_Pin_Content_Calendar.csv`](../../../docs/editorial/pinterest/OMC_500_Pin_Content_Calendar.csv)). Batch numbers are not master IDs. **Nothing here is owner-approved, imported, scheduled or published.**

**All ten images received** (41–45 first, 46–50 later the same day; pin 47 replaced twice). **7 pass QA:** 47 is owner-approved; 41, 45, 48, 49, 50 are import-ready pending approval; 44 passes but is held for January. **3 fail and are held:** 42, 43, 46. Details in [qa-report.md](qa-report.md).

| # | Master ID | Headline on image | File | Destination | Board | State |
| --- | --- | --- | --- | --- | --- | --- |
| 41 | OMC-P0021 | 3 Chores a 7-Year-Old Can Own | `final-2026-10-21/omc-chores-for-7-year-olds-01.png` | /resources/chores-for-kids-by-age | Chores & Shared Responsibilities | QA pass; import-ready; awaiting approval |
| 42 | OMC-P0271 | A Calendar Kids Check | `held-2026-10-21/omc-kids-activity-calendar-01.png` | /resources/how-to-organize-a-family-calendar | Family Organization Ideas | **QA fail** (child’s head visible; copy) |
| 43 | OMC-P0227 | Your Family Planner Is Missing One Thing | `held-2026-10-21/omc-family-planner-who-does-what-01.png` | /resources/free-weekly-family-planner-printable | Family Organization Ideas | **QA fail** (no wordmark) |
| 44 | OMC-P0477 | Don’t Organize Your Whole Life This January | `final-2026-10-21/omc-new-year-weekly-reset-01.png` | /resources/weekly-family-reset | Weekly Reset Routines | QA pass; seasonal hold (Dec 28) |
| 45 | OMC-P0183 | Give Laundry a Place in the Week | `final-2026-10-21/omc-family-laundry-schedule-01.png` | /resources/family-laundry-schedule (new HC-10) | Cleaning Schedules for Busy Moms | QA pass; import-ready; awaiting approval |
| 46 | OMC-P0139 | A Cleaning Routine the Whole Family Shares | `held-2026-10-21/omc-family-cleaning-routine-01.png` | /resources/daily-cleaning-routine | Cleaning Schedules for Busy Moms | **QA fail** (face in profile, heads visible) |
| 47 | OMC-P0389 | Plan Dinner and Groceries Together | `final-2026-10-21/omc-meal-planning-and-groceries-03.png` | /resources/weekly-meal-planning-for-families | Meal Planning for Families | **Approved by owner** 2026-10-21; QA pass; import-ready. `-01` and `-02` held. |
| 48 | OMC-P0095 | Kids Can Do Chores Without Earning Prizes | `final-2026-10-21/omc-chores-without-rewards-01.png` | /resources/chore-chart-without-rewards (new IF-11) | Chores & Shared Responsibilities | QA pass; import-ready; awaiting approval |
| 49 | OMC-P0345 | Weekends Need a Rhythm, Not a Schedule | `final-2026-10-21/omc-weekend-routine-for-kids-01.png` | /resources/weekend-routine-for-kids (new FP-22) | Family Organization Ideas | QA pass; import-ready; awaiting approval |
| 50 | OMC-P0026 | 5 Chores an 8-Year-Old Can Learn to Own | `final-2026-10-21/omc-chores-for-8-year-olds-01.png` | /resources/chores-for-kids-by-age | Chores & Shared Responsibilities | QA pass (minor artifact); import-ready; awaiting approval |

## Headline adaptations vs. the master drafts

| # | Master draft | On the image |
| --- | --- | --- |
| 41 | Chores for 7 year olds | 3 Chores a 7-Year-Old Can Own |
| 42 | Kids activity calendar | A Calendar Kids Check (assigned: “A Kids’ Activity Calendar They Can Actually Check”) |
| 43 | The part of weekly family planner families often miss | Your Family Planner Is Missing One Thing |
| 44 | The part of new year family organization families often miss | Don’t Organize Your Whole Life This January |
| 45 | Give loads a repeatable place in the week | Give Laundry a Place in the Week |
| 46 | What cleaning schedule with kids looks like in a real home | A Cleaning Routine the Whole Family Shares |
| 47 | What meal planner with grocery list looks like in a real home | -01: Your Family’s Organized Week; -02 and -03: Plan Dinner and Groceries Together |
| 48 | Try a free chore chart without rewards | Kids Can Do Chores Without Earning Prizes |
| 49 | Put weekend routine for kids to work this week | Weekends Need a Rhythm, Not a Schedule |
| 50 | Chores for 8 year olds | 5 Chores an 8-Year-Old Can Learn to Own |

Metadata is written from the actual images, not the drafts.

## Files

- `originals/`: the ten JPEGs exactly as supplied (`1.jpg` = pin 45, `2.jpg` = 41, `3.jpg` = 42, `4.jpg` = 43, `5.jpg` = 44, `6.jpg` = 50, `7.jpg` = 49, `8.jpg` = 48, `9.jpg` = 47 first version, `10.jpg` = 46, `11.jpg` = 47 first replacement, `12.jpg` = 47 approved replacement).
- `final-2026-10-21/`: QA-passed 1000 × 1500 sRGB PNGs (41, 44, 45, 47, 48, 49, 50).
- `held-2026-10-21/`: same export of the failed pins (42, 43, 46, and 47’s superseded -01 and -02), for review only.
- `production-manifest.csv`: master ID, original and final filenames, dimensions, SHA-256 of both, path, immutable media URL, destination, board, QA and publish state.
- `pinterest-metadata.csv`: internal metadata for every received pin, including held ones. **Not a Pinterest import file.**
- `pinterest-import-ready.csv`: Pinterest Import Content file, pins **41, 45, 47, 48, 49, 50**.
- `pinterest-import-seasonal-hold.csv`: pin 44, dated 2026-12-28. Import in December, not now.
- `qa-report.md`, `contact-sheet-2026-10-21.png`.

## Pinterest Import Content CSV

Columns `Title,Media URL,Pinterest board,Thumbnail,Description,Link,Publish date,Keywords`, same as batches 03–04. UTF-8 without BOM, CRLF.

| Column | This batch |
| --- | --- |
| Title | 41–68 characters in the import file (limit 100). |
| Media URL | Raw GitHub links at commit `7e6a2ed` (41, 45), `6b64f86` (48–50) and `cd0c120` (47); all HTTP 200, byte-identical to the committed files. |
| Pinterest board | Exact names from [PINTEREST_BOARDS.md](../../../docs/editorial/PINTEREST_BOARDS.md). |
| Description | Two sentences, 177–286 characters, built from each destination’s own copy. No hashtags. |
| Link | Canonical, no trailing slash (the live site 308-redirects to the trailing-slash URL, then 200). |
| Publish date | Proposed, 12:00 each: **41 Nov 1, 45 Nov 2, 48 Nov 3, 49 Nov 4, 50 Nov 5, 47 Nov 6.** The three Chores-board pins (41, 48, 50) alternate with other boards; 41 and 50 share a destination and sit four days apart, and 41 is two days after batch 04 #40. Assumes batch 04 is queued through Oct 30; not checked in the live account. A blank date would publish on import. |
| Keywords | Four phrases per pin; hypotheses, not checked against Pinterest search. |

**Pins 45, 48 and 49 link to pages created in this batch.** Confirm they return 200 before importing (see the live check below).

## Live check

Checked 2026-10-21 (about 16:41 UTC) after the Cloudflare Pages deploy: `/resources/family-laundry-schedule`, `/resources/chore-chart-without-rewards` and `/resources/weekend-routine-for-kids` all return HTTP 200 with their expected titles, and all three are listed on `/resources`. The other destinations were checked live earlier the same day. Re-check before importing if the import happens days later.
