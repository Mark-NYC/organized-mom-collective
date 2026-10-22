# August 2027 mailer: Ready for the School Year (draft)

**Status (2026-10-23): draft for owner review. Not printed, not quoted, not sent.** Kit config: `src/data/club/kits/2027-08-school-year.ts`. Every piece below also exists as a printable in the digital kit ("In the mail" tab), so a member can reprint it.

**The rule for this mailer: useful even if nobody scans the QR code.** The printed pieces carry a complete, generic back-to-school plan with blank owner lines; the QR code adds the personalized version (her children's names, ages, schools and first days), it doesn't hold the value hostage.

Mailer cutoff 2027-07-15, mail drop around 2027-07-20, kit opens 2027-08-01 ([YEAR_ONE_CALENDAR.md](../YEAR_ONE_CALENDAR.md)).

## What's in the envelope

| # | Piece | Format (proposed; confirm with the mail house quote, D9) | Content source |
| --- | --- | --- | --- |
| 1 | Letter from Megan | Folded card, 5.5 × 8.5 in, one side | **Megan writes it.** Placeholder only (below) |
| 2 | Ready for the School Year: the one-page guide | US Letter, two sides, heavier stock | `mailer.fieldGuide` (front) + the printed launch plan (back) |
| 3 | The School-Year Huddle | 5 × 7 in card, two sides | `mailer.activity` + per-person write-in lines |
| 4 | Backpack Station Reset | 5 × 7 in card, plus a strip of six hook labels | `printables → backpack-station` |
| 5 | QR code | On the back of the guide, bottom right | `mailer.qrPath` |

## 1. Letter from Megan (placeholder)

Megan writes this herself, in her own words. Nothing here stands in for it, and the kit can't be scheduled until it exists (`schedulable()` refuses `letter: null`). Suggested ground to cover, only where it's true for her: what the first week of school is like at her house; why the jobs go to everyone this year; one thing she's letting go of. No invented stories, numbers or quotes.

## 2. Ready for the School Year (guide)

**Front: the six ideas** (from `mailer.fieldGuide.sections`):

1. **Start two weeks out.** Forms, supply lists and bedtimes take longer than the night before allows.
2. **Give each child their own launch list.** Their list is theirs, so the getting-ready isn't all yours.
3. **Hand off whole school jobs.** Rides, school email, lunches and papers each get one owner for the year.
4. **Practice the morning before it counts.** Two practice runs show where the morning sticks.
5. **Make the week visible.** Ten minutes on Sunday, everyone writes the week where the family can see it.
6. **The first two weeks will wobble.** Keep the plan, fix one thing at the Sunday check-in.

**Back: Our School Launch, printed for any family.** A generic version of the digital launch plan, grouped by timing, each line with a blank "Who" column to fill in at the huddle:

- *Two weeks before:* first days, early dismissals and breaks on the family calendar · supply lists checked and bought · school forms in · physical and vaccine forms checked · bedtimes moving earlier · school clothes and shoes tried on · last year's backpack emptied
- *The week before:* drop-off and pick-up plan settled · backpack station reset · first week of lunches planned · meet-the-teacher on the calendar · the school morning practiced twice · class schedule, bus and locker looked up · the huddle
- *The night before:* backpacks packed and by the door · first-day outfits laid out · alarms set and tested
- *First day:* the first-day photo

Bottom right: the QR code (piece 5).

## 3. The School-Year Huddle (activity card)

20 minutes, a few days before school starts, everyone together (from `mailer.activity`):

1. Sit down together before the first day, with everyone's launch list.
2. Each person says one thing they're excited about and one they're nervous about. Nobody fixes anything yet.
3. Read the school-year jobs out loud: rides, lunches, papers, the homework check-in. Each grown-up and older kid picks one to own.
4. Each child picks one new thing they'll do themselves this year.
5. Agree where backpacks, shoes and school papers live.
6. Write the first days and the first early dismissal on the family calendar together.

Back: six write-in lines, "Name" and "The school-year job I'll own", and one for "Check-in day".

## 4. Backpack Station Reset (card + hook labels)

Twenty minutes by the door (from the `backpack-station` printable): clear the drop zone; one hook or bin per child, with their name on it; a shoe spot the littlest can reach; a paper inbox for anything a grown-up must sign; lunchboxes to the sink after school; every night, backpacks packed and on their hooks; Sunday, empty the inbox and check the bins.

The tangible extra: a strip of six blank hook labels (name line, a small illustration from the card set) to cut apart and hang. Quote it separately; drop it if it breaks the $5–7 margin.

## 5. QR code

- **Placement:** back of the guide, bottom right, 1 × 1 in, quiet zone kept clear, above the fold line if the guide is folded.
- **Caption beside it:** "Your family's plan, already filled in: each child's launch list, routine charts and who owns what. Scan to open it."
- **Target:** `https://www.organizedmomcollective.com/club/kits/2027-08-school-year?source=mailer` (permanent once printed; never rename the slug).
- **Fallback for people who don't scan:** the short line "or sign in at organizedmomcollective.com/club" (only once that page exists and is live).
- Members land in their personalized kit; anyone else lands on sign-in. Test the printed proof on two phones before approving it.

## Calendar mention (one line, honest)

The guide's "Make the week visible" section and the huddle's last step point to "the family calendar", any calendar the family uses. The digital command center prints to hang beside the wall calendar. Don't claim the wall calendar syncs with anything, and don't put a sales pitch in the mailer; the member already belongs.

## Open questions

- Quote for this envelope (5 pieces, one with a die-cut label strip) at the $5–7 working price (D1).
- Whether the hook-label strip is worth its cost, or becomes a printable only.
- Megan's letter.
