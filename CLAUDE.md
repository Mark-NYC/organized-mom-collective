# CLAUDE.md

Organized Mom Collective: a static Astro site with two parts. The companion cleaning website (`/app`, noindex; in all copy call it a website or "the cleaning companion", never an app) for owners of the printed family wall calendar, and the public website: homepage (`/`), calendar product page (`/calendar`), companion explainer (`/companion`) and a resource library (`/resources`) of articles in the brand's Real-Life Reset format. Keep the two separate: public pages use `PublicLayout`, the companion uses `AppLayout`; never put site navigation or sales elements in the companion, or the manifest/service worker on public pages.

Architecture, commands, routes, storage and brand notes for the site are in [README.md](README.md). Don't duplicate them here; update the README when they change.\n\n## Brand and product direction: read before changes\n\n- [docs/brand/VISION.md](docs/brand/VISION.md) is the source of truth for audience, promise, positioning and the distinction between wall-calendar visibility and future digital schedule consolidation. Core belief: **Mom shouldn't have to manage everything alone.** Tagline candidate: **Less on your mind. More hands helping.**\n- [docs/brand/PRODUCT_ROADMAP.md](docs/brand/PRODUCT_ROADMAP.md) distinguishes current offer, next growth work, future integrated digital family system and unvalidated subscription concepts. Never advertise roadmap features as live.\n- [docs/editorial/BRAND_VOICE.md](docs/editorial/BRAND_VOICE.md) governs all public writing, including homepage, product pages, articles, Pins and email. Speak to a busy suburban mom aged roughly 25–35 with young school-aged children and lots of school/activity logistics. Market to mom, but design for the family to participate.\n- Current first offer remains the **physical wall calendar plus cleaning companion website**. The website does not consolidate digital calendars or sync the paper calendar. Do not call it an app in customer copy. Verify shipping, checkout and entitlement in code before publishing claims.\n- Existing three editorial pillars stay intact; recurring cross-pillar themes are **get it out of your head, get everyone involved, make home life easier**.\n

## Standing brand story principle

**Organized moms raise organized families.** This is the philosophy behind the name: we aren't teaching mom to do everything better, but helping the family learn shared plans, rhythms and responsibility. Keep this messaging hierarchy across brand storytelling and future decisions: **promise**: Mom doesn't have to manage everything alone; **philosophy**: Organized moms raise organized families; **outcome**: A home where everyone knows the plan and plays a part. Don't make mom the family's permanent task delegator or reminder. See [VISION.md](docs/brand/VISION.md) and [BRAND_VOICE.md](docs/editorial/BRAND_VOICE.md) for implementation. Existing product capabilities and current-vs-future honesty rules still apply.

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
- Keep articles short: 300–600 words of prose, core sections only (ARTICLE_FORMAT.md → Short by default). Don't force photos.
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
| Reference articles (the quality bar for new articles) | `src/content/articles/daily-cleaning-routine.mdx` (HC-02, length and tone) · `weekly-cleaning-schedule-for-busy-moms.mdx` (HC-01, pillar guide) |
| Article helpers / table of contents | `src/lib/articles.ts`, `src/lib/toc.ts` |
| Public layout (header, footer, canonical, Open Graph, JSON-LD) | `src/layouts/PublicLayout.astro`, `src/layouts/BaseLayout.astro` |
| Calendar link at the end of every article without a calendar product callout | `src/components/resources/CalendarBridge.astro` |
| Article typography and layout (`.article-title`, `.article-body` grid, `.breakout`) | `src/styles/global.css` |
| Sitemap | `src/pages/sitemap.xml.ts` |
| Post-build checks + content inventory | `scripts/check-site.mjs` (`npm run check:site`) |
| Copy-ready templates (article, brief, Pinterest plan) | `docs/editorial/templates/` |
| Pinterest plans (one per article) / pin exports | `docs/editorial/pinterest/{ID}.md` / `design/pinterest/{ID}/` |

Conventions: reuse the existing print palette, `.label` / `.page-title` / `.text-link` classes and `marks.tsx` components; internal URLs come from `src/routes.ts` and have no trailing slash; cleaning content is read from `src/data/cleaning.ts`, never retyped.

## Article and resource photography

**Before choosing images for any new article, guide, resource, or editorial landing page, read `docs/brand/PHOTO-DISCOVERY.md` and follow its discovery → source verification → clearance → optimization → reuse workflow.** Prefer faceless Kaboompics images, and **require new, source-unique lifestyle photography for each article**. Search the library first for duplicate detection, not for stock-image reuse; the same source photo with different crops or filenames is still a duplicate. No lifestyle image may be shared between articles. Exceptions apply only to explicitly marked real product photos and instructional assets. Run `npm run check:article-photos` before committing. The owner has approved all Kaboompics photos (standing approval, 2026-10-12): clear them yourself after the license, content and context checks in PHOTO-DISCOVERY.md, and record them in the catalog. Never publish other stock photos without the owner's clearance. If a fresh cleared Kaboompics image is unavailable, leave the article without a photo, never reuse another article's lifestyle shot as filler. The GitHub Actions downloader is not itself a photo search engine.

## Public website visual design

Read [docs/brand/PUBLIC-VISUAL-DESIGN.md](docs/brand/PUBLIC-VISUAL-DESIGN.md) before changing public page layouts. Use the homepage's inset gray composition, square photo edges, and shared public styles as the visual reference. Preserve tool output design and the cleaning companion's separate interface.

## Customer support and returns

Policy terms, service expectations, case workflows and the Etsy settings checklist live in [docs/operations/CUSTOMER_SUPPORT.md](docs/operations/CUSTOMER_SUPPORT.md); copy and numbers in `src/data/support.ts`. The 14-day return policy covers printed calendars only: never apply it to downloads or other products, and never change approved terms without the owner. The support form backend is in [supabase/SUPPORT.md](supabase/SUPPORT.md).

## Printable tool output design

Read [docs/brand/TOOL-OUTPUT-DESIGN.md](docs/brand/TOOL-OUTPUT-DESIGN.md) before creating or redesigning printable tools. Shared three-color choices live in `src/data/tool-palettes.ts`; selections save with tool content and carry into downloads.
