# September 2027 mailer: A Week Everyone Can See

**Status (2026-10-23): design draft for owner review. Not printed, not quoted, not sent.** Kit config: `src/data/club/kits/2027-09-a-week-everyone-can-see.ts`; the printable twin is the kit's "This month's letter" (`LetterSheets` in `src/components/club/print/LetterPrintables.tsx`).

**The brief arrived cut off at section 11 (visual direction).** Everything from the back page onward (back-page contents, the digital kit's tool copy and button, the calendar note) is **placeholder copy in the brand voice**, marked below, for the owner to confirm or replace.

**One sheet, two sides:** a double-sided 8.5 × 11 in letter, sent flat in a quality envelope. One letter, one 15-minute meeting, one optional meeting guide. Useful without scanning: the family can run the meeting straight from the front.

Mailer cutoff 2027-08-15, mail drop around 2027-08-20, kit opens 2027-09-01.

## Audit: what the site already had

| Looked for | Found | Used? |
| --- | --- | --- |
| Weekly reset tools | `/weekly-reset` (and `/weekly-reset-simple`): the paid $9 Weekly Reset System landing pages | Untouched. The Club tool is a free meeting guide, deliberately named apart (`family-reset`) |
| Weekly planning components | `/planner` (`WeeklyPlanner.astro`): a weekly planner grid | Not used: it would be a second calendar |
| Family meeting guides | The FP-04 article *The Weekly Family Reset: 15 Minutes to Plan the Week*: a static five-step checklist (check the week, rides, dinners, extra jobs, one priority) | Its shape and timing reused in the agenda rules |
| Wall calendar structure | The calendar product page and ARTICLE_FORMAT: daily schedule, cleaning zone, self-care, word of the week, family and friends, grateful for, meal plan, grocery list, to-do list | The guide names only real sections: daily schedule, meal plan, grocery list, to-do list |
| Shared generator pieces | Who's helping (`household-helpers`, `HelpersEditor`), printing, palettes, saving, the Club handoff | Reused |

## Design

The Club stationery with September's touch (`mailer.accent: 'calendar'`): a fine-line wall calendar page in sage with one day marked in pale apricot. Sage panels, an apricot calendar note. The front sits a little tighter (five steps with a sentence each and a meeting-day line). *Visual direction beyond the brief's first line is inferred from the earlier months.*

## Front

1. **Header:** ORGANIZED FAMILY CLUB · SEPTEMBER 2027, then the calendar page.
2. **Title:** A Week Everyone Can See. **Subtitle:** One family. One calendar. Everyone knows the plan.
3. **The letter: You Don't Have to Remember Everything** (164 words with greeting and sign-off). **A draft for Megan to approve or rewrite.** No guilt, no criticism of husbands or children, no two-parent assumption, nothing unrealistic for little ones.

   > When life gets busy, it's easy for one person to become the keeper of everyone's schedule. Mom remembers the appointments, checks the school emails, knows who's picking up whom, thinks about dinner, and reminds everyone what comes next.
   >
   > Even with a calendar on the wall, she can still be the only one carrying the plan.
   >
   > A family calendar works best when the whole family uses it, and a short weekly meeting is a simple way to start. Everyone sees what's coming, adds what they know, and takes their part. Children learn to look ahead to their own activities and get their things ready. The grown-ups in the house own whole jobs instead of waiting to be told.
   >
   > Mom doesn't need to be the family's walking calendar. The calendar can do that, for everyone.
   >
   > The meeting below takes about fifteen minutes. Start this week.
   >
   > At dinner this week, ask: "What's one thing happening this week that everyone needs to know about?"
   >
   > Warmly, *Megan*

4. **Our First 15-Minute Family Meeting** (sage panel): "One short conversation. One shared plan." Note: "The minutes are a guide. With little ones, keep it shorter; a big household may need a little longer." **Our family meeting day and time ______**, then five checkboxes:
   1. **Gather around the calendar. (3 min)** Everyone where they can see the wall calendar. Each person shares one important thing coming up.
   2. **Look at the week ahead. (4 min)** School, appointments, practices, family events. Add anything missing to the calendar.
   3. **Decide who's doing what. (3 min)** Rides, getting ready for activities, important jobs. A whole job each, not reminders.
   4. **Make the week easier. (3 min)** On the busiest days: simple meals in the meal plan, the grocery list, what can be ready ahead.
   5. **Ask who needs help. (2 min)** Everyone says what they need. Make final changes to the calendar, and you're done.

## Back (placeholder copy)

1. **The Calendar Is Everyone's.** Everyone brings something. / Owners, not reminders. / Short beats perfect.
2. **Taking part, by age:** 3–5 point to one thing on the calendar they're looking forward to · 6–9 name one thing to remember and get their own bag ready · 10–12 read the week aloud, lead a step, pack for their activities · 13+ add their own plans, flag clashes, say which rides they need.
3. **Take turns leading** (beside it): the meeting doesn't have to be Mom's; a young child can lead by asking the first question; a teen can guide the whole thing.
4. **Ask at dinner this week:** *What's one thing happening this week that everyone needs to know about?*
5. **Make Your Family Weekly Reset:** QR code, "Tell us who's taking part and what makes your weeks busy. We'll make a one-page, 15-minute meeting guide to keep beside the calendar. Scan the code, then tap "Build Our Weekly Reset."", and **organizedmomcollective.com/club/kits/2027-09-a-week-everyone-can-see** (encodes `…?source=mailer`, verified by decoding).
6. **On the family calendar:** Keep the meeting guide beside the calendar. Write the week's plans, meals, groceries and to-dos where everyone can see them.

## The Family Weekly Reset Builder

Component `src/components/site/FamilyResetBuilder.astro` + `family-reset-builder.ts`, rules `src/data/family-reset.ts`. Hosted at `/club/tools/family-reset`; no public page yet. Kit copy (placeholder): **Make Your Family Weekly Reset** · "Tell us who's taking part, what makes your weeks busy, and when you'll meet. We'll make a 15-minute guide to keep by the calendar." · **Build Our Weekly Reset**.

- **Three questions (and who leads).** Who's taking part (the family profile, or add people; not everyone has to come every week). What makes your weeks complicated (school, activities, transportation, meals and groceries, household responsibilities, appointments, work schedules, something else in her words): these only change the steps' words. When you meet (Sunday, Friday, Saturday or another day, optional time). Who leads: one person, take turns (this week and next), or decide together.
- **The guide.** Five steps, about 15 minutes: What's happening this week? (3) · Look at the week ahead (4, on the calendar's daily schedule) · Who's doing what? (3, a name beside each job) · What about meals? / Make the week easier (3, meal plan and grocery list, or the to-do list) · Who needs help? (2). Lines for how each person takes part at their age; one question for the family's ages; an optional question of their own.
- **Not Mom by default.** The first leader is an older child (8+) or another grown-up when there is one; leading is described by age (a young child asks the first question; a teen guides it; grown-ups keep the calls that need a grown-up). Single parents: no second adult assumed; rides they can't cover prompt "who to ask: a carpool, a grandparent or a friend".
- **Editing.** Reword, retime, reorder, remove steps; edit the participation lines; change the question, leader, day. New suggestions keep it all. Saved in the browser.
- **Printing.** One US Letter page, generous white space, for a clear sleeve: title, family name, meeting day and time, total minutes, five numbered steps with minutes and short participation lines, the question, this week's leader (and next week's), and "The plan lives on the wall calendar…". No grids, no writing sections, no grocery list.
- **Not in it:** meeting history, attendance, minutes, notifications, assignments tracking, scoring, a calendar or planner.

## Open questions

- **The rest of the brief** (section 11 onward): back page, visual direction, digital kit copy, QA list and deliverables. Placeholders above until it arrives.
- Megan's approval or rewrite of the letter.
- The mail-house quote (D1, D9), same format as August.
