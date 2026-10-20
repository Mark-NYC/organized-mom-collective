# Six-article hero photo sourcing | October 20, 2026

## Installation update (2026-10-20, later)

The owner supplied all six photos; they are installed as heroes (originals in `design/photography/kaboompics/six-article-heroes-2026-10-20/`, records in `lifestyle-photo-library.json`, registry keys in `src/data/images.ts`):

| Article | Registry key | Source ID |
| --- | --- | --- |
| FP-19 | `fp-19-busy-family-calendar-hero` | 21474 (matches brief) |
| HC-08 | `hc-08-missed-cleaning-day-hero` | 30800 (matches brief) |
| IF-08 | `if-08-teaching-kids-independence-hero` | 22717 (matches brief) |
| HC-09 | `hc-09-ten-minute-living-room-reset-hero` | unconfirmed: supplied photo is a woman reading, not 30364's empty sofa |
| FP-20 | `fp-20-screen-time-routine-for-kids-hero` | 1913 (matches brief) |
| IF-09 | `if-09-kids-helping-with-dinner-hero` | unconfirmed: supplied photo is on a steel counter, not 39343's marble |

**Still open:** Kaboompics pages return HTTP 403 to the build environment, so license pages were not re-read; each record lists this under `open_items`. FP-19's pen shows a hotel name ("HOTEL KOROŠICA"), flagged for the owner.


Status: **candidates selected, installation blocked**. These are distinct Kaboompics photo IDs not found in the current `lifestyle-photo-library.json` and `src/data/images.ts` text records as of 2026-10-20. Source detail pages display standard commercial-use license. **Full-resolution contents, crops, direct download bytes, reuse in any uncataloged article, responsive output, and final rights/brand clearance have not been independently verified.**

| Article | Proposed image ID | Kaboompics source | Candidate file stem | Intended alt text |
| --- | --- | --- | --- | --- |
| FP-19 busy-family-calendar | 21474 | https://kaboompics.com/photo/21474/hand-writing-in-notebook-with-wooden-desk-copy-space | fp-19-planning-notebook | A hand writes in a notebook beside an open stretch of wooden desk |
| HC-08 missed-cleaning-day | 30800 | https://kaboompics.com/photo/30800/portrait-table-setting-background-with-neutral-plates-and-cutlery-and-generous-copy-space | hc-08-table-reset | Neutral dishes and cutlery arranged on a table with space around them |
| IF-08 teaching-kids-independence | 22717 | https://kaboompics.com/photo/22717/student-packing-school-backpack-at-home | if-08-packing-backpack | A student packs a school backpack at home |
| HC-09 ten-minute-living-room-reset | 30364 | https://kaboompics.com/photo/30364/open-book-on-neutral-gray-sofa-in-cozy-living-room | hc-09-sofa-book | An open book rests on a neutral sofa in a living room |
| IF-09 kids-helping-with-dinner | 39343 | https://kaboompics.com/photo/39343/draining-small-cucumbers-through-a-colander-over-a-bowl-on-marble-counter | if-09-kitchen-colander | Cucumbers are drained through a colander over a bowl on a kitchen counter |
| FP-20 screen-time-routine-for-kids | 1913 | https://kaboompics.com/photo/1913/coffee-on-table-with-a-tablet | fp-20-tablet-table | A tablet sits on a table with coffee nearby |

## Remaining installation procedure

1. Recheck every source page, individual photograph and commercial-use license. Reject editorial-only images and third-party branding.
2. Inspect the six photo files at full resolution; select crops that convey the correct topic and preserve dignity. Do not present stock models as actual OMC customers.
3. Recheck source IDs against **all** used lifestyle photos. Each source photo may only serve one article; hero and inline must not use the same source.
4. Download lawful original files to `design/photography/kaboompics/<ARTICLE_ID>/`. Keep originals unchanged.
5. Render responsive variants in `public/images/resources/` with `scripts/article-image.py`; record actual dimensions and crop.
6. Register each asset in both `src/data/images.ts` and `docs/brand/lifestyle-photo-library.json`, including verified `public_path`, source link and image clearance.
7. Add matching `hero.image` and accurate `hero.alt` to each article's MDX frontmatter, using the same stem as the registered image.
8. Run `npm run check:article-photos` and `npm run verify`. Only then commit new media, metadata and article changes together.

**Do not set hero references until the image files are actually available in the repo.**

## Transport limitation

The active tool environment can inspect Kaboompics' web page text but could not download the actual binary files into the working container. The available GitHub text-file editor cannot turn a URL into downloadable original photo bytes. Therefore these six candidates have intentionally not been installed and none is marked cleared. The candidates need image-binary access and full-resolution review before use.
