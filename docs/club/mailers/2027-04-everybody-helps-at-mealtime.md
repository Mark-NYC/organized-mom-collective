# April 2027 mailer: Everybody Helps at Mealtime

**Status (2026-10-23): design draft for owner review. Not printed, not quoted, not sent.** Kit config: `src/data/club/kits/2027-04-everybody-helps-at-mealtime.ts`; the printable twin is the kit's "This month's letter" (`LetterSheets` in `src/components/club/print/LetterPrintables.tsx`), the same component as the other three-part kits.

**One sheet, two sides:** a double-sided 8.5 × 11 in letter, sent flat in a quality envelope. One letter, one meal, one team, one optional personalized plan. Useful without scanning: the front is a complete family resource on its own.

Mailer cutoff 2027-03-15, mail drop around 2027-03-20, kit opens 2027-04-01.

## Design

The Club stationery with April's one touch (`mailer.accent: 'table'`): a fine-line place setting (fork, plate, knife) in muted sage, the plate's inner rim in pale apricot, above the title and beside the back heading. Pale apricot panels for the action and the question, a sage calendar note, warm ivory paper. No food photos, no cartoon vegetables, no recipe cards. The front uses the tighter letter layout (the helper column and two write-in lines need the room); the back is set slightly tighter than March's to fit the age reference and the pantry tip.

## Front

1. **Header:** ORGANIZED FAMILY CLUB · APRIL 2027, then the place setting.
2. **Title:** Everybody Helps at Mealtime. **Subtitle:** Less on Mom's plate. Everyone has a place at the table.
3. **The letter: Dinner Is Everyone's Job** (152 words with greeting and sign-off). **A draft for Megan to approve or rewrite.** No invented stories, no guilt, no two-parent assumption, no nutrition advice, nothing unsafe for children. "Hi Ana," when her first name is on her profile; otherwise "Hi friend,".

   > Somebody has to decide what's for dinner. Somebody checks the fridge, writes the list, starts the cooking and notices when the milk runs out. In a lot of homes, that somebody is Mom, every night, whether anyone sees it or not.
   >
   > Mealtime is one of the easiest places to change that. Everybody eats, so everybody can help.
   >
   > A five-year-old can set out the napkins. An eight-year-old can wash the vegetables or clear the table. A teenager can cook one dinner a week. The grown-ups can share the planning, not just the cooking. Nobody needs to be a chef; Mom just shouldn't be carrying every meal in her head.
   >
   > This month, start with one meal. Choose it together, give everyone a part, and sit down to enjoy it. The steps are below.
   >
   > At dinner this week, ask: "What's one part of mealtime you could take responsibility for this week?"
   >
   > Warmly, *Megan*

4. **Our Family Dinner Team** (apricot panel): "One meal. Everyone has a part." Note: "Any meal counts: a weeknight dinner, a weekend breakfast, a simple lunch. Little ones can carry napkins; that's a part." Then **The meal we're making: ______** and **When we're having it: ______**, and five checkboxes, each with a "Who's helping?" line:
   1. Choose a meal together.
   2. Share the preparation.
   3. Get the table ready.
   4. Enjoy the meal together.
   5. Share the cleanup.

   Online, she taps a meal idea (taco night, pasta and salad, breakfast for dinner, homemade pizza, soup and sandwiches, sheet-pan dinner) or types her own, picks the day, writes names or notes on any step, checks steps off and prints her filled-in copy.

## Back

1. **Everyone Has a Place at the Table.** "Every meal has three parts. Share each one." **Before the meal.** Choose it, check what you have, wash, stir, set out the plates. Planning counts as a job, too. **During the meal.** Pour the drinks, pass the dishes, and sit down together. Phones can wait. **After the meal.** Everyone clears their own plate. Then one person loads, one wipes, one puts the leftovers away.
2. **Kitchen jobs by age** (compact reference, "Suggestions, not rules. You know your children."): 3–5 napkins and spoons, carry their own plate, rinse fruit · 6–9 set the table, wash vegetables, clear, wipe the table · 10–12 write the grocery list, make a simple side, load the dishwasher · 13+ cook one meal with help nearby, wash the pots, help plan the week. Matches the planner's own age suggestions.
3. **A five-minute pantry check** (beside it): "Before writing this week's grocery list, check what you already have and add only what's missing."
4. **Ask at dinner this week:** *What's one part of mealtime you could take responsibility for this week?* Everyone answers, grown-ups too.
5. **Make Your Family Meal Responsibility Plan:** the QR code beside "Choose who's helping and which meals you want to share. We'll help divide the jobs. Scan the code, then tap "Build Our Mealtime Plan."" and **organizedmomcollective.com/club/kits/2027-04-everybody-helps-at-mealtime**. The code encodes `https://www.organizedmomcollective.com/club/kits/2027-04-everybody-helps-at-mealtime?source=mailer`, verified by decoding the printed code. Test the printed proof on two phones.
6. **On the family calendar:** Use the meal-planning and grocery-list sections of your wall calendar to keep the plan visible. Let your family's responsibility chart show who handles each part.

