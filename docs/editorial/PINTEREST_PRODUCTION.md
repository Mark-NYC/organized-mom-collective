# Pinterest production playbook

This records the methods actually used in the first editorial batch and its corrections. Requirements inherited from strategy are identified separately. Unverified techniques are not presented as working capabilities.

## Source of truth and scope

At each batch start, retrieve the latest [PINTEREST_STRATEGY.md](PINTEREST_STRATEGY.md), [BRAND_VOICE.md](BRAND_VOICE.md), [../brand/VISION.md](../brand/VISION.md), [../brand/PUBLIC-VISUAL-DESIGN.md](../brand/PUBLIC-VISUAL-DESIGN.md), this document, [PINTEREST_CREATIVE_DIRECTION.md](PINTEREST_CREATIVE_DIRECTION.md), [PINTEREST_QA_CHECKLIST.md](PINTEREST_QA_CHECKLIST.md), the finished article and its `pinterest/{ARTICLE_ID}.md` plan. Consult current `src/styles/global.css` and `src/theme.ts`; follow relevant linked product/output guidance.

GitHub remains authoritative. If it is unavailable, disclose that before proceeding. Do not treat a prior local copy as current.

Keep the strategy's three planned jobs: search, curiosity and save. Default production remains two designs per job, six total. These jobs are not layouts. Do not migrate the existing three-concept plan/checker contract without separate authorization.

The owner expressly authorized new supporting scenes, editorial experimentation and edits to generated backgrounds for this batch. This draft proposes recording that workflow; it does not imply that user-supplied photographs may be generatively edited. Product artwork is locked in every case.

## 1. Establish the inputs

Record the article ID, URL, exact source version, article sections, approved product PNGs and approved photography. Read the finished article, not only its brief or metadata.

Verify the live destination when accessible. In IF-03, public-page retrieval failed; article copy was verified from GitHub, SHA `19eb2d1577a3f3ffba08b79452b4fc5a94eafa32`. That was not live-site verification. Keep those statuses separate.

Retain each original product file unchanged. Record its dimensions and SHA-256. The supplied chart was 2048 × 1582 pixels; SHA-256:

`b5523340bce671cf9744e84a8d9c98644025ee061a64f4c7c7c60d4d9f2dd624`

A finished example supplied by the owner can show more jobs than the article's trimmed three-job example. Do not rewrite the supplied example to match the article or imply that it is the same trimmed chart.

Record platform research honestly. Native Pinterest autocomplete, guided search and Trends were not verified in this batch. No trend, volume or performance claims can be inferred from it.

## 2. Develop and approve six visual ideas from the article

For each idea, record its strategic job, one promise, exact supporting article section, proposed headline, focal point, photographic action or useful excerpt, and reason to save/click.

IF-03 provided a free editable generator, a specific three-job example, teaching/checking/stepping-back steps, and a missed-day fallback. Concepts were built from those actual ideas. Save-pin jobs and teaching steps were copied from the article.

Choose compositions after deciding those ideas. Retire the old requirement to map each strategic job to a prescribed A/B/C template. Retain the strategy's truthful copy and brand rules.

**Creative approval gate:** Present six distinct concepts with headline, visual premise, format and intended save/click job to the owner before full-resolution batch production. Get explicit approval or revise. Small exploratory mockups are allowed, but do not render all six polished finals before concept review. Review the concepts together. Six text changes on the same photo are not six visual concepts. Produce fewer qualified pins when the article cannot support the count. Do not fill the gap with invented advice.

## 3. Produce supporting photography separately

The built-in image-generation tool produced text-free fridge, entryway, dinner-cleanup and tabletop scenes. Typography and product insertion were added afterward with deterministic composition.

Prompt each distinct scene separately. Specify camera angle, action, materials, light, subject position, clear copy space and exclusions. Do not request a finished pin from the image model.

For people, require no visible faces. Use a full back view or a natural hands/torso crop. Inspect the image before composing: the early “head entirely out of frame” instruction produced a headless-looking child. The successful correction requested the whole back of the head and natural neck. The photo was then offset beneath the masthead so the panel did not amputate it.

For interactions, describe exactly what each person is doing. Replacing a floating adult gesture with an adult setting down a cup while the child carried a plate produced the reviewed dinner scene. Inspect the hands and held objects individually.

Original photography is optional. Save 01 worked as a typographic reference. Save 02's finished illustration was created deterministically, not generated photography.

## 4. Composite authentic product artwork

### Verified flat-insert method

