# Image-first inspiration article template

**Production workflow and import files:** [IMAGE_FIRST_PINTEREST_WORKFLOW.md](IMAGE_FIRST_PINTEREST_WORKFLOW.md). The gallery is a permanent layout standard for the image-first Pinterest lane, independent of the Real-Life Reset checklist format.

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

The mudroom gallery uses 15 photographs and 15 numbered photo sections. Each section contains two separate practical ideas, giving readers 30 ideas without confusing paired numbers such as 'ideas 1 & 2'. Navigation labels refer to the 15 photo sections, not the two pieces of advice. Do not claim 30 unique visual photographs. Review every image and caption together before publication.

## Photo titles and idea numbers

Each photo is one visual section with a short, standalone editorial H2, taken from `navLabel`, followed by two equal-weight H3 idea headings. The two practical ideas are numbered consecutively across the full gallery (1–30) with identical sage circle badges. Each H3 and its paragraph form a compact ruled tip block. Do not put a number inside the photo's H2, do not mix heading sizes between the paired ideas, and do not display 'Ideas 1 & 2' counters. The small 'Photo 01 of 15' label identifies the photograph, while the 1–30 numbers identify the actual tips.

The dropdown lists only the 15 photo titles, linking to their permanent `#idea-N` anchors. Pinterest saving remains per photograph.

## Large single-idea galleries (50 photos)

For 50-image inspiration articles such as `beautiful-toy-storage-ideas-family-living-rooms`, use **one distinctly titled, numbered practical idea per photograph**, not two tips per photo. The shared component automatically switches between 15 x 2 and 50 x 1 formats based on presence of `secondTitle` fields; do not add dummy second tips. A 50-photo page displays 50 numbered sage circles and 50 individual `#idea-N` anchors. Keep `published:false` and all `image` fields empty until uploaded assets pass visual QA, then bind paths from the exact `UPLOAD_MANIFEST.csv` in the folder. Do not publish a gallery with broken images or produce its Pinterest CSV before image URLs are live.

Use `src/data/toy-storage-gallery.ts` and `src/pages/resources/beautiful-toy-storage-ideas-family-living-rooms.astro` as examples. See the corresponding image directory README for image handoff instructions.
