# May 2027 mailer: Finish the School Year Well

**Status (2026-10-23): design draft for owner review. Not printed, not quoted, not sent.** Kit config: `src/data/club/kits/2027-05-finish-the-school-year.ts`; the printable twin is the kit's "This month's letter" (`LetterSheets` in `src/components/club/print/LetterPrintables.tsx`), the same component as the other three-part kits.

**One sheet, two sides:** a double-sided 8.5 × 11 in letter, sent flat in a quality envelope. One letter, five closeout actions, one optional personalized plan, a few memories worth keeping. Useful without scanning: the front is a complete family resource on its own, and nothing on it needs a last-day date.

Mailer cutoff 2027-04-15, mail drop around 2027-04-20, kit opens 2027-05-01.

## Design

The Club stationery with May's one touch (`mailer.accent: 'school'`): a fine-line open notebook in muted sage with a soft blue ribbon, above the title and beside the back heading. Soft blue panels for the action, a warm neutral panel for the Five Favorites Rule, a sage calendar note. No graduation caps, apples, pencils or school-bus graphics. The front uses the tighter letter layout (the helper column and a sentence on each line need the room) and still leaves white space; the back is set a little tighter to fit the keepsake.

## Front

1. **Header:** ORGANIZED FAMILY CLUB · MAY 2027, then the notebook.
2. **Title:** Finish the School Year Well. **Subtitle:** Less end-of-year chaos. More ready for summer.
3. **The letter: You Don't Have to Wrap Up Everything Yourself** (159 words with greeting and sign-off). **A draft for Megan to approve or rewrite.** No invented stories, no guilt, no blame, no pressure to keep every memory, no assumption that every child's school year looks the same. "Hi Ana," when her first name is on her profile; otherwise "Hi friend,".

   > The end of the school year can feel a little like another holiday season. There are concerts and class parties, library books to return, forms to sign, and a pile of papers that somehow grew all year. It's easy for one person to end up remembering all of it.
   >
   > The school year belongs to your kids, too. They can help finish it well.
   >
   > Children can gather their own things, check for borrowed books, sort their papers and choose the few pieces worth keeping. Grown-ups can share the forms and the final-day details, so no one is coordinating everything alone.
   >
   > It doesn't have to be perfect. Every school year ends a little differently, so start wherever you are. The goal is to finish the season together, notice how much your children have grown, and head into summer with fewer loose ends.
   >
   > At dinner this week, ask: "What's one thing you're proud of from this school year?"
   >
   > Warmly, *Megan*

4. **Our School Year Wrap-Up** (soft blue panel). "Start wherever you are. Some children finish in May, others in June; these work either way." Five checkboxes, each with its sentence and a "Who's helping?" line:
   1. **Check the calendar.** Add remaining school events, celebrations, and important dates.
   2. **Handle the loose ends.** Check library books, forms, borrowed supplies, and anything that needs to be returned.
   3. **Sort school papers.** Choose a few favorite pieces of artwork or schoolwork to keep, and recycle what isn't needed.
   4. **Reset school gear.** Empty backpacks and lunchboxes, sort reusable supplies, and put things away.
   5. **Celebrate the year.** Have each child share something they learned, enjoyed, or accomplished.

   Online: check off, write helpers, saved, and print her own copy. No dates, reminders or dashboard.

## Back

1. **Close the Year, Keep What Matters.** **Finish the loose ends.** Return what belongs to school and bring home what belongs to your child. **Let your child help sort.** Invite children to choose favorite schoolwork and decide what they're ready to let go of. **Celebrate their growth.** Take a moment to notice what each child learned or accomplished.
2. **The Five Favorites Rule:** "When the school papers come home, invite your child to choose five favorites worth keeping. Five is a suggestion, not a strict limit: it just makes choosing easier." A sorting principle, not a scrapbook, archive or inventory.
3. **My School Year** (a dashed edge to cut along, "For your child to fill in, then keep with their five favorites."): a name line, then *My favorite memory this year was…*, *Something new I learned was…*, *Something I'm proud of is…*, each with two writing lines (0.3 in apart). Handwritten-style heading so it reads as a celebration, not homework.
4. **Build Your School Year Wrap-Up Plan:** the QR code beside "Tell us when school ends, and we'll help you figure out what to finish, when to do it, and who can help. Scan the code, then tap "Build Our School Year Plan."" and **organizedmomcollective.com/club/kits/2027-05-finish-the-school-year**. The code encodes `https://www.organizedmomcollective.com/club/kits/2027-05-finish-the-school-year?source=mailer`, verified by decoding the printed code. Test the printed proof on two phones.
5. **On the family calendar:** Add the remaining school events and your closeout dates to the family calendar so everyone can see the plan.

