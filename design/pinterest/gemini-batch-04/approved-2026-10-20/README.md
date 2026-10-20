# Gemini batch 04: pins 31–40 (2026-10-20)

Ten Gemini pins assigned by the owner to master IDs from the 500-pin calendar ([`OMC_500_Pin_Content_Calendar.csv`](../../../../docs/editorial/pinterest/OMC_500_Pin_Content_Calendar.csv)). Batch numbers are not master IDs. Nothing here has been imported, scheduled or published on Pinterest.

**4 approved and import-ready (32–35). 1 held for an owner decision (31). 5 not received as files (36–40).** Details in [qa-report.md](qa-report.md) and [blocked-pins.md](blocked-pins.md).

| # | Master ID | Headline | File | Destination | Board | State |
| --- | --- | --- | --- | --- | --- | --- |
| 31 | OMC-P0251 | Busy Family Calendar | `../held-2026-10-20/omc-busy-family-calendar-01.png` | /resources/busy-family-calendar | Family Organization Ideas | Held: calendar prop has no Sunday column |
| 32 | OMC-P0207 | Missed a Cleaning Day? | `omc-missed-cleaning-day-01.png` | /resources/missed-cleaning-day | Cleaning Schedules for Busy Moms | Import-ready |
| 33 | OMC-P0457 | Teaching Kids Independence | `omc-teaching-kids-independence-01.png` | /resources/teaching-kids-independence | Chores & Shared Responsibilities | Import-ready |
| 34 | OMC-P0168 | 10-Minute Living Room Reset | `omc-ten-minute-living-room-reset-01.png` | /resources/ten-minute-living-room-reset | Cleaning Schedules for Busy Moms | Import-ready |
| 35 | OMC-P0418 | Kids Can Help Make Dinner | `omc-kids-help-make-dinner-01.png` | /resources/kids-helping-with-dinner | Chores & Shared Responsibilities | Import-ready |
| 36 | OMC-P0124 | A Weekly Cleaning Schedule for Real Life | not received | /resources/weekly-cleaning-schedule-for-busy-moms | Cleaning Schedules for Busy Moms | Held: file missing |
| 37 | OMC-P0374 | A Screen Time Routine Kids Can Follow | not received | /resources/screen-time-routine-for-kids | Family Organization Ideas | Held: file missing; IP decision |
| 38 | OMC-P0080 | Kitchen Chores Kids Can Own | not received | /resources/chores-for-kids-by-age | Chores & Shared Responsibilities | Held: file missing; caption fix |
| 39 | OMC-P0330 | School Morning Checklist | not received | /resources/morning-routine-chart-generator | Family Organization Ideas | Held: file missing |
| 40 | OMC-P0011 | Chores for 5-Year-Olds | not received | /resources/chores-for-kids-by-age | Chores & Shared Responsibilities | Held: file missing; “Make the bed” fix |

## Files

- `omc-*.png`: the four approved pins. The held pin 31 is in `../held-2026-10-20/` so it can't be mistaken for an approved file.
- `originals/`: `1.jpg`–`5.jpg` exactly as supplied (chat attachment order = pins 31–35).
- `production-manifest.csv`: original and final filename, master ID, dimensions, SHA-256 of both files, repository path, public image URL, destination, board, approval and publication status.
- `pinterest-metadata.csv`: internal metadata for all 10 pins. **Not a Pinterest import file.** Rows 36–40 are drafts; their alt text must be written from the actual file.
- `pinterest-import-ready.csv`: the Pinterest Import Content file, pins 32–35 only.
- `import-validation.json`: conversion results, length checks, round-trip and duplicate scan.
- `qa-report.md`, `blocked-pins.md`.
- `../omc-gemini-batch-04-approved-2026-10-20.zip`: the four approved PNGs plus every CSV, the manifest, the QA report and the updated master and reconciliation.

## Pinterest Import Content CSV

`Title,Media URL,Pinterest board,Thumbnail,Description,Link,Publish date,Keywords`, same as batch 03.

| Column | This batch |
| --- | --- |
| Title | Unique, 60–71 characters (limit 100). |
| Media URL | Immutable raw GitHub links at asset commit `4cb196e`. All returned HTTP 200 `image/png`, byte-identical to the committed files. |
| Pinterest board | Exact names from [PINTEREST_BOARDS.md](../../../../docs/editorial/PINTEREST_BOARDS.md). No new boards. |
| Description | Unique, 277–313 characters (limit 500). Built from each destination's own copy. No hashtags, no product claims. |
| Link | Canonical `https://www.organizedmomcollective.com/resources/…`, no trailing slash. All live, HTTP 200. |
| Publish date | The master calendar's original proposed date at noon: 32 and 33 on 2026-10-26, 34 and 35 on 2026-10-27. Recommendation only; the owner sets the schedule. |
| Keywords | 4 phrases per pin. Hypotheses, not checked against Pinterest search. |

UTF-8 without BOM, CRLF, RFC 4180 quoting; round-trip confirmed.

**Spacing:** pin 32 repeats batch 01 #1's hook (“Missed a day? Skip it.”, OMC-P0122), so keep them a week apart. 33 and 35 share a board on consecutive days.

## How the files were produced

Each JPEG was decoded and saved as PNG with no resizing, cropping, recoloring or retouching; reopening each PNG gives the same pixels as the source. The sources were untagged, so each got the same sRGB profile bytes as batches 01–03. Tags change no pixels. All five are 687 × 1024 (the size the attachments arrived at), not 1000 × 1500.

## Site fix made during this batch

Three destinations (34, 35, 37) were 404 live because every production build since HC-09 failed. Two meta descriptions were over the 160-character schema limit. Trimmed in `e8de32f`; the deploy succeeded and all three pages now return 200.
