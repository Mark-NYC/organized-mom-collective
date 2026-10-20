# Brief: FP-14 digital-wall-calendar-vs-paper-calendar

- **Pillar:** Family Planning & Routines (pillar guide? no)
- **URL:** /resources/digital-wall-calendar-vs-paper-calendar
- **Researched:** 2026-10-20
- **Decision:** a dedicated digital wall calendar display, a paper wall calendar, or a hybrid. Buyer is a mom deciding whether a screen on the wall solves her family's calendar problem.

## Overlap gate (run first)

The instruction: if the Google results for this article's target query match the pages ranking for FP-15's Skylight query, stop and merge.

Live web searches, 2026-10-20, same tool and session:

| Query | What ranks |
| --- | --- |
| digital wall calendar vs paper calendar | Mango Display (display software seller) category and blog pages, incl. "Why Digital Calendar Displays Are Better Than Paper" and "The 3 different types of wall calendars and their pros and cons"; Cal State Fullerton news summary of a paper-vs-digital planning study; an academic workshop paper (ceur-ws.org); a promotional-products blog on paper wall calendars; filler PDFs |
| digital family calendar display | Invisible Computers (e-paper wall calendar, shop page); Mango Display pages (×6); filler pages titled "Digital Calendar Hearth", "Hearth Digital Calendar", "Digital Calendar Display" on hijacked domains |
| skylight calendar vs paper calendar (FP-15) | Skylight's own compare page (myskylight.com/compare-calendars); single-brand "Skylight review" pages, several scraped or on hijacked domains |
| is skylight calendar worth it (FP-15) | Nine near-identical "Is Skylight Calendar Worth It" filler pages on hijacked domains |

**Result: zero URL overlap.** The category query returns category pages (types of wall calendars, display software, a planning study); the Skylight queries return single-brand pages. Different searches, so no merge. Proceed.

**What FP-14 owns that FP-11 and FP-15 don't:**

