# Gemini batch 01: approved pins (2026-10-19)

Ten owner-approved Pinterest pins made with Gemini, covering more than one article. The owner approved them as final designs. Nothing here has been imported, scheduled or published on Pinterest.

| # | Headline | File | Destination |
| --- | --- | --- | --- |
| 1 | Missed a day? | `omc-cleaning-missed-day-01.png` | /resources/weekly-cleaning-schedule-for-busy-moms |
| 2 | 15 minutes on Sunday. | `omc-sunday-family-reset-01.png` | /resources/weekly-family-reset |
| 3 | The week on one page. | `omc-2027-family-wall-calendar-01.png` | /calendar |
| 4 | Mornings without the hunt. | `omc-morning-routine-generator-01.png` | /routine-chart |
| 5 | One spot by the door. | `omc-family-entryway-routine-01.png` | /resources/launch-pad-by-the-door |
| 6 | Free Chore Chart Generator for Kids | `omc-free-chore-chart-generator-01.png` | /chore-chart |
| 7 | A little job. A bigger ‘I can.’ | `omc-kids-responsibility-01.png` | /resources/chores-for-kids-by-age |
| 8 | What does “done” look like? | `omc-teaching-kids-chores-01.png` | /resources/chores-for-kids-by-age |
| 9 | One zone each day. | `omc-weekly-cleaning-zones-01.png` | /resources/zone-cleaning-schedule |
| 10 | 15 minutes. Then stop. | `omc-daily-cleaning-reset-01.png` | /resources/daily-cleaning-routine |

## Files

- `omc-*.png`: the approved pins, ready to publish.
- `originals/`: the files exactly as supplied, kept unchanged for audit.
- `production-manifest.csv`: original and new filenames, headline, topic, dimensions, SHA-256 hashes, repository path, public image URL and approval status.
- `pinterest-metadata.csv`: internal production metadata (title, description, alt text, board, destination, media URL, status). It follows the playbook's columns plus `pin_number` and `media_url`. **It is not a Pinterest import file.**
- `validation-report.json`: the conversion and metadata checks below.

## How the files were produced

Each image was decoded and saved as PNG with no resizing, cropping, recoloring or retouching. Reopening each PNG shows the same pixels as the decoded source, so nothing visible changed. The two WebP files keep their embedded color profile. The eight JPEGs had no profile, so they got a standard sRGB tag. That tag changes no pixels and matches how browsers already show untagged images.

**Dimensions exception:** pins 3 and 6 are 1000 × 1500. The other eight came in at 687 × 1024, which is close to 2:3 but not exact (0.671 vs 0.667). Hitting 1000 × 1500 would have meant stretching or trimming them, and the owner ruled out both, so they stay at their native size. Earlier 687 × 1024 owner pins on the site were scaled up and trimmed 3 px a side (see `docs/editorial/pinterest/HC-02.md`). That treatment was not applied here. Full-resolution exports from Gemini would solve this.

## Public image URLs

Every image is served from the immutable commit `c51545508bfee9a91ec3d22290780c8b2e0a7be9`:

`https://raw.githubusercontent.com/Mark-NYC/organized-mom-collective/c51545508bfee9a91ec3d22290780c8b2e0a7be9/design/pinterest/gemini-batch-01/approved-2026-10-19/{filename}`

On 2026-10-19, all 10 returned HTTP 200 `image/png`, byte-identical to the committed files.

## What was verified and what wasn't

- **Destinations:** each page exists in the site source. The on-image copy was checked against the article text (pin 1: HC-01 “skip it, don’t stack it”; 2: FP-04 summary; 3: calendar page hero; 4: FP-09 and `/routine-chart`; 5: FP-10; 6: `/chore-chart`; 7–8: IF-03 teaching steps; 9: HC-03 zone table; 10: HC-02 five tasks). **The live site was not verified.** This session's network policy blocked `www.organizedmomcollective.com`.
- **Boards:** names come from the board list in `PINTEREST_STRATEGY.md`. Whether they exist on the Pinterest account was not checked.
- **Keywords:** titles use the articles' existing primary keywords. No Pinterest search volumes or trends were researched or claimed.
- **Product artwork:** pin 3's calendar page matches the content of the site's `calendar-filled-in` photo, and pin 6's chart matches the generator's jobs. Neither was pixel-compared with the master artwork.
- **Pinterest import format:** Pinterest's help center couldn't be reached from this session, so the current bulk-upload template wasn't checked. No import-ready CSV was made. The last batch used `Title, Media URL, Pinterest board, Thumbnail, Description, Link, Publish date, Keywords` (`design/pinterest/IF-03/approved-2026-10-14/`). Before building one from this batch, confirm that template is current and settle the publish dates.

## Review notes for the owner

- Pins 2 and 3 share the same three-line checklist and the line “The plan belongs to everyone.” They point to different pages (FP-04 and /calendar). Space them apart when scheduling.
- Pins 7 and 8 reuse the IF-03 hooks “A little job. A bigger ‘I can.’” and “What does ‘done’ look like?” with new images. They go to the same article as the approved IF-03 curiosity v01 and save v02 pins.
- The three steps on pin 8 (carry dishes, wipe the table, put the cloth away) are illustrative. The article says to clear a place setting together and agree on what finished looks like. It doesn't list those exact steps.
