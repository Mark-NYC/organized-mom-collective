# November 2026 mailer: Our Family, Our Team

**Status (2026-10-23): design draft for owner review. Not printed, not quoted, not sent.** Kit config: `src/data/club/kits/2026-11-family-ownership.ts`; the printable twin is the kit's "This month's letter" (`LetterSheets` in `src/components/club/print/LetterPrintables.tsx`). The letter is a draft for Megan (`draft: true`): the kit can't be scheduled until she approves or rewrites it.

**Rebuilt 2026-10-23 as a coach.** November used to be the Family Ownership Builder: a chart of household jobs for everyone, plus four more printables in five tabs. It's now one letter, one next step and one short guided conversation that meets the family where it is. The builder is kept, unregistered, in `src/data/club/libraries/family-ownership-builder.ts`.

**One sheet, two sides:** a double-sided 8.5 × 11 in letter, sent flat in a quality envelope. Useful without scanning: the family circles a path on the front and writes its next step.

*Make the plan together. Learn to share the load.* September made the plan together; November helps it stick, troubleshoots what isn't working, and takes the next step toward shared ownership.

## Front

1. **Header:** ORGANIZED FAMILY CLUB · NOVEMBER 2026, then November's touch (`accent: 'team'`): three fine-line figures in sage, linked by one clay arc. Soft clay panels.
2. **Title:** Our Family, Our Team. **Subtitle:** Make the plan together. Learn to share the load.
3. **The letter: It's Okay to Start Again** (about 165 words). **A draft for Megan to approve or rewrite.** New routines take a few tries; the answer is usually a realistic time, a visible reminder, clearer roles or a smaller first step; when the plan is working, the next step is ownership. Includes *"Whether you've been doing this for months or you're just getting started, you can take one small step together this week."* and the question *"What's one thing that would help our family work better together this week?"* Personal greeting ("Hi {name},") when her first name is known, "Hi friend," otherwise. Signed "Warmly, Megan". No guilt about missed meetings, no two-adult assumption, no criticism of husbands or children, no invented stories, and no assumption she had September's kit.
4. **Our Family's Next Step.** *You don't need a perfect system. Just one useful next step. Circle the one that fits.* Three short paths:
   1. **We're just getting started.** Our next step: have one short family meeting. Choose a day and time; gather around the wall calendar; talk about what's coming this week; let everyone add something; use September's meeting guide if it helps.
   2. **We started, but got off track.** Our next step: make the meeting easier to repeat. Choose one change: put the guide where everyone sees it; tie it to something you already do; make it shorter; give someone else a part in leading.
   3. **We're ready to share more ownership.** Our next step: hand off one whole responsibility. Pick something an adult still manages alone; choose who can begin to own it; agree on what finished looks like; practice together; then let them own it.

   Then two lines: **Our family's next step** ____ · **When we'll try it** ____

## Back

1. **Make the Rhythm Stick.** Make it visible. / Connect it to an existing habit. / Share the leadership. / Start small.
2. **Ready for the Next Step?** Helping vs. owning in one sentence, then **Show it · Do it together · Hand it over · Check in**.
3. **Ask at dinner this week:** *What's one thing that would help our family work better together this week?*
4. **New to the Club? We've got you.** Your membership includes our September digital kit, A Week Everyone Can See, with a simple family meeting guide to help you get started. Words only: no prices, values or deadlines.
5. **Find Your Family's Next Step:** one QR code to `/club/kits/2026-11-family-ownership?source=mailer` (decodes, verified in QA), and the readable address.
6. **On the family calendar:** Write your next step on the family calendar, on the day you'll try it, where everyone can see it.

## The Family Rhythm & Ownership Guide

Screen `src/components/club/RhythmGuide.tsx`, rules `src/data/rhythm-guide.ts`, print `src/components/club/print/NextStepSheet.tsx`. In the kit itself (not a site tool): one button, **Find Our Family's Next Step**, then one question at a time, only the ones her answers lead to. About three minutes. Answers and the plan save in the kit's `next-step` document as she goes; Back steps one question at a time; Start over clears it.

| She says | Then | Her plan |
| --- | --- | --- |
| It's going pretty well → Mom still leads most of it | Who could lead the next meeting (anyone 6+ but her, or a name she types), when | **Our Family's Next Step:** share the meeting leadership, with what a leader does at their age |
| … → We share it pretty well | Straight to the handoff | **Our Ownership Handoff Plan** |
| … → Another person leads / It varies | "That sounds like it's working. Keep it." A handoff offered, or "Not right now" (no plan forced) | Handoff, or none |
| We started, but got off track | What made it hard (six answers; "Something else" in her words, matched by keywords, or one small experiment when it can't tell), one adjustment to choose from up to three, when | **Our Family Restart Plan** |
| We haven't started yet | "That's okay. You don't need to catch up." When the family could gather, where the guide will live | **Our First Family Meeting Plan** |
| I'm new to the Club | Welcome, and the September bonus (Open My Bonus September Kit, linking the real kit); then Start November's Guide → a first meeting or a handoff | First meeting or handoff |

**Restart responses:** forgetting → make it visible (guide by the calendar, the time on the calendar, tied to an existing habit); no good time → fit the family (a time you're already together, five minutes, another day: never "Sunday only"); Mom doing all the planning → share the leadership; kids not participating → one small role each, from the family's real ages; too long → the five-minute reset (three questions).

**The handoff (Hand Off One Whole Job):** one of six jobs (or her own), who could own it (not the account holder, nobody preselected; each person's age-suited version from the ownership job library), what's hard about letting go (one short coaching answer each: reminding → a trigger and a visible cue; different standards → agree on done, let go of how; faster myself → teach once, then step back; follow-through → start small, check in after a week), then three editable lines (I own / When / Done looks like), then Show it · Do it together · Hand it over (support for their age) · Check in.

**Every plan:** one goal, one next step, who's involved, when, one visible reminder, one check-in question. Editable, saved, printed on one US Letter page, or copied as text. Never all three plans; no chart, no daily boxes.

## The September bonus

New November members get September's complete digital kit (its meeting, letter and Family Weekly Reset Builder), linked from the guide's welcome, the kit page and the letter's back. The kit page passes `?from=` so September shows "A bonus with your November 2026 kit · ← Back to Our Family, Our Team".

**Access:** `supabase/migrations/20261104000000_club_november_bonus.sql` (**not applied**) adds `club_kit_bonuses` and lets `club_can_open` open a bonus kit with the kit that gives it, before the bonus's own release date, once the bonus kit isn't a draft. Tested in `supabase/tests/club-access.sql`. Until it's applied, and until September is scheduled, the link shows only in sample previews (where every kit opens); the page says "It opens here as soon as it's ready for your account" otherwise. A preview flag is never treated as a paid membership.

**Calendar order:** November is dated 2026-11 and September 2027-09, so the bonus opens September ten months before its own release, and the dashboard lists it as "A bonus with your membership", not as this month's kit. No back issue is mailed; nothing is sold.

## Open questions

- Megan's approval or rewrite of the letter.
- Scheduling September's kit (its letter is also a draft, and its brief arrived incomplete) before November goes out, so the bonus can open.
- The mail-house quote (D1, D9).
