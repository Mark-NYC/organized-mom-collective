# Gemini batch 02: approved pins (2026-10-19)

Ten owner-approved Pinterest pins (numbered 11–20, continuing batch 01) made with Gemini. The owner approved them as final designs. Nothing here has been imported, scheduled or published on Pinterest.

| # | Headline | File | Destination | Board |
| --- | --- | --- | --- | --- |
| 11 | Stop Deciding Dinner at 5 PM. | `omc-stop-deciding-dinner-01.png` | /resources/weekly-meal-planning-for-families | Meal Planning for Families |
| 12 | Your Grocery List Starts Here | `omc-grocery-list-system-01.png` | /resources/grocery-list-from-meal-plan | Meal Planning for Families |
| 13 | A Command Center That Actually Works | `omc-family-command-center-01.png` | /resources/home-command-center | Family Organization Ideas |
| 14 | Put the Week Where Everyone Can See It | `omc-shared-family-calendar-01.png` | /resources/how-to-organize-a-family-calendar | Family Organization Ideas |
| 15 | One Deep-Cleaning Project a Month | `omc-monthly-deep-cleaning-01.png` | /resources/monthly-deep-cleaning-schedule | Cleaning Schedules for Busy Moms |
| 16 | Sharing the Mental Load Starts Here | `omc-sharing-mental-load-01.png` | /resources/how-to-share-the-mental-load | Mom Life & Mental Load |
| 17 | Where Does Your Time Go? | `omc-family-time-audit-01.png` | /resources/where-does-my-time-go | Mom Life & Mental Load |
| 18 | The Paper Pile Needs Two Places | `omc-family-paper-organization-01.png` | /resources/home-command-center | Family Organization Ideas |
| 19 | Plan Around Your Busy Nights | `omc-busy-night-meal-planning-01.png` | /resources/weekly-meal-planning-for-families | Meal Planning for Families |
| 20 | What Matters This Week? | `omc-what-matters-this-week-01.png` | /resources/intentional-family-life | Weekly Reset Routines |

## Files

- `omc-*.png`: the approved pins.
- `originals/`: the files exactly as supplied, unchanged. Names are the chat-attachment order (`1.jpg`–`11.jpg`). `4.jpg` was a byte-identical second copy of `3.jpg` (pin 13, SHA-256 `551e44d9…5941`) and isn't stored.
- `production-manifest.csv`: original and new filenames, headline, topic, dimensions, SHA-256 hashes, repository path, public image URL and approval status.
- `pinterest-metadata.csv`: internal production metadata (title, description, alt text, board, destination, article section, media URL, keywords, status). **It is not a Pinterest import file.**
- `pinterest-import-ready.csv`: the Pinterest Import Content file, built from the same source data.
- `import-validation.json`: conversion results for every image plus the mechanical checks on the import file.

Headlines were matched from the visible text on each image, not from filenames or upload order.

## Pinterest Import Content CSV

`Title,Media URL,Pinterest board,Thumbnail,Description,Link,Publish date,Keywords`

| Column | What's in this batch |
| --- | --- |
| Title | Unique, 45–73 characters (limit 100). Leads with the article's search phrase. |
| Media URL | Immutable GitHub links at commit `2d55e35`. All 10 returned HTTP 200 `image/png`, byte-identical to the committed files. |
| Pinterest board | Exact names from `docs/editorial/PINTEREST_BOARDS.md` (branch `docs/pinterest-actual-boards-2026-10-19`, not yet merged). |
| Thumbnail | Blank. That column is only for video pins. |
| Description | Unique, 245–281 characters (limit 500). Opens with the search phrase. No hashtags. |
| Link | Canonical `https://www.organizedmomcollective.com/resources/…` paths with no trailing slash and no tracking parameters. |
| Publish date | Blank for all 10. The owner sets the schedule. |
| Keywords | 4 phrases per pin, taken from the article's primary keyword and the pin copy. **Not checked against Pinterest autocomplete or Trends.** No search volume is claimed. |

The file is UTF-8 with no BOM and CRLF line endings. Fields containing commas or quotes are double-quoted per RFC 4180. It has 10 rows and was re-read with a CSV parser to confirm it parses back to the same values.

