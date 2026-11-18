# Printed wording that names a month differently from its page: proposal for approval

Status 2026-11-18: **proposal only. Nothing printed has changed.** Owner decision 2026-11-18: "Align outdated printed
titles and mailer wording with the approved monthly pages where it improves clarity. Prepare exact before-and-after
wording for my approval before modifying printable outputs or fulfillment materials. Don't force identical wording
where a descriptive resource title is more useful."

The monthly pages (`/app/club/<month>`) are the source of truth (docs/product/UNIFIED_FAMILY_ARCHITECTURE.md §13).
Every row below is text that prints. Approve row by row; each one is a one-line change in the file named.

## A. The monthly meeting sheet: "Introducing …" and "Then use … together."

Printed on each month's meeting sheet (`src/lib/club/plan/meeting.ts`, from `resourceTitle` in
`src/data/club/family-meeting.ts`). Recommendation in **bold**.

| Month | Today prints | Proposed | Why |
| --- | --- | --- | --- |
| July | Introducing What Can I Do Right Now? Activity Board | **Introducing our I’m Bored! What Can I Do? board** | The page and the printed board are headed "I’m Bored! What Can I Do?"; "What Can I Do Right Now?" is only the on-screen label of the editor's summary box |
| October | Introducing Our 5-Minute Reset | **Introducing Our Daily Reset** | The printed sheet's own heading is "Our Daily Reset"; "5-Minute Reset" appears nowhere on the page |
| August | Introducing My School Day Routines | **Introducing our back-to-school plan and routines** | The printable's sections are "Our back-to-school plan" and "Our family routines"; descriptive beats the page's headline here |
| January | Our Family Weekly Meeting | **Our Family Focus** | The January page is Our Family Focus. January has no separate meeting sheet, so nothing prints this today; aligning it stops it leaking anywhere later |
| February | Family Laundry Guides | Keep | Descriptive and matches what prints (a guide per child) |
| April | Our Dinner Team | Keep | The printable says "Your Dinner Team" |
| May | Our Summer Day Rhythm | Keep | Page: "Our Summer Day" |
| June | My Family’s Snack Station | Keep | Descriptive |
| March, September, November | Our Family Rhythm · Our Family Habit Cards · Our Family Ownership Plan | Keep | Match |
| December | Our Christmas Mission | Keep | Page: "Your Christmas Mission Has Arrived!" |

## B. The kit registry's theme (mailer letters, older kit editor's chart footer)

`theme` in `src/data/club/kits/<slug>.ts` prints as the mailer letter's title (`LetterPrintables`) and the older chart
editor's footer ("Family Meeting Club · {theme}"). Every mailer is still a draft (not printed, quoted or sent).

| Kit | Today | Proposed theme | Also needed |
| --- | --- | --- | --- |
| February 2027 | Better Together (a Connection Challenge) | **My Laundry, My Job** | The February mailer draft and its `action`/`tool` describe a connection challenge, not the laundry guides the page delivers. It needs rewriting from the February page before it can print; I can draft that for your review |
| March 2027 | Our Family Spring Prep | **Our Family Rhythm** (Spring Prep named second in the letter) | Mailer copy check |
| July 2027 | What Can I Do Right Now? | **I’m Bored! What Can I Do?** | None |
| August 2027 | My School Day | **Back to School Without the Scramble** | None |
| October 2027 | A Home That Works Together (a five-item fall checklist and a chore chart) | **Less Asking. More Doing.** | The October mailer draft (`docs/club/mailers/2027-10-home-works-together.md`) describes a fall reset and chore chart, not the Daily Reset. Needs rewriting from the October page; I can draft it |
| April 2027 | Everybody Helps at Mealtime | Keep | Descriptive; the printable is the Dinner Team |
| Others | — | Keep | Match |

The kit slugs never change (entitlements, saved work and QR codes are keyed by them).

## C. November's printable year: FIXED (owner approved a narrow fix, 2026-11-18)

`src/components/club/NovemberOwnershipPrintable.astro` prints "FAMILY MEETING CLUB · NOVEMBER 2027" on all three
headers and works out children's ages as of 2027. It is the November tool for both November 2026
(`2026-11-family-ownership`, the current month) and November 2027. A November 2026 family would see 2027 and ages a
year ahead. Nobody holds November 2026 in production today (read-only, 2026-11-18), so no printed copy is affected yet.

**Done:** the page passes the kit's own month (`kitMonth`) and the printable prints "NOVEMBER 2026" or "NOVEMBER
2027" and works out ages for that November, with the same age rule as before. November 2027 got its own member route
(`/club/resources/2027-11-family-ownership`, its own saved version and orders). Tested separately for both editions:
headers, age-dependent jobs (Mia, born May 2017: 9 → "Lay out tomorrow's clothes"; 10 → "Prepare my school and
activity gear"), separate saved versions, the admin print view of each mailing, no order status changed. The public
sample (`/club/worksheet-generator`) shows the registry's November edition (2026), not a fixed year.

## D. Not proposed

Legacy views kept for saved work (January's old Habit Cards copy prints "September 2027"; the retired January
Weekly Meeting prints "January 2027 · Our Family Weekly Meeting"): left exactly as the families saved them.
