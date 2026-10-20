# Image-first inspiration article template

Separate editorial format for visual Pinterest inspiration collections, not routine/checklist guides. Existing MDX Real-Life Reset articles remain unchanged.

## Reuse
1. Add a new gallery record in `src/data/inspiration-galleries.ts`. Each photo gets a permanent `idea-N` anchor, unique descriptive alt text, category, practical caption and individual Pinterest description.
2. Add `src/pages/resources/<slug>.astro` based on the mudroom example, passing the correct gallery record into `InspirationGallery`. Avoid routing collisions with existing `[slug].astro`.
3. Upload exact reviewed source images to `public/images/inspiration/<slug>/`; store the public URLs in each `image` field. Use filenames describing the actual scene. Never invent an image URL and never reuse lifestyle photos across articles. Keep original high-quality Pinterest versions at stable public URLs. Validate image contents match captions and correct AI artifacts, text, brand/logos, fixtures and plausible clearances.
4. Replace placeholder alt text with accurate visual descriptions. The first photo loads eagerly; later photos lazy load. Add responsive versions and `srcset` where generated derivatives are available.
5. Publish only once all images exist, image save actions have been tested on mobile, and the 30 distinct idea count is editorially honest. Set `published:true` to allow indexing and visible Save buttons. Preview remains noindexed beforehand.
6. Verify `npm run verify`, mobile layout 320/375/390/768px, keyboard tabbing, anchor links, mobile Pinterest save flow, and Open Graph. Confirm site domain is claimed on Pinterest. The Save buttons use image-specific `media`, URL fragment, description. Host browser popup settings vary; test on real devices. The dataLayer event means *clicked Save*, not confirmed pin.
7. Make a Pinterest upload manifest for each original with filename, title, description, destination URL with anchor, and permanent ID. Track impressions, saves and outbound clicks from Pinterest separately from site clicks.

Do not redirect all images to the top of the article. Keep image anchors stable after launch. Avoid popups or nonfunctional 'save' controls. AI visuals must be labeled as concepts, never shoppable photographs.

Current mudroom page is an intentional noindex preview until the 15 Gemini originals are provided and reviewed. The template contains 15 image slots and 15 extra tips; do not claim 30 unique visual photographs. The picture-specific descriptions must be finalized only after images arrive.
