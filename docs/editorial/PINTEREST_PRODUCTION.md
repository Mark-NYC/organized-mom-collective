# Pinterest production playbook

Status: production workflow specification, October 14, 2026. This document governs how approved article concepts become finished pins. It does not claim a renderer, font license, scheduling integration, or automated publishing already exists.

## Source of truth and startup

At the start of **each batch**, read the latest GitHub versions of this file, [PINTEREST_STRATEGY.md](PINTEREST_STRATEGY.md), [BRAND_VOICE.md](BRAND_VOICE.md), [../brand/VISION.md](../brand/VISION.md), [../brand/PUBLIC-VISUAL-DESIGN.md](../brand/PUBLIC-VISUAL-DESIGN.md), the finished article, and its `docs/editorial/pinterest/{ARTICLE_ID}.md` plan. Consult `src/styles/global.css` and `src/theme.ts` for current colors. If GitHub is unavailable, disclose that and request a source snapshot rather than claiming guidelines are current. Respect the existing rules if they are more restrictive.

**Strategic plan vs. production batch:** Three concepts remain the existing plan and checker contract: search, curiosity, save. The new default production output is **six image variations**, two per concept. Do not change three-pin plan sections or `npm run check:site` expectations without a separate code/template migration. Existing three-pin assets remain valid.

## Input contract

- Canonical final article URL and article ID; read and verify the *published* article.
- Approved, clean, high-resolution master photograph, ideally already 2:3 at 1000 × 1500 or larger. No text in the source. Accept an approved photo from the repository, or a user-provided image.
- Approved branding and any necessary assets from the repository. Do not substitute generated logos or pretend to have licensed fonts.
- Current research evidence for the keywords if available. If unavailable, mark research as not verified; never invent Pinterest Trends, autocomplete, volumes or performance.
- Where the photo is not safe to crop or does not offer readable copy space, request an approved alternate or choose a solid opaque text panel that preserves image visibility. Never use generative fill.

## Immutability and layered rendering

1. Copy the master asset and keep the original bytes untouched. Store a filename and SHA-256 hash in the batch manifest.
2. Compose a fixed **1000 × 1500 px, sRGB** canvas. If resizing/cropping is required, record the crop and apply it once to a derived background layer; never alter the source asset. If the photo is already exactly 1000 × 1500, place it without resampling wherever possible.
3. Add separate editable composition layers for text, accent bars, rules, solid or translucent color panels, and the authentic badge. **Never use an AI image-edit model for typography.** Render text deterministically with installed, licensed fonts.
4. Do not erase, repaint, reimagine, recolor, re-light, outpaint or regenerate photo contents. Any fades/panels apply as *overlay layers* and do not modify the underlying photograph.
5. Export flattened PNGs at exact dimensions. Keep the recipe or layered source used to reproduce the batch. A flattened output necessarily combines layers; only the **master** is pixel-identical.
6. Never claim pixel-perfect preservation of a photo in the *flattened output* where scaling, cropping or overlay blending visibly changes it. The claim applies to the untouched master and unmodified background source layer.

## The six variations

Produce **two search-led**, **two curiosity-led**, and **two save-worthy** designs. Each must have a distinct, truthful hook or useful excerpt, and map to a real article section.

| Variant | Job | Suggested starting template |
| --- | --- | --- |
| search-v01 | Primary search phrase | A, photo + headline panel |
| search-v02 | Secondary search phrasing | B, quiet image with inset title panel |
| curiosity-v01 | Name real friction | B |
| curiosity-v02 | Show the article's actual shift | A |
| save-v01 | Short exact routine or checklist | C, paper/checklist panel |
| save-v02 | Alternate exact steps or fallback | C with a different composition |

Do not pad an article with invented advice just to achieve six variants. If distinct save-worthy content is unavailable, record the shortfall and produce fewer qualified variations. Variation is not a license to change the source photo's content. At least **two noticeably different layouts** across the batch, and rotate accent colors and placements without drifting from the brand.

## Reusable compositions

- **A: Photograph + lower paper panel.** Original photo remains visible behind the upper portion; cream or paper-white lower panel holds headline and short supporting line.
- **B: Photograph + quiet inset copy area.** Use naturally empty photo space or a rectangular opaque/translucent panel, with no gradient-heavy treatment or illegible type directly on clutter.
- **C: Planner/checklist on paper.** Use a large flat opaque paper panel, checklist boxes and rules. Retain the source photo as a secondary visible segment only when that helps. Exact article checklist text only; never synthesize a fake printable.

