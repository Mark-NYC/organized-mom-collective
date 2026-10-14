# Pinterest QA checklist

**Proposed for review. October 14, 2026. Not committed to GitHub.**

Use current [PINTEREST_STRATEGY.md](PINTEREST_STRATEGY.md), [BRAND_VOICE.md](BRAND_VOICE.md), [PINTEREST_CREATIVE_DIRECTION.md](PINTEREST_CREATIVE_DIRECTION.md) and [PINTEREST_PRODUCTION.md](PINTEREST_PRODUCTION.md). Check the final exported files, not just the renderer preview.

## Creative quality: visual judgment

- [ ] One clear focal point and one truthful promise.
- [ ] The headline gives a specific reason to save or click; the destination delivers it.
- [ ] The actual offer is clear. For a generator, the viewer understands this is a tool for making a chart, not merely a fixed printable.
- [ ] Shared family responsibility is demonstrated without implying mom must manage everything forever.
- [ ] The pin feels warm, useful and art-directed; it does not resemble a slide or bulk template.
- [ ] The batch varies its visual ideas, subjects, scale and reading rhythm. Text/color swaps alone do not count.
- [ ] Empty space serves hierarchy. Panels, illustrations and branding earn their space.

## Product accuracy: mechanical check plus inspection

- [ ] Correct original PNG selected; original hash recorded and source untouched.
- [ ] Entire artwork preserved: text, colors, spacing, checkboxes and proportions.
- [ ] Uniform resizing only for the verified flat-insert workflow; no independent stretching to fit a placeholder.
- [ ] Unobscured product crop matches the expected resized source pixel for pixel.
- [ ] Product is recognizable at feed size; internal detail remains clear at full resolution.
- [ ] One believable sheet. No unintended backing rectangle, doubled border or extended paper edge.

## Photographic realism and physical integration: visual judgment

- [ ] No visible generated faces, including profiles, reflections or small fragments.
- [ ] Back-view heads are complete; other crops look intentional rather than anatomically missing.
- [ ] Hands, grip, body positions and adult-child actions make physical sense.
- [ ] Paper sits on the actual surface and stays clear of hands, fruit and other objects unless believable occlusion has been explicitly verified.
- [ ] Contact shadow anchors the edge; direction and softness agree with the scene light. The sheet does not float.
- [ ] Paper edges match the camera angle. An oblique scene has not been disguised with an unexplained flat rectangle.
- [ ] A visible magnet overlaps and visibly holds the sheet. Above, behind or disconnected does not pass.
- [ ] No patch seams, lost fingers, warped props, strange reflections or background text artifacts.
- [ ] Generated scenes are illustrative, not presented as customer testimonials.

## Typography and layout: bounds plus visual judgment

- [ ] Spelling, punctuation, copy and article excerpts are correct.
- [ ] Licensed/available fonts and actual substitutions recorded; no claim of a font that was not used.
- [ ] Intended left edges align by visible ink bounds, including serif/sans transitions.
- [ ] Line breaks, descenders, block gaps and panel padding feel deliberate.
- [ ] Headline dominates; support and brand do not compete with it or the product.
- [ ] No crowding, clipping, tiny mandatory copy or excessive caption/footer space.
- [ ] Strategy margins and lower UI reserve checked from actual text bounds; exceptions identified rather than concealed.
- [ ] Strategy contrast targets met: at least 4.5:1, aiming for 7:1 on headlines. Photo-backed copy reviewed over its actual background.
- [ ] Headline and offer remain readable at approximately 250 px width.
- [ ] Illustration looks finished and supports the advice.

## Export and delivery: mechanical check

- [ ] Each PNG opens, is exactly 1000 × 1500, RGB, and carries an sRGB profile.
- [ ] Source and final versions are distinguishable; final output does not overwrite the original product.
- [ ] Every pin inspected at full resolution and feed size; batch viewed together.
- [ ] Contact sheet, manifest, CSV and ZIP use the same final-file list. Single-pin revisions do not imply old packages were updated.
- [ ] CSV contains unique, truthful metadata within strategy limits and the correct destination/board.
- [ ] ZIP opens and contains the approved files; no discarded versions accidentally included.
- [ ] Live-destination verification and native-platform research are stated honestly.
- [ ] No GitHub change or publication without explicit approval.

## Automatic rejection criteria

Any one of these blocks production-ready delivery until fixed. Visual detection still requires a reviewer; “automatic” means mandatory rejection, not a claim that software can detect every case.

1. Generated/rebuilt product artwork, altered wording or distorted proportions.
2. A visible generated face, impossible anatomy, headless-looking crop or broken grip.
3. Paper crossing through an object, unexplained backing sheet, floating placement or disconnected magnet.
4. Unreadable headline/offer, misspelling, clipped text, unresolved collision or serious alignment error.
5. Invented feature, unsupported claim, misleading testimonial or missing core offer in a search-led tool pin.
6. Repetitive template substitutions presented as distinct creative ideas.
7. Broken file, wrong dimensions/profile, stale contact sheet/archive, or a failed check described as passed.

## Sign-off record

Record each item as **pass**, **fail**, **not applicable** or **not verified**, with the exact final filename/version. Separate mechanical results, visual judgment and owner approval. An original-source hash does not certify shadows; a zero pixel difference does not certify realism; owner creative approval does not prove measured Pinterest performance.