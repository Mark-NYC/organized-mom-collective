# Brief: FP-17 skylight-calendar-vs-paper-wall-calendar

- **Pillar:** Family Planning & Routines (pillar guide? no)
- **URL:** /resources/skylight-calendar-vs-paper-wall-calendar
- **Researched:** 2026-10-19 (Google), 2026-10-20 (Google re-run, Skylight sources, Pinterest)
- **ID note:** Requested as FP-13, but FP-13 is the published `after-school-routine-for-kids`. Filed as FP-14, renumbered FP-15 when FP-14 went to the category guide, then FP-17 when the owner assigned FP-15 to the "best family wall calendars for 2027" roundup.
- **Status:** Unblocked 2026-10-20 when network access opened and Skylight's own pages were fetched. Drafted and published the same day.

## Overlap check

Published articles reviewed: FP-02, FP-03, FP-11, FP-14, FP-15 (headings, short answers, tables).

- **FP-11** owns paper vs. phone calendars (Google, Cozi, hybrid). No hardware.
- **FP-14** owns the display category vs. paper, with a two-row Skylight/Hearth price table and a "test both" checklist.
- **FP-15** is the roundup; Skylight is one row of six.
- **FP-17 owns the single-brand purchase:** which Skylight jobs are free, which need Calendar Plus, what a paper calendar covers instead, and first-year cost for one family. The tool (sort your jobs into free / Plus / paper) and the job table appear nowhere else. It doesn't repeat FP-14's "test both" steps or its category table; it links up to FP-14 for other displays and to FP-15 for other calendars.
- FP-02 (setup) and FP-03 (the spot) untouched.

Decision: distinct intent; proceed. Primary keyword `skylight calendar vs paper calendar` is unique in the library.

## Search intent

Primary query: *skylight calendar vs paper calendar*. Validation: *is skylight calendar worth it*. Intent: pre-purchase decision on one named product. She's looking at a Skylight and wants to know whether it solves a problem paper doesn't, for the money, and whether she'd need the subscription.

Secondary keywords: is skylight calendar worth it; skylight calendar subscription; skylight calendar plus; skylight calendar alternative; family wall calendar.

Related questions (result titles; no "People also ask" box shown to the tool): skylight calendar subscription cost; how does skylight calendar work; skylight calendar reviews reddit; skylight calendar at Costco.

## What currently ranks (WebSearch, 2026-10-19 and 2026-10-20)

- Skylight's own comparison page (https://myskylight.com/compare-calendars).
- Single-brand "Skylight review" pages, several scraped or on hijacked domains.
- For "is skylight calendar worth it": nine near-identical filler pages on hijacked domains (iris.londoncouncils.gov.uk, chw.dhis2.org, track.ctrader.com and others) that contradict each other on price ($149.99/$279.99 vs. "$170 to $630"; subscription "$39" vs. "$79 a year").

Table stakes: device price, whether the subscription is needed, sync sources, who it's for.

Gaps: no ranking page is dated and sourced; none maps the free vs. Plus features to family jobs; none says when paper is enough.

## Differentiation