The working renderer used Python/Pillow on a 1000 × 1500 canvas. Product artwork was inserted from the supplied PNG, converted to RGB for composition and resized once with Lanczos resampling.

For original dimensions `W × H` and selected display width `w`, use `h = round(w × H / W)`. Use that same ratio everywhere. Integer raster dimensions entail rounding; do not stretch width and height independently to fit a mismatched placeholder.

Insert the entire image. Do not crop internal content, retype labels, alter colors, simplify checks or rebuild the chart. A flattened pin is not byte-identical to the source, but its unobscured product region can be compared to the expected uniformly resized source.

In both search pins, Pillow pixel differences between the exported product crop and the expected resized original returned no differing pixels. This proves artwork identity after the documented resizing. It does not prove realistic lighting, shadows or attachment.

### Placeholder mismatch and paper edges

The initial tabletop placeholder had a different aspect ratio from the real chart. A small authentic chart on that larger white rectangle looked like a second sheet. Enlarging it without fixing the background covered the hand; later placement crowded the orange. None of those was acceptable physical compositing.

The successful sequence was:

1. Edit only the generated background to remove the empty paper and its shadow, requesting matching bare wood. Do not give the chart to the image model.
2. Load the original and edited scenes at the same canvas size.
3. Use a Pillow rectangular mask, feathered with Gaussian blur, to apply only the repaired paper-footprint region to the original photo. Keep surrounding hand, pencils, case and orange from the original scene.
4. Insert one complete authentic chart at its native ratio. Its outer edge now defines the physical sheet; there is no larger backing sheet.
5. Move the sheet clear of surrounding objects, then add shadows beneath it.

The final IF-03 desk product rectangle was `x=95, y=505, width=760, height=587`. These coordinates are an audit example, not default placement for future articles. The background-repair mask covered approximately `(90,535)` through `(911,1104)` with 2 px Gaussian feathering. This is region masking, not a verified object-segmentation workflow.

### Contact shadows actually used

Pillow RGBA shadow layers were drawn behind the sheet, blurred, alpha-composited onto the background, and then covered by the authentic chart.

The final desk correction used three layers, colored `(43,27,17)`, with the following pixel parameters:

| Layer | Offset x/y | Alpha, 0–255 | Gaussian blur radius |
| --- | --- | --- | --- |
| Soft ambient shadow | 3 / 5 | 35 | 9 |
| Directional shadow | 5 / 6 | 100 | 4 |
| Tight contact edge | 1 / 2 | 90 | 1 |

The down/right direction was judged against the scene's upper-left light. The tighter edge and stronger directional layer replaced an almost invisible single shadow. Use the layering method again; choose values visually for the actual light and surface. A standard large floating-card shadow is not a paper treatment.

Keep shadows and any graphic ground outside the product region. The product colors were not relit or tinted. Lighting integration of the product surface itself was not verified in this batch.

### Perspective, occlusion and magnets: limits of the evidence

- Verified product scenes were approximately front-on or overhead, with rectangular flat inserts. No homography, perspective warp, mesh deformation or paper curl was used. Choose a compatible scene for this proven workflow. Do not claim oblique compositing is already solved.
- The desk correction avoided fruit and hand overlap by repositioning the sheet. Object cutout masks placing a hand or fruit over the chart were not used or verified.
- The fridge magnet was generated above the blank paper. After compositing, it still did not visibly overlap the chart. No successful magnet isolation, foreground-layer placement or associated shadow correction appears in the record.

For future fridge imagery, visibly holding the paper is a required quality condition, not a verified technique from this batch. If that relationship cannot be demonstrated, reject the attachment detail or choose a scene without it. Never report “magnet fixed” based on the prompt alone.

## 5. Set final typography precisely

All final copy was rendered with Pillow text layers. Montserrat Variable weights were set deterministically; URW P052 Roman/Italic supplied the batch's serif substitute. Do not claim Georgia was used or licensed here. Follow the strategy's font policy for future batches and record any owner-approved substitution.

The last tabletop refinements used `font.getbbox(text)` to compensate for different glyph bearings. For a desired visible-ink origin `(x,y)` and bounding box `(left,top,right,bottom)`, draw at `(x-left, y-top)`. This made the visible left edges of serif headlines, sans-serif support and branding share `x=80`.

Record actual visible bounds, not just nominal text coordinates. Inspect line endings, descenders and the space between the bottom of one block and the top of the next. In the last tabletop pin, visible text tops were 72, 166, 286 and 366; the brand top was 1241. Those values are specific to that copy and those fonts.

