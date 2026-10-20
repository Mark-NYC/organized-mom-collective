# Gemini batch 04: held pins

Three of ten pins are held and not in `pinterest-import-ready.csv`. Their IDs are reserved in the 500-pin master and `PRODUCTION_RECONCILIATION.csv`; reuse the same ID for the fix.

| # | Master ID | Headline | Held for | To clear |
| --- | --- | --- | --- | --- |
| 37 | OMC-P0374 | A Screen Time Routine Kids Can Follow | *The Wild Robot* cover and *CLUE* game box legible (third-party IP). | Owner: approve as is, or regenerate with plain props. |
| 38 | OMC-P0080 | Kitchen Chores Kids Can Own | “Put away sauces and things from the fridge” reads as taking things out; “Wipe the table” is over a kitchen counter. | “Put sauces back in the fridge”, “Wipe the counter”. |
| 40 | OMC-P0011 | Chores for 5-Year-Olds | “Make the bed” is listed for ages 6–8 at the destination. | “Pull up the covers”. |

Files: `../held-2026-10-20/`. Draft titles, descriptions, boards and verified links are in `pinterest-metadata.csv`.

## Cleared

| # | Master ID | Was held for | Cleared by |
| --- | --- | --- | --- |
| 31 | OMC-P0251 | Calendar prop had no Sunday column and no 27 (`1.jpg`, SHA-256 `4a77ec49…0da4d`, only in commit `4cb196e`). | Owner replacement `6.jpg` with a seven-day grid, shipped as `omc-busy-family-calendar-02.png`. |
| 36 | OMC-P0124 | File didn't reach the session. | File added in commit `8cb00ea`; full-resolution QA pass. |
| 39 | OMC-P0330 | File didn't reach the session. | File added in commit `8cb00ea`; full-resolution QA pass. |
