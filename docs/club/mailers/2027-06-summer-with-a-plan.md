# June 2027 mailer: Summer With a Plan

**Status (2026-10-23): design draft for owner review. Not printed, not quoted, not sent.** Kit config: `src/data/club/kits/2027-06-summer-with-a-plan.ts`; the printable twin is the kit's "This month's letter" (`LetterSheets` in `src/components/club/print/LetterPrintables.tsx`), the same component as the other three-part kits.

**One sheet, two sides:** a double-sided 8.5 × 11 in letter, sent flat in a quality envelope. One letter, four family decisions, two optional tools. Useful without scanning: the front is a complete family activity on its own.

Mailer cutoff 2027-05-15, mail drop around 2027-05-20, kit opens 2027-06-01.

## Internal reuse assessment

What the repository already had, and what June uses.

| Question | Answer |
| --- | --- |
| 1. Summer Rhythm Builder | The public **routine chart** (`/routine-chart`, `RoutineChart.astro` + `routine-chart.ts`). It's the site's family routine generator: illustrated steps from the responsibility library, editing on the sheet, reordering, colors, US Letter PNG, and the Club handoff August already uses (a child's name, age, their own saved chart). The FP-21 article *Summer Routine Chart for Kids* already sends readers there for "summer steps". The homeschool rhythm (`/homeschool-rhythm`) was the other candidate: a page-inline weekly grid of school blocks, no illustrations, no handoff, so not a fit for a child-readable daily flow. |
| 2. Screen Time Agreement Builder | The public **screen time contract** (`/screen-time-contract`), already listed in the tools directory as "Family screen time agreement". |
| 3. What already worked | Routine chart: types with starter steps, picture steps by age, times, notes (buyers' version), reorder, colors, autosave, PNG, Club handoff. Screen time contract: jobs first, activities that earn screen time, tick boxes, signatures, chips, autosave, PNG. |
| 4. What was incomplete | Routine chart: no summer type (the FP-21 article promised one), no way to say "morning" instead of a clock time, no structure or focus choices. Screen time contract: only the earn-it model; nothing on when screens are on, how much, where devices go, how screen time ends, or what grown-ups agree to; no ages; written inline in the page, so the Club couldn't host it without copying it. |
| 5. What June improved, in the canonical tools | Routine chart: a **Summer** type with three quick answers (who it's for, mostly home or camp, relaxed / balanced / more structured, what needs attention) that write a few daily anchors (Morning, Midday, Afternoon, Evening) in place of clock times; rough times only for "more structured". Screen time: moved into a shared component with a second format, a **family agreement**, with starter wording for ages 3–5, 6–12 and teens; the earn-it contract is unchanged and remains the public page's default. |
| 6. Shared between public and Club | Each tool is one component and one behavior module, used by both its public page and its Club page (`/club/tools/routine-chart`, `/club/tools/screen-time`). The kit only passes a handoff (child's name and age, the starting type or format). Public URLs, SEO copy, saved sheets (`omc:routine-chart:v1`, `omc:screen-time:v1`) and the sitemap are unchanged. |

**Between the tools:** shared household data (the child's name and age from the profile) is the integration. They also share words: the rhythm's screen line reads "Screen time (our agreement)", and the agreement's 6–12 wording starts with "In the afternoon, after quiet time", matching the rhythm's afternoon. No syncing, no overwriting: each saves on its own.

## Design

The Club stationery with June's one touch (`mailer.accent: 'summer'`): a fine-line sun, sage rays around a pale apricot center, above the title and beside the back heading. Apricot panels for the agreement, a soft blue gear tip and calendar note. No beach balls, no neon, no activity calendar. The front sits a little tighter (the agreement has a writing line under each decision).

## Front

1. **Header:** ORGANIZED FAMILY CLUB · JUNE 2027, then the sun.
2. **Title:** Summer With a Plan. **Subtitle:** More freedom for the kids. Less managing for Mom.
3. **The letter: Summer Doesn't Need a Schedule for Every Hour** (157 words with greeting and sign-off). **A draft for Megan to approve or rewrite.** No guilt, no anti-technology message, no assumption of a parent at home all day, no pressure to plan activities. "Hi Ana," when her first name is on her profile; otherwise "Hi friend,".

   > There's something wonderful about summer: later mornings, unhurried afternoons, an adventure nobody planned. That freedom is worth protecting.
   >
   > But summer can wear a family out when one person is expected to entertain everyone, manage the screens, settle the arguments and remind every child about every job, whether that person is home all day or fitting it around work.
   >
   > The answer isn't a schedule for every hour. It's a few simple rhythms everyone agrees on, so everyone knows what to expect.
   >
   > Kids can have freedom and still help keep the house running. They can enjoy screens and respect the limits you choose together. They can be bored for a while without anyone rushing to fix it.
   >
   > The four decisions below take about fifteen minutes together. The goal is a summer that works for the whole family, including Mom.
   >
   > At dinner this week, ask: "What would make this summer really good for each of us?"
   >
   > Warmly, *Megan*

4. **Our Summer Family Agreement** (apricot panel). "Sit down together for ten or fifteen minutes. Write what you decide on the lines; you can change it later." Four checkboxes, each with a sentence and a **We decided ______** line:
   1. **Choose our daily anchors.** Two or three predictable moments: getting ready, lunch, quiet reading or an evening reset. Not every hour.
   2. **Agree on screen-time expectations.** When screens are available, what happens first, and how screen time ends.
   3. **Share summer responsibilities.** A job for everyone that keeps going when school is out.
   4. **Choose something fun.** Ask everyone what they'd love to do. Pick one realistic plan and put it on the calendar.

   Online: check decisions off, write the answers, saved, and print her own copy. No dashboard, tracker or schedule.

## Back

1. **A Little Structure. A Lot of Summer.** **Keep a few predictable anchors.** Children benefit from knowing what to expect without needing every hour scheduled. **Agree before the argument.** Discuss screens and household responsibilities together before conflicts arise. **Leave room for boredom.** Children don't need Mom to provide an activity every time they have nothing to do.
2. **When I'm Bored…** a small card with a dashed edge to cut out for the fridge: read something, make or draw something, play outside, build something, help someone, invite someone to play.
3. **Before the summer adventures begin** (beside it, optional): "Check water bottles, sunscreen, swim gear, and the supplies your family regularly takes outdoors."
4. **Your Summer Toolkit:** one QR code beside "Two optional tools on this month's page. Scan the code; use either one, or both." then **Build Your Summer Rhythm**, A simple daily flow that fits your family's summer, and **Make Your Family Screen Agreement**, Agree on screen-time expectations before the daily negotiations begin. **organizedmomcollective.com/club/kits/2027-06-summer-with-a-plan**. The code encodes `https://www.organizedmomcollective.com/club/kits/2027-06-summer-with-a-plan?source=mailer`, verified by decoding the printed code. One code, not two: the kit page holds both tools.
5. **On the family calendar:** Add camps, activities, trips, and family plans to your calendar. Let the summer rhythm handle the ordinary days in between.

## The kit page

Header (June 2027, title, subtitle, Read this month's letter); **Our Summer Family Agreement**; **Your Summer Toolkit** ("Two optional tools. Each works on its own…"), two cards: **Summer Rhythm Builder** (Create a simple daily rhythm that helps your kids know what to expect. · Build Our Summer Rhythm) and **Family Screen Time Agreement** (Set clear expectations together so screens don't become a daily argument. · Make Our Screen Agreement). With several children, each asks who it's for (or "Someone else" for a family version), as August's routine chart does. Then the printed letter.

## The tools, as June uses them

- **Summer Rhythm Builder** (`/routine-chart`, Summer type). Who it's for (ages 3–5, 6–12, teens; from the child's age), their days (mostly home, or camp or a program), how much structure (relaxed: five steps; balanced, the default: eight; more structured: eight with rough times), what needs attention (optional: morning routines, independent activities, outdoor play, reading, household responsibilities, rest, screen-time boundaries). The chart shows Morning, Midday, Afternoon, Evening where the times would be. Steps keep a summer job and an evening reset in every balanced day; library jobs get their illustrations; the evening ends with "Lights out by" for the age. Everything stays editable: reword, reorder, remove, add, colors; a new answer asks before replacing her edits. One chart per child (or one for the family); prints one US Letter page.
- **Family Screen Time Agreement** (`/screen-time-contract`, agreement format). When screens are on (weekdays, weekends), how much (always left for the family to fill in), before screens (four tick boxes), where devices go, when screen time ends (three steps), what grown-ups agree to (three commitments), "If something isn't working, we'll change it together. We'll check in on ______", signatures for the child, a parent and the date. Starter wording for ages 3–5, 6–12 and teens (a teen's: wrap up on my own, ask, don't argue; grown-ups: trust you to manage your own time). One agreement per child, or one for the family; prints one US Letter page.

## Not the other months

May closes out school; August gets ready for it. July will have its own focus on connection and independence. June is ordinary summer days: no school routines, no summer planner, no activity grid; camps and trips stay on the wall calendar.

## Open questions

- Megan's approval or rewrite of the letter.
- The rhythm's steps and the agreement's starter wording are defaults to tune with a family test.
- Whether the public routine chart's page should mention the Summer type in its intro copy (unchanged for now, to keep SEO copy as it is).
- The mail-house quote (D1, D9), same format as August.
