# Organized Family Club: year one editorial calendar

**Status (2026-10-22): proposed curriculum, not for sale; the November kit's configuration is built (`src/data/club/kits/2026-11-family-ownership.ts`), nothing published.** Release and cutoff dates are planning targets. The first paid month and first mailer month are open ([IMPLEMENTATION_PLAN.md → D2](IMPLEMENTATION_PLAN.md#2-decisions-owed-before-building)): December if the mail house's turnaround fits a Nov 15 cutoff, otherwise January. Working price: $5/month including the mailer, until fulfillment quotes are in (D1). Each kit is specified in full with [KIT_TEMPLATE.md](KIT_TEMPLATE.md) before it's built.

## The through-line

One year, one shift: **from Mom running the house to a family that runs it together.** Every kit moves one area of family life onto someone else's row, in an order that builds: first who owns what (November), then protecting time (December), then the daily rhythms (January–June), then independence (July–August), then the weekly habit that holds it all (September), then a look back at what stuck (October). Each kit should leave the family with one thing they keep doing without her, not a one-off activity.

Rules for every month (from [VISION.md](../brand/VISION.md) and [BRAND_VOICE.md](../editorial/BRAND_VOICE.md)): partners own whole jobs, never "help Mom"; kids get age-appropriate ownership; every plan has a fallback for the bad week; no invented statistics, studies, testimonials or experiences; Megan's letter is written by Megan.

## Year at a glance

