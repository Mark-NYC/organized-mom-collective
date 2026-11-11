# Scout: search opportunity research

Owner: Organized Mom Collective editorial. First run: 2026-11-03.

Scout is the *research gate* before any new SEO article, article refresh or search-led Pinterest idea. It does not write, publish or schedule content. Use this alongside [SEARCH_OPPORTUNITY_LOOP.md](SEARCH_OPPORTUNITY_LOOP.md), [SEO_STRATEGY.md](SEO_STRATEGY.md), [ARTICLE_WORKFLOW.md](ARTICLE_WORKFLOW.md), and the [Pinterest strategy](PINTEREST_STRATEGY.md). Those docs remain authoritative.

## Weekly run: research → compare → queue → approve

1. **Inventory first.** Read all `src/content/articles/*.mdx` frontmatter and headings, `docs/editorial/CONTENT_TRACKER.md`, `docs/editorial/CONTENT_CLUSTERS.md`, `docs/editorial/content-inventory.md`, existing generators/routes under `src/pages/`, and Pinterest queue/tracker records. Include planned and draft coverage. Never infer a missing topic from a title alone.
2. **Look at measured demand.** When exports are available, examine Search Console query and page performance over 28 and 90 days; retain dates, page, clicks, impressions, CTR and position. Never manufacture volumes, difficulty or ranking changes. If data is not connected, label candidates as qualitative research, not proven opportunities.
3. **Research live Google results.** For each candidate, capture query, date, search intent, dominant formats, competitor/source URLs, recurring questions and a concrete gap. Check whether video is a natural result type, but don't demand a video by default. Research Pinterest independently using its autocomplete/results or documented search access; absence of Pinterest research must be marked `not checked`, not assumed.
4. **Duplicate and cannibalization gate.** Compare against existing article bodies, primary keywords, planned articles, tools and pin queue. Prefer `refresh-existing` or `tool-landing-page` over a new article if the intent is already served. If two pages would target the same query, stop and document how to merge or distinguish them. Never silently change a published URL.
5. **Prioritize.** Rate *fit* to mom-with-school-age-kids, *intent* match, *unique practical usefulness*, *ability to bring a family into shared responsibility*, *existing assets*, and *effort*. These are editorial judgments, not measured SEO scores. Every recommendation must name what OMC alone can deliver and a reader's next step.
6. **Queue five, at most.** Write/update [SCOUT_QUEUE.md](SCOUT_QUEUE.md) with evidence and statuses; mark previously proposed ideas as duplicates, superseded or completed rather than repeatedly resurfacing them. Protect the tracker from unapproved content ideas: don't add a formal article ID until approval and a full overlap check.
7. **Hand off only after approval.** A new article follows the existing brief → article → Pinterest plan → tracker → verification gates, one article at a time. The Pinterest plan is drafted from the *finished* article, never invented from the Scout outline. A refresh follows editorial QA and updates links/metadata only when justified. Link proposed pins to real approved destinations, not placeholders.
8. **Review outcomes.** For implemented recommendations, log the affected URL, change date, baseline Search Console data (if available), and a 28-day follow-up. Report unknown outcomes as unknown.

## Status vocabulary

- `researched`: supported enough to discuss; no publication approved
- `approved`: assigned for editorial brief or existing-page fix
- `briefed`: an editorial brief exists; the article workflow takes over
- `in-progress`: active work tracked elsewhere
- `done`: released and verified
- `hold`: lacks evidence or depends on a missing feature
- `superseded`: merged into another idea or existing page

## Required queue entry

Each candidate must include: unique ID, status, primary query, secondary queries, user intent, action (`new-article`, `refresh-existing`, `tool-landing-page`, or `hold`), existing URLs and overlap boundary, candidate landing page, unique OMC contribution, evidence links with date, Pinterest research status, conversion/next step, and a clear reason for ranking. Do not add fake search volumes.

## Editorial constraints

- Don't mass-produce 1,500-word/seven-step/FAQ-schema posts. Follow OMC's short, helpful interactive guide rules. FAQPage schema is not a default.
- No unverified product, Club, shipping, conversion or traffic claims.
- No invented personal stories, first-party experience or backlink opportunities.
- No automatic writing, pushing to production, Pinterest scheduling or external outreach without approval.
- The calendar and Club are distinct offers. Respect cleaning-companion access boundaries and the current product behavior.
- Keep genuinely useful existing pages instead of changing them just to keep a content calendar full.