The question lives in the letter only; the reflection's "Something I'm proud of" picks it up for the children.

## The School Year Wrap-Up Builder

A new site tool, because nothing existing does this: August's countdown gets ready for the first day, `/back-to-school-checklist` is a start-of-year list, `/paper-clutter-blitz` is a whole-house paper reset. This one finishes the school year. Component `src/components/site/WrapUpBuilder.astro` + `wrap-up-builder.ts`, tasks and rules `src/data/school-wrapup.ts`; dates from August's countdown (`planCountdown`, `addDays`, `localToday` in `src/lib/club/countdown.ts`), who's helping from the shared helpers editor. Hosted at `/club/tools/school-wrap-up`; no public page yet, built to take one.

- **Three inputs.** The last day of school: one family date, and for any child "A different day" or "Not in school this year". Which responsibilities apply (all six on to start): library books or borrowed items, school forms or paperwork, end-of-year activities, school belongings to bring home, school papers and artwork, school supplies to sort. Who can help: the family profile, or one adult and one child to start.
- **The plan.** Two groups, before school ends and after the last day. Suggested days, counted from each child's last day: final school dates on the calendar 14 days before, borrowed books and supplies 10, forms 7, school messages 5, belongings 3; celebrate on the last day; backpacks and lunchboxes 1 day after, papers and keepsakes 3, supplies 5. Shown as real dates (Jun 5), always editable. Family tasks happen once (counted from the first last day still ahead); each child's own tasks follow their own day; siblings doing the same thing on the same day share a line ("Sofia and Mateo, each their own"). Usually 5–8 tasks per child.
- **Short timelines (August's rules).** A suggestion that's already gone moves to the days left, a couple a day, never shown as overdue. Within four days, bringing things home and returning borrowed books become one trip. A day or two out, only the essentials (returns, forms, belongings) come before the last day. On the last day itself, only the essentials, all today. Once it's over, no before-tasks: the after-school closeout starts today. A gentle line says which of these applies.
- **Dates are hers.** A date she enters is kept as entered, never moved, through new suggestions and reloads; only "Use the suggested dates" (with a confirmation) clears them. Every printout says dates are suggestions, not school deadlines; the builder never invents a school deadline.
- **Ownership.** Each child closes out their own year in words for their age: a young child with a grown-up (bring home things from the cubby, empty the backpack, choose five favorite pictures); a grown-up looks for library books in a young child's backpack; school-age children check their own backpacks and desks and sort their papers; teens clear their lockers, check their own forms and school messages and ask a grown-up to sign. Forms, sign-offs, payments and the family's school messages are grown-ups only, shared between grown-ups with the account holder leaning last; a teen or a child of 10 or more can take the calendar.
- **Editing.** Check off, re-date, reassign, reword, remove, add her own; "New suggestions (keeps your changes)". Saved in the browser.
- **Printing.** US Letter, one page for the families tested: family name, the last day (or each child's), Before school ends / After school ends with big checkboxes, dates, tasks and owners, the Five Favorites Rule, the calendar line. Print the whole family's plan or one child's (their own tasks and the celebration, not the grown-ups' forms). Copy as text.
- **Not in it:** a school planner, assignment tracking, reminders, a summer calendar, first-day routines, supply shopping, a scrapbook or photo storage.

## Not the other months

August gets ready for the first day; May finishes the year. June will have its own summer focus: nothing summer-shaped is planned here.

## Open questions

- Megan's approval or rewrite of the letter.
- The suggested spacing is the owner's brief, not research; a family test would tune it.
- A school's own deadlines vary: families enter them, and the builder keeps them.
- The mail-house quote (D1, D9), same format as August.
