# Photo publishing clearance queue

Updated 2026-10-12. This document is a **review queue**, not a legal approval.

## Standard for website publication
For a particular image, confirm (1) the photo-page license type and allowed commercial usage, (2) any visible logos, protected artwork or branded packaging, (3) recognizable people, especially children, and use context, (4) no implication that the person is a customer/endorser, (5) the final crop and alt text, and (6) an actual optimized WebP exported from the checked original. Record reviewer, date, and intended placement. Until then leave `publishing_clearance: false`.

## Kaboompics: higher-priority house details

| ID | Photo-page commercial label | Outstanding manual check | Proposed use |
|---|---|---|---|
| K01 | Confirmed, page states free for personal and commercial use | Inspect cleaning-product branding/identifiable hands and approved crop | Cleaning and weekly reset |
| K02 | Confirmed, page states free for personal and commercial use | Inspect packaging and logos and approved crop | Cleaning and tidy |
| K03 | Unverified in current source-page check | Reopen source-page license, then inspect visible products/artwork | Planning and organization |
| K05 | Page states free to use under Kaboompics license | Inspect food packaging/trademarks and approved crop | Morning and pantry |
| K06 | Source page states free for commercial use | Inspect branded grocery packaging or artwork and approved crop | Meal planning / groceries |

All are still **publishing blocked**; source-license labels are not a substitute for rights review of the actual final image.

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
