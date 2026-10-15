# Resource article audit: 2026-10-15

Scope: all **17** `src/content/articles/*.mdx` files currently present on the repository's default branch (excluding .gitkeep), with frontmatter, article intros, headings, body links and key components inspected. Earlier generated `content-inventory.md` states **16 published**, so regenerate inventory and reconcile its timing with the recently added FP-11 before treating that count as current.

**Audit limitations:** This is a repository-content review, not a live visual QA, not an instrumented generator test, not a Google Search Console/GA4 audit, and not independent verification of all article body claims. Priority labels are recommended editorial work, not proof of broken functionality. Every article currently shows a usable opening answer, and inspected files have at least two resource links by simple string count. No performance rankings are asserted.

## Across the library
- **Preserve:** short-answer-first writing, practical bad-week fallbacks, cross-article links, tangible household routines, the shared-responsibility theme and verified-product policy.
- **Do first:** reconcile 17 article files vs generated inventory's 16, inspect the October monthly-project behavior over all twelve months, and verify the new calendar comparison's factual scope.
- **Improve:** a few articles explain routines well but would benefit from a single concrete completed example or copyable template; avoid repeating generic 'Mom shouldn't do it alone' language without a specific handoff.
- **Tool pages:** generator articles intentionally don't use all default Shift/RealLifeVersion components. Judge them by what they let readers accomplish, and test the real flow rather than imposing decorative prose.
- **Images:** zero photographs is not a defect; add images only if they teach, clarify or help a user recognize the task. Audit repeated or redundant images before adding any.
- **Measurement:** no connected GSC, Pinterest or conversion data reviewed here. Traffic, CTR, AI citations and conversions remain **unknown**. Don't call a page a leak or gap without evidence.
- **Process:** do not change slugs. If body changes substantially, check the corresponding Pinterest plan and update the actual article's `updated` date.

## Article-by-article queue

| ID | Article slug | Priority | Finding and next action |
|---|---|---|---|
| FP-01 | [how-to-organize-your-familys-week](../../src/content/articles/how-to-organize-your-familys-week.mdx) | P2 | Strong hub and shared ownership; differentiate from FP-04 with a clearly visible four-part overview and links to each task. |
| FP-02 | [how-to-organize-a-family-calendar](../../src/content/articles/how-to-organize-a-family-calendar.mdx) | P2 | Strong early answer; add a filled entry example and verify product-calendar image remains accurate. |
| FP-03 | [home-command-center](../../src/content/articles/home-command-center.mdx) | P2 | Strong paper-in/paper-out insight; add one compact realistic layout/diagram or pictured example. |
| FP-04 | [weekly-family-reset](../../src/content/articles/weekly-family-reset.mdx) | P2 | Good 15-minute decision routine; make the exact meeting agenda especially easy to screenshot. |
| FP-05 | [weekly-meal-planning-for-families](../../src/content/articles/weekly-meal-planning-for-families.mdx) | P2 | Strong night-first method; five Figure references warrant image duplication/relevance review and mobile inspection. |
| FP-06 | [grocery-list-from-meal-plan](../../src/content/articles/grocery-list-from-meal-plan.mdx) | P2 | Strong practical list method; add optional printable or explicit reusable list format if it genuinely helps. |
| FP-08 | [where-does-my-time-go](../../src/content/articles/where-does-my-time-go.mdx) | P2 | Useful three-day tally; no article photo, and an actual tally example/template could improve utility. |
| FP-09 | [morning-routine-chart-generator](../../src/content/articles/morning-routine-chart-generator.mdx) | P2 | Actual free generator is the value; keep format exception, test generator flow and downloadable output, check whether title matches user intent. |
| FP-10 | [launch-pad-by-the-door](../../src/content/articles/launch-pad-by-the-door.mdx) | P2 | Specific and actionable; missing Shift component is not inherently a defect, but a photograph or quick layout would help. |
| FP-11 | [wall-calendar-vs-digital-calendar-for-families](../../src/content/articles/wall-calendar-vs-digital-calendar-for-families.mdx) | P1 | High-intent comparison; verify both options against same real family scenario and check all feature claims/decision tradeoffs; newly published, no performance inference. |
| HC-01 | [weekly-cleaning-schedule-for-busy-moms](../../src/content/articles/weekly-cleaning-schedule-for-busy-moms.mdx) | P2 | Strong printable data-driven routine; verify that schedule and cleaning companion still match. |
| HC-02 | [daily-cleaning-routine](../../src/content/articles/daily-cleaning-routine.mdx) | P2 | Concrete five-task reset; check Pinterest embed relevance and current cleaning task data. |
| HC-03 | [zone-cleaning-schedule](../../src/content/articles/zone-cleaning-schedule.mdx) | P2 | Strong time-boxed zones; verify task source and Pinterest content match. |
| HC-04 | [monthly-deep-cleaning-schedule](../../src/content/articles/monthly-deep-cleaning-schedule.mdx) | P1 | Verify seasonal/month project example is correct in all twelve months, colors match monthly theme, and checklist/projects actually line up with companion. |
| IF-01 | [intentional-family-life](../../src/content/articles/intentional-family-life.mdx) | P2 | Strong values-to-week bridge; verify two photos are distinct, useful, and avoid visual redundancy. |
| IF-02 | [how-to-share-the-mental-load](../../src/content/articles/how-to-share-the-mental-load.mdx) | P2 | Clear full-job ownership; add a single worked handoff example readers could reuse. |
| IF-03 | [chores-for-kids-by-age](../../src/content/articles/chores-for-kids-by-age.mdx) | P2 | Free generator is primary value; test generated chores by age, editing, download, and whether article promises match tool. |

## Fix log (2026-10-15)

- FP-11: **Edited and committed.** Corrected the implication that all digital calendars automatically alert people to event edits; clarified Google Family Calendar's default behavior and Cozi Gold's change alerts, improved household decision test and pillar link, and added official-source claim log to the brief. Still needs deployed-page/mobile check.
- HC-04: **Edited and committed.** Aligned Friday, Saturday and Sunday descriptions with the actual cleaning program's named weekend zones and clarified that the current-month checklist follows the reader's device. Shared data source confirmed by repository inspection. Twelve-month rendered/browser QA remains pending.
- `npm run verify`, rendered screenshots, Search Console review and generator functional checks: **not run** in this connector-only pass.

## Immediate execution order
1. Run existing verification and regenerate inventory; check publication statuses and any missing documentation.
2. Review the updated FP-11 comparison at phone size; its official-source claim log is now saved.
3. Test HC-04's current-month card in January through December; its source data and weekend labels have been reconciled.
4. Check FP-09 and IF-03 generator flows on phone, including downloads, and match promises to behavior.
5. Prioritize worked examples for IF-02 and FP-08; photo relevance review for FP-05 and IF-01.
6. After 28+ days of meaningful Search Console data, rank real query-level gaps/leaks and revisit priorities.

## Repeatable audit columns
Date | ID | canonical URL | intent and query | evidence from GSC | current answer | first-party value | worked example | shared ownership | real tool link | accurate product claims | internal links | image/alt | Pinterest alignment | priority | specific change | owner/status | follow-up result.
