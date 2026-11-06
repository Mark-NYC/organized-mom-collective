# OMC Practical Guide Blueprint
Version 1 · pilot: Family Bathroom Reset

## What every guide is for
A real problem gets a repeatable, usable household system. The article teaches the full system. The companion printout makes it easy to carry out. Family members should be able to understand their part without asking Mom to translate everything.

## Required deliverables
1. An indexable public editorial guide page in `src/pages/guides/<slug>/index.astro` using `PublicLayout`. Mobile-first, keyboard accessible, with natural jump navigation.
2. A printer-first four-page US Letter reference in `src/pages/guides/<slug>/print.astro`. White base paper, 100% scale, page numbering, safe margins, and a print / Save as PDF action. No automatic signup wall.
3. A small canonical artwork map in `src/data/guides/<topic>-icons.ts`, importing **real** source assets via Vite `?url`, then referenced by BOTH guide and printable. Do **not** hardcode `/assets/icons/ofc/...` when the artwork only exists under the repository's top-level `assets/` folder: those paths do not exist in `public/`.
4. A visual guide preview; use actual print pages when screenshots are available, otherwise label the preview clearly as representative. Never claim a CSS mockup is a screenshot of rendered PDF.
5. At least one useful related free resource (for this guide: Family Responsibility Builder); promotion is secondary to utility.

## Guide layout system
- Hero: concrete problem and result; clear free-printable CTA.
- Warm-ivory featured resource block with readable printable preview and CTA.
- Jump navigation to high-value sections, not just an uninterrupted article.
- `Daily`: habits small enough to do after each use. Hand-drawn icons for each habit.
- `Weekly`: a task, specific steps, and a clear **definition of done** for each task. One correct icon per action.
- `Periodic / condition-based`: only what needs occasional attention, with safety caveats.
- `Troubleshooting`: recurring symptom, probable friction/source, and specific change. Pair icons with real objects/actions, not decorative clipart.
- `Family handoff`: age/ability-based examples, teaching loop (show / practice / own), and a short family meeting prompt.
- Repeated, non-intrusive printable CTA and one connected free tool.
- Alternate white, #FBF7F1 and restrained pastel surfaces. Use #545454 body, Georgia headlines, Montserrat body/supporting text. Use #CDDDE1, #D4DFC4, #F1D8A8, #E8D2D6 as color accents and meaningful hierarchy.
- Green #315B4F on web CTAs may be used sparingly if consistent with the site's existing editorial palette. Avoid large heavy ink areas in print.

## Icon rules
- Use OMC's hand-drawn illustrations, never emoji or mixed generic outline packs in place of a task drawing.
- Reuse the same illustration for the same task on website, printed instructions, and assignment areas.
- Keep the original aspect ratio, background transparency if present, and `object-fit:contain`. No stretch, cropping, shadows, or colored circles baked into the artwork.
- Images communicate actions; don't put icons on every sentence or heading.
- If a precise drawing is unavailable, use a clearly related existing icon or omit it; don't portray a misleading action.
- Meaningful icons have adjacent text and no reliance on color alone; decorative duplicated icons use empty alt text.
- Print target: 40–55px for task anchors, 28–32px in compact troubleshooting/assignment rows. Verify icons stay recognizable at physical 100% size.

## Printable page logic
- 1 Daily habits + `what done looks like`.
- 2 Weekly jobs with steps and individual finish lines.
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
- Print 4 actual US Letter pages at 100%, backgrounds on/off; inspect page count, safety margins, icon clarity and handwriting room. Do not declare print QA passed without rendering it.
- Verify buttons, download route, relevant tool links, semantic heading order, color contrast and keyboard focus.
- Don't merge a guide as the new template until the checks pass.

## Pilot limitations to address before declaring final
The bathroom printable is presently an HTML print-to-PDF route; it does not serve a pre-generated PDF file. The featured paper-stack graphic is a representative page preview, not a screenshot of the actual PDF. Both are acceptable as interim implementations but should be labeled accurately.