These are design *recipes*, not yet a coded renderer. Build reusable code/templates only after the first approved batch establishes spacing, typography and composition.

## Design requirements

Follow the detailed palette, licensed typeface policy, hierarchy, margins and image rules in `PINTEREST_STRATEGY.md`. In particular:

- 1000 × 1500, vertical 2:3, sRGB; PNG deliverable.
- 80 px safe margins, bottom 160 px free of critical copy.
- Headline 3–8 words where possible; legible when scaled to ~250 px width.
- High-contrast copy (>= 4.5:1; aim >= 7:1 for headlines); no word collisions, truncation or stretched logo.
- Montserrat family for primary copy; Georgia accent italic only when licensed/available. Do not package proprietary fonts.
- Warm, realistic, slightly lived-in photography. No synthetic customer claims, fake calendar/screen/product depiction, or invented product capabilities.
- OMC's promise is shared ownership: help moms get the plan out of their heads and enable the whole family to participate, not simply make mom more efficient.
- Current offer is the printed wall calendar with the **cleaning companion website**. Never call it an app or promise future features.

## Copy and metadata

For each variation, produce unique:
- On-image headline, optional eyebrow/supporting line, and approved brand line.
- Pinterest title (up to 100 characters), description (up to 500 characters), and accessible alt text (up to 500 characters).
- Recommended relevant board and the identical canonical URL of the finished article, unless a tool/freebie has its own verified destination.
- Exact article heading or section supporting the claim.

Make the first words of search-led titles recognizable search phrases, but avoid keyword stuffing and artificial urgency. A single photo can anchor all six without forcing all six captions to be identical.

## Files and manifest

Suggested batch output directory: `design/pinterest/{ARTICLE_ID}/`. Keep master and source files separately from flattened published pins. Do not put pins in the website's `public/` unless a separate site feature specifically needs them.

Use filenames:
`{ARTICLE_ID}-{search|curiosity|save}-v{01|02}-1000x1500.png`.

Export:
- Six PNGs, unless any concept fails honest content/QA checks.
- One ZIP containing approved PNGs, manifest and metadata.
- `pinterest-metadata.csv` with columns: `article_id,variant,filename,headline,title,description,alt_text,board,destination_url,article_section,status`.
- `batch-manifest.json` with source filename, original SHA-256, article URL, guideline revision/commit if available, template ID per pin, crop/resizing notes, file list and QA results.
- An editable template/recipe alongside the files if produced. Do not claim to provide layered design files when only PNGs exist.

For a chat-only production job, generate downloadable artifacts in the working environment; GitHub commits are optional and must be explicitly requested. Files cannot be assumed present until generated and verified.

## QA gate before delivery

- [ ] Read current GitHub rules and verified final article.
- [ ] Original master retained, hash recorded, image contents never regenerated.
- [ ] Each overlay headline and checklist supported by the real article.
- [ ] Exactly 1000 × 1500 RGB/sRGB outputs; check each with an image inspector.
- [ ] Correct text and spelling, no clipping; readable at phone-feed width.
- [ ] Contrast, 80 px safe margins, 160 px lower UI reserve, logo integrity verified.
- [ ] Distinct hooks; at least two different layouts; not six near-duplicates.
- [ ] No false product images, fabricated people/testimonials, or future-as-current features.
- [ ] CSV rows correspond to actual generated PNG filenames and live destination URL.
- [ ] ZIP opens and contains every approved deliverable; report any rejected variants honestly.

## Publication and measurement

Stage the batch; **do not publish all six at once**. Follow the initial three-stage publishing sequence in the strategy and space additional variants on subsequent dates. Avoid re-uploading effectively identical images. Track impressions, outbound clicks and saves by creative over time when real Pinterest data is available; do not invent benchmarks. Update the concept plan and tracker using their present three-concept contract until a separate migration is shipped.

## ChatGPT Project operating instruction

"At the beginning of every Pinterest production task, read the latest `docs/editorial/PINTEREST_PRODUCTION.md` and its linked brand, article and Pinterest strategy files in the connected `Mark-NYC/organized-mom-collective` GitHub repository. Use the verified article and an approved clean source image to make two search, two curiosity and two save-worthy variations via deterministic layered overlays, preserving the original photo. Deliver verified PNGs, metadata CSV, manifest and ZIP. If GitHub or the needed source is inaccessible, say so rather than guessing."
