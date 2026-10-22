# Gemini batch 06: pins 51–60 (2026-10-22)

Ten pins planned for master rows 50–59 of the 500-pin calendar ([`OMC_500_Pin_Content_Calendar.csv`](../../../docs/editorial/pinterest/OMC_500_Pin_Content_Calendar.csv)). Batch numbers are not master IDs. **All ten images received and approved by the owner for upload on 2026-10-22** (51, 55 and 59 by override of the QA holds below; 51 assigned OMC-P0028, 55 assigned OMC-P0189). All ten are in `pinterest-import-ready.csv` and live in `final-2026-10-22/` (51, 55, 59 moved from `held-2026-10-22/` in commit `4097a87`). Nothing imported, scheduled or published by Claude.

- **Seven pass QA** and are in `pinterest-import-ready.csv`, pending owner approval: 52, 53, 54, 56, 57, 58, 60.
- **Two are held** because their planned slots are already approved: 51 (OMC-P0026, batch 05 #50) and 55 (OMC-P0188, batch 02 #18, identical headline).
- **One fails QA and is held:** 59 (OMC-P0100), teal headline words at 2.6:1 contrast. Details in [qa-report.md](qa-report.md).

| # | Master ID | Headline on image | File | Destination | Board | State |
| --- | --- | --- | --- | --- | --- | --- |
| 51 | unassigned (planned P0026 taken; proposed P0028) | 5 Chores an 8-Year-Old Can Own | `held-2026-10-22/omc-chores-for-8-year-olds-02.png` | /resources/chores-for-kids-by-age | Chores & Shared Responsibilities | Held: ID conflict; visual QA pass |
| 52 | OMC-P0276 | Every School Paper Needs a Place | `final-2026-10-22/omc-school-paperwork-organization-01.png` | /resources/school-paperwork-organization | Family Organization Ideas | QA pass; import-ready pending approval |
| 53 | OMC-P0232 | A Paper Station Needs an Exit | `final-2026-10-22/omc-command-center-paper-station-01.png` | /resources/home-command-center | Family Organization Ideas | QA pass (minor notes); import-ready pending approval |
| 54 | OMC-P0482 | The Holiday List Needs Names | `final-2026-10-22/omc-holiday-family-planning-checklist-01.png` | /resources/holiday-family-planning-checklist | Family Organization Ideas | QA pass; import-ready pending approval |
| 55 | unassigned (planned P0188 taken; proposed P0189/P0190) | The Paper Pile Needs Two Places | `held-2026-10-22/omc-paper-clutter-organization-01.png` | /resources/home-command-center | Family Organization Ideas | Held: QA fail (duplicate headline and concept) |
| 56 | OMC-P0438 | Hand Off the Whole Job | `final-2026-10-22/omc-hand-off-the-whole-job-01.png` | /resources/how-to-share-the-mental-load | Mom Life & Mental Load | QA pass; import-ready pending approval |
| 57 | OMC-P0144 | A Cleaning Plan for Workdays | `final-2026-10-22/omc-cleaning-schedule-for-working-moms-01.png` | /resources/cleaning-schedule-for-working-moms | Cleaning Schedules for Busy Moms | QA pass; import-ready pending approval |
| 58 | OMC-P0394 | Dinner Depends on the Night | `final-2026-10-22/omc-easy-dinner-planning-system-01.png` | /resources/easy-dinner-planning-system | Meal Planning for Families | QA pass; import-ready pending approval |
| 59 | OMC-P0100 | Rewards Don’t Have to Be Stuff | `held-2026-10-22/omc-chore-chart-reward-ideas-01.png` | /resources/chore-chart-reward-ideas | Chores & Shared Responsibilities | Held: QA fail (headline contrast) |
| 60 | OMC-P0350 | Tomorrow Starts by the Door | `final-2026-10-22/omc-getting-kids-out-the-door-01.png` | /resources/getting-kids-out-the-door | Family Organization Ideas | QA pass; import-ready pending approval |

Boards for 56–60 are proposals from [PINTEREST_BOARDS.md](../../../docs/editorial/PINTEREST_BOARDS.md); confirm when the images arrive.

## Files

- `originals/`: the ten JPEGs exactly as supplied (`1.jpg` = 55, `2.jpg` = 54, `3.jpg` = 53, `4.jpg` = 52, `5.jpg` = 51, `6.jpg` = 60, `7.jpg` = 59, `8.jpg` = 58, `9.jpg` = 57, `10.jpg` = 56).
- `final-2026-10-22/`: the seven QA-pass 1000 × 1500 sRGB PNGs.
- `held-2026-10-22/`: empty; 51, 55 and 59 moved to final after owner approval.
- `production-manifest.csv`: master ID, original and final filenames, dimensions, SHA-256 of both, path, immutable media URL, destination, board, QA, approval and publish state (rows for all ten).
- `pinterest-metadata.csv`: internal metadata for every received pin, including held ones. **Not a Pinterest import file.**
- `pinterest-import-ready.csv`: Pinterest Import Content file, all ten pins **51–60**.
- `qa-report.md`, `contact-sheet-2026-10-22.png`.

## Pinterest Import Content CSV

Columns `Title,Media URL,Pinterest board,Thumbnail,Description,Link,Publish date,Keywords`, same as batches 03–05. UTF-8 without BOM, CRLF.

| Column | This batch |
| --- | --- |
| Title | 49–66 characters (limit 100); each starts with the primary keyword. |
| Media URL | Raw GitHub links at commit `cba71a1` (52–54) and `e09ca33` (56–58, 60); all HTTP 200 `image/png`, byte-identical to the committed files (checked 2026-10-22). |
| Pinterest board | Exact names from PINTEREST_BOARDS.md. Three of 52–54 plus 60 are Family Organization Ideas; spread them across days. |
| Thumbnail | Blank (image pins). |
| Description | Two sentences, 254–302 characters, built from each destination's own copy. No hashtags. |
| Link | Canonical, no trailing slash (the live site 308-redirects to the trailing-slash URL, then 200). |
| Publish date | **Blank. No dates were requested, so none were invented. A blank date publishes immediately on import.** Add dates (format `2026-10-24T10:00:00`) before importing if these should be scheduled; batch 05 is planned Oct 24–28. Keep 60 apart from the launch-pad pin (P0348) and “Tomorrow Starts Tonight” (P0369); keep 53 apart from 52. |
| Keywords | Four phrases per pin; hypotheses, not checked against Pinterest search. |

## Live check

2026-10-22: all ten destinations return HTTP 200 (after 308) with their expected titles. Re-check before importing if the import happens days later.