- **FP-11** (`wall-calendar-vs-digital-calendar-for-families`) owns paper vs. *digital calendars in general*: shared phone calendars (Google, Cozi), reminders, edit alerts, hybrid. It never discusses buying hardware for the wall.
- **FP-15** (Skylight vs. paper, briefed, not drafted) owns *one brand's* worth-it question.
- **FP-14 owns the category of wall-mounted digital calendar displays** (dedicated touchscreens, e-paper frames, display software on a TV or tablet): whether that *purchase* beats a paper wall calendar, what to check before buying any of them, and the hybrid (a display or phones for appointments, paper for this week's family plan). It doesn't re-teach FP-11's phone-calendar comparison; it links to it for "should we go digital at all".
- **FP-12** (planned) is the command-center setup roundup; **FP-02** owns calendar setup; **FP-03** the physical spot. FP-14 teaches none of those.

## Search intent

Primary query: *digital wall calendar vs paper calendar*. Validation query: *digital family calendar display*. Intent: comparison / pre-purchase. In one sentence: is a screen on the wall worth buying, or does paper do the job?

Secondary keywords: digital family calendar display; digital wall calendar; family wall calendar; paper wall calendar; digital calendar display for family.

Related questions (from result titles, no "People also ask" box was shown to the tool): are digital calendar displays better than paper; types of wall calendars; do paper calendars help us plan better.

## What currently ranks

- Mango Display: vendor pages arguing displays beat paper (sync with Google, Outlook, Apple; no crossing out). Seller, so advice is shaped by the product. https://mangodisplay.com/2025/12/20/why-digital-calendar-displays-are-better-than-paper
- Invisible Computers: e-paper family wall calendar product page. https://shop.invisible-computers.com/pages/a-digital-wall-calendar-with-e-paper-display
- Cal State Fullerton news: summary of a paper vs. digital planning study. https://news.fullerton.edu/spotlight/digital-calendars-are-the-norm-in-2023-but-do-paper-calendars-help-us-plan-better (search snippet only, not fetched; not cited in the article)
- Promopunks: paper wall calendar "ambient visibility" angle. https://promopunks.com/blogs/news/the-calendar-paradox-why-paper-still-wins-in-digital-offices

Table stakes: sync with phone calendars, cost, visibility, writing by hand vs. typing.

Gaps: almost every ranking page sells one side. Nobody says when paper is enough, nobody gives a test to run before spending, and nobody covers the hybrid in practical terms.

## Differentiation

- **The Shift:** "A screen fixes updating. It doesn't fix looking." Choose by the bottleneck: keeping the plan current, or getting the family to use it.
- A neutral, vendor-free answer; a "check before you buy" list instead of unverified prices; a two-week free test before spending.

## Structure

1. Tension: practice moved by text at 2 pm; the phone knows, the fridge calendar still says 4:00, and that's what the kids read.
2. First H2: "Should you get a digital wall calendar or a paper one?" Short answer ≤100 words, by use case: digital wins with frequent changes, adults on phone calendars, nobody wanting to hand-write; paper is enough for steady weeks where the problem is nobody looking; hybrid; don't switch if it works.
3. The Shift (as above).
4. Table: digital display vs. paper across changes away from home, upfront cost, ongoing cost, kids reading tomorrow, writing on it, meals/lists, power/Wi-Fi, what goes stale.
5. Checklist: "Check before you buy a display" (price for the size, which calendars it connects to, which features need a paid plan, outlet and Wi-Fi, who can add events).
6. Real-Life Version: "Test both before you buy": count changes, note who asks, test a free shared phone calendar, test paper, pick or go hybrid.
7. When Life Happens: screen and paper disagree; display nobody checks; paper stale by Wednesday.
8. Product CTA (`calendar`): printed 11 × 17 weekly calendar, prices imported from `src/config.ts`, companion cleaning website, no sync.
9. Next Small Win: a week-long tally of schedule changes and where each came from.

## Internal links

- Parent: FP-01 (body link in first half; FP-01 gets a child link back)
- Siblings: FP-11 (body link; FP-11 gets an incoming link), FP-04 (weekly reset, body)
- Next: FP-02
- Incoming to add: FP-01, FP-11
- Not yet published (link later): FP-15 Skylight (link both ways once it ships), FP-12

## Product CTA

`calendar`: verified against ARTICLE_FORMAT.md → Product notes; prices rendered from `CALENDAR_OPTIONS` in `src/config.ts`. States it doesn't sync with or replace a digital calendar.

## Claim log

Rule: every product fact from the maker's own site, fetched this session, cited inline, "as of October 2026". Unverifiable means omitted; name only products verified as currently sold.

| Claim | Official source | Date | Tested or documented | Status |
| --- | --- | --- | --- | --- |
| Skylight models, prices, subscription, sync sources | myskylight.com | 2026-10-20 | — | **Not verified.** Host blocked by the environment's network policy (proxy CONNECT 403; WebFetch DNS failure) |
| Hearth Display models, prices, subscription, sync sources | hearth.com / hearthdisplay.com | 2026-10-20 | — | **Not verified.** Blocked |
| Mango Display, Invisible Computers | their sites | 2026-10-20 | — | **Not verified.** Blocked (seen only in search snippets) |
| OMC calendar prices | `src/config.ts` | 2026-10-20 | Repository | Verified, imported |
| OMC calendar does not sync | ARTICLE_FORMAT.md, PRODUCT_ROADMAP.md | 2026-10-20 | Repository | Verified |

**Consequence for the draft:** no product is named and no product price, plan or sync list appears. The article describes the category in general terms and gives a check-before-you-buy list. When the hosts are allowlisted, a dated, cited "as of October 2026" fact table can be added as an update.

## Pinterest research notes

- Researched on: 2026-10-20
- pinterest.com and trends.pinterest.com are unreachable from this environment (WebFetch DNS failure; proxy blocks the hosts). A `site:pinterest.com` web search returned no pinterest.com pages.
- Autocomplete, guided terms, top pin formats, Trends: **not observed.** Keywords in the plan are hypotheses, labeled as such.
