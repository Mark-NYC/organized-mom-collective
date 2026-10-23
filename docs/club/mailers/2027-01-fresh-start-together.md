# January 2027 mailer: A Fresh Start, Together

**Status (2026-10-23): design draft for owner review. Not printed, not quoted, not sent.** Kit config: `src/data/club/kits/2027-01-fresh-start-together.ts`; the printable twin is the kit's "This month's letter" (`LetterSheets` in `src/components/club/print/LetterPrintables.tsx`), the same component as August's, October's and December's.

**One sheet, two sides:** a double-sided 8.5 × 11 in letter, sent flat in a quality envelope. One letter, one family improvement, one simple habit, seven days of practice. Useful without scanning: the reset and the back page work on paper alone.

Mailer cutoff 2026-12-15, mail drop around 2026-12-20, kit opens 2027-01-01. Nothing depends on a date: the family starts its seven days whenever it chooses, in January or later.

## Design

The standard Club stationery (no seasonal accent): warm ivory paper, Georgia for the letter and guidance, Montserrat for labels and the steps, Kalam only for Megan's signature, muted sage panels, generous margins. No confetti, fireworks, "new year" graphics or dashboards. The letter keeps its full size: the steps have no helper column, so the front has room.

## Front

1. **Header:** ORGANIZED FAMILY CLUB · JANUARY 2027.
2. **Title:** A Fresh Start, Together. **Subtitle:** One small change. A better rhythm for everyone.
3. **The letter: You Don't Need a Whole New Routine** (about 170 words with greeting and sign-off). **A draft for Megan to approve or rewrite**; the kit can't be scheduled while it's marked `draft`. No invented stories, numbers or quotes. "Hi Ana," when her first name is on her profile; otherwise "Hi friend,".

   > January has a way of asking for everything at once. New schedules, new goals, a new system for the mail, the meals and the mornings. It can feel like the whole house needs fixing before February.
   >
   > It doesn't. Most families don't need an overhaul. Sometimes one part of the day working better is enough to make the whole house feel calmer.
   >
   > So this month, choose one thing. Maybe it's the rush to get out the door, or backpacks and shoes all over the house, or a kitchen that stays messy after dinner. Maybe it's bedtime, or reminding everyone about the same things every day. Not all of them. Just one.
   >
   > Then ask your family to help solve it. The reset below is five small steps, and the last one is simply trying your plan for a week.
   >
   > At dinner this week, ask everyone: "What's one part of our day that we could make easier for everyone?"
   >
   > One small change, made together, is a fresh start.
   >
   > Warmly, *Megan*

4. **Our One-Thing Family Reset** (sage panel): a writing line, **Our one thing this month: ______**, then five checkboxes, each step with its question. No dates, no names to assign.
   1. **Choose one frustration.** What's one part of everyday family life that isn't working well?
   2. **Agree on a simpler plan.** What would make that part of the day easier?
   3. **Give everyone a part.** What can each family member do to make the plan work?
   4. **Put it on the calendar.** Choose when you'll start and when you'll check in.
   5. **Try it for seven days.** Practice together, then decide what to keep or change.

## Back

1. **Small Changes That Stick.**
   - **Start with something small.** A five-minute habit the family actually practices is better than an ambitious plan nobody follows.
   - **Connect it to something you already do.** Attach the new habit to a familiar part of the day, such as breakfast, arriving home, or finishing dinner.
   - **Let everyone play a part.** The goal isn't for Mom to supervise another routine. Give each person a clear responsibility that fits their ability.
2. **For example: the kitchen after dinner.** Every night the kitchen stays a mess, and one person cleans it after everyone else leaves the table. The family's plan: after dinner, everyone spends five minutes resetting the kitchen. One clears plates, one wipes the table, one loads the dishwasher. After seven days, they check in and decide what to keep. (Illustrative, not a customer story.)
3. **Ask at dinner this week** (sage panel): *What's one part of our day that we could make easier for everyone?* Everyone answers, grown-ups too. Then choose one together.
4. **Build Your Family Habit:** the QR code beside "Scan the code for this month's kit and our Family Habit Builder. Answer three questions (what to make easier, when it could happen, who takes part) and it writes one simple habit for your family, with a seven-day practice card to print." and **organizedmomcollective.com/club/kits/2027-01-fresh-start-together**. The code encodes `https://www.organizedmomcollective.com/club/kits/2027-01-fresh-start-together?source=mailer`, verified by decoding the printed code; that kit page exists in the Club build and opens the builder from "Build Our Family Habit". Test the printed proof on two phones.
5. **On the family calendar** (rose band): Choose your start day and a day to check in together. Write both on your family calendar.

## Online: the same reset, plus three small fields

The kit page shows the same five steps with checkboxes, and: **What is your family's one thing?** (one of five suggestions, the habit builder's own, or her words), **Our simpler plan** under step 2, an optional **start day** under step 4 with "Check in together" a week later. Her printout carries all of it. No streaks, scores or reminders.

## The Family Habit Builder

A new site tool, because none fit: the routine chart orders one child's steps, the chore chart lays out a week of jobs. Neither makes one shared family habit tied to a moment of the day. Component `src/components/site/HabitBuilder.astro` + `habit-builder.ts`, choices and rules `src/data/family-habits.ts`; hosted in the Club at `/club/tools/habit-builder`, no public page yet (built to take one).

- Three questions, all with answers already chosen so a habit shows at once: what to make easier (five areas or something else, in her words), when (five everyday moments or her own), who (whole family, adults, children, or specific people: her family's first names from the profile, or typed names).
- One editable sentence ("After dinner, everyone spends five minutes resetting the kitchen."). Her words stay when she changes answers; "Use the suggested wording" brings ours back. Plus when, who, and an editable "Done means".
- A seven-day practice card (US Letter): the habit with one illustration from the responsibility library, when, who, done means, seven boxes (dated from her start day if she gave one), the reflection "Did this make our day easier? What should we change?", and a calendar line. Download or copy as text.
- Not in it: streaks, points, rewards, badges, analytics, notifications, a 30-day calendar, more than one habit.

## Not the other months

August prepares for school; October resets spaces; November shares ongoing responsibilities; December is celebrations. January improves one recurring rhythm: not a declutter, not a responsibility overhaul, not a 30-day program.

## Open questions

- Megan's approval or rewrite of the letter.
- The year: this is January **2027** as directed, so it sorts between November 2026 and August 2027; if the intent was the January after December 2027, the slug, dates and QR code change to 2028.
- The mail-house quote (D1, D9), same format as August.
