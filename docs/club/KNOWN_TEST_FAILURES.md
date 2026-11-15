# The failing-test baseline, retired (2026-11-15)

Until now CI accepted a list of failing unit tests (`tests/known-failures.txt`, 56 by November) and only blocked
failures not on it. That list and `scripts/compare-test-failures.mjs` are gone. **CI runs `npm test` on every pull
request and every test must pass.** A real open problem is written into its test as an explicit expectation that
breaks when the problem is fixed (so it can't be forgotten), never as an ignored failure.

All 56 were audited. Result: 8 real defects fixed, 2 left open and recorded in their tests, 12 tests updated to
the product as it is, 41 tests removed because the draft they described was replaced.

## Real defects, fixed

| Was failing | Defect | Fix |
| --- | --- | --- |
| `club-kits`, `club-may` | May's mailed QR code pointed at a public preview page (`/club/may-preview/`), not the month's own member page like every other kit | `qrPath` now `/club/kits/2027-05-finish-the-school-year?source=mailer`. **Owner: this changes what May 2027's mailer prints; say if the preview page was intended** |
| `shop` (launch guard) | Calendar buy links went to the website checkout in every build, where `src/config.ts` and every other product say "only in shop-enabled builds, otherwise Etsy" | Guard restored in `src/lib/reorder.ts`. No change on the live site (its shop is enabled; checked 2026-11-15) |
| `shop` (paste-ready files) | `supabase/dashboard/shop-checkout.ts` (and two others) were out of date with their sources | Regenerated with `npm run build:functions`. Files only; nothing deployed |
| `email-checkout-attribution` | A URL fragment passed with the query was read as part of the campaign name | The fragment is cut off before parsing, so a resource pass in `#…` can never be read or stored |
| `club-countdown` (whole file crashed on load) | It borrowed August's countdown lines, which August no longer has; the library is still used by the wrap-up builder and kit pages and had no running tests | The tests have their own fixture; all 17 run again |

## Real defects, still open (recorded in the test, CI stays green)

| Where | Problem | Needs |
| --- | --- | --- |
| `tests/club-kits.test.ts` → "kits with an open problem" | July and August 2027 have no `action`; the kit page their mailed QR opens still reads one and would fail for those months. `schedulable` refuses both, so nothing can be mailed in this state | Owner/content decision before July is scheduled: give them an action/activity, or open the plan screen from the kit page |
| `tests/shop.test.ts` → email pictures | `family-schedule-calendar-2027` has no `public/email/<slug>.jpg`; its order email would show a broken image | The real product photo (never a generated one) |

## Updated to the product as it is

`logic` (the printed QR's `/start` → `/app/calendar`; day links at `/app/cleaning`), `tool-sharing` (the chore chart is
a builder; the email gate is now checked by behavior, not by source text), `club-october` (motto punctuation; August's
shape), `club-print-deadline` (benefit-led banner: "Order by Dec 13"), `worksheet` ×3 (renamed Our Family Ownership
Plan; more fields), `shop` (the scheduler product is on the guarded list).

## Removed: tests of drafts that were replaced

Each month's kit was redesigned (one practical printed tool per month) and its test file kept asserting the earlier
draft's titles, steps and letter length. Those 41 tests are removed; the helpers in the same files that still exist
keep their tests. In their place `tests/club-kits.test.ts` checks, for every month at once: the kit passes validation,
its theme / flagship printable / hosted tool match one table (changed deliberately, with the kit), its letter is
60–220 words, and its mailed QR opens its own member page.

| File | Removed | Tests |
| --- | --- | --- |
| `tests/club-august.test.ts` | 7 | passes every kit check, beside November; is the theme and subtitle the owner set; has exactly the six countdown lines, with an optional helper blank instead of assignments; prints the countdown and the letter, and nothing from the first draft: no launch plan, command center, overview or item sets; has a 150–200 word letter, still a draft for Megan, so the kit can’t be scheduled yet; asks one family question on the back of the letter; the letter’s example is the routine chart’s own morning starter, with its illustrations |
| `tests/club-january.test.ts` | 10 | passes every kit check and sits in month order; has exactly the five steps, no dates, no per-step assignments; asks for the family’s one thing, offering the habit builder’s own areas, a plan on step 2 and a start day on step 4; saves the one thing, plan and start day, checks in a week later, and never schedules anything else; works for a family that joins late in January, or opens it later: no date is assumed; prints the plan and the letter, like the other three-part kits; is a 150–200 word draft for Megan, greets by name when known, asks the family question, and picks one thing; puts the three principles, one example, the question, the QR code and the calendar note on the back; is a site tool the Club hosts for the whole family, with its first names; copies one habit as plain text with the reflection, and its card has no scoring |
| `tests/club-july.test.ts` | 5 | passes every kit check and sits in month order; has exactly the five steps, where and when above them, and the outing choices the builder knows; is a 150–200 word draft for Megan, with the question, and no guilt, blame or vacation assumption; puts the guide by age, Pack Check Unpack, the question, the builder, the gear note and the calendar note on the back; is a site tool the Club hosts with the family, separate from the month’s copy, and leaves the travel checklist alone |
| `tests/club-june.test.ts` | 5 | passes every kit check and sits in month order; has the four decisions, each with a line to write the family’s answer, and nothing scheduled; offers two independent tools, the site’s own, with the June names and buttons; is a 150–200 word draft for Megan, with the question, and no guilt, anti-screen talk or stay-at-home assumption; puts the principles, the boredom card, the gear tip, both tools under one QR code and the calendar note on the back |
| `tests/club-march.test.ts` | 5 | passes every kit check and sits in month order; has exactly the five steps, the space and when written above them, optional helpers, and nothing scheduled; prints the reset and the letter, with a leafy stem; puts the field guide, the optional decluttering ideas, the question, the builder and the calendar note on the back; is a site tool the Club hosts with the family’s names and ages, separate from the month’s copy |
| `tests/club-may.test.ts` | 5 | passes every kit check and sits in month order; has exactly the five steps with their sentences, optional helpers, no dates, and a start-anywhere note; is a 150–200 word draft for Megan, with the question, and no guilt, blame or invented story; puts the three principles, the Five Favorites Rule, the reflection keepsake, the builder and the calendar note on the back; is a site tool the Club hosts with the family’s names and ages, using August’s date logic |
| `tests/club-september.test.ts` | 4 | passes every kit check and sits in month order; has the five meeting steps with their minutes, 15 in all, and a line for the meeting day and time; is a 150–200 word draft for Megan, with the question, and no guilt, blame or two-parent assumption; is a site tool the Club hosts with the family, separate from the month’s copy and from the paid Weekly Reset System |

## Owner decision this audit surfaced again

January and September have traded content between files: January's kit is now the family meeting ("A Week Everyone
Can See") and September's is the Habit Cards, while the public print-deadline banner still advertises **January's Habit
Cards**. See [JANUARY_MEETING_ALIGNMENT.md](JANUARY_MEETING_ALIGNMENT.md). The table in `tests/club-kits.test.ts`
records what the kit files say today; it doesn't decide which month is right.
