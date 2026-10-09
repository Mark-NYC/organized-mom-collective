# Article workflow

The exact process for taking one article from the tracker to published. One article at a time: finish step 7 before starting the next.

Related: [CONTENT_TRACKER.md](CONTENT_TRACKER.md) · [ARTICLE_FORMAT.md](ARTICLE_FORMAT.md) · [SEO_STRATEGY.md](SEO_STRATEGY.md) · [INTERNAL_LINKING.md](INTERNAL_LINKING.md) · [BRAND_VOICE.md](BRAND_VOICE.md).

## 0. Pick the article

- Take the next article by priority from [CONTENT_TRACKER.md](CONTENT_TRACKER.md) (status `Planned`). Follow the recommended order in [CONTENT_CLUSTERS.md](CONTENT_CLUSTERS.md#priority) unless told otherwise.
- Read its row in [CONTENT_CLUSTERS.md](CONTENT_CLUSTERS.md): primary intent, relationships, overlap boundary.

## 1. Research

1. Search the primary query (and one or two variants). Review the top results as described in [SEO_STRATEGY.md](SEO_STRATEGY.md#search-intent-research): intent type, dominant format, table stakes, gaps, related questions, who ranks.
2. **Overlap check:** read the frontmatter and headings of every published article in `src/content/articles/` and the overlap boundaries in CONTENT_CLUSTERS.md. If this article would answer a query another article already answers, stop and resolve it (sharpen, merge, or move the boundary) before writing.
3. **Product check:** if the article will mention a product, confirm each feature against the verified list in [ARTICLE_FORMAT.md](ARTICLE_FORMAT.md#product-notes) (and the app or listing images if it isn't listed).

## 2. Brief

Copy [templates/brief.md](templates/brief.md) to `docs/editorial/briefs/<ID>-<slug>.md` (e.g. `CR-01-weekly-cleaning-schedule-for-busy-moms.md`) and fill it in: intent, keywords, competing content with links, differentiation, The Shift, outline, internal links, product CTA, overlap check.

Set the tracker status to `Briefed`.

**Gate:** if a person is directing the work, share the brief and wait for approval before drafting.

## 3. Outline

In the brief's Structure section, list the sections in [ARTICLE_FORMAT.md](ARTICLE_FORMAT.md#structure-in-order) order with their actual headings:

- The tension line and the short answer (write these now, word for word).
- The Shift title and its one-sentence argument.
- The Real-Life Version steps or checklist items.
- The visual element.
- The When Life Happens scenarios.
- The Next Small Win action.
- Every internal link: parent, siblings, bridge, next, and which are not yet published.

Check that the short answer satisfies the search intent on its own, and that any curiosity loop closes within the next section.

## 4. Write

1. Copy [templates/article.mdx](templates/article.mdx) to `src/content/articles/<slug>.mdx`. Keep `draft: true` while writing.
2. Fill in the frontmatter from the brief (`trackerId`, titles, description, pillar, keyword, related, next, cta).
3. Write the body following the outline, [ARTICLE_FORMAT.md](ARTICLE_FORMAT.md) and [BRAND_VOICE.md](BRAND_VOICE.md).
4. Preview with `npm run dev` at `http://localhost:4321/resources/<slug>` (drafts render in dev only). Check it at phone width.
5. Self-edit against the "Never" list in BRAND_VOICE.md: cut filler, hype, invented claims, generic advice. Read it out loud.

Set the tracker status to `Drafted`.

## 5. Implement links

Follow [INTERNAL_LINKING.md](INTERNAL_LINKING.md#maintaining-incoming-links):

1. Body links in the new article: parent pillar guide + at least one more published article.
2. Add the new article to its pillar guide (and the pillar guide's `related` if appropriate).
3. Add contextual links from one or two older related articles.
4. Update `next` / `related` on older articles that were waiting for this one.

## 6. Validate

1. Set `draft: false`, `published` to today's date (YYYY-MM-DD).
2. In [CONTENT_TRACKER.md](CONTENT_TRACKER.md), set status `Published` and the same date in Published.
3. Run:

   ```sh
   npm run verify    # astro check + build + check:site + unit tests
   ```

   Fix every error. `check:site` verifies links, anchors, alt text, H1/title/description/canonical, JSON-LD, the sitemap, two body links per article, and that the article matches its tracker row. It also regenerates [content-inventory.md](content-inventory.md).
4. Review the built page (`npm run preview`) at phone and desktop width: answer visible early, tables fit, components render, Read next and related cards make sense.
5. Run through the quality checklist in [SEO_STRATEGY.md](SEO_STRATEGY.md#quality-standards).

## 7. Publish

1. Commit the article, the brief, the tracker update, link changes in older articles, and the regenerated `content-inventory.md` together:

   ```
   Publish CR-01: A Weekly Cleaning Schedule for Busy Moms
   ```

2. Push to the working branch and open a pull request if asked. The site is static; deploying `dist/` publishes it.
3. After deploy, spot-check the live URL and request indexing in Google Search Console if you have access (submit `/sitemap.xml` once).

## Updating a published article

- Change the advice → set `updated` to today and note the change in the commit message.
- Fix typos → no `updated` change.
- Never change a published slug. If an article must be retired, keep its URL and point readers to the replacement in the body.
