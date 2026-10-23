# October 2027 mailer: A Home That Works Together

**Status (2026-10-23): design draft for owner review. Not printed, not quoted, not sent.** Kit config: `src/data/club/kits/2027-10-home-works-together.ts`; the printable twin is the kit's "This month's letter" (`LetterSheets` in `src/components/club/print/LetterPrintables.tsx`), the same component as August's.

**One sheet, two sides:** a double-sided 8.5 × 11 in letter, sent flat. One letter, one fall reset, one optional chore chart. Useful without scanning: the reset list and the back page work on paper alone.

Mailer cutoff 2027-09-15, mail drop around 2027-09-20, kit opens 2027-10-01 ([YEAR_ONE_CALENDAR.md](../YEAR_ONE_CALENDAR.md)).

## Design

Same as August ([2027-08-school-year.md](2027-08-school-year.md) → Design): warm ivory paper, Georgia for the letter and guidance, Montserrat for labels and the checklist, Kalam only for Megan's signature, generous margins, no type under 10 pt except small capital labels.

## Front

1. **Header:** ORGANIZED FAMILY CLUB · OCTOBER 2027.
2. **Title:** A Home That Works Together. **Subtitle:** Little jobs. Shared responsibility. A home ready for the season ahead.
3. **The letter** (about 160 words). **A draft for Megan to approve or rewrite**; the kit can't be scheduled while it's marked `draft`. No invented stories, numbers or quotes. "Hi Ana," when her first name is on her profile; otherwise "Hi friend,".

   > Someone in every home notices things. The jacket that doesn't fit anymore. The shoes piling up by the door. The last roll of paper towels. If that someone is usually you, you're not alone, and you don't have to be the only one.
   >
   > A family works better when everyone knows what they can contribute. Not because someone asked them to help, but because a job is theirs.
   >
   > October is a good time to start. The holidays aren't here yet, and a few small changes now make November and December lighter. The Fall Home Reset below is five little things. Do them in one weekend or spread them across the month, and put a name beside each one.
   >
   > At dinner this week, or when you sit down with the family calendar, ask everyone: "What's one thing around our home you think you could take care of without being reminded?" Then let them.
   >
   > Here's to a home that works together.
   >
   > Warmly, *Megan*

4. **Our Fall Home Reset** (sage panel): five checkboxes, each with a "Who's helping?" line. No dates.
   1. Clear outgrown coats, shoes, and seasonal clothes.
   2. Get the entryway ready for jackets, backpacks, and shoes.
   3. Restock household essentials before colder weather.
   4. Choose one cluttered area and reset it together.
   5. Give each family member one job they can own this season.

## Back

1. **From Helping Mom to Owning a Job.** Helping means waiting to be asked. Owning a job means it's yours from start to finish: you notice it needs doing, you do it, and you know when it's done.
   - **Start small.** Choose one responsibility the person can realistically manage.
   - **Make it clear.** Everyone should understand what "done" looks like.
   - **Let them own it.** Mom shouldn't have to remember and remind every time. The job, and the remembering, are theirs.
2. **For example: an eight-year-old owns the entryway.** Every afternoon, shoes go in the basket and backpacks go on their hooks. Done means the floor by the door is clear before dinner. If it slips, the chore chart on the wall is the reminder, not Mom.
3. **Ask at dinner this week** (sage panel): *What's one thing around our home you think you could take care of without being reminded?* Or when you sit down with the family calendar. Everyone answers, grown-ups too.
4. **Make a Family Chore Chart** (online it opens with one job each, grown-ups included, matching the reset's fifth line): the QR code beside "Scan the code for our chore chart: it starts with jobs that fit each child's age, so everyone can see their part at a glance." and **organizedmomcollective.com/club/kits/2027-10-home-works-together**. The code encodes `https://www.organizedmomcollective.com/club/kits/2027-10-home-works-together?source=mailer`, verified by decoding the generated code; that kit page exists in the Club build and opens the chore chart from its button. It works for members once the Club is live; test the printed proof on two phones.
5. **On the family calendar** (rose band): Choose a time this month for your family reset. Put it on the wall calendar so everyone knows the plan.

## Paper or online: one list

The mailed reset and the online one are the same five lines. Online she can check them off, name who's helping, reword a line for her family, and print her own copy; the page says either copy works. No dates, reminders or tracking.

## Not November

October resets the physical home and starts one owned job each. November (Our Family, Our Team) is the full family chart of ongoing responsibilities and follow-through.

## Open questions

- Megan's approval or rewrite of the letter.
- The mail-house quote (D1, D9), same format as August.