Reduce panels when copy does not need their space. The entryway footer was removed entirely. The dinner caption panel shrank from 563 to 410 pixels. The desk's competing dark promotional label became a discreet light brand ground with deliberate padding.

## 6. Finish illustration and supporting graphics

The initial plate/cutlery sketch was visibly unfinished. It was replaced with a complete plate-and-cup SVG drawn as independent artwork, rendered with PyMuPDF, supersampled and downsampled before Pillow compositing. The final typography stayed outside the illustration renderer.

The attempt to render with CairoSVG failed because the dependency was unavailable. ImageMagick SVG attempts also failed. Do not describe those paths as verified renderers. PyMuPDF was the successful route in this session.

## 7. Export and inspect

Verified exports used PNG at exactly 1000 × 1500, RGB, with an embedded sRGB ICC profile. Check those properties by reopening each final file. Preserve an untouched original and versioned intermediate/final files.

Review each pin at full resolution and approximately 250 px width. Review the batch together for repetition and hierarchy. Contact sheets were assembled deterministically from exported PNGs, with labels outside each image. A contact sheet cannot replace full-resolution review.

Use [PINTEREST_QA_CHECKLIST.md](PINTEREST_QA_CHECKLIST.md). Serious visual flaws block delivery even when artwork identity and dimensions pass.

Retain the strategy's 80 px safe margins, 160 px lower reserve and contrast requirements. The first batch did not programmatically validate every margin or sampled photograph contrast. Some copy positions depart from those numerical defaults; do not describe all checks as passed. Keep approval of a creative concept separate from compliance with every production requirement.

## 8. Package the actual final versions

Existing naming: `{ARTICLE_ID}-{search|curiosity|save}-v{01|02}-1000x1500.png`.

Default deliverables remain PNGs, a contact sheet, a **production metadata CSV**, a batch manifest and a ZIP. **Pinterest bulk-upload CSV is a separate, optional export**: verify Pinterest's current import template and required column names at time of use, host each approved image at a stable public direct-image URL, verify board and destination URLs, and supply supported scheduling fields. Never rename the internal production CSV or claim it can be imported as-is. Do not invent media URLs or supported schedule fields. A request for only one corrected pin should return only that pin; it must not silently imply that an older contact sheet or archive has been refreshed.

The first batch produced CSV, JSON, ZIP and a code recipe. ZIP integrity was checked. Later desk corrections were delivered separately; the earlier six-pin contact sheet and archive do not contain the newest desk image. On the next complete batch delivery, assemble everything from an explicit final-file list rather than a broad directory scan.

Preserve the existing CSV columns: `article_id,variant,filename,headline,title,description,alt_text,board,destination_url,article_section,status`. Keep titles, descriptions and alt text unique and truthful. The first renderer reused one description across all six rows; that is a shortfall, not a successful metadata practice to copy. Use strategy length limits and approved boards.

The manifest should retain original hashes, source versions, prompts, actual fonts, transformations, product rectangles, output files, mechanical checks, visual review notes and unresolved exceptions. A Python recipe is a reproducible composition instruction, not a layered PSD or a standalone package if its scene/font dependencies are missing.

Never commit, publish or create permanent templates without the owner's explicit authorization. Publishing cadence and measurement remain governed by Pinterest strategy.

## What can be automated

| Operation | Evidence and boundary |
| --- | --- |
| Source hash and dimensions | Used and verified. |
| Uniform product resizing and pixel comparison | Used and verified for unobscured flat inserts. |
| Layer placement, rectangular masks, blur and alpha compositing | Used; physical plausibility still needs visual inspection. |
| Typography bounds and optical left-edge placement | Used in the final desk correction. Does not choose good hierarchy for you. |
| Vector rendering, PNG properties and contact-sheet assembly | Used. |
| CSV/manifest/ZIP generation | Used; freshness, metadata quality and completeness still need review. |
| Perspective warping, object segmentation, magnet compositing | Not verified. Do not advertise as completed automation. |
| Story, image realism, hands, shadow plausibility and save/click appeal | Requires visual judgment. No automated approval or performance model was verified. |

## Reviewed baseline and known exceptions

The six concepts reviewed were IF-03 search v01, the latest grounded desk search v02, corrected curiosity v01/v02 and save v01/v02. The master chart hash above and the latest desk rectangle distinguish that desk version from earlier same-name exports.

Preserve their editorial direction. Do not carry forward the disconnected fridge magnet, weak generator identification, unverified live destination status, shared metadata description, or assumptions that every strategy metric passed. Numerical self-assessments were subjective. No published Pinterest performance was measured.