- The tool: sort the jobs the wall must do into free on Skylight, needs Calendar Plus, or covered by paper.
- Dated primary-source facts only, an honest disclosure (we make a paper calendar; we haven't tested a Skylight), and a plain "a Skylight wins when…" list.

## Structure (interactive guide layout)

1. `quick`: "6 min" · "Sort your jobs: free, Plus or paper" · jump `#checklist`. Inline photo: Kaboompics 2368 (kitchen chalkboard week), cropped to remove a branded coffee machine; fetched via the photo-request workflow and cleared 2026-10-20; exclusive to FP-17. No hero: the photo is portrait.
2. Tension: practice moved in a group text; is a screen the fix?
3. First H2 (required): "Is a Skylight Calendar worth it, or is a paper wall calendar enough?" Short answer ≤100 words by use case, bold lead.
4. StepChecklist "Free, Plus or paper?": list what the wall shows; mark phone-synced items; mark chores and lists; mark meals and school emails; price the first year.
5. Tip "Before you buy": Wi-Fi at all times, an outlet, 4-month returns.
6. Table: job × Skylight × paper (6 rows), sourced.
7. First-year cost for one family: Calendar 2, 10", OMC full-year from `src/config.ts`.
8. SplitList: where each one wins. Parent link to FP-01.
9. When Life Happens: nobody checks the Skylight; paper stale by Wednesday.
10. Make it part of your week: FP-14, FP-15, /chore-chart.
11. ProductCTA (`calendar`), prices imported, no sync.
12. Next Small Win: list what people asked about; circle what started on a phone.

## Internal links

- Parent: FP-01 (body). FP-01 gets a child link.
- Siblings: FP-14, FP-15 (body, related). Both get incoming links. FP-11 in `related`.
- Next: FP-02.
- Free tool: /chore-chart.

## Product CTA

`calendar`: ARTICLE_FORMAT.md → Product notes; prices rendered from `CALENDAR_OPTIONS` in `src/config.ts`. States it doesn't sync with a phone or replace a digital calendar.

## Claim log

All fetched with curl from myskylight.com on 2026-10-20 (compare page fetched twice the same day, unchanged). Documented only, not tested.

| Claim | Source | Status |
| --- | --- | --- |
| 10" $149.99 (countertop placement), 15" refurbished memory $229.99, 15" Calendar 2 $299.99, 27" Calendar Max $569.99, all "Starting at" | https://myskylight.com/compare-calendars | Verified |
| Free on every model: auto-sync with Google, Apple, Outlook, Cozi (FAQ adds Yahoo, Readdle, public links); Chore Chart & Task Manager; Custom Lists; mobile app | https://myskylight.com/compare-calendars | Verified |
| Calendar Plus $79/year: Sidekick email import, photo and video screensaver, meal planning, rewards (stars), Disney Mode | https://myskylight.com/products/calendar-skylight-plus | Verified |
| Rewards and meal planning are subscription features; Tasks Manager is free | compare page FAQ | Verified |
| Needs Wi-Fi at all times; must be plugged in to an outlet | https://myskylight.com/products/skylight-calendar (FAQ) | Verified |
| Full refund within 4 months for purchases on myskylight.com | https://myskylight.com/products/skylight-calendar (FAQ) | Verified |
| First-year totals $378.99 (Calendar 2 + Plus) and $228.99 (10" + Plus) | Arithmetic on the verified prices | Verified |
| OMC prices; no sync | `src/config.ts`; ARTICLE_FORMAT.md, PRODUCT_ROADMAP.md | Verified |

Left out on purpose: the "3-year replacement" promise (reliability-adjacent), "used in over 1 million homes" (vendor claim), the first-free-month bundle terms (varies by option), any review or quality claim.

## Pinterest research notes

Logged-out pinterest.com search pages in headless Chromium, 2026-10-20; screenshots inspected. Autocomplete not observed (behind the login modal; not bypassed). Trends not checked.

- "skylight calendar" guided terms: Wall ideas, Hacks, Wall ideas decor, Reward ideas, Color palette, Styling, Command center, Ideas, Tips, Display ideas, Screensaver, Decor, Chores kids, Family command center, Wallpaper, Aesthetic, Frame diy, Frame, Wall, Kitchen, Background, Placement, Diy, Max wall ideas, Max.
- "skylight calendar worth it", "skylight calendar alternative", "skylight calendar vs paper": no guided terms shown.
- Top pins for "worth it": first-person review graphics ("Is It Worth the Money? Skylight Calendar Review", "The Ultimate Skylight Calendar Review", "How My Family Uses the Skylight Calendar", "Skylight: Is It Worth It?").
- Top pins for "alternative": "14 Alternatives to the Skylight Calendar" (SlashGear), "Skylight Calendar Alternatives", "Best Digital Calendar Overall? Cozyla vs Skylight vs Echo Show 15", "How to Build Your Own Digital Wall Calendar".
- Gap: no pin we saw breaks down free vs. Plus, or offers paper as the alternative.

Hero: Skylight press-kit BB-01 (week view, white background), white canvas extended to 3:2 with the product unaltered, captioned "Image: Skylight" as the kit fact sheet asks. Owner-cleared 2026-10-20; the kit has no written license for competitor sites and Skylight wasn't contacted. FP-17 only; never in pins.
