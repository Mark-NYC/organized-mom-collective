# Free resource directory

Owner direction, October 14, 2026: replace the old /tools design entirely. Match the supplied Clean Mama reference's clarity, publication-like hierarchy and previews while using OMC colors and original OMC content. This page-specific direction supersedes the gray intro frame and prior rounded seasonal-button/pill styling on /tools only. Shared site navigation, footer, tool pages and printable artwork are outside this change.

## Layout

- White base, restrained charcoal sans-serif headings, generous space and thin rules.
- Centered compact heading and one explanatory line. No eyebrow or large introductory panel.
- Seasonal resources first, using real previews. Three columns on desktop and compact preview/action rows on mobile. No rounded seasonal cards or icon badges.
- A single library with understated text filters and search. Popular is a curated six-resource default, not an analytics-backed ranking.
- Main grid: three columns desktop, two tablet, one phone. No enclosing cards. Full-sheet preview, plain resource name, short description and one clear action.
- Actions describe the next page accurately. Seasonal on-screen checklists say Use on screen; they are not advertised as downloadable printables.
- Calendar offer comes after the directory, separated by a rule, with real product photography and one action.
- Month accent comes directly from src/theme.ts. No new palette or decorative gradients.

## Sources and maintenance

src/data/tools-directory.ts contains directory-only titles, descriptions, actions, categories and selections. src/data/free-tools.ts remains the canonical route inventory. All 24 tools are included once in the main grid, including chore chart, routine charts and weekly planner which were omitted from the previous category arrays.

public/images/tools/previews/ contains real screenshots of original tool output elements, resized onto neutral grounds. No AI-generated or CSS-reconstructed printable artwork. Multipage resources show two actual captured pages; on-screen tools show a real room checklist. design/tools-directory/preview-manifest.json records source routes, selectors, dimensions and hashes. Regenerate the corresponding preview whenever its source tool design changes. The calendar screenshot is an illustrative example, not a live month widget.

ToolResource.astro renders the shared resource presentation. Each resource has one keyboard-focusable action; the preview is also clickable by pointer without duplicating the keyboard stop. Search crosses all resources when Popular is selected, and stays inside a selected category otherwise. Clearing an unmatched search restores All tools. Seasonal selections use the reader's local month and refresh on tab resume. A static fallback is included; with JavaScript disabled all resources remain visible.

## Verification

2026-10-14: npm run verify passes (116 active unit tests, site checks). Browser checks cover six Popular resources, all 24 resources, all three category counts, cross-library search, no-results recovery, all 12 seasonal months, image loading and no horizontal overflow at 320, 390, 768 and 1440px. No page errors or failed requests in the tested flow. Desktop and phone screenshots visually reviewed.
