# Internal linking

How articles link to each other and to the products, so every page leads somewhere useful and the library reads as one guide. The planned links per article are in [CONTENT_CLUSTERS.md](CONTENT_CLUSTERS.md) and the "Target links" column of [CONTENT_TRACKER.md](CONTENT_TRACKER.md). The actual links are generated into [content-inventory.md](content-inventory.md) by `npm run check:site`.

## Link types

### 1. Parent links (up to the pillar guide)
- Every cluster article links to its **pillar guide** once in the body, in the first half, where the broader system is relevant ("This is one part of [a simple weekly cleaning schedule](/resources/weekly-cleaning-schedule-for-busy-moms)").
- The template also adds breadcrumbs (Resources › Pillar) and an "All … articles" link to the pillar page. These don't replace the contextual link.
- A pillar guide's own parent is its pillar page; breadcrumbs cover it.

### 2. Child links (down from the pillar guide)
- A pillar guide links to **every published article in its cluster**, each in the section it expands on.
- When a new cluster article is published, add its link to the pillar guide in the same change. This is the most important maintenance rule.

### 3. Sibling links (across the cluster)
- 1–2 links to other articles in the same cluster where one genuinely continues the other (the calendar article mentions the weekly check → link to the weekly reset).
- Set `related` in frontmatter to up to three articles, most relevant first: siblings and bridges. These render as cards at the end.

### 4. Next-step link
- Exactly one `next` article in frontmatter: the natural thing to do after Your Next Small Win. Planned in [CONTENT_CLUSTERS.md](CONTENT_CLUSTERS.md).
- If the planned next article isn't published yet, use the best published alternative (usually the pillar guide) and note it in the tracker so it's updated later.

### 5. Bridge links (across clusters)
- At most one or two per article, only where real life connects the topics (weekly reset → meal planning; kitchen reset → fridge check before planning; chores → mental load).
- Usually a one-sentence bridge just before the product note.

### 6. Product links
- Only through `<ProductNote>`, at most once per article, never before the Real-Life Version. The component supplies the link: `/app/reorder` for the calendar, `/app` for the companion app.
- No product links in headings, the short answer, The Shift or Your Next Small Win.
- Set `cta` in frontmatter to the product mentioned (`none` if there's no note).

## Body link minimum

Every article has **at least two contextual links to other published articles in the body** (parent + one more). `npm run check:site` fails otherwise. Until fewer than three articles are published, the minimum is the number of other published articles.

## Anchor text

- Describe what she'll get, in words that fit the sentence: "[plan next week's meals](/resources/weekly-meal-planning-for-families)".
- Never "click here", "this post", "read more", or a bare URL.
- Vary the wording across articles; don't repeat the target's exact title or keyword every time.
- One link per target per article. Don't link the same article twice in the body.

## URL format

- Root-relative, no trailing slash, no domain: `/resources/<slug>`, `/resources/<slug>#the-real-life-version`.
- Use the anchors the components create when pointing at a routine or fallback: `#the-real-life-version`, `#when-life-happens`.
- Never link to an article that isn't published (`draft: true` or not yet written). The link check fails on it. Write the sentence without a link and add the link when the target ships (record it in the tracker's Target links).

## Maintaining incoming links

Every published article should be linked from at least two other articles: its pillar guide and one sibling or bridge. When you publish an article:

1. Add its link to the **pillar guide** (child link).
2. Add it to **one or two older articles** that mention its topic, as a contextual link where it genuinely helps, and to their `related` lists if it's a better fit than what's there.
3. Check the tracker's Target links for older articles that were waiting on this one ("→ link when published") and add those links.
4. Update `next` on any article whose planned next step was this one.
5. Run `npm run build && npm run check:site`. It regenerates [content-inventory.md](content-inventory.md) and warns about any article with no incoming body links.

When an article's slug or topic changes (avoid it), update every incoming link in the same commit; the link check catches anything missed.

## Checks

`npm run check:site` (after `npm run build`) fails on broken internal links and anchors, fewer than two body links to other articles, and articles out of sync with the tracker; it warns on articles with no incoming body links. See `scripts/check-site.mjs`.
