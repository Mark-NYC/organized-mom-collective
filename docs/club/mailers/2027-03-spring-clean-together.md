# March 2027 mailer: Spring Clean as a Team

**Status (2026-10-23): design draft for owner review. Not printed, not quoted, not sent.** Kit config: `src/data/club/kits/2027-03-spring-clean-together.ts`; the printable twin is the kit's "This month's letter" (`LetterSheets` in `src/components/club/print/LetterPrintables.tsx`), the same component as the other three-part kits.

**One sheet, two sides:** a double-sided 8.5 × 11 in letter, sent flat in a quality envelope. One letter, one room, one short session, one optional personalized plan. Useful without scanning: the front is a complete family resource on its own.

Mailer cutoff 2027-02-15, mail drop around 2027-02-20, kit opens 2027-03-01.

## Design

The Club stationery with March's one touch (`mailer.accent: 'spring'`): a single fine-line stem with four new leaves in muted sage, above the title and beside the back heading. Sage panels, no cartoon supplies, no cleaning grids. The front uses the tighter letter layout (the helper column and the two write-in lines need the room), with the letter at 11 pt.

## Front

1. **Header:** ORGANIZED FAMILY CLUB · MARCH 2027, then the stem.
2. **Title:** Spring Clean as a Team. **Subtitle:** Less cleaning for Mom. More helping hands.
3. **The letter: This House Belongs to All of Us** (about 160 words with greeting and sign-off). **A draft for Megan to approve or rewrite.** No invented stories, no guilt, no two-parent assumption, no adult jobs for children. "Hi Ana," when her first name is on her profile; otherwise "Hi friend,".

   > Spring has a way of making you want to open every window, empty every closet and start fresh. That's a good instinct. But getting the house ready for a new season shouldn't mean one person spends the weekend cleaning while everyone else gets the weekend off.
   >
   > This house belongs to all of us. Taking care of it can belong to all of us, too.
   >
   > Everyone can do something real. A four-year-old can collect the toys and put the shoes where they go. A ten-year-old can dust the shelves and sort the books. A teenager can vacuum or change the sheets. The grown-ups take the jobs that need a step stool or a strong cleaner. Nobody has to do it perfectly.
   >
   > The reset below is one room, thirty minutes, and a part for everyone. With little ones, try fifteen. One room is enough.
   >
   > At dinner this week, ask: "What's one space in our home we could make better together?"
   >
   > Warmly, *Megan*

4. **Our One-Room Family Reset** (sage panel): "Thirty minutes is a starting point. With little ones, try 15; if you want more, do another room another day. One room is enough." Then **The space we're resetting: ______** and **When we're doing it: ______**, and five checkboxes, each with a "Who's helping?" line:
   1. Choose one room or shared space.
   2. Have everyone choose one job they can handle.
   3. Set a timer for 30 minutes.
   4. Work together and put things back where they belong.
   5. Enjoy the result and decide if you want to tackle another space.

## Back

1. **Your Spring Reset Field Guide.** Start with one room. / Give everyone a real job. / Work in short sessions. (The owner's wording.)
2. **Not sure where to start?** "Ideas for choosing a focus, not four more projects. Pick one, or none." Four small boxes: outgrown clothes and shoes; toys, games and books; paperwork and school papers; unused household items.
3. **Ask at dinner this week:** *What's one space in our home we could make better together?* Everyone answers, grown-ups too. Then pick one space together.
4. **Build Your Family Spring Cleaning Plan:** the QR code beside "Choose your rooms, who's helping, and how much time you have. We'll help divide the work: safe jobs for each person, in short sessions, one room per printed page. Scan the code, then tap "Build Our Cleaning Plan."" and **organizedmomcollective.com/club/kits/2027-03-spring-clean-together**. The code encodes `https://www.organizedmomcollective.com/club/kits/2027-03-spring-clean-together?source=mailer`, verified by decoding the printed code. Test the printed proof on two phones.
5. **On the family calendar:** Choose one cleaning session and put it on your wall calendar so everyone knows when it's happening.

## The Family Spring Cleaning Builder

A new site tool, because nothing existing plans this: `/spring-cleaning-checklist` is a checklist by room (no ages, times or safety), `/chore-chart` is one child's weekly chores, and November's engine spreads recurring weekly jobs by capacity. It borrows November's rules (Mom leans last, nothing falls to her by default, a job nobody can do says "Needs someone") and the spring checklist's room wording. Component `src/components/site/SpringCleaningBuilder.astro` + `spring-cleaning-builder.ts`, rooms, jobs and rules `src/data/spring-cleaning.ts`. Hosted at `/club/tools/spring-cleaning`; no public page yet, built to take one.

- **Three decisions.** Rooms (ten plus your own space; starts with one). Who's helping: the family profile's names and ages, or Adult / Teen / School-age / Young child added in a tap; each person's optional limits (no heavy lifting, no ladders or high reaching, no kneeling or floor work, seated jobs only, no cleaning products). Session length: 15, 30 or 60 minutes.
- **The plan.** Each room's starting jobs (5–9; more to add), placed into sessions no longer than the length chosen. People work side by side, so a session is as long as its busiest person. Younger helpers get extra time per job. Jobs only some people can do are placed first; the rest go to whoever has done least, so children get real jobs and grown-ups get the ones only they can do. The account holder leans last; what doesn't fit becomes another session, never her leftovers.
- **Safety.** Grown-ups only, whatever a child's age: cleaning chemicals, ladders and high reaching, heavy lifting and moving furniture, shredding, appliances, medicines. An age is a suggestion (a parent can still choose a younger child, with a note); a grown-ups-only job or a person's limit can't be reassigned past.
- **Editing.** Rename, reassign, remove or add any job (from the room's list or your own); change one room's session length; "New suggestions" redoes one room and leaves the others as edited. Changing who's helping re-plans rooms you haven't edited.
- **Printing.** One US Letter page per room (a long room continues on a second page): each session, each person with their jobs and big boxes, what to have ready, a note line, the calendar line. Print just the room you're doing; copy the whole plan as text.
- **Not in it:** dashboards, deadlines, reminders, streaks, scores, multi-week progress, dependencies, a cleaning schedule (the calendar's cleaning zones and monthly projects stay the calendar's).

## Not the other months

October resets a few spaces and starts one owned job each; November sets ongoing responsibilities. March is one seasonal project, done together, as often as the family wants.

## Open questions

- Megan's approval or rewrite of the letter.
- The builder's time estimates are reasonable guesses, labeled as estimates; a family test would tune them.
- The mail-house quote (D1, D9), same format as August.
