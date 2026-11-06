# OMC Practical Guide Blueprint
Version 1 · pilot: Family Bathroom Reset

## What every guide is for
A real problem gets a repeatable, usable household system. The article teaches the full system. The companion printout makes it easy to carry out. Family members should be able to understand their part without asking Mom to translate everything.

## Required deliverables
1. An indexable public editorial guide page in `src/pages/guides/<slug>/index.astro` using `PublicLayout`. Mobile-first, keyboard accessible, with natural jump navigation.
2. A real, generated US Letter PDF in `public/downloads/<slug>.pdf` built with a dedicated `scripts/generate-<slug>-pdf.mjs` script and reusable `scripts/lib/omc-guide-pdf.mjs` helpers. White paper, four pages, safe margins, writable owner fields, page numbering. Never require signup.
3. A small canonical artwork map in `src/data/guides/<topic>-icons.ts`, importing **real** source assets via Vite `?url`, then referenced by BOTH guide and printable. Do **not** hardcode `/assets/icons/ofc/...` when the artwork only exists under the repository's top-level `assets/` folder: those paths do not exist in `public/`.
4. Show the actual downloadable PDF using `src/components/guides/GuidePdfPreview.astro`, with a direct-download fallback. For marketing images, render real PDF pages; never fake a screenshot or label a CSS composition as a rendered PDF.
5. At least one useful related free resource (for this guide: Family Responsibility Builder); promotion is secondary to utility.

## Guide layout system
- Hero: concrete problem and result; clear free-printable CTA.
- Warm-ivory featured resource block with readable printable preview and CTA.
- Jump navigation to high-value sections, not just an uninterrupted article.
- `Daily`: habits small enough to do after each use. Hand-drawn icons for each habit.
- `Weekly`: a task, specific steps, and a clear **definition of done** for each task. One correct icon per action.
- `Periodic / condition-based`: only what needs occasional attention, with safety caveats.
- `Troubleshooting`: recurring symptom, probable friction/source, and specific change. Pair icons with real objects/actions. Use an accessible table on desktop and stacked problem cards on small screens; never force sideways scrolling to read instructions.
- `Family handoff`: age/ability-based examples, teaching loop (show / practice / own), and a short family meeting prompt.
- Repeated, non-intrusive PDF download CTA and one connected free tool. Use the existing `btn-primary` design, not a one-off style.
- Match OMC's existing public editorial system first: Georgia headlines, Montserrat text, centered editorial intro, charcoal primary buttons, restrained rules and whitespace. Never imitate a reference site's visual identity. Alternate white, #FBF7F1 and restrained pastel surfaces. Use #545454 body, Georgia headlines, Montserrat body/supporting text. Use #CDDDE1, #D4DFC4, #F1D8A8, #E8D2D6 as color accents and meaningful hierarchy.
- Use existing OMC charcoal `btn-primary` and shared editorial classes, not a separate guide-specific button or competitor-inspired dark-green CTA. Avoid large heavy ink areas in print.

## Icon rules
- **All practical guides use monochrome hand-drawn artwork only.** No pastel-colored illustration fills, colored discs, stock icons, emoji, or mixed line-art styles. The pastel brand palette is for page accents and guide panels, not the illustrations.
- Prefer existing charcoal traced hand-drawn sources in `assets/icons/ofc/updatedicons/svg/*.svg` first. Use the task-accurate drawing, rather than a vaguely related vector just to fill a slot. When that artwork is missing, reuse an appropriate existing hand-drawn master and convert it to charcoal-only PNG, or commission/create a matching drawing before publishing.
- Every guide icon preparation script must run `normalizeGuideCollection` from `scripts/lib/normalize-guide-ink.mjs` **before** its PDF and page-preview generators. This makes web, PDF and preview artwork use exactly the same dark-ink pixels and transparent background.
- Do not change the original master images in place. Keep black/charcoal illustrated marks on white print paper; only the surrounding page sections get gentle OMC color.
- Use OMC's hand-drawn illustrations, never emoji or mixed generic outline packs in place of a task drawing.
- Use background-free exports for every icon. Run `scripts/prepare-bathroom-guide-icons.mjs` before both page build and PDF generation; preserve intentional white enclosed inside the drawing. Reuse cleaned `/public/assets/icons/ofc/guides/bathroom/*.png` in BOTH outputs, rather than the original source JPG/PNG/WebP.
- Prefer a canonical transparent OMC SVG for problematic icons, such as the toothbrush, rather than filtering out white from the entire image.
- Reuse the same illustration for the same task on website, printed instructions, and assignment areas.
- Keep the original aspect ratio, background transparency if present, and `object-fit:contain`. No stretch, cropping, shadows, or colored circles baked into the artwork.
- Images communicate actions; don't put icons on every sentence or heading.
- If a precise drawing is unavailable, use a clearly related existing icon or omit it; don't portray a misleading action.
- Meaningful icons have adjacent text and no reliance on color alone; decorative duplicated icons use empty alt text.
- Print target: 40–55px for task anchors, 28–32px in compact troubleshooting/assignment rows. Verify icons stay recognizable at physical 100% size.

## Printable page logic
- 1 Daily habits + `what done looks like`.
- 2 Weekly jobs with the necessary safe supplies, steps and individual finish lines.
- 3 Family age/ability examples + fill-in owner and schedule. Leave generous handwriting space.
- 4 Troubleshooting, safety, and one small next action.
These four page purposes may be adapted by topic, but each must offer a clear job rather than serve as filler.

## Editorial and safety rules
- Distinguish a cleaning habit from maintenance and repairs.
- Do not assign chemical cleaners, disinfection, mold remediation, or dangerous tasks to young children.
- Prefer clear directions to exaggerated statistics or unsupported expert claims. Source niche recommendations or safety thresholds on the article before asserting them.
- Avoid using the exact same text on page and printable: page explains, printable is the quick reference.
- Don't make busy families track another log unless tracking materially helps.

## Release quality checks
- `astro check` / build / CI succeeds.
- Audit referenced assets (all source paths and built URLs); check both web and print routes.
- Render page at ~390px and desktop; confirm no clipping, unreadably small text, broken images or horizontal overflow.
- Generate and render the actual 4-page US Letter PDF at 100%; inspect page count, safety margins, icon clarity and handwriting room. A build-time check of page count alone is not visual print QA.
- Verify buttons, download route, relevant tool links, semantic heading order, color contrast and keyboard focus.
- Don't merge a guide as the new template until the checks pass.

## Build and rollout
- Add the new PDF generator to both dev/build commands in `package.json` so `public/downloads` always holds the current PDF before Astro copies static assets.
- PDFs use actual OMC art from the source icon folders. Use PNG/JPG for `pdf-lib` embedding, and retain the exact task meaning when selecting artwork.
- Keep the article’s table and its mobile card view in sync using the same data array.
- The GuidePdfPreview component embeds the actual PDF rather than a fake static graphic. Browsers without inline PDF support still offer direct download.
- Do not merge or call the guide a validated master template without build, responsive, and visual PDF checks.
