# Monthly resource consistency (audit, Oct 30 2026)

Goal: the family sees, discusses, approves and receives the same monthly resource. Four surfaces have to agree:

| Surface | Where | Reads |
| --- | --- | --- |
| App month page (tool + Family Meeting) | `/app/club/<month>` | the printable in the page's `printable` slot; meeting content `src/data/club/family-meeting.ts` |
| Member's copy (what she approves) | `/club/resources/<slug>` | `src/data/club/resources.ts` → `component` |
| Fulfillment (what is mailed) | `/club/resources/<slug>?fulfillment=<order>` → browser Print → Save as PDF | same page and registry as the member's copy |
| Welcome Kit first resource | the member's copy of her first paid month | same registry (`welcome` text too) |

Checked by `tests/club-resource-consistency.test.ts`; PDFs rendered with `scripts/club-resource-pdf-audit.mjs` (Rivera family, all 12 months, member page, app page and the admin's January fulfillment view).

## Month by month

Pages and sizes are from the rendered PDFs after this PR's print fixes (before → after where they changed).

| Month | App page and meeting | Member copy / fulfillment (what mails) | Mails | Status |
| --- | --- | --- | --- | --- |
| January | Our Family Weekly Meeting (`SeptemberSundayReset`, 2 sheets) | Our Family Habit Cards (`JanuaryHabitCards`), **sheet headed "September 2027"** in September's color | 1 page portrait (was 2: the sheet twice) | **Decision** |
| February | Family Laundry Guides (`FebruaryLaundryGuides`) | **Family Laundry Guides** (same printable; owner's decision, Oct 30 2026) | 1 portrait page per readiness level in use (Rivera: 2). Was Connection Cards, 1 page | Consistent |
| March | Our Family Chore Charts (`MarchChoreCharts`, 1 landscape sheet per child; Rivera 3) | Spring Prep as a Family (`MarchSpringPrep`) | 1 page portrait (was 2: one blank) | **Decision** |
| April | Our Dinner Team | same | 2 pages portrait | Consistent |
| May | Our Summer Day Rhythm | same | 1 page portrait | Consistent |
| June | My Family’s Snack Station | same | 1 page portrait | Consistent |
| July | What Can I Do Right Now? (sheet: "I’m Bored! What Can I Do?") | same | 1 page portrait | Consistent (meeting title aligned) |
| August | My School Day Routines | same | 1 page portrait | Consistent (descriptions fixed) |
| September | Our Family Habit Cards (`JanuaryHabitCards`, 1 sheet) | Our Family Sunday Reset (`SeptemberSundayReset`), **sheets headed "Our Family Weekly Meeting · January 2027"** | 2 pages portrait | **Decision** |
| October | Our Daily Reset | same | 2 pages portrait | Consistent (title was "Our 5-Minute Reset") |
| November | Our Family Ownership Plan (meeting page links to the member copy) | same | 2 pages portrait (was 3: the front's last lines alone on a page) | Consistent; **sheets say "November 2027" on the 2026-11 kit** (decision 4) |
| December | Your Christmas Mission | same | 2 pages portrait | Consistent (meeting title aligned) |

Production (read-only check, Oct 30 2026): January's kit is **scheduled**; **4 January monthly orders are pending** (founding members' Welcome Kits, none approved); **2 households saved their own January version** (Habit Cards state); 2 of 4 welcome prints are approved. Every other kit is a draft.

## What changed in this PR (nothing that changes the mailed product)

- **Fulfillment print:** the member page now prints only its printable (ClubPrintStyles: `data-plan-print-scope`, plus `data-plan-print-root` when the printable marks its sheets, the same rules every app plan page uses). Before, the hidden member panel and editor stayed in the print layout: January printed the cut sheet **twice**, February and March added a **blank page**, November pushed the front's last lines onto a page of their own. After: January 1, February 1, March 1, November 2 pages. The January page is pixel-identical to the same printable printed from its plan page; April–October and December are pixel-identical to before. February's and March's sheets got sheet markers (attributes only).
- **Titles:** October's registry title is now the printed "Our Daily Reset"; the meeting names March, July, October and December exactly as the product is named.
- **Descriptions:** August in the Club library and on `/club` ("a personalized countdown") now describes the School Day Routines; June and July on `/club` (screen-time expectations, packing lists) now describe the Snack Station and the Activity Board.
- **February is the Laundry Guides (owner's decision).** The member copy and fulfillment now render `FebruaryLaundryGuides`, the same printable as `/app/club/february`, with her household and her saved version (it reads the household from the same `omc:club-preview-household` event and saves through the same member storage key, so no copy of the printable). Its editor opens only through its plan controller, so her copy has a **Change your plan** button that calls `clubPlan.openEditor()` (only while she can edit and it isn't printed). Checked: a change saves to her account and comes back after a reload; the print is one Letter page per readiness level; 390px wide without sideways scrolling. The member page now marks the print root when sheets appear later, not only at load.
- **Family Meeting links:** the Club library doesn't link a member from her January, February, March or September copy to a meeting about a different tool (`resources.ts → sameAsApp`). Previews are unchanged.
- **Guard:** `tests/club-resource-consistency.test.ts` fails if a member copy and its app tool drift apart again, or if the meeting names a different product.

Not changed: what each month renders for members and fulfillment, the Welcome Kit (still January Habit Cards, same text and approval flow), deadlines, approval, billing, orders, saved versions, page sizes and orientation.

## Decisions for the owner

1. **January and September are swapped between the app and the mailing.** Members approve and would receive Habit Cards in January (headed "September 2027") and the Weekly Meeting in September (headed "January 2027"). Options:
   - **A. Repoint both to the app pages (recommended for the product, needs your go-ahead).** January members get the 2-page Weekly Meeting (one page more per January mailing and Welcome Kit), September gets the 1-page Habit Cards. The four pending January Welcome Kits would change contents; the two saved January versions are Habit Cards state and wouldn't carry over. Small code change: swap the two `component` keys, titles and `welcome` text.
   - **B. Keep Habit Cards as January's mailing.** Then the January printable needs its own month label and color on the member copy (today it prints September's), the app's January page and meeting should show Habit Cards, and September needs the same treatment in reverse.
2. ~~February~~ **Decided: Laundry Guides.** Follow-up: the February kit config (`src/data/club/kits/2027-02-better-together.ts`, theme "Better Together") and the `/club/february-preview` sample still describe the Connection Cards; members don't see either from their copy, but the kit's database title and the public sample should follow.
3. **March: Spring Prep (mails today, matches the kit config) or Chore Charts (app page and meeting).** Chore charts are **landscape**, one page per child (Rivera: 3 vs 1 today): more pages and a different orientation for the printer. Same shell question.
4. **November's sheets say "November 2027"** while the registry's kit is `2026-11` (first printed mailing month is November 2026 in club_settings). If November 2026 mails, the year is wrong; if the program starts in 2027, the registry should point at `2027-11-family-ownership`.

Until decided, the meeting for these months describes the app page's tool, and members holding them aren't linked to it from their copy.
