# Article workflow

The exact process for taking one article from the tracker to published, including its Pinterest plan. One article at a time: finish step 8 before starting the next. **Every article has two required deliverables: the article and its Pinterest plan.** An article without a complete plan fails `npm run check:site`.

Related: [CONTENT_TRACKER.md](CONTENT_TRACKER.md) · [ARTICLE_FORMAT.md](ARTICLE_FORMAT.md) · [SEO_STRATEGY.md](SEO_STRATEGY.md) · [PINTEREST_STRATEGY.md](PINTEREST_STRATEGY.md) · [INTERNAL_LINKING.md](INTERNAL_LINKING.md) · [BRAND_VOICE.md](BRAND_VOICE.md).

## Before you start: pick the article

- Take the next article by priority from [CONTENT_TRACKER.md](CONTENT_TRACKER.md) (status `Planned`), following the recommended order in [CONTENT_CLUSTERS.md](CONTENT_CLUSTERS.md#priority) unless told otherwise.
- Read its row in [CONTENT_CLUSTERS.md](CONTENT_CLUSTERS.md): primary intent, relationships, overlap boundary.

## 1. Research Google search intent and Pinterest search intent

Two separate passes. Don't assume a phrase has the same demand or meaning on both platforms.

**Google** ([SEO_STRATEGY.md](SEO_STRATEGY.md#search-intent-research)): search the primary query and one or two variants; record intent type, dominant format, table stakes, gaps, related questions, who ranks.

**Pinterest** ([PINTEREST_STRATEGY.md](PINTEREST_STRATEGY.md#pinterest-keyword-research)): autocomplete, guided search terms, top pin formats, Pinterest Trends if available, board names. Record what you observed and the date. These notes go into the Pinterest plan in step 5; keep them in the brief's appendix until then.

Never record search volumes, engagement figures or trends a tool didn't show.

Also:

- **Overlap check:** read the frontmatter and headings of every published article in `src/content/articles/` and the overlap boundaries in CONTENT_CLUSTERS.md. If this article would answer a query another one already answers, resolve it (sharpen, merge, or move the boundary) before writing.
- **Product check:** if the article will mention a product, confirm each feature against the verified list in [ARTICLE_FORMAT.md](ARTICLE_FORMAT.md#product-notes) (and the companion website or listing images if it isn't listed).

## 2. Develop the editorial brief

Copy [templates/brief.md](templates/brief.md) to `docs/editorial/briefs/<ID>-<slug>.md` (e.g. `HC-01-weekly-cleaning-schedule-for-busy-moms.md`) and fill it in: intent, keywords, competing content with links, differentiation, The Shift, the outline in [ARTICLE_FORMAT.md](ARTICLE_FORMAT.md#structure-in-order) order (tension and short answer word for word, Shift, Real-Life Version steps, visual, When Life Happens scenarios, Next Small Win), internal links, product CTA, overlap check, and the Pinterest research notes.

Check that the short answer satisfies the search intent on its own, and that any curiosity loop closes within the next section.

Set the tracker status to `Briefed`.

**Gate:** if a person is directing the work, share the brief and wait for approval before drafting.

## 3. Write and implement the article

1. Copy [templates/article.mdx](templates/article.mdx) to `src/content/articles/<slug>.mdx`. Keep `draft: true` while writing.
2. Fill in the frontmatter from the brief (`trackerId`, titles, description, pillar, keyword, related, next, cta).
3. Write the body following the brief, [ARTICLE_FORMAT.md](ARTICLE_FORMAT.md) and [BRAND_VOICE.md](BRAND_VOICE.md).
4. Preview with `npm run dev` at `http://localhost:4321/resources/<slug>` (drafts render in dev only). Check it at phone width.
5. Self-edit against the "Never" list in BRAND_VOICE.md: cut filler, hype, invented claims, generic advice. Read it out loud.
6. Set `draft: false` and `published` to the publication date (YYYY-MM-DD). Run `npm run build` and review the built page (`npm run preview`) at phone and desktop width.

Set the tracker status to `Drafted` while writing; it becomes `Published` in step 6.

## 4. Develop three Pinterest concepts from the finished article

Only now, with the article's final text in front of you. Follow [PINTEREST_STRATEGY.md](PINTEREST_STRATEGY.md#the-three-pins):

1. **Search-driven:** targets the primary Pinterest keyword and promises the answer the article gives.
2. **Curiosity-driven:** a truthful hook, usually from The Shift, that the article answers early.
3. **Save-worthy:** the article's checklist, routine, framework or mini-guide, copied exactly.

For each, note where the article delivers the promise (heading or anchor). If a concept promises something the article doesn't deliver, change the concept, or improve the article and re-run step 3's checks. **Concepts reflect the final article, not the brief or outline.**

## 5. Save the full Pinterest plan

Copy [templates/pinterest-plan.md](templates/pinterest-plan.md) to `docs/editorial/pinterest/{ARTICLE_ID}.md` (e.g. `pinterest/HC-01.md`) and complete every field: article ID, title and final URL; Pinterest research (from step 1); audience and search/save intent; for each pin the exact text overlay, complete image-generation prompt, production notes, Pinterest title, description, alt text, board, asset filename and status (`planned`); the publishing sequence.

Check the plan against the visual identity, readability, product-imagery and pin-copy rules in PINTEREST_STRATEGY.md.

## 6. Add the Pinterest production status to the content tracker

In [CONTENT_TRACKER.md](CONTENT_TRACKER.md), on the article's row:

- Status → `Published`, Published → the same date as the frontmatter.
- Pinterest plan → `Yes`.
- Pins (search / curiosity / save) → the three statuses from the plan, e.g. `planned / planned / planned`.

Update the Pins column (and the plan) every time a pin moves to `generated`, `reviewed` or `published`.

## 7. Update relevant internal article links

Follow [INTERNAL_LINKING.md](INTERNAL_LINKING.md#maintaining-incoming-links):

1. Body links in the new article: parent pillar guide (or hub article) + at least one more published article.
2. Add the new article to its pillar guide (and the pillar guide's `related` if appropriate).
3. Add contextual links from one or two older related articles.
4. Update `next` / `related` on older articles that were waiting for this one, and the tracker's Target links notes.

If an older article's content changes meaningfully, re-check its Pinterest plan: pins must still match what that article says.

## 8. Run site verification and commit

1. Run:

   ```sh
   npm run verify    # astro check + build + check:site + unit tests
   ```

   Fix every error. `check:site` verifies links, anchors, alt text, H1/title/description/canonical, JSON-LD, the sitemap, two body links per article, the article ↔ tracker match, and the Pinterest plan (exists, three complete pins, matches the tracker). It regenerates [content-inventory.md](content-inventory.md).
2. Run through the quality checklist in [SEO_STRATEGY.md](SEO_STRATEGY.md#quality-standards).
3. Commit together: the article, the brief, the Pinterest plan, the tracker update, link changes in older articles, and the regenerated `content-inventory.md`:

   ```
   Publish HC-01: A Weekly Cleaning Schedule for Busy Moms
   ```

4. Push to the working branch and open a pull request if asked. The site is static; deploying `dist/` publishes it.
5. After deploy, spot-check the live URL. Submit `/sitemap.xml` to Google Search Console once, if you have access. Pins are produced and published from the plan on its own schedule (see the plan's publishing sequence); record each status change in the plan and the tracker.

## Updating a published article

- Change the advice → set `updated` to today, note the change in the commit message, and re-check the Pinterest plan (add a line to its review log; regenerate any pin whose promise or copied content no longer matches).
- Fix typos → no `updated` change.
- Never change a published slug. If an article must be retired, keep its URL and point readers to the replacement in the body.
