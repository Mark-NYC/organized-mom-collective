# Family printables

Built November 4, 2026 for the owner-approved sibling, cleaning-finish-line, bedroom, dinner-team and counter-clutter concepts.

## Files and destinations

| Printable | Article | PDF |
| --- | --- | --- |
| Our family. Our jobs. | /resources/chore-chart-for-siblings | /downloads/family/sibling-chore-chart.pdf |
| Clean means this. | /resources/kids-cleaning-checklist | /downloads/family/kids-cleaning-finish-lines.pdf |
| My bedroom reset. | /resources/kids-bedroom-cleaning-checklist | /downloads/family/kids-bedroom-reset.pdf |
| Our dinner team. | /resources/kids-helping-with-dinner | /downloads/family/family-dinner-team.pdf |
| Where does this go? | /resources/kitchen-counter-clutter-reset | /downloads/family/kitchen-counter-clutter-reset.pdf |

The dinner resource improves IF-09 rather than creating a second article for the same intent. Its old #checklist anchor remains valid. New article IDs: IF-18, IF-19, IF-20, HC-13. Master concepts C012, C013, C014, C016 and C039 now have destinations. Article completion does not change pin artwork, approval or publishing status.

## Rebuild

Single content source: src/data/family-printables.json. Responsive article component: src/components/resources/FamilyPrintable.astro. The PDF generator reads the same titles, rows, icons and fallbacks.

1. Install the site's existing Node dependencies.
2. Run `node scripts/prepare-family-printables.mjs` to rasterize the existing SVG masters into an ignored working folder.
3. With reportlab and pypdf available, run `python3 scripts/render-family-printables.py`.
4. Render each PDF at a 1000 px long edge: `pdftoppm -scale-to 1000 -singlefile -png INPUT.pdf public/images/resources/printables/SLUG`.
5. Inspect all five pages and check field values and widget appearances in a disposable filled copy.

These are US Letter portrait, one page each. White paper, restrained OMC accents, charcoal text, original hand-drawn SVG icons, embedded Montserrat and the repository's Gelasio printable serif. The website uses Georgia. AcroForm typed fields use the PDF standard Helvetica to support PDF readers. Type in the PDF or write by hand; the website does not collect family names. Color is supplementary to text and rules, so the PDFs remain usable in grayscale.

Downloads need no email, login or JavaScript. Preview images are renders of the actual PDFs. The Pinterest Save link uses that actual preview. No final Pinterest pin artwork has been generated or scheduled in this task.

## Verification on November 4

- All five PDFs render on exactly one US Letter page. Each has the expected canonical form fields. Disposable filled copies retained the assigned values and nonempty widget appearances; bedroom checkboxes were also checked and rendered.
- All five page previews were inspected. The responsive HTML twin was inspected in the browser for every destination; icons loaded, the download URLs matched, and no horizontal overflow was observed at the tested desktop viewport.
- Astro type check: zero errors. Static build: passed, 212 routes.
- Built-page checks: each destination has one H1, one printable anchor, one download, a real PDF, its actual PNG preview and the expected canonical.
- Full site check reports three existing failures outside this batch: missing family-responsibility-builder tool preview and missing Secondary search terms / Target audience field labels in FP-27. No new article or plan errors.
- Unit suite: 107 passed, one existing March icon fallback expectation failed. That test assumes March artwork is absent although the repository contains it. No March engine or test files were changed.
- Original 500 master IDs and proposed schedules retained. Only destination/resource readiness is updated for the five completed concepts.
