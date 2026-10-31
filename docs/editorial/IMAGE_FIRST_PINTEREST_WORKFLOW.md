# Image-first Pinterest production lane

**Premium long-gallery campaign:** When selected by [PINTEREST_DAILY_PRODUCTION_DESK.md](PINTEREST_DAILY_PRODUCTION_DESK.md), use the established 39 original gallery photographs + 10 additional promotional Pin images model (49 distinct Gemini prompts). This is a separate campaign variation from the legacy 15-photo workflow described below, not an amendment to past gallery records. The assistant chooses galleries based on inventory, season, demand and site readiness, usually assessing the need every 2–3 weeks. All prompts include the full brand hex palette and Georgia/Montserrat design direction, though the 39 gallery photos themselves have no text overlays. Keep OMC-V IDs distinct from the 500-pin master.

**Separate from** the existing 500-pin `OMC-P0001–OMC-P0500` campaign. Gallery IDs: `OMC-VG001` onward. Pin IDs: `OMC-V00001` onward. IDs are permanent. Never copy rows from this lane into the 500-pin master or count them twice.

## Operating standard

1. Verify the topic is visually searchable on Pinterest, recording observed autocomplete, competitor examples, seasonal signals and sources. Do not invent traffic data.
2. Produce a gallery brief and 15 visually distinct, no-overlay editorial images. Check AI artifacts, spelling, branding, physical plausibility, and scene diversity. The photos are visual inspiration, not a representation of purchasable exact products.
3. Put original photos in `public/images/inspiration/<slug>/`, one unique source image per article, with descriptive filenames.
4. Add a typed gallery record (in `src/data/inspiration-galleries.ts` or its own `src/data/*-gallery.ts`) and a thin Astro route using the shared `InspirationGallery.astro`. Keep short photo titles and useful, distinct advice. **Every gallery must include ordered `sections` with `start` (zero-based image index), `title`, `intro`, a compact `label`, and an `icon` key.** Start with index 0; add meaningful sections without padding. The shared component automatically builds an icon-card category navigation near the top, with anchor links to the first image in each section. Keep all `#idea-N` image anchors stable. Longer galleries may also keep the existing per-photo jump menu.
5. Before publishing, test the icon cards on mobile and desktop and verify that all category links land on the matching heading, including offset under the site header. The image-specific Pinterest Save control must reference the public image and matching article anchor, with no generic top-of-page destination. Check image alt text, natural scene-specific captions, relevant free tool link, OG metadata, and responsive mobile layout.
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

## Category navigation standard (all inspiration galleries)

Use the existing `sections` array, not one-off gallery-specific HTML. The shared `InspirationGallery.astro` renders sage-tinted, accessible icon cards automatically when sections exist. Set the first `start` to 0 and use strictly ascending start indices under `ideas.length`; each `title` and `intro` must accurately describe the included images, and each short `label` should fit a mobile card. Icon keys available in the shared component: `bench`, `hooks`, `corner`, `kids`, `sparkle`, `star`, `cabinet`, `basket`, `shelves`, `sofa`, `book`, `home`, `wallet`, `lamp`, `paint`. Add a reusable SVG path entry only if these cannot represent a topic. Do not hide navigation behind a closet-only condition. Preserve picture deep links and Pinterest save behavior.