| Month | Theme | Flagship generator | Engine | Monthly reset (team version of the companion's monthly project in `src/data/cleaning.ts`) | Release (target) | Mailer cutoff (target) |
| --- | --- | --- | --- | --- | --- | --- |
| **Nov 2026** | Our Family, Our Team | Family Ownership Builder | responsibilities | Kitchen & Pantry Reset (companion: Kitchen + Hosting Prep) | Private beta, late Nov | No mailer (beta) |
| **Dec 2026** | Make Room for What Matters | Holiday Teamwork Planner | planning | Holiday Reset + Declutter | Dec 1 (first paid month if D2 allows) | Nov 15 |
| **Jan 2027** | Mornings Without the Mayhem | Morning Routine Builder | routines | Kitchen Reset | Jan 1 | Dec 15 |
| **Feb 2027** | Better Together | Family Connection Planner | planning | Bedrooms + Closets | Feb 1 | Jan 15 |
| **Mar 2027** | Spring Clean as a Team | Family Spring Cleaning Builder | projects + responsibilities | Spring Prep | Mar 1 | Feb 15 |
| **Apr 2027** | Everybody Helps at Mealtime | Meal Responsibility Planner | responsibilities | Windows + Entry | Apr 1 | Mar 15 |
| **May 2027** | Finish the School Year Well | School Year Wrap-Up Builder | planning | Living Areas | May 1 | Apr 15 |
| **Jun 2027** | Summer With a Plan | Summer Rhythm Builder | routines | Outdoor / Summer Prep | Jun 1 | May 15 |
| **Jul 2027** | Ready to Go | Packing and Independence Builder | projects | Kitchen Deep Clean | Jul 1 | Jun 15 |
| **Aug 2027** | Ready for the School Year (built) | Letter + six-line countdown + routine chart tool | responsibilities | Bedrooms + Back-to-School | Aug 1 | Jul 15 |
| **Sep 2027** | A Week Everyone Can See | Sunday Family Reset Builder | planning | Entry + Storage | Sep 1 | Aug 15 |
| **Oct 2027** | A Home That Works Together (built) | Letter + five-line Fall Home Reset + chore chart | responsibilities | Fall Home Reset | Oct 1 | Sep 15 |

Whether December is the first paid month with a mailer depends on the mail house's real proof-to-mail time (D2), not on the placeholder lead times below. If it doesn't fit, December's kit opens digitally for beta families and January becomes the first paid month.

Slugs follow `YYYY-MM-<theme>` and are permanent once printed on a mailer: `2026-11-family-ownership`, `2026-12-holiday-teamwork`, `2027-01-mornings`, `2027-02-better-together`, `2027-03-spring-clean`, `2027-04-mealtime`, `2027-05-school-year-wrap-up`, `2027-06-summer-rhythm`, `2027-07-ready-to-go`, `2027-08-school-launch`, `2027-09-sunday-reset`, `2027-10-home-works-together` (built; replaced the planned `2027-10-follow-through`).

## Kit by kit

Each kit: one flagship generator, two or three complementary worksheets (each useful printed on its own), the monthly team reset, and the mailer (Megan's letter, a field guide, a family activity, the QR code to the kit). Personalization uses only the saved profile: first names, ages for that month, roles, preferences. The kit opens already filled in; nothing asks her another questionnaire beyond, at most, one or two kit-specific choices with defaults (a time, a date).

### November: Our Family, Our Team (MVP)

- **Flagship: Family Ownership Builder.** Recommends household jobs by age; every job has **one owner** (start to finish, including noticing it needs doing), a frequency (daily, a set weekday, weekly, as needed) and an ownership level by age (learning: their job with someone beside them; with-check: theirs start to finish, a coach checks; owns: theirs completely). Adults get whole jobs (dinner on two weeknights, start to finish; the recycling, including knowing pickup day). Editable: reassign, reword, change frequency, hide, add, reorder. Output: **the Family Responsibility Chart**, US Letter landscape, a row per person with their jobs and illustrations, palette choice.
- **Worksheets:** "Who Owns What" conversation card (the family activity's printable); November Kitchen & Pantry Reset (team version, filled with names); a one-page "Handing over a whole job" checklist for the adults.
- **Mailer:** Megan's letter (her words; theme: why ownership beats helping); field guide "Owning a Job, Not Helping With It" (what full ownership means at each age, how to hand a job over once and not take it back, what to do the week it slips); family activity "The Team Meeting" (20 minutes, a script, everyone picks one job to own); QR to the personalized chart.
- **Personalization inputs:** ages, adult/child, account holder, `pets`.
- **Overlap check:** the free `/chore-chart` (one child, one age group) and `/mental-load-worksheet` (one handed-over job) stay free and unchanged; the Club version is whole-family, multi-child, owner-per-job, already filled in.

### December: Make Room for What Matters

- **Flagship: Holiday Teamwork Planner.** The season's jobs (gifts, cards, hosting, travel, school events) as owned projects with a lead per job and a "this is enough" limit per category; dates from the real calendar month.
- **Worksheets:** "Our Big Three" (the three traditions we're keeping), host-day job board, the team Holiday Reset + Declutter.
- **Mailer:** letter on doing fewer things together; field guide on dividing the season so one person isn't the season; activity: family vote on traditions.
- **Overlap check:** free `/december-countdown` and `/holiday-gift-planner` stay free; the kit links to them instead of duplicating.

### January: A Fresh Start, Together (built 2026-10-23, behind the flag)

*One small change. A better rhythm for everyone.* Owner direction, 2026-10-23: replaces "Mornings Without the Mayhem" below for January 2027. Config: `src/data/club/kits/2027-01-fresh-start-together.ts`. Mailer: [mailers/2027-01-fresh-start-together.md](mailers/2027-01-fresh-start-together.md).

- **The letter:** You Don't Need a Whole New Routine (about 170 words): January asks for everything at once; choose one recurring frustration, not all of them. Asks "What's one part of our day that we could make easier for everyone?" A draft for Megan.
- **The action:** Our One-Thing Family Reset, five steps (choose one frustration, agree on a simpler plan, give everyone a part, put it on the calendar, try it for seven days), with "Our one thing this month" written above them. Online: the one thing (a suggestion or her words), a simple plan, an optional start day and its check-in a week later. No tracking.
- **The tool:** the Family Habit Builder, a new site tool: what to make easier, when (tied to something the family already does), who; one editable habit sentence and a seven-day practice card.
- **Back of the letter:** Small Changes That Stick (three principles), one worked example, the family question, the QR code, one calendar note.
- **Not another month:** one rhythm, not a declutter, a responsibility overhaul or a 30-day program.

### January (earlier plan): Mornings Without the Mayhem

- **Flagship: Morning Routine Builder.** Per child: ordered, timed steps from wake-up to out-the-door, sized by age, with the night-before steps they own; adults' morning jobs split, not stacked on one person. Two inputs with defaults: leave-the-house time, wake-up time.
- **Worksheets:** night-before checklist per child, "the late morning" fallback plan (the 10-minute version), team Kitchen Reset.
- **Mailer:** letter on mornings; field guide on teaching a routine once and letting the chart do the reminding; activity: a timed practice run on a weekend morning.
- **Overlap check:** free `/routine-chart` (one routine, typed in) stays free; the kit builds every child's chart at once from ages.

### February: Better Together (built 2026-10-23, behind the flag)

*Less managing life. More enjoying it together.* Owner direction, 2026-10-23: replaces the earlier February plan below. Config: `src/data/club/kits/2027-02-better-together.ts`. Mailer: [mailers/2027-02-better-together.md](mailers/2027-02-better-together.md).

- **The letter:** Make Room for Each Other (about 170 words): you can care for your family all day without enjoying them; organizing is for making room for the people you love; Mom isn't the entertainment director. Asks "What's something you'd love for us to do together more often?" A draft for Megan.
- **The action:** Our Family Connection Challenge, three actions (do something together, one-on-one time with every grown-up taking a turn, one shared space made inviting on its cleaning-zone day), each with an optional "Our idea" line. No dates or scores.
- **The tool:** the Family Connection Planner, a new site tool on the traditions picker's shared idea rules: three ideas (family, one-on-one, a rhythm), swap, edit, choose one, a one-page plan.
- **Back of the letter:** Make Room for Connection (three principles), three conversation prompts, the QR code, one calendar note.

### February (earlier plan): Better Together

- **Flagship: Family Connection Planner.** A month of small, dated connection moments (one-on-one time per child with each adult, a family night per week), rotated so each pairing gets a turn; who plans each one.
- **Worksheets:** conversation cards by age, one-on-one date menu, team Bedrooms + Closets reset.
- **Mailer:** letter on connection as part of the family system; field guide on keeping it small; activity: family night plan.

### March: Spring Clean as a Team (built 2026-10-23, behind the flag)

*Less cleaning for Mom. More helping hands.* Owner direction, 2026-10-23: replaces the earlier March plan below. Config: `src/data/club/kits/2027-03-spring-clean-together.ts`. Mailer: [mailers/2027-03-spring-clean-together.md](mailers/2027-03-spring-clean-together.md).

- **The letter:** This House Belongs to All of Us (about 160 words): spring cleaning shouldn't be one person's weekend; everyone does something real, at their age. Asks "What's one space in our home we could make better together?" A draft for Megan.
- **The action:** Our One-Room Family Reset, five steps, with the space and when written above them and an optional "Who's helping?" per step. Thirty minutes is a starting point; one room is enough.
- **The tool:** the Family Spring Cleaning Builder, a new site tool: rooms, who's helping (with limits), session length; safe, age-fit jobs for each person in time-boxed sessions; edit anything; print one room.
- **Back of the letter:** the field guide, optional decluttering ideas, the question, the QR code, one calendar note.
- **Not October or November:** one seasonal project, not ongoing chores; it divides the work of what's on the calendar.

### March (earlier plan): Spring Clean as a Team

- **Flagship: Family Spring Cleaning Builder.** Spring Prep zones split into owned tasks with a due day, sized by age, so no one person does the spring clean.
- **Worksheets:** donate / keep / toss station sign, room-by-room team checklist, finish-line celebration card.
- **Mailer:** letter; field guide on teaching a cleaning task to a child; activity: the 30-minute family blitz.
- **Overlap check:** free `/spring-cleaning-checklist` stays free; the kit assigns it.

### April: Everybody Helps at Mealtime (built 2026-10-23, behind the flag)

*Less on Mom's plate. Everyone has a place at the table.* Owner direction, 2026-10-23: replaces the earlier April plan below. Config: `src/data/club/kits/2027-04-everybody-helps-at-mealtime.ts`. Mailer: [mailers/2027-04-everybody-helps-at-mealtime.md](mailers/2027-04-everybody-helps-at-mealtime.md).

- **The letter:** Dinner Is Everyone's Job (about 150 words): the thinking behind meals is work too, and it usually lands on Mom; everybody eats, so everybody can help, at their age. Asks "What's one part of mealtime you could take responsibility for this week?" A draft for Megan.
- **The action:** Our Family Dinner Team, five steps, with the meal and when written above them and an optional "Who's helping?" per step. Any meal counts.
- **The tool:** the Family Meal Responsibility Planner, a new site tool (`/club/tools/meal-team`): who's helping (with limits and an allergy setting), which meals, the same jobs or rotating; planning, prep, serving and cleanup shared out, the thinking included; edit anything; print the team chart (and the week, when rotating).
- **Back of the letter:** before / during / after, kitchen jobs by age, a five-minute pantry check, the question, the QR code, the calendar's meal-plan and grocery-list sections.
- **Not the free `/meal-planner`:** that plans what to eat; this shares who does the work. Meals still go in the calendar's meal plan.

### April (earlier plan): Everybody Helps at Mealtime

- **Flagship: Meal Responsibility Planner.** Weeknight dinners as owned jobs: who plans, who cooks (with an adult for younger kids), who sets, who clears, rotating weekly; a kid-led meal per week from age 8.
- **Worksheets:** family meal ideas list by who can make it, grocery list ownership, team Windows + Entry reset.
- **Mailer:** letter; field guide on letting kids cook with real jobs; activity: kids plan and make one dinner.
- **Overlap check:** free `/meal-planner` and `/lunch-and-snack-station` stay free.

### May: Finish the School Year Well

- **Flagship: School Year Wrap-Up Builder.** The last four weeks as a dated plan: teacher thank-yous, end-of-year events, paperwork, clearing backpacks, each owned by a person.
- **Worksheets:** end-of-year memory page per child, summer kickoff list, team Living Areas reset.
- **Mailer:** letter; field guide on the end-of-year pile-up; activity: memory interview.

### June: Summer With a Plan

- **Flagship: Summer Rhythm Builder.** A loose daily and weekly rhythm (not a schedule) per child by age: morning jobs, quiet time, outside time, one weekly outing each child chooses.
- **Worksheets:** "I'm bored" menu by age, summer jobs chart, team Outdoor / Summer Prep.
- **Mailer:** letter; field guide on rhythm vs. schedule; activity: summer bucket list vote.

### July: Ready to Go

- **Flagship: Packing and Independence Builder.** Packing lists per person by age and trip type; kids pack their own from a list with a check step at the age that needs it.
- **Worksheets:** car bag list, house-before-we-leave list, team Kitchen Deep Clean.
- **Mailer:** letter; field guide on independence one bag at a time; activity: kids pack a practice bag.
- **Overlap check:** free `/travel-checklist` stays free.

### August: Ready for the School Year (built 2026-10-23, simplified the same day, behind the flag)

*One calmer start. Everyone has a part.* Config: `src/data/club/kits/2027-08-school-year.ts`. Mailer: [mailers/2027-08-school-year.md](mailers/2027-08-school-year.md).

The first kit in the three-part shape every month now follows (owner direction, 2026-10-23): **one letter, one action, one optional tool**, with the family calendar staying the plan.

- **The letter:** about 160 words to Mom, greeting her by first name when it's known: get ready together, give kids their part, put the plan on the family calendar, start small. A draft for Megan to approve or rewrite.
- **The action:** Our Back-to-School Countdown, six lines with "By" and "Who's helping?" blanks. Online she enters when school starts (one family date, or one per child, picking which the countdown counts from) and each line gets a suggested day (14, 10, 7, 7, 5 and 1 days before), changeable; past days move to a practical one, a day or two out keeps only the essentials, after the first day it points to the routine charts. Print, copy as text, or a calendar file; nothing syncs.
- **The conversation:** one question on the back of the letter: "What's one thing you want to be able to do by yourself before school starts?"
- **The tool:** the site's routine chart (`/routine-chart`), opened inside the Club for the child she picks, with their name in the title, the routine she chose and the picture steps suited to their age first. Same tool, same printable, no Club copy.
- **Removed from the first draft** (kept as `src/data/club/libraries/school-year.ts`): the 20-plus-task launch plan with an owner per task, the overview, the per-child school and first-day setup, the School-Year Command Center with its Sunday checklist and commitments, the separate guide, huddle and backpack-station pieces.
- **Overlap check:** the free `/routine-chart` and `/back-to-school-checklist` stay free; the Club chart is personalized by each child's age.

### September: A Week Everyone Can See

- **Flagship: Sunday Family Reset Builder.** A 30-minute weekly family meeting: who leads which part, a running order, what each person brings (their week's activities, one job update).
- **Worksheets:** weekly meeting agenda, "this week" board, team Entry + Storage reset.
- **Mailer:** letter; field guide on keeping the meeting short and kept; activity: the first Sunday reset.
- **Note:** the wall calendar is the natural place for this week to live; mention it once, secondary, per ARTICLE_FORMAT product rules, and never imply sync.

### October: A Home That Works Together (built 2026-10-23, behind the flag)

*Little jobs. Shared responsibility. A home ready for the season ahead.* Owner direction, 2026-10-23: replaces the planned "Family That Follows Through" review. Config: `src/data/club/kits/2027-10-home-works-together.ts`. Mailer: [mailers/2027-10-home-works-together.md](mailers/2027-10-home-works-together.md).

- **The letter:** about 160 words: you shouldn't be the only one noticing what needs doing; a family works better when everyone knows what they can contribute; October before the busy season. Asks "What's one thing around our home you think you could take care of without being reminded?" A draft for Megan.
- **The action:** Our Fall Home Reset, five lines (outgrown clothes, the entryway, essentials, one cluttered area, one job each), a "Who's helping?" blank on each, wording she can change. A plain checklist: no dates, reminders or tracking; one weekend or across the month.
- **The tool:** the site's chore chart (`/chore-chart`), opened inside the Club for anyone in the family she picks, grown-ups included, starting with **one job they can own** (one age-fit job for a child, a whole job for a grown-up; no rewards filled in). The full week of chores for their age is a tap away. The calendar says when; the chart says who.
- **Back of the letter:** From Helping Mom to Owning a Job: three principles, one example, the family question, the QR code, and one calendar note.
- **Not November:** October resets the physical home and starts one owned job each; November (Our Family, Our Team) builds ongoing shared responsibilities and follow-through.

### December: Christmas Is a Family Affair (built 2026-10-23, behind the flag)

*More together. Less on Mom.* Owner direction, 2026-10-23: replaces the planned "Make Room for What Matters" (Holiday Teamwork Planner) above for 2027. Config: `src/data/club/kits/2027-12-christmas-family-affair.ts`. Mailer: [mailers/2027-12-christmas-family-affair.md](mailers/2027-12-christmas-family-affair.md).

- **The letter:** You Get to Enjoy Christmas, Too (about 180 words): loving Christmas doesn't mean carrying all of it; a Christmas the family makes together isn't a lesser one. Asks "What's one thing we could each do to make Christmas special for someone else?" A draft for Megan.
- **The action:** Our Family Christmas Plan, five decisions (what matters, dates on the calendar, gift preparations, one way to give, Christmas-week jobs), each with its sentence and a "Who's helping?" blank, wording she can change. No dates or deadlines; "Already made your plans?" turns it into a check-in, so it works in late November or mid-December.
- **The tool:** the Family Christmas Traditions Picker, a new site tool (nothing on the site did this), opened with the children's ages: three ideas that fit the family's time, budget and ages; keep up to three, swap the rest, print or copy.
- **Back of the letter:** the family question first, Making Christmas Together (three principles), the QR code, one calendar note.
- **Not October or November:** celebration and sharing the work of it, not a chore system.

## Monthly production calendar (per kit)

See [IMPLEMENTATION_PLAN.md → Monthly fulfillment lifecycle](IMPLEMENTATION_PLAN.md#6-monthly-fulfillment-lifecycle). In short: brief 10 weeks out, config and letter 8 weeks out, mailer locked 6 weeks out, cutoff the 15th of the month before, mail drop around the 20th, kit opens the 1st.

| Kit | Brief | Config + letter | Mailer locked | Cutoff | Mail drop |
| --- | --- | --- | --- | --- | --- |
| Nov 2026 (beta) | done in this plan | Phase 1 | — | — | — |
| Dec 2026 | set by the mail house's turnaround (D2) | | | Nov 15 | Nov 20 |
| Jan 2027 | Oct 23 | Nov 6 | Nov 20 | Dec 15 | Dec 20 |
| Feb 2027 | Nov 22 | Dec 6 | Dec 20 | Jan 15 | Jan 20 |
| Mar 2027 | Dec 21 | Jan 4 | Jan 18 | Feb 15 | Feb 20 |
| Apr 2027 | Jan 21 | Feb 4 | Feb 18 | Mar 15 | Mar 20 |
| May 2027 | Feb 18 | Mar 4 | Mar 18 | Apr 15 | Apr 20 |
| Jun 2027 | Mar 22 | Apr 5 | Apr 19 | May 15 | May 20 |
| Jul 2027 | Apr 21 | May 5 | May 19 | Jun 15 | Jun 20 |
| Aug 2027 | May 22 | Jun 5 | Jun 19 | Jul 15 | Jul 20 |
| Sep 2027 | Jun 22 | Jul 6 | Jul 20 | Aug 15 | Aug 20 |
| Oct 2027 | Jul 22 | Aug 5 | Aug 19 | Sep 15 | Sep 20 |

**These lead times are planning placeholders,** counted back from the release date. The real print deadlines come from the mail house's quote and turnaround (D9), and replace these columns once they're known.
