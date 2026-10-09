# CLAUDE.md

Organized Mom Collective: a static Astro site with two parts. The companion cleaning website (`/app`, noindex; in all copy call it a website or "the cleaning companion", never an app) for owners of the printed family wall calendar, and a public resource library (`/resources`) of articles in the brand's Real-Life Reset format.

Architecture, commands, routes, storage and brand notes for the app are in [README.md](README.md). Don't duplicate them here; update the README when they change.

## Working on articles or the resource library

**Before planning, writing, editing or publishing any article, read the editorial system in `docs/editorial/`:**

| Read | For |
| --- | --- |
| [BRAND_VOICE.md](docs/editorial/BRAND_VOICE.md) | Audience, positioning, tone, convictions, what we never write |
| [ARTICLE_FORMAT.md](docs/editorial/ARTICLE_FORMAT.md) | The Real-Life Reset structure, curiosity loops, components, verified product features |
| [BLOG_EDITORIAL_STYLE.md](docs/editorial/BLOG_EDITORIAL_STYLE.md) | How articles read and look: writing and design rules, photography direction and shot list, quality checklist |
| [SEO_STRATEGY.md](docs/editorial/SEO_STRATEGY.md) | Intent research, keywords, headings, metadata, structured data, quality bar |
| [CONTENT_CLUSTERS.md](docs/editorial/CONTENT_CLUSTERS.md) | The three pillars (Family Planning & Routines, Simple Home Cleaning, Intentional Family Life), 18 planned articles, relationships, overlap boundaries, backlog |
| [INTERNAL_LINKING.md](docs/editorial/INTERNAL_LINKING.md) | Parent, sibling, next-step, bridge and product links; incoming-link maintenance |
| [PINTEREST_STRATEGY.md](docs/editorial/PINTEREST_STRATEGY.md) | The three pins per article, Pinterest keyword research, visual identity, image rules, pin copy, boards |
| [ARTICLE_WORKFLOW.md](docs/editorial/ARTICLE_WORKFLOW.md) | The eight-step process, one article at a time, including the Pinterest plan |
| [CONTENT_TRACKER.md](docs/editorial/CONTENT_TRACKER.md) | IDs, slugs, status, target links, publication dates, Pinterest plan and pin status |

Non-negotiables (details in the docs above):

- Work through the tracker **one article at a time**, and write a brief (`docs/editorial/briefs/`) with an overlap check before drafting.
- **Every article requires a Pinterest plan.** Follow PINTEREST_STRATEGY.md and save a complete plan at `docs/editorial/pinterest/{ARTICLE_ID}.md` (from `docs/editorial/templates/pinterest-plan.md`) with three distinct pins: search-driven, curiosity-driven, save-worthy. Write the concepts from the finished article, not the outline, and keep the tracker's Pinterest columns in sync. An article isn't done until its plan is.
- Research Google and Pinterest search intent separately; never invent search volume, engagement or trend data.
- Never generate fake product images, alter the real calendar artwork, or misrepresent how the cleaning companion works.
- Never invent statistics, studies, expertise, testimonials or first-person experiences.
- Never describe a product feature that isn't verified (see ARTICLE_FORMAT.md → Product notes). Product mentions stay secondary.
- Run `npm run verify` after every article and fix everything it reports. Commit the regenerated `docs/editorial/content-inventory.md` with the article.

## Code map for the library

| What | Where |
| --- | --- |
| Article files (`.mdx`, file name = slug) | `src/content/articles/` |
| Frontmatter schema | `src/content.config.ts` |
| Pillars (ids, tracker prefixes, page copy) | `src/data/pillars.ts` |
| Article template, hub, pillar pages | `src/pages/resources/[slug].astro`, `src/pages/resources/index.astro`, `src/pages/resources/topics/[pillar].astro` |
| MDX components (Figure, Tip, Checklist, ChecklistGrid, ProductCTA, Shift, RealLifeVersion, WhenLifeHappens, NextSmallWin, Versions, CleaningWeek; legacy ProductNote) | `src/components/resources/` |
| Article photography registry / image tool | `src/data/images.ts` / `scripts/article-image.py` (files in `public/images/resources/`) |
| Reference article (the quality bar for new articles) | `src/content/articles/weekly-cleaning-schedule-for-busy-moms.mdx` (HC-01) |
| Article helpers / table of contents | `src/lib/articles.ts`, `src/lib/toc.ts` |
| Public layout (header, footer, canonical, JSON-LD) | `src/layouts/PublicLayout.astro`, `src/layouts/BaseLayout.astro` |
| Article typography and layout (`.article-title`, `.article-body` grid, `.breakout`) | `src/styles/global.css` |
| Sitemap | `src/pages/sitemap.xml.ts` |
| Post-build checks + content inventory | `scripts/check-site.mjs` (`npm run check:site`) |
| Copy-ready templates (article, brief, Pinterest plan) | `docs/editorial/templates/` |
| Pinterest plans (one per article) / pin exports | `docs/editorial/pinterest/{ID}.md` / `design/pinterest/{ID}/` |

Conventions: reuse the existing print palette, `.label` / `.page-title` / `.text-link` classes and `marks.tsx` components; internal URLs come from `src/routes.ts` and have no trailing slash; cleaning content is read from `src/data/cleaning.ts`, never retyped.