## The Family Meal Responsibility Planner

A new site tool, because nothing existing does this: the free `/meal-planner` plans *what* the family eats (and its grocery list); the chore chart is one child's weekly chores; November's engine spreads recurring household jobs. This one shares *who does the work around meals*, the thinking included. Component `src/components/site/MealTeamPlanner.astro` + `meal-team-planner.ts`, jobs and rules `src/data/mealtime-jobs.ts`, who's helping shared with March (`src/lib/household-helpers.ts`, `HelpersEditor.astro`). Hosted at `/club/tools/meal-team`; no public page yet, built to take one.

- **Three inputs.** Who's helping: the family profile's names and ages, or Adult / Teen / School-age / Young child in a tap, each with optional limits (no sharp knives, no stove or oven, no heavy pots, seated jobs only), plus "someone at home has a food allergy". Which meals: dinner by default; breakfast and lunch can be added. Same jobs all week (default) or rotate; optional days at home.
- **The plan.** Four parts: every week (the thinking: choose the meals and write them in the calendar's meal plan, check the fridge and pantry, keep the calendar's grocery list, shopping, a child picks one dinner, a teen cooks one dinner), before, during and after the meal. A few jobs per person, cleanup weighted so it isn't skipped. Everyone who can help gets a part; "Everyone clears their own plate" is everyone's.
- **The mental load.** Jobs are weighed by how much they ask over a week, the thinking counted fully, and measured against what each group can carry (a grown-up more than a teen, a teen more than a child). The account holder leans last in near ties; the first adult listed gets no special treatment. A line under the plan names who carries the thinking and nudges when one grown-up holds all of it.
- **Single parents.** A one-adult home gets a shorter list, children take real parts (a 9-year-old checks the pantry, a 6-year-old sets the table), and nothing pretends a second adult exists. A parent alone gets a short, honest list.
- **Safety.** Shopping is grown-ups only; stove, oven and sharp-knife work is from 13, with a grown-up nearby, and nightly cooking goes to a grown-up when there is one (a teen's turn is their weekly dinner). With the allergy setting, choosing meals, cooking and leftovers stay with grown-ups. Young children get one job per meal. Ages are suggestions she can override (with a note); limits and grown-ups-only jobs can't be reassigned past.
- **Rotating.** Day one is the plan as it stands; after that each meal job moves to whoever has done it least that week, stove and knife work stays among the grown-ups, and nobody who can help sits a day out.
- **Two views.** *Our Mealtime Team* (default: every job, its owner, editable) and *Our Weekly Meal Responsibilities* (the same jobs all week in words, or a day-by-day grid when rotating).
- **Editing.** Reword, reassign, remove or add any job. "New suggestions (keeps your changes)" re-plans the rest: owners she chose, her wording, removed jobs and her own jobs stay. Everything saves in the browser.
- **Printing.** A US Letter chart, *Our Mealtime Team*, by part, each job with an illustration from the responsibility library (or a small fine-line mark for the part), and its owner; a second page, *Our Weekly Meal Responsibilities*, when rotating. Footer: "Meals go in the wall calendar's meal plan, groceries in its grocery list. This chart shows who makes each part happen." Three color choices; download or copy as text.
- **Not in it:** recipes, nutrition, meal suggestions beyond the action's few ideas, reminders, streaks, scores, a meal calendar (the wall calendar's meal plan stays the plan).

## Not the other months

October and November set ongoing household responsibilities; March is one seasonal cleaning project. April is the daily rhythm of meals, shared, with the calendar's meal plan and grocery list at the center.

## Open questions

- Megan's approval or rewrite of the letter.
- The age reference and job weights are reasonable defaults, not research; a family test would tune them.
- Big families (seven people) print on two pages.
- The mail-house quote (D1, D9), same format as August.
