# PHOTO-DISCOVERY.md
## Organized Mom Collective | Article & Resource Photography Workflow

**Purpose:** Give Claude a repeatable image workflow whenever it creates or edits articles, printable resources, guides, lead magnets, and editorial landing pages. **Do not wait for a large prebuilt library.** Discover only the photos a piece actually needs, then grow the approved library as a byproduct.

### Default visual direction
- **85–90% faceless, Kaboompics-style domestic lifestyle images** for editorial lifestyle placements. Faces only when they add emotional storytelling value; never force the ratio on a single page.
- Warm-neutral daylight, soft contrast, subtle saturation, ordinary lived-in American home settings, approachable rather than perfectly staged. Real objects and routines: calendars, grocery lists, pantry, school supplies, cleaning baskets, meal prep, cozy kitchen counters.
- Kaboompics is the first external source: https://kaboompics.com/
- Actual Organized Mom Collective wall-calendar photos always take precedence over generic stock in product-selling sections.
- Avoid obviously AI-generated imagery, dated planners, glossy stock posing, visible third-party logos/artwork, overly immaculate interiors, or faces presented as real customers.

### Mandatory workflow for every new article/resource

**1. Plan the article's images.**
Read the article and identify the actual visual jobs: hero (normally one), optional inline image(s) only when they help understanding, and social/Pinterest crops if needed. For each, define a scene, subject, mood, aspect ratio and alt-text purpose. Avoid unnecessary decorative stock. An article can use no extra image if the content doesn't benefit.

**2. Search the approved local library first.**
Read:
- `docs/brand/lifestyle-photo-library.json`: canonical photo entries, source links and publishing gates.
- `docs/brand/photography-guidelines.md` and `docs/brand/photo-color-standard.md` for style.
- `docs/brand/PHOTO-PUBLISHING-CLEARANCE.md` for rights-review status.

Only treat an image as deployable when its entry has **`publishing_clearance: true` and a non-null verified `public_path`** and its intended placement is covered by the recorded usage clearance. The manifest currently contains primarily research candidates, not deployable site images. Visual likes or platform-level licensing never suffice.

**3. If no cleared library image fits, discover new photos.**
- Search Kaboompics using the article's concrete scene terms, not vague aesthetics (e.g. `weekly planner coffee kitchen counter`, `laundry baskets living room`, `pantry jars breakfast`, `woman writing grocery list hands only`). Favor several images from one Kaboompics shoot where useful.
- Use actual search/browsing capability available to Claude. Do **not** fabricate links or assume that GitHub Actions itself can search Kaboompics. If browsing is unavailable, use source links already cataloged and flag gaps for review.
- As a second choice for people/faces, search Pexels or other sources under compatible licenses. Previously liked family images are style references, not automatically cleared.
- Capture the **direct photo detail page**, photographer credit, source and subject description. Verify the page resolves to the described photo. Do not use search thumbnails or guessed CDN URLs as proof of permission.
- Curate 2–3 plausible choices for each image slot, then pick the strongest visual match instead of flooding the article.

**4. Apply image-specific rights and context checks before publication.**
- Open and review the photo's actual source page, date of check, applicable Standard/Editorial license and any restrictions. For Kaboompics see https://kaboompics.com/page/license-and-faq; for Pexels see https://www.pexels.com/license/; for Unsplash see https://unsplash.com/license.
- Inspect the **actual image at useful resolution** for recognizable people/children, trademarks, printed artwork, property and third-party rights. A commercial stock license is not automatic permission for every use or implied endorsement.
- Do not imply pictured people are OMC customers, testimonials or that a real family uses this calendar. Avoid use on sensitive/negative claims that could suggest something about a depicted person.
- Do not use Kaboompics images for AI model training or image generation. Ordinary image resize/crop/compression is fine when source license permits.
- If rights or intended context remain uncertain, **do not place the image in a published page**. Use an already-cleared photo or continue with text until reviewed. Never quietly set `publishing_clearance` to true.

**5. Download and optimize a cleared image.**
- Download from a lawful source using its provided download options, not a bypass of 401/paywalls/access controls. Record original source URL, download date and source license evidence.
- Retain the original privately for audit. Make sRGB WebP responsive variants (initial targets: width 800 and 1440 pixels **without upscaling**), crop for hero/inline/Pinterest separately as needed. Compress without obvious artifacts.
- Use stable descriptive names, e.g. `weekly-reset-laundry-basket-800.webp`, instead of random photo IDs.
- Give meaningful alt text that describes the photo, not SEO-stuffed keyword strings.
- Store only final **cleared** web assets under `public/images/lifestyle/`; keep research downloads, contact sheets and uncleared previews out of the public site tree.

**6. Record and reuse.**
For every discovered image, record or update its entry in `docs/brand/lifestyle-photo-library.json` (or an unapproved research-batch file), including:
- Stable unique ID, human-friendly description, content tags, source/creator/source detail URL, source license URL and verification date.
- Owner visual status; rights/context review; allowed placement(s); `publishing_clearance` boolean; `public_path` (null until truly cleared).
- Finished filename(s), dimensions and alt-text example for cleared assets.
- Article/resource pages using the photo, so repeated images can be monitored.

Before reuse, check that the license and intended context still fit. One approved photo can be reused across multiple pages without repeated discovery work.

**7. Publish and quality-check.**
Confirm correct aspect ratio, mobile layout, lazy loading below the fold, no broken links, relevant image, no repeated hero photo across adjacent articles, and plausible color coherence with nearby images. If a new image is uncleared, block publication of the image, not creation of the article. No unapproved image should be silently deployed.

### Claude operating rules
- **When asked to make an article or resource:** proactively perform steps 1–3. Use steps 4–7 only with the necessary source access and clearance evidence. Tell the user when an asset is still pending approval.
- **When asked to create a draft only:** produce recommended photo URLs and captions, but never claim images were downloaded, approved or installed.
- **When asked to implement on the site:** prefer cleared existing assets. If new external photos are needed, document the selection and rights review; do not deploy uncleared photography.
- **When batch-reviewing photos:** generate internal-only thumbnails/contact sheets. The existing GitHub Actions workflow `.github/workflows/lifestyle-photo-review.yml` is a known-URL downloader, **not a discovery engine**.
- Don't generate artificial images as a substitute for genuinely sourced lifestyle photos unless the user specifically requests generated imagery.
- Keep product photography distinct from editorial stock. First print-run offer is physical calendar plus companion website; don't suggest the future full family system is included.

### Fast execution checklist
- [ ] Do we actually need a photo for this section?
- [ ] Existing **cleared** image fits?
- [ ] If not, searched Kaboompics by real scene keywords?
- [ ] Selected verified source photo page and creator?
- [ ] Reviewed exact license, subject, branding/artwork and placement?
- [ ] Downloaded legitimately, resized/cropped and checked output?
- [ ] Added source metadata and reuse tracking?
- [ ] Deployed **only** if clearance is recorded?

**Desired outcome:** Every article or resource can be created immediately, and each newly approved photograph makes the next article easier. The library grows through actual production rather than a separate collecting project.
