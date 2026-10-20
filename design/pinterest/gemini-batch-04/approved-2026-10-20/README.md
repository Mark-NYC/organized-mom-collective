# Gemini batch 04: pins 31–40 (2026-10-20)

Ten Gemini pins assigned by the owner to master IDs from the 500-pin calendar ([`OMC_500_Pin_Content_Calendar.csv`](../../../../docs/editorial/pinterest/OMC_500_Pin_Content_Calendar.csv)). Batch numbers are not master IDs. Nothing here has been imported, scheduled or published on Pinterest.

**All 10 approved and import-ready.** 37, 38 and 40 by owner override (2026-10-20), as is. Details in [qa-report.md](qa-report.md) and [blocked-pins.md](blocked-pins.md).

| # | Master ID | Headline | File | Destination | Board | State |
| --- | --- | --- | --- | --- | --- | --- |
| 31 | OMC-P0251 | Busy Family Calendar | `omc-busy-family-calendar-02.png` | /resources/busy-family-calendar | Family Organization Ideas | Import-ready (owner replacement) |
| 32 | OMC-P0207 | Missed a Cleaning Day? | `omc-missed-cleaning-day-01.png` | /resources/missed-cleaning-day | Cleaning Schedules for Busy Moms | Import-ready |
| 33 | OMC-P0457 | Teaching Kids Independence | `omc-teaching-kids-independence-01.png` | /resources/teaching-kids-independence | Chores & Shared Responsibilities | Import-ready |
| 34 | OMC-P0168 | 10-Minute Living Room Reset | `omc-ten-minute-living-room-reset-01.png` | /resources/ten-minute-living-room-reset | Cleaning Schedules for Busy Moms | Import-ready |
| 35 | OMC-P0418 | Kids Can Help Make Dinner | `omc-kids-help-make-dinner-01.png` | /resources/kids-helping-with-dinner | Chores & Shared Responsibilities | Import-ready |
| 36 | OMC-P0124 | A Weekly Cleaning Schedule for Real Life | `omc-weekly-cleaning-schedule-real-life-01.png` | /resources/weekly-cleaning-schedule-for-busy-moms | Cleaning Schedules for Busy Moms | Import-ready |
| 37 | OMC-P0374 | A Screen Time Routine Kids Can Follow | `omc-screen-time-routine-for-kids-01.png` | /resources/screen-time-routine-for-kids | Family Organization Ideas | Import-ready (owner override) |
| 38 | OMC-P0080 | Kitchen Chores Kids Can Own | `omc-kitchen-chores-kids-can-own-01.png` | /resources/chores-for-kids-by-age | Chores & Shared Responsibilities | Import-ready (owner override) |
| 39 | OMC-P0330 | School Morning Checklist | `omc-school-morning-checklist-01.png` | /resources/morning-routine-chart-generator | Family Organization Ideas | Import-ready |
| 40 | OMC-P0011 | Chores for 5-Year-Olds | `omc-chores-for-5-year-olds-01.png` | /resources/chores-for-kids-by-age | Chores & Shared Responsibilities | Import-ready (owner override) |

## Files

- `omc-*.png`: all ten approved pins. 37, 38 and 40 were in `../held-2026-10-20/` until the owner approved them; media URLs point at commit `8559ad9`. Pin 31's first version (`1.jpg`, no Sunday column) was replaced by the owner's `6.jpg` (shipped as `-02`); the first version is only in commit `4cb196e`.
- `originals/`: files exactly as supplied. `2.jpg`–`5.jpg` = pins 32–35, `6.jpg` = pin 31 replacement, `pins-36-40/1.jpg`–`5.jpg` = pins 36–40.
- `production-manifest.csv`: original and final filename, master ID, dimensions, SHA-256 of both files, repository path, public image URL, destination, board, approval and publication status.
- `pinterest-metadata.csv`: internal metadata for all 10 pins. **Not a Pinterest import file.** Alt text for every pin is written from the actual file.
- `pinterest-import-ready.csv`: the Pinterest Import Content file, all 10 pins (31–40).
- `import-validation.json`: conversion results, length checks, round-trip and duplicate scan.
- `qa-report.md`, `blocked-pins.md`.
- `../omc-gemini-batch-04-approved-2026-10-20.zip`: the ten approved PNGs plus every CSV, the manifest, the QA report and the updated master and reconciliation.

## Pinterest Import Content CSV

`Title,Media URL,Pinterest board,Thumbnail,Description,Link,Publish date,Keywords`, same as batch 03.

| Column | This batch |
| --- | --- |
| Title | Unique, 55–71 characters (limit 100). |
| Media URL | Immutable raw GitHub links: 32–35 at `4cb196e`, 36 and 39 at `8cb00ea`, 31 at `3e9f442`. All returned HTTP 200 `image/png`, byte-identical to the committed files. |
| Pinterest board | Exact names from [PINTEREST_BOARDS.md](../../../../docs/editorial/PINTEREST_BOARDS.md). No new boards. |
| Description | Unique, 277–313 characters (limit 500). Built from each destination's own copy. No hashtags, no product claims. |
| Link | Canonical `https://www.organizedmomcollective.com/resources/…`, no trailing slash. All live, HTTP 200. |
| Publish date | Owner-requested plan, set 2026-10-20 (master dates stay as proposals): **Oct 23: 33, 34. Oct 24: 35. Oct 25: 31. Oct 27: 32** (a week after batch 01's “Missed a day?”). **Oct 28: 36, 39.** Owner-approved later: **Oct 26: 37. Oct 29: 38. Oct 30: 40** (38 and 40 share a board and destination, so a day apart). All at 12:00, format `YYYY-MM-DDTHH:MM:SS`. Assumes batches 01–03 are queued for Oct 20–22; not checked in the live account. |
| Keywords | 4 phrases per pin. Hypotheses, not checked against Pinterest search. |

UTF-8 without BOM, CRLF, RFC 4180 quoting; round-trip confirmed.

**Spacing:** pin 32 repeats batch 01 #1's hook (“Missed a day? Skip it.”, OMC-P0122), so keep them a week apart. 33 and 35 share a board on consecutive days.

## How the files were produced

Each JPEG was decoded and saved as PNG with no resizing, cropping, recoloring or retouching; reopening each PNG gives the same pixels as the source. The sources were untagged, so each got the same sRGB profile bytes as batches 01–03. Tags change no pixels. All five are 687 × 1024 (the size the attachments arrived at), not 1000 × 1500.

## Site fix made during this batch

Three destinations (34, 35, 37) were 404 live because every production build since HC-09 failed. Two meta descriptions were over the 160-character schema limit. Trimmed in `e8de32f`; the deploy succeeded and all three pages now return 200.
