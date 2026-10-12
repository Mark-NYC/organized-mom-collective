# OMC lifestyle photo library: Claude handoff

## Status
**Visual selections are locked; commercial use is not yet cleared.** This branch contains the photo research, [machine-readable library](lifestyle-photo-library.json), license references and scripts for preview exports. No assets on this branch should be automatically inserted into customer-facing pages.

## Canonical source of truth
Read [lifestyle-photo-library.json](lifestyle-photo-library.json). Use `owner_visual_status`, `publishing_clearance`, and `public_path` as gates. Only images with `publishing_clearance: true` and non-null `public_path` may be used in production. Kaboompics photos carry the owner's standing approval (2026-10-12; see [PHOTO-DISCOVERY.md](PHOTO-DISCOVERY.md#standing-owner-approval-kaboompics-2026-10-12)): Claude may clear them after the recorded checks. The owner selected Kaboompics K01, K02, K03, K05, K06 as the visual standard and F03, F04, F05, F07, F08, F09, F10, F11, F12 as preferred face images. F01, F02 and F06 were rejected.

## Visual treatment
See [photo-color-standard.md](photo-color-standard.md). Default to approximately 85–90% faceless Kaboompics-style domestic details in general lifestyle placements; use 10–15% candid people photos only where emotional connection adds genuine value. Actual product shots should anchor conversion sections. Warm neutrals, natural light, muted saturation, modest contrast, natural skin tones. Do not use a heavy global preset or claim the photos feature actual OMC customers.

## How to generate the research-only photos
1. GitHub Actions → **Build OMC photo comparison sheets** → Run workflow on `photo-library-pilot-2026-10` (or use a script-change commit).
2. Download artifact `omc-photo-style-comparison`.
3. Inspect `kaboompics-style-reference.jpg`, `liked-faces-contact-sheet.jpg`, the `optimized-preview-only/*.webp` exports, `*.status.json`, and `photo-manifest.preview.json`. Missing Unsplash images show placeholders and have no WebP previews.
4. The exports are **not production assets**. A passing workflow confirms processing, not legal clearance.
5. Before publication, review each photo's source license classification, recognizable persons, trademarks, property, content placement, and intended usage. Update the manifest only upon documented clearance and commit approved WebP files under explicitly reviewed public paths in a separate PR.

## Rights checkpoints
- Kaboompics: [License & FAQ](https://kaboompics.com/page/license-and-faq). Standard photos allow website/commercial use and editing, but editorial-only photos do not; content including recognizable people, logos, and other property needs context review. Do **not** use Kaboompics files for AI training or generation.
- Pexels: [License](https://www.pexels.com/license/). Website, ads and modified use generally allowed; don't imply endorsement, sell raw photos or redistribute as stock.
- Unsplash: [License](https://unsplash.com/license). F10–F12 are preserved as liked candidates, with automated downloads returning HTTP 401.
- These are platform-level reviews, **not** per-photo legal opinions or release documentation.

## Site usage intent
Use home details as the primary image choice for planning, cleaning, groceries, meals and the majority of site sections. Use selected people images for family connection, morning rhythm, after-school homework, and stories. No hero claim or testimonial should suggest a photo depicts an OMC buyer. The initial physical offer is the calendar plus companion website, not a promised full future family app.

## Remaining tasks
- Successfully run the latest exporter and inspect actual WebP and manifest outputs.
- Decide whether to source replacement direct licensed downloads for Unsplash F10–F12 or keep them pending.
- Complete per-photo rights review and visually approve normalized exports.
- Merge to the working branch and promote only cleared assets in a separate explicit deployment PR.
