# Photo publishing clearance queue

Updated 2026-10-12. This document is a **review queue**, not a legal approval.

## Standard for website publication
For a particular image, confirm (1) the photo-page license type and allowed commercial usage, (2) any visible logos, protected artwork or branded packaging, (3) recognizable people, especially children, and use context, (4) no implication that the person is a customer/endorser, (5) the final crop and alt text, and (6) an actual optimized WebP exported from the checked original. Record reviewer, date, and intended placement. Until then leave `publishing_clearance: false`.

## Kaboompics: higher-priority house details

| ID | Photo-page commercial label | Outstanding manual check | Proposed use |
|---|---|---|---|
| K01 | Confirmed, page states free for personal and commercial use | Inspect cleaning-product branding/identifiable hands and approved crop | Cleaning and weekly reset |
| K02 | Confirmed, page states free for personal and commercial use | Inspect packaging and logos and approved crop | Cleaning and tidy |
| K03 | Confirmed via indexed source-page license text on 2026-10-12 | Inspect visible laptop branding, floral artwork and crop | Planning and organization |
| K05 | Page states free to use under Kaboompics license | Inspect food packaging/trademarks and approved crop | Morning and pantry |
| K06 | Source page states free for commercial use | Inspect branded grocery packaging or artwork and approved crop | Meal planning / groceries |

**All five Kaboompics source pages display a commercial-use license label** as of October 12, 2026. All remain **publishing blocked** until their actual final images are checked for branding, art, recognizable subjects and context. Source-license labels are not a substitute for final image review.

## Actual-image visual inspection (October 12, 2026)

Reviewed the real 5-image Kaboompics contact sheet downloaded from GitHub Actions artifact `11770035828`. This is a thumbnail-level review, **not full-resolution inspection**.

| ID | Visual decision | What was actually visible | Next blocker |
|---|---|---|---|
| K01 | Provisionally suitable | Cleaning basket and cropped adult arms; no obvious logo or identifiable face in thumbnail | Inspect full-size supplies, final crop |
| K02 | Provisionally suitable | Home-care items and hands on sofa; no obvious logo in thumbnail | Inspect full-size packaging, final crop |
| K03 | **Hold** | Decorative floral notebook (possibly protected artwork) and laptop | Verify notebook artwork/brand permissions or use another shot |
| K05 | Provisionally suitable | Pantry containers and cropped hand; no obvious brand in thumbnail | Inspect jar/box labels at 100%, final crop |
| K06 | **First priority for final clearance** | Bread in reusable mesh bag, no visible people or brand in thumbnail | Full-resolution inspection and final WebP |

All five still have `publishing_clearance: false`. **No model releases have been confirmed**, but for shots without identifiable people, model releases may not be relevant. Never claim a specific person endorses OMC.

[Contact-sheet artifact](https://github.com/Mark-NYC/organized-mom-collective/actions/runs/38298329340/artifacts/11770035828)

## Pexels: liked face photographs

F03, F04, F05, F07, F08, and F09 have been fetched into *review artifacts*. They may be used for website storytelling only after checking exact per-photo source page and actual visual contents for recognizable people, brand identity or trademark issues, unsuitable usage context and nonendorsement. Avoid presenting them as purchasers or testimonials.

## Unsplash: liked but blocked previews

F10, F11 and F12 remain in the liked collection but their download automation previously returned HTTP 401. Do not bypass access restrictions. Revisit legitimate site download options or replace with similarly styled, explicitly downloadable images when necessary.

## Production gate

Only after an individual image passes every checkpoint:
1. Set `license_review` to verified and record page evidence.
2. Record context/release review and approved placements.
3. Generate the final WebP from a lawfully obtained original.
4. Review the edited image and its crop; commit to public assets through a separate reviewed PR.
5. Set `publishing_clearance: true` and the exact public path in the catalog **in the same reviewed PR**, after validation.

Never mass-enable all photos because the license page allows general commercial usage. Kaboompics disallows using the photos for AI training or image generation; the existing Pillow-only resizing workflow is ordinary image processing.

## References

- https://kaboompics.com/page/license-and-faq
- https://www.pexels.com/license/
- https://unsplash.com/license
