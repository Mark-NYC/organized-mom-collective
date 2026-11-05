# November 7–8, 2026 Pinterest batch

Source images: `public/images/pinterest/daily-2026-11-05/`.

Import files:
- `pinterest-import-nov07-2026.csv`: five designs, November 7, 08:00–18:00 America/New_York.
- `pinterest-import-nov08-2026.csv`: eleven designs, November 8, 07:00–19:30 America/New_York.

These are **prepared imports, not evidence of Pinterest scheduling or publication**. Verify that each pin is absent from Pinterest's accepted/scheduled list before importing. Upload one CSV, wait for Pinterest's acceptance report, then import the next. Keep rejected rows separate and retry only after reconciling accepted ones.

## Mapping to master concepts

| Filename | Master concept ID | Intended article |
| --- | --- | --- |
| omc-dinner-team-free-pdf-pin-01.jpg | OMC-P0076 | kids-helping-with-dinner |
| omc-kids-kitchen-chores-skill-level-jobs-01.jpg | OMC-P0076 | kids-helping-with-dinner |
| omc-school-morning-checklist-night-before-01.jpg | OMC-P0326 | morning-routine-chart-generator |
| omc-stop-the-morning-scramble-01.jpg | OMC-P0326 | morning-routine-chart-generator |
| omc-chores-for-9-year-olds-can-own-01.jpg | OMC-P0032 | chores-for-kids-by-age |
| omc-from-helping-to-owning-jobs-age-9-01.jpeg | OMC-P0032 | chores-for-kids-by-age |
| omc-family-calendar-setup-location-habit-01.jpg.jpg | OMC-P0282 | how-to-organize-a-family-calendar |
| omc-one-calendar-everyone-checks-01.jpg.jpg | OMC-P0282 | how-to-organize-a-family-calendar |
| omc-shared-plan-mini-checklist-01.jpeg | OMC-P0238 | how-to-organize-a-family-calendar |
| omc-spring-cleaning-jobs-by-age-01.jpg | OMC-P0488 | /spring-cleaning-checklist/ |
| omc-spring-clean-one-room-at-a-time-01.jpeg | OMC-P0488 | /spring-cleaning-checklist/ |
| omc-stop-the-counter-pile-up-01.jpg | OMC-P0194 | kitchen-counter-clutter-reset |
| omc-what-to-do-instead-of-reminding-01.jpg | OMC-P0444 | kids-chores-without-nagging |
| omc-cleaning-schedule-printable-weekly-rhythm-01.jpg | OMC-P0150 | daily-cleaning-routine |
| omc-when-cleaning-feels-never-ending-01.jpg | OMC-P0150 | daily-cleaning-routine |
| omc-three-kinds-of-dinner-night-01.jpg | OMC-P0400 | weekly-meal-planning-for-families |

Both images under each master ID are **variants**, not two separate original master IDs. Do not overwrite reconciliation records or mark either published from this manifest.

## Publication gates / warnings

- `omc-three-kinds-of-dinner-night-01.jpg` substantially repeats a previous creative title and destination: `public/assets/pinterest/advice-pins-batch-02/omc-19-three-kinds-dinner-night.jpeg`. Review visual differentiation and Pinterest actual scheduled status before uploading.
- The two spring-cleaning pins are included for November 8 per owner request; this is early for spring 2027, so consider holding them if prioritizing seasonal reach.
- The two image files with `.jpg.jpg` are genuine uploaded filenames. Preserve exactly in URL until renamed explicitly.
- The exact rendered images have **not** been visually inspected through this GitHub text connector. Check visual accuracy, 1000×1500 dimensions, headline spelling, OMC footer, no visible palette hex codes, and any product/chart depiction.
- All destination pages should receive a live URL and promise check before Pinterest import; source article presence does not prove the live landing page passes.
- Check Pinterest for preexisting scheduled posts on these dates before importing, so actual daily counts remain intentional.
- Date-time strings in CSV are intended as **America/New_York local time**; Pinterest's native importer/account timezone should be confirmed.
- Both CSVs carry distinct `utm_content` values, but Pinterest can still reject apparently duplicated destinations or creative.
