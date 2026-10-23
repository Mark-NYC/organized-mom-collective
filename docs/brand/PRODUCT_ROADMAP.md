# OMC Product and Growth Roadmap

Status: Strategic direction as of October 13, 2026. **Proposed phases, not release dates or customer entitlements.** Use actual repo code, checkout configuration and tests for shipped status.

Read first: [VISION.md](VISION.md), [../editorial/BRAND_VOICE.md](../editorial/BRAND_VOICE.md), [../../README.md](../../README.md).

## North star

Mom shouldn't have to manage everything alone. Reduce both (1) fragmented family schedules and (2) invisible planning and coordination that falls to one parent.

**Two places, one family system:** digital consolidation for incoming information; a physical wall calendar for family-wide visibility and participation. Achieve practical shared responsibility through clear routines and ownership, not just another screen.

## Guiding philosophy: organized moms raise organized families

The product journey should help households move from mom as the default keeper of every plan and task toward family members who can see, learn and own their part. This is a behavior-change goal, not an existing product feature or promised result.

- **Promise:** Mom doesn't have to manage everything alone.
- **Philosophy:** Organized moms raise organized families.
- **Outcome:** A home where everyone knows the plan and plays a part.
- Design the wall calendar and coaching so family members can consult the plan without asking mom.
- Test shared weekly rhythms, age-appropriate child ownership and end-to-end partner responsibility. Don't build a system that makes mom assign, chase and approve every step.
- Evaluate future app features by whether they transfer coordination and ownership to the family, rather than merely creating a more powerful dashboard for mom.

## Phase 0: Initial physical offer and trust (current focus)

- Sell the printed **11 × 17 inch weekly wall calendar**, bundled with access to the **cleaning companion website**.
- Clearly explain the printed sections and the verified website's daily / weekly cleaning routines.
- Do **not** call the companion an app in customer-facing copy; do not imply it syncs with the paper calendar.
- Make Etsy and any enabled direct-shop checkout accurate; respect the real purchase/access flow.
- Gather authentic customer feedback, usage observations, objections and reviews with consent.
- Confirm that the target audience (suburban moms 25–35 with school-aged children and activity-heavy weeks) feels the two problems acutely; don't presume product-market fit.

## Parked: the older-kids command center

