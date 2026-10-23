# December 2027 mailer: Christmas Is a Family Affair

**Status (2026-10-23): design draft for owner review. Not printed, not quoted, not sent.** Kit config: `src/data/club/kits/2027-12-christmas-family-affair.ts`; the printable twin is the kit's "This month's letter" (`LetterSheets` in `src/components/club/print/LetterPrintables.tsx`), the same component as August's and October's.

**One sheet, two sides:** a double-sided 8.5 × 11 in letter, sent flat in a quality envelope. One letter, five family decisions, up to three traditions. Useful without scanning: the plan and the back page work on paper alone.

Mailer cutoff 2027-11-01, mail drop around 2027-11-15, so it lands in late November; the kit page opens 2027-12-01 like every month (see Open questions). Nothing in it depends on a date: it works as an early plan in November or a reset in mid-December.

## Design

Same system as August and October: warm ivory paper, Georgia for the letter and guidance, Montserrat for labels and the plan, Kalam only for Megan's signature, generous margins. December's one seasonal touch (`mailer.accent: 'evergreen'`): a small fine-line evergreen sprig with two clay berries above the title and beside the back-page heading, and the panels in muted evergreen and soft clay instead of sage and rose. No red-and-green, no Santa, no ornaments or borders. The front is set slightly tighter (letter 10.6 pt) so the five decisions, each with its sentence, fit.

## Front

1. **Header:** ORGANIZED FAMILY CLUB · DECEMBER 2027, then the sprig.
2. **Title:** Christmas Is a Family Affair. **Subtitle:** More together. Less on Mom.
3. **The letter: You Get to Enjoy Christmas, Too** (about 180 words with greeting and sign-off). **A draft for Megan to approve or rewrite**; the kit can't be scheduled while it's marked `draft`. No invented stories, numbers or quotes. "Hi Ana," when her first name is on her profile; otherwise "Hi friend,".

   > Christmas has a way of landing on one person. The gifts, the cards, the class party, the school concert, the cookies, the list of who's coming for dinner. If that person is you, you probably love a lot of it. Much of the magic happens because you care.
   >
   > That's worth keeping. But loving Christmas doesn't mean carrying all of it. A Christmas the whole family makes together isn't a lesser Christmas. It's often a more meaningful one.
   >
   > A five-year-old can stir cookie dough and carry a plate to a neighbor. A ten-year-old can wrap gifts or plan a movie night. A partner can own a whole job, like the cards or the Christmas grocery list, without waiting to be asked.
   >
   > Below are five little decisions to make together. If your plans are already made, use them as a check-in: keep what matters, share what's left, and let a few things go.
   >
   > At dinner this week, ask everyone: "What's one thing we could each do to make Christmas special for someone else?"
   >
   > You get to enjoy Christmas, too.
   >
   > Warmly, *Megan*

4. **Our Family Christmas Plan** (evergreen panel): *Already made your plans? Use this as a quick family check-in. Keep what matters, share what's left, and let a few things go.* Five checkboxes, each with its sentence and a "Who's helping?" line. No dates, no owner required.
   1. **Choose what matters most.** Pick two or three Christmas traditions your family really wants to enjoy.
   2. **Put the important dates on the calendar.** Add gatherings, school events, church activities, and celebrations.
   3. **Share the gift preparations.** Decide who's handling shopping, wrapping, cards, and other gift-related jobs.
   4. **Choose one way to give together.** Find a simple way to bless, serve, or encourage someone outside your household.
   5. **Share the Christmas-week jobs.** Decide who can help with meals, preparing the house, and other responsibilities.

## Back

1. **Ask at dinner this week** (evergreen panel, first and largest): *What's one thing we could each do to make Christmas special for someone else?* Everyone answers, grown-ups too. Then pick one or two to do together.
2. **Making Christmas Together.**
   - **Choose what matters.** Ask everyone which traditions they value most. You may discover that the simplest things matter more than elaborate plans.
   - **Share the preparations.** Give family members meaningful responsibilities from beginning to end, appropriate to their ages and abilities.
   - **Leave room to enjoy it.** Don't fill every open day. Keep time for ordinary evenings, rest, and being together.
3. **Find Your Family's Christmas Traditions:** the QR code beside "Scan the code for this month's kit and our traditions picker. Tell it your children's ages, the time you have and your budget, and it suggests three simple activities, each with a part a child can lead. Keep up to three, swap the rest, then print or copy them." and **organizedmomcollective.com/club/kits/2027-12-christmas-family-affair**. The code encodes `https://www.organizedmomcollective.com/club/kits/2027-12-christmas-family-affair?source=mailer`, verified by decoding the generated code; that kit page exists in the Club build and opens the picker from "Find Our Christmas Traditions". It works for members once the Club is live; test the printed proof on two phones.
4. **On the family calendar** (clay band): Add your favorite traditions and important Christmas dates to the family wall calendar. Leave some open space, too.

## The traditions picker

A new site tool, because nothing on the site did this: `/december-countdown` is a 24-day activity calendar (the opposite of choosing fewer) and `/holiday-gift-planner` is gift lists. Component `src/components/site/TraditionsPicker.astro` + `traditions-picker.ts`, ideas and rules `src/data/christmas-traditions.ts` (23 small activities, each with a time, a cost, at home or out, and a part for a child under 5, 5–8 and 9 and up). Hosted in the Club at `/club/tools/traditions-picker`; no public page yet, but it's built to take one (no handoff = any visitor).

- Optional questions with defaults (about an hour, under $25, either): children's ages (from the family profile in the Club, or four age chips), time, budget, where.
- Three suggestions straight away, never two of one kind, one a way to give when any fits; ranked by time, then the children's ages, then budget. "We'll do this" on one to three, "Swap this idea" on the rest.
- Download a US Letter printout ("Our Christmas Traditions", with When and Who's leading? lines for each) or copy as text. "Three meaningful traditions are better than twenty things you feel obligated to do." on the page and the printout.
- No account needed, no reminders, no dates, no Advent tracker.

## Not October or November

October resets the home and starts one owned job each; November builds the family's ongoing shared responsibilities. December is about celebrating: choosing what matters and sharing the work of making it happen. No chores chart.

## Open questions

- Megan's approval or rewrite of the letter.
- **The QR code and the release date.** The letter lands in late November, but the kit page opens December 1 (release_at also decides which invoice earns the kit). Someone who scans on November 25 sees "This kit isn't open". Options: release December's kit a week early, or say "opens December 1" beside the code.
- The mail-house quote (D1, D9), same format as August.
