# SEO strategy

How articles are researched, targeted and marked up so a reader from Google finds the answer fast and the site reads as one connected guide.

Related: [CONTENT_CLUSTERS.md](CONTENT_CLUSTERS.md) (what we target) · [INTERNAL_LINKING.md](INTERNAL_LINKING.md) · [ARTICLE_WORKFLOW.md](ARTICLE_WORKFLOW.md).

## Principles

- **Intent first.** Each article exists to satisfy one search intent completely. Rankings follow usefulness, not keyword counts.
- **Answer early.** A reader who gets her answer in the first screen and then keeps reading is the outcome we want.
- **Clusters, not posts.** Every article belongs to one of three pillars, links to its pillar guide, and is linked from it. Topical depth beats volume.
- **No arbitrary word counts.** An article is as long as the intent needs. Cut anything that doesn't help her act.
- **Trust through specificity, not claims.** Concrete routines and honest limits instead of invented credentials, statistics or testimonials.

## Search intent research

Before every brief (see [ARTICLE_WORKFLOW.md](ARTICLE_WORKFLOW.md) step 1), search the primary query and record:

1. **Intent type.** Informational how-to ("how to…"), list/template ("…schedule", "…checklist"), comparison, or problem-solving ("…when overwhelmed"). Our format fits how-to and template intents best.
2. **Dominant format** of the top results: printable, listicle, step-by-step guide, video, product page, forum. If Google shows mostly products or videos, reconsider the target.
3. **What every result covers** (table stakes we must also cover, briefly).
4. **What's missing or weak**: usually the fallback for a bad week, a specific stopping point, or the reasoning that lets her adapt. This becomes our differentiation and often The Shift.
5. **Related questions** from "People also ask" and related searches. Answer the relevant ones inside the article as H2s or within sections; don't bolt on an FAQ.
6. **Who ranks**: brands, publishers, blogs, forums. Note any that sell a competing product; their advice is often shaped by it.

Record sources as links in the brief. Don't copy their structure or wording.

## Keyword targeting

- **One primary keyword per article**, recorded in frontmatter `primaryKeyword` and in [CONTENT_TRACKER.md](CONTENT_TRACKER.md). It must be distinct from every other article's primary keyword.
- **Secondary keywords**: 3–6 close variants and sub-questions listed in the brief. Use them where they read naturally (headings, the short answer, alt text), never forced.
- **Cannibalization check**: if two articles would answer the same query, merge them or sharpen one to a different intent. The overlap notes in [CONTENT_CLUSTERS.md](CONTENT_CLUSTERS.md) define the boundary for each planned article.
- **Natural language.** Write how a mom would search and talk ("what's for dinner", "catch up on housework"), not industry terms.
- **Don't repeat the keyword** to hit a density. Once in the H1 or SEO title, once early in the body, and in headings only where it's the natural wording.

## Headings

- **One H1 per page**: the frontmatter `title`. Clear and specific; may carry a benefit or qualifier ("…That Survives a Bad Week").
- **H2s are descriptive**, not clever: "What goes on the calendar (and what doesn't)", not "The Big Question". A reader skimming only H2s should get the outline of the answer.
- The `RealLifeVersion` and `WhenLifeHappens` titles render as H2s and appear in the table of contents; write them as headings.
- H3s only nest under an H2. Don't skip levels.
- Sentence case. Product and zone names keep the calendar's capitalization.

## Metadata

All set in the article's frontmatter (schema: `src/content.config.ts`; a build fails if a field is missing or out of range).

| Field | Rule |
| --- | --- |
| `title` (H1) | For the reader. Can be longer and warmer than the SEO title. |
| `seoTitle` (`<title>`) | ≤ 60 characters (enforced). Primary keyword near the front. Used as-is, no brand suffix. Quote it in YAML if it contains a colon. |
| `description` (meta) | 70–160 characters (enforced). Answers the query in one or two sentences, with the specific promise. Not a teaser. |
| Slug (file name) | Lowercase, hyphenated, contains the core phrase, no dates or stop-word padding. **Permanent once published**: changing it breaks links and loses ranking. |
| `summary` | The line under the H1 and on cards. ≤ 200 characters. |
| `published` / `updated` | Honest dates. Set `updated` only when the advice changes. |

Automatic (from the template, `src/pages/resources/[slug].astro` and `src/layouts/`):

- **Canonical URL**: `https://organizedmomcollective.com/resources/<slug>`, no trailing slash (matching internal links).
- **Open Graph**: title, description, type `article`, URL, image.
- **Sitemap**: `/sitemap.xml` lists the home page, the hub (once it has articles), pillar pages with articles, and every published article with `lastmod`. `robots.txt` points to it. The companion app and `/start` are noindex and excluded.

## Structured data

Generated by the templates; don't hand-write JSON-LD in articles.

| Page | Types |
| --- | --- |
| Article | `Article` (headline, description, dates, image, section, author and publisher = the Organized Mom Collective organization) + `BreadcrumbList` (Resources › Pillar › Article) |
| Pillar page | `BreadcrumbList` |
| Hub | `CollectionPage` listing published articles (once there are any) |

Not used, on purpose: `FAQPage` (FAQ rich results are limited to authoritative government and health sites) and `HowTo` (no longer shown as a rich result). Don't add `Review`, `AggregateRating` or person authors: we have no verified reviews and articles are written as the brand.

## Images and alt text

- Alt text describes what's actually in the image and why it's there: "A filled-in week on the calendar with its sections labeled: daily schedule, meal plan, grocery list…". Not "calendar image", not keyword lists.
- Purely decorative images (badges, icons beside a label) use `alt=""`.
- Always set `width` and `height`; use the existing responsive `.webp` sizes in `public/images/` where possible.
- `npm run check:site` fails on any `<img>` without an `alt` attribute.

## Indexing rules

- Article, pillar and hub pages are indexable; the companion app (`/app/…`) and `/start` stay `noindex`.
- Pillar pages are built only when the pillar has at least one published article.
- The hub is `noindex` and out of the sitemap until the first article is published, so search engines never see an empty library.
- Drafts (`draft: true`) render in `npm run dev` only and are never built for production.

## Quality standards

An article is ready to publish only if all of these are true:

- [ ] It satisfies the primary intent better than the current top results, in a way the brief can name.
- [ ] The answer is visible within the first screen or two on a phone.
- [ ] It contains a routine someone could follow today without buying anything.
- [ ] It has a fallback for a bad week.
- [ ] Every factual claim is either common knowledge or linked to a reputable source. No invented statistics, studies, quotes, testimonials or first-person stories.
- [ ] Every product mention is verified (see [ARTICLE_FORMAT.md](ARTICLE_FORMAT.md#product-notes)) and secondary to the advice.
- [ ] Internal links follow [INTERNAL_LINKING.md](INTERNAL_LINKING.md).
- [ ] Its Pinterest plan is complete at `docs/editorial/pinterest/{ID}.md` (see [PINTEREST_STRATEGY.md](PINTEREST_STRATEGY.md)); Pinterest keywords were researched separately from Google.
- [ ] `npm run verify` passes.
- [ ] Read on a phone-width screen: no horizontal scrolling, tables fit, nothing feels like filler.