Owner decision, October 13, 2026: **establish the family wall calendar as the primary product for the primary audience first.** The **Own Your Row Family Calendar System** (Etsy search name: Family Activity Calendar; on the site still the Family Sanity Saver Starter Kit) for moms with kids roughly 10+ in lots of activities ([VISION.md → Secondary audience](VISION.md#secondary-audience-future-de-emphasized)) stays in the background:

- Kept on the site but not promoted: the landing page says "Coming soon", the shop product is switched off, and nothing in the main site links to it.
- When it's revived, rename the URL, page and shop product to the new names in one change.
- Its calendar is the 2025–2026 edition. Don't refresh it or build for it until the wall calendar is established.
- Future build idea, not started: generate her calendar instead of reissuing a dated PDF. She enters names and recurring activities once (as on `/try-the-calendar`), picks a 12-month range, and downloads it as one PDF, recurring activities included. Decide first whether it uses the kit's week-rows design or the tool's monthly grid.

## Shelved (off the roadmap)

Kept for reference only, not planned. Don't build or mention in customer copy.

- **The Seasonal Family Table** (meal planning from the previous site): [archive/seasonal-family-table.md](archive/seasonal-family-table.md).
- **Freemium cleaning companion** (seasonal maps free, "VIP" tier paid, from the previous site): retired. The companion stays a full bonus for calendar owners. [archive/fall-cleaning-map-freemium.md](archive/fall-cleaning-map-freemium.md).

## Phase 1: Brand, discovery and owned audience (next growth work)

- Apply [VISION.md](VISION.md) and [../editorial/BRAND_VOICE.md](../editorial/BRAND_VOICE.md) to homepage, product pages, articles, Pins and emails.
- Keep **three editorial pillars**, not four competing taxonomies: Family Planning & Routines; Simple Home Cleaning; Intentional Family Life. Across each, recur to three messages: **get it out of your head; get everyone involved; make home life easier**.
- Use existing Real-Life Reset article workflow, keyword research, photo-clearance rules, internal links and per-article Pinterest plans.
- Proposed test cadence, subject to capacity and results: ~2 SEO articles/week, ~15–25 Pins/week repackaged from content, 1 helpful email/week, up to 5 personalized creator outreaches/week. Do not present these numbers as validated optimal performance.
- Build an email opt-in with a genuinely useful resource for school/activity-heavy families, test landing-page signup rate and create a practical welcome series.
- **Seasonal cleaning checklists as free Pinterest offers** (idea, not built): a free fall reset checklist and a spring cleaning checklist on the public site, each a printable with an email opt-in. Path: seasonal Pins → checklist page → email → calendar plus cleaning companion. Publish ahead of each season's search interest and verify timing with real Pinterest Trends data, not assumptions. Build each one as a full family task list (age-appropriate kid tasks, whole zones a partner owns) so it shows the brand's "get everyone involved" promise. Free and ungated: no paid tier, and nothing gated inside the companion. Starting material: the retired [3-zone fall cleaning map](archive/fall-cleaning-map-freemium.md). Measure signups and calendar sales per checklist, not Pin impressions.
- Prioritize Pinterest + SEO discovery, an owned email relationship, and micro-creator partnerships; Etsy and the direct site are conversion destinations when checkout is live.
- Reuse winners based on qualified traffic, subscribers, conversion and actual sales, not impressions alone.
- **Customer accounts, step 1 (built 2026-10-21, switched off until launch):** sign in with an emailed code, saved tools synced across devices, website purchases with permanent downloads, a separate marketing opt-in. Asked at the moment she'd lose something she made, never as a wall. Launch gates (a published privacy policy first) and setup: [../../supabase/ACCOUNTS.md](../../supabase/ACCOUNTS.md). Don't advertise it until it's switched on. Step 2, companion progress sync, waits for step 1's numbers: share of tool users who save, and share who finish signing in.

## Phase 2: Shared family habits and retention (validate before building)

- Test a simple Sunday/weekly setup ritual: review schedules, meals and responsibilities together.
- Explore age-appropriate child participation and partner ownership of whole tasks, not mom delegating every individual step.
- Make the cleaning companion more useful based on actual behavior and customer requests, while avoiding inflated product claims.
- Consider recurring email guidance or lightweight challenges *only if* users want them. Don't launch a community just to have one.
- Learn what repeat value customers would genuinely pay for before choosing a subscription.

## Proposed: Organized Family Club (planning, not launched)

**Status: Exploring. Not built, not for sale, not to be mentioned in customer copy.** Owner proposal, October 22, 2026; architecture and plan in [../club/IMPLEMENTATION_PLAN.md](../club/IMPLEMENTATION_PLAN.md), curriculum in [../club/YEAR_ONE_CALENDAR.md](../club/YEAR_ONE_CALENDAR.md).

- A monthly membership (working hypothesis: $5/month including the printed mailer, until fulfillment quotes are in) adding to the calendar business, not replacing it.
- **One letter, one action, one tool** (owner direction, 2026-10-23): each month a small printed letter (the centerpiece: Megan's letter, one practical action, short guidance, a QR code), one family action that's useful on paper, and one optional personalized tool online. The wall calendar stays the family's plan; the Club is never a second planner or homework for Mom. She saves her family once (first names, ages, roles; children never get accounts). Every built month has this shape now (June with two optional tools; November with a short guided conversation in the kit instead of a tool, and September's kit as a bonus for new members).
- Twelve themes, November to October, each moving one area of family life onto someone else's row ([YEAR_ONE_CALENDAR.md](../club/YEAR_ONE_CALENDAR.md)).
- **Depends on:** customer accounts step 1 being live (and `/privacy` published), Stripe subscriptions (none exist today), a mail house, and the decisions listed in the plan.
- **Proposed order:** private digital beta of the November kit with a small group of families, then a first paid month (December or January, set by the mail house's turnaround) once the beta, billing tests and mailer production pass. Phase 1 (the November kit, family form, dashboard and printing, plus the database migration) and the August 2027 kit (Ready for the School Year) are built behind a switched-off flag, previewed only with made-up sample families; nothing is published, applied or linked. This is the Phase 4 subscription hypothesis tested with real families, not a validated product.
- Free tools stay free; Club kits link to them rather than duplicating them.

## Phase 3: Integrated digital family system (future, not promised)

Explore a daily digital hub for:
- Importing family events from Google/Apple calendars, subject to technical feasibility, permission and privacy review.
- Bringing in school, sports and club information; a forwarded family inbox is a potential initial approach, not a built capability.
- Reviewing changes, coordinating schedules, preparing the coming week and tracking relevant cleaning/household routines.
- Clear “Sunday Setup” workflow, with the printable wall view as the shared family reference.
- Low-friction onboarding, mobile accessibility, notifications only when helpful, and privacy-safe data handling.

Decide whether the physical display is manually updated, printable, or connected based on customer needs and actual implementation. **Do not assert automatic wall-calendar synchronization**, especially for a paper calendar.

## Phase 4: Monetization options (hypotheses)

- Physical calendar editions, bundles and repeat annual/half-year purchases.
- Useful standalone digital resources where they solve a distinct problem.
- Subscription only if an ongoing digital service earns repeat usage and willingness to pay.
- Creator referral programs only after reliable attribution, discount and payout operations exist.
- Evaluate unit margins, retention, activation and support load. Never advertise recurring features before they are live.

## Release gates and customer honesty

Before any feature appears in sales copy, confirm implementation, QA, authentication/access rules if needed, availability, support and purchase entitlements. Distinguish **Live / In progress / Exploring / Not planned** in internal tracking. A roadmap mention is **not** an available benefit.

Avoid claims of guaranteed calmer homes, automatic shared chores, invented testimonials or fabricated founder experiences.

## Priorities for decision-making

1. Does it reduce work for a mom rather than create more setup?
2. Does it make family participation easier, not only her personal efficiency?
3. Is it immediately useful to school-aged, activity-heavy families?
4. Does the current product actually do what we say?
5. Can we test demand cheaply before building complexity?
6. Does it create a durable customer relationship, not only social reach?

Update this file when discoveries change the priorities. Keep shipped-state truth in the README and code.
