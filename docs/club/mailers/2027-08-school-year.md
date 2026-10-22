# August 2027 mailer: Ready for the School Year

**Status (2026-10-23): design draft for owner review. Not printed, not quoted, not sent.** Kit config: `src/data/club/kits/2027-08-school-year.ts`; the printable twin is the kit's "Your printed letter" (`LetterSheets` in `src/components/club/print/LetterPrintables.tsx`), so the mailed piece and the reprint never drift apart.

**One sheet, two sides:** a double-sided 8.5 × 11 in letter, sent flat in an envelope. One letter, one action, one tool. It has to be worth reading, using and keeping **even if nobody scans the QR code**: the countdown and the routine example work on paper alone.

Mailer cutoff 2027-07-15, mail drop around 2027-07-20, kit opens 2027-08-01 ([YEAR_ONE_CALENDAR.md](../YEAR_ONE_CALENDAR.md)).

## Design

Warm ivory paper (#FBF7F1), warm charcoal text, muted sage and rose accents. Georgia for the title, the letter and the guidance; Montserrat for small labels and the checklist; Kalam only for Megan's signature and handwritten names. Generous margins (0.5–0.6 in), single column on the front, no type under 10 pt except small capital labels. Square edges, hairline rules. No prices, offers, coupons or sales copy: she already belongs.

For the mail house: the on-screen version has a 0.35 in home-printer margin; the production file gets the same layout at full size with a 0.125 in bleed on the ivory background. Paper: an uncoated warm-white or ivory text weight (quote two, D9).

## Front

1. **Header line:** ORGANIZED FAMILY CLUB · AUGUST 2027 (small capitals, hairline rule).
2. **Title:** Ready for the School Year. **Subtitle (italic, rose):** One calmer start. Everyone has a part.
3. **The letter** (about 190 words, from `mailer.letter`). **A draft for Megan to approve or rewrite in her own words**; the kit can't be scheduled while it's marked `draft`. No invented stories, numbers or quotes.

   > Hi friend,
   >
   > Back-to-school has a way of landing on one person. The forms, the supply lists, the shoes that suddenly don't fit, the question of who's driving on Tuesday. If that person is usually you, this letter is for you.
   >
   > This year, try getting ready together. Not you preparing everyone, but everyone preparing a little. A six-year-old can try on shoes and lay out an outfit. A ten-year-old can pack their own backpack. A partner can own drop-off, start to finish.
   >
   > The countdown below is six things, not sixty. Put the school dates on the family calendar where everyone can see them, then work down the list together. Write a name beside each one.
   >
   > And start small. One routine that sticks by October is worth more than five perfect ones that fall apart in week two. The wobbly first weeks are normal.
   >
   > You don't have to carry the school year alone. Everyone has a part.
   >
   > Warmly, *Megan*

4. **Our Back-to-School Countdown** (sage panel, six checkboxes, a "Who's helping?" line beside each):
   1. Add school dates and activities to the family calendar.
   2. Check clothes, shoes and school supplies.
   3. Set up a place for backpacks and school papers.
   4. Decide who's handling drop-off and pick-up.
   5. Practice morning and after-school routines.
   6. Pack bags and get everything ready the night before.

## Back

1. **Helping kids own their school day**: four short tips in two columns: Four to six steps · Pictures first · Ask "What's next?" · Practice before it counts.
2. **For example: a school morning for a seven-year-old**, with the responsibility-card illustrations: Get dressed · Make my bed · Breakfast at the table · Brush my teeth · Comb my hair · Backpack, lunch and shoes by the door. Generated from the routine tool's own rules (`exampleRoutine()`), so the paper matches what she'll see online.
3. **Make a chart for each of your kids**: the QR code (1.2 in, quiet zone kept) beside "Scan the code, pick a child and morning or after school. We suggest steps for their age; change any of them, then print." and the readable address **organizedmomcollective.com/club/kits/2027-08-school-year**. The code encodes `https://www.organizedmomcollective.com/club/kits/2027-08-school-year?source=mailer` (permanent once printed; never rename the slug). Test the printed proof on two phones before approving it.
4. **On the family calendar** (rose band, the one reminder): Before the first day, write every first day, early dismissal and school break on your family calendar, where everyone can see them. Says "family calendar", so it's useful whether or not she owns ours; never claims the paper calendar syncs with anything.

## Why it's worth opening without scanning

The letter names the problem and gives her permission to share it; the countdown is the whole action, on paper, with room for names; the back teaches the one idea behind the tool and shows a finished example she can copy by hand onto any chart.

## Open questions

- Quote for one double-sided sheet, flat, in a #10 or 9 × 12 envelope (flat keeps it fridge-ready) at the $5 working price (D1, D9).
- Megan's approval or rewrite of the letter.
