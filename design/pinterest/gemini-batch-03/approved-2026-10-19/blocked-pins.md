# Gemini batch 03: held pins

**No pins are held.** All 10 are in `pinterest-import-ready.csv`. This file records what was held and how each was cleared.

| # | Master ID | Headline | Was held for | Cleared by |
| --- | --- | --- | --- | --- |
| 21 | OMC-P0163 | A Bathroom Reset You Can Actually Finish | Misspelled first image (“Actualy”); proposed link `/resources/zone-cleaning-schedule` had no bathroom checklist. | Owner's corrected image (`6.jpg`); owner switched the link to `/resources/bathroom-reset-checklist` (HC-07). |
| 24 | OMC-P0369 | Tomorrow Starts Tonight | Real copyrighted book cover (*Where the Wild Things Are*, Maurice Sendak) legible in the image. | **Owner override**, 2026-10-19: keep as is. |
| 25 | OMC-P0075 | Small Bathroom Jobs Kids Can Own | `/resources/chores-for-kids-by-age` had one bathroom job and none of the pin's towel or toothbrush-cup jobs. | New article IF-07 `/resources/bathroom-chores-for-kids`, published 2026-10-19. |
| 26 | OMC-P0325 | The After-School Drop Zone | `/resources/launch-pad-by-the-door` covers leaving the house, not arriving home. | New article FP-13 `/resources/after-school-routine-for-kids`, published 2026-10-19. |
| 29 | OMC-P0212 | A Small Home Still Needs a Simple Cleaning Rhythm | Owner replaced the image; the replacement first failed to reach the session. | Replacement received (`12.jpg`), shipped as `omc-small-home-cleaning-rhythm-02.png`, asset commit `5db509e`. |

Also an **owner override**, never held: **pin 30** shows a generated adult face fragment (nose, lips, chin) at the top-right edge, which the QA checklist bans. Approved as is, 2026-10-19.

Still open from the pin 21 check: `src/content/articles/bathroom-reset-checklist.mdx` embeds `/images/pinterest/HC-07-search-1000x1500.webp`, which isn't in the repository. Pin 21 sends traffic there; fix before importing.
