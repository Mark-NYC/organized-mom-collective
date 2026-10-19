# Brief: IF-03 chores-for-kids-by-age

- **Pillar:** Intentional Family Life (pillar guide? no)
- **URL:** /resources/chores-for-kids-by-age (short address `/chores-for-kids-by-age` 308s here; one page, one canonical)
- **Researched:** 2026-10-19
- **Direction:** Owner request 2026-10-19: rebuild IF-03 as "Kids’ Responsibility Chart by Age (Free Printable)": ages 2–12 in four bands with 8–12 jobs each (independent vs with help), a no-nagging section, an FAQ (age appropriateness, motivation, rewards, how many), an infographic (HTML + 1000 × 1500 PNG + printable PDF), a free US Letter starter chart offered through the existing download signup, a "Make Your Own Chore Chart" link to /chore-chart and a Kids’ Responsibility Cards section. Improve the existing page; no duplicate. This supersedes the 2026-10-13 short generator-first brief. The owner's explicit sections override ARTICLE_FORMAT's 300–600-word default and SEO_STRATEGY's "don't bolt on an FAQ"; prose is kept tight and the job lists carry the length. No FAQPage schema (SEO_STRATEGY: not used on purpose).

## Search intent

Primary query: *chores for kids by age*. Intent type: list/template with a printable. She wants to know what her child can realistically do now, and a chart to start.

Secondary keywords (use naturally): age appropriate chores, kids responsibility chart, printable chore chart, chores for 6 year olds, chores for 8 year olds. Former primary "free chore chart generator" stays served by the generator section and /chore-chart itself.

Related questions: how many chores should a child have; should kids be paid for chores; how to get kids to do chores without nagging; what chores can a 6-/8-year-old do.

## What currently ranks (Google, web search 2026-10-19)

- Outschool — age lists framed as executive-function skills (https://outschool.com/articles/age-appropriate-chores-for-kids)
- Merry Maids — short age lists from a cleaning company (https://merrymaids.com/cleaning-tips/tidy-home/age-appropriate-chores-for-kids)
- Baby Chick — toddler-to-teen lists (https://www.baby-chick.com/chores-for-kids-bests-lists-that-are-good-for-each-age/)
- Cleanipedia — brand guide with chart (https://www.cleanipedia.com/za/family/chore-chart-for-kids-by-age.html)
- Several auto-generated near-duplicate pages also appear.

Table stakes: age bands with lists; a printable. Gaps: few separate "on their own" from "with help"; little on how to teach so the chart replaces reminders; no fallback for missed days.

## Differentiation

- **The Shift:** Age tells you what’s possible; practice tells you what’s ready. The list is a menu, not a test.
- Every band split into independent vs with-help jobs; a three-job starter chart with a "when" per job; a teach-then-step-back routine and a missed-day fallback; the real illustrated responsibility artwork.

## Structure

1. Tension: dinner plates, “Can someone help?” (kept from the earlier version; scheduled pins reuse it).
2. Short answer: the four bands in one bolded sentence, then “Pick three, teach them, put them on a chart.”
3. Free chart panel (primary CTA “Get the Free Responsibility Chart”).
4. At a glance: infographic (HTML; PDF and PNG links).
5. The Shift.
6. Age-by-age H3s with two data-driven checklists each (`src/data/chores-by-age.ts`).
7. Real-Life Version: How to teach responsibility without nagging (five steps), the 7-year-old example (same three jobs the approved IF-03 pins show), "Make Your Own Chore Chart".
8. When Life Happens: missed day, busy week, pushback.
9. FAQ (H2 + six H3s).
10. Product section: Kids’ Responsibility Cards preview, “Coming soon” (no listing, no price).
11. Bridges, Next Small Win, save-worthy pin.

## Internal links

- Parent: IF-01 (body). Sibling: IF-02 (body). Bridge: FP-09 morning routine chart (body). Next: HC-02.
- Incoming: IF-01, IF-02, FP-09 already link here.

## Product CTA

`none` in frontmatter (CalendarBridge renders). Product section: Kids’ Responsibility Cards — verified in `src/data/responsibility-cards.ts`: physical cards, each with illustration, title and three how-to steps; not on sale (`pageUrl: null`), so no price, availability date or buy link. Only titles and art shown, never steps or layouts.

## Overlap check

Published articles reviewed. FP-09 owns the school-morning routine chart; IF-02 owns whole-task handoffs; HC-02 owns the daily cleaning reset. /chore-chart (tool page) targets "picture chore chart by age"; the article targets the informational list and links to the tool. Decision: rebuild IF-03 in place, keep the slug.

## Claims

Job lists are presented as starting points, not milestones; no developmental studies cited or implied. Safety-adjacent jobs (knives, stove, cleaners, dishwasher) assigned to "with help". The 7-year-old example is illustrative.

## Pinterest research notes

Web query `site:pinterest.com kids responsibility chart by age` (2026-10-19) returned no pinterest.com pages; results were printable kits (e.g. Payhip, 101planners) using toddler / preschool / 6–8 / 9–12 bands. Native Pinterest autocomplete, guided search and Trends were not checked. Keywords are hypotheses until validated in Pinterest.
