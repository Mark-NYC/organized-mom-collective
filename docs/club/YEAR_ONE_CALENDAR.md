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
| **Aug 2027** | Ready for the School Year (built) | School Launch Plan + routines + command center | responsibilities | Bedrooms + Back-to-School | Aug 1 | Jul 15 |
| **Sep 2027** | A Week Everyone Can See | Sunday Family Reset Builder | planning | Entry + Storage | Sep 1 | Aug 15 |
| **Oct 2027** | The Family That Follows Through | Family Habits and Ownership Review | responsibilities (review mode) | Closet Cleanout | Oct 1 | Sep 15 |

Whether December is the first paid month with a mailer depends on the mail house's real proof-to-mail time (D2), not on the placeholder lead times below. If it doesn't fit, December's kit opens digitally for beta families and January becomes the first paid month.

Slugs follow `YYYY-MM-<theme>` and are permanent once printed on a mailer: `2026-11-family-ownership`, `2026-12-holiday-teamwork`, `2027-01-mornings`, `2027-02-better-together`, `2027-03-spring-clean`, `2027-04-mealtime`, `2027-05-school-year-wrap-up`, `2027-06-summer-rhythm`, `2027-07-ready-to-go`, `2027-08-school-launch`, `2027-09-sunday-reset`, `2027-10-follow-through`.

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

### January: Mornings Without the Mayhem

- **Flagship: Morning Routine Builder.** Per child: ordered, timed steps from wake-up to out-the-door, sized by age, with the night-before steps they own; adults' morning jobs split, not stacked on one person. Two inputs with defaults: leave-the-house time, wake-up time.
- **Worksheets:** night-before checklist per child, "the late morning" fallback plan (the 10-minute version), team Kitchen Reset.
- **Mailer:** letter on mornings; field guide on teaching a routine once and letting the chart do the reminding; activity: a timed practice run on a weekend morning.
- **Overlap check:** free `/routine-chart` (one routine, typed in) stays free; the kit builds every child's chart at once from ages.

### February: Better Together

- **Flagship: Family Connection Planner.** A month of small, dated connection moments (one-on-one time per child with each adult, a family night per week), rotated so each pairing gets a turn; who plans each one.
- **Worksheets:** conversation cards by age, one-on-one date menu, team Bedrooms + Closets reset.
- **Mailer:** letter on connection as part of the family system; field guide on keeping it small; activity: family night plan.

### March: Spring Clean as a Team

- **Flagship: Family Spring Cleaning Builder.** Spring Prep zones split into owned tasks with a due day, sized by age, so no one person does the spring clean.
- **Worksheets:** donate / keep / toss station sign, room-by-room team checklist, finish-line celebration card.
- **Mailer:** letter; field guide on teaching a cleaning task to a child; activity: the 30-minute family blitz.
- **Overlap check:** free `/spring-cleaning-checklist` stays free; the kit assigns it.

### April: Everybody Helps at Mealtime

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

### August: Ready for the School Year (built 2026-10-23, behind the flag)

Config: `src/data/club/kits/2027-08-school-year.ts` (slug `2027-08-school-year`). Mailer draft: [mailers/2027-08-school-year.md](mailers/2027-08-school-year.md).

- **Opens on an overview:** 5–8 first actions, already shared out, from the launch plan (shared prep first, then each child's most useful task), with the full plan, routines and command center a tap away.
- **School setup:** each child's school (public, private, homeschool, preschool, or not in school this year) and first day, guessed from age, changed in one line. Never assumes every child goes to school or starts the same day. Due dates count back from each child's first day.
- **A. School Launch Plan** (flagship; one portrait page): each child's prep by age and school type, plus shared prep (calendar dates, supply lists, forms, rides, bedtimes, the backpack station) with one owner each.
- **B. Morning and after-school routines:** a page per child, steps by age and school type, reorderable and editable.
- **C. School-Year Command Center** (one landscape page): who owns drop-off, pick-up, activity driving, school email, lunches, papers, the homework check-in and Sunday planning; the family's own weekly commitments; the Sunday planning checklist. Made to hang beside the wall calendar, not replace it.
- **In the mail:** Megan's letter (placeholder), the one-page guide, the School-Year Huddle, the Backpack Station Reset.
- **Overlap check:** the free `/back-to-school-checklist`, `/routine-chart`, `/lunch-and-snack-station` and `/command-center-setup` stay free; the kit builds every child's version at once from the profile.

### September: A Week Everyone Can See

- **Flagship: Sunday Family Reset Builder.** A 30-minute weekly family meeting: who leads which part, a running order, what each person brings (their week's activities, one job update).
- **Worksheets:** weekly meeting agenda, "this week" board, team Entry + Storage reset.
- **Mailer:** letter; field guide on keeping the meeting short and kept; activity: the first Sunday reset.
- **Note:** the wall calendar is the natural place for this week to live; mention it once, secondary, per ARTICLE_FORMAT product rules, and never imply sync.

### October: The Family That Follows Through

- **Flagship: Family Habits and Ownership Review.** Reads her saved November chart (and any later ones): which jobs stayed with their owner, which drifted back, and suggests next-level ownership by each child's new age. Output: a new chart for year two.
- **Worksheets:** "what stuck" family reflection, certificate per person for a job they own, team Closet Cleanout.
- **Mailer:** letter on a year of shared work; field guide on what to do when jobs drift back; activity: family awards night.
- **Retention note:** the review only works for members who kept their November chart; it's the natural renewal point for year two.

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