**Format check:** this session couldn't reach Pinterest's help center (`help.pinterest.com` didn't resolve). The columns follow the template the owner confirmed for batch 01 on 2026-10-19. One third-party community post lists the same order without `Thumbnail`. That's unconfirmed, but if Pinterest rejects the file, check that column first.

## How the files were produced

Each image was decoded and saved as PNG with no resizing, cropping, recoloring or retouching. Reopening each PNG gives the same pixels as the decoded source. The sources were untagged JPEGs, so each PNG got the same standard sRGB profile as batch 01. That tag changes no pixels.

**Dimensions exception:** all 10 are 687 × 1024, the size the chat attachments arrived at. That's close to 2:3 but not exact (0.671 vs 0.667). As in batch 01, they keep their native size rather than being stretched or trimmed. Full-resolution exports from Gemini would solve this.

**Duplicate check:** none of the 10 PNGs matches any image file tracked in the repository (588 scanned) by SHA-256. A perceptual difference hash found no near-duplicates either. The closest match was 92 of 256 bits apart, where a near-duplicate would be under about 10. All 10 also differ from each other.

## What was verified and what wasn't

- **Destinations:** all 8 pages exist as published article sources in `src/content/articles/`. Pin copy was checked against the article text: 11 is the FP-05 hook and short answer; 12 is the FP-06 steps; 13 is the FP-03 setup; 14 is the FP-02 "can anyone read tomorrow" test; 15 is the HC-04 "one bounded job"; 16 is IF-02 "include the noticing"; 17 is the FP-08 "things you do twice"; 18 is the FP-03 two pockets; 19 is the FP-05 "Three kinds of night"; 20 is IF-01 "One thing that matters this week". **The live site was not verified.** This session's network policy blocked `www.organizedmomcollective.com`.
- **Boards:** all 10 match the registry exactly. No new boards.
- **Product claims:** no description mentions the wall calendar or the cleaning companion, so no product feature is claimed. The calendars in pins 13 and 14 are generic Gemini props, not the OMC calendar, and the metadata doesn't present them as the product.

## Review notes for the owner

1. **Pin 13 version:** the packaged file is the copy supplied first (`3.jpg`), where "Works" runs into the top of the calendar. A revised pin 13 was shown in chat afterwards, but it didn't arrive as a file. Before importing, confirm which version is final. If it's the revision, it must replace this PNG and the media URL commit must be updated.
2. **Pin 14 face check:** the boy's head is turned away, but part of his cheek and ear show in profile. The QA checklist bans visible generated faces "including profiles". The owner approved the pin, so it's flagged here rather than changed.
3. **Pin 18 labels:** the pockets read "Incoming" and "Outgoing". The article calls them "Needs attention" and "Ready to go". It's the same system, and the description bridges the two.
4. **Pin 19 categories:** the image labels the third night "Zero-effort" and shows sandwiches as a short night. The article says "Zero night" and lists sandwiches as a zero-night option. It's a small mismatch, and the description follows the article.
5. **Gemini prop text:** some background text is garbled or invented: can labels in pin 12, the school form and receipt in pin 17, and a picture-book title in pin 20. None of it is presented as real information. It wasn't edited.
6. **Repeated topics:** pins 11 and 19 both go to FP-05, and pins 13 and 18 both go to FP-03. Space them apart when scheduling. Pin 18 shares an idea with the earlier "Give Every Paper an Exit" concept (inventory) but uses a new hook and image.

## Remaining launch checks

1. Resolve pin 13 (note 1).
2. Open the 8 destination URLs on the live site and confirm each returns 200 and shows what its pin promises.
3. Confirm the exact spelling of *Meal Planning for Families*, *Family Organization Ideas* and *Cleaning Schedules for Busy Moms* in the live account. The registry notes the profile cards truncate them.
4. Set publish dates if you're scheduling rather than publishing on import.
5. After importing, update `docs/editorial/PINTEREST_PIN_INVENTORY.md` only from real Pinterest evidence (the pin URL and date).
