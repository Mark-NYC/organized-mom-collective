# Image-first Pinterest production lane

**Separate from** the existing 500-pin `OMC-P0001–OMC-P0500` campaign. Gallery IDs: `OMC-VG001` onward. Pin IDs: `OMC-V00001` onward. IDs are permanent. Never copy rows from this lane into the 500-pin master or count them twice.

## Operating standard

1. Verify the topic is visually searchable on Pinterest, recording observed autocomplete, competitor examples, seasonal signals and sources. Do not invent traffic data.
2. Produce a gallery brief and 15 visually distinct, no-overlay editorial images. Check AI artifacts, spelling, branding, physical plausibility, and scene diversity. The photos are visual inspiration, not a representation of purchasable exact products.
3. Put original photos in `public/images/inspiration/<slug>/`, one unique source image per article, with descriptive filenames.
4. Add a gallery record to `src/data/inspiration-galleries.ts` and a thin Astro route using `InspirationGallery.astro`. Keep **one short photo title** per image; underneath it, **two distinct practical ideas** with consecutive numbered sage circles. The 15-photo menu links to stable `#idea-N` fragments. There are 30 advice ideas, not 30 photos.
5. The image-specific Pinterest Save control must reference the public image and matching article anchor, with no generic top-of-page destination. Check image alt text, natural scene-specific captions, relevant free tool link, OG metadata, and responsive mobile layout.
6. Create a reviewed JSON manifest and generate the Pinterest upload CSV using `node scripts/generate-inspiration-pinterest-csv.mjs <manifest.json> <output.csv>`. Do not manually rearrange media URLs, image IDs or link anchors. Output headers follow Pinterest's official bulk create format.
7. Set board to a **verified, existing board name** (currently proposed: `Family Organization Ideas`). Pinterest may create a new board if the name doesn't match, so confirm the account board before import.
8. **Publish date blank means immediate publication on import.** Fill dates before upload if scheduling; don't assume a blank means draft. Pinterest supports ISO dates/timestamps.
9. Run `npm run verify`, image URL HTTP checks, mobile widths 320/375/390/768, keyboard navigation, Pinterest save on iOS/Android, and CSV validator. If these aren't checked, state they remain unverified. No publishing claims without Pinterest confirmation.
10. Import in Pinterest Business → Settings → Import content. Record result, actual Pin IDs, dates, errors, and analytics in the visual-lane tracker. Track saves, outbound clicks and engagement per creative, and don't interpret an onsite Save click as confirmed Pinterest save.

## Mudroom batch

- Gallery ID: `OMC-VG001`
- Source: `src/data/inspiration-galleries.ts`
- Manifest: `design/pinterest/inspiration/small-mudroom-ideas/manifest.json`
- Pinterest upload file: `design/pinterest/inspiration/small-mudroom-ideas/pinterest-bulk-upload.csv`
- Internal tracker: `docs/editorial/pinterest/inspiration/INSPIRATION_PIN_TRACKER.csv`
- 15 unique Pin titles, 15 image URLs, 15 section-deep links, one board, no dates filled.

**Current status:** CSV prepared, not submitted to Pinterest. Verify that public image URLs return actual JPEGs and the article is deployed before importing. Content and images should be reviewed together to avoid misleading captions.

## Official spec

Pinterest Business Help: https://help.pinterest.com/en/business/article/bulk-upload-video-pins

The required columns are Title (up to 100 characters), Media URL (public image file) and Pinterest board. Other supported columns: Thumbnail (blank for images), Description (up to 500), Link, Publish date and Keywords. Up to 200 assets per CSV, subject to account restrictions.
