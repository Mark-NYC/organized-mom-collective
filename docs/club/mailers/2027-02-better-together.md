# February 2027 mailer: Better Together

**Status (2026-10-23): design draft for owner review. Not printed, not quoted, not sent.** Kit config: `src/data/club/kits/2027-02-better-together.ts`; the printable twin is the kit's "This month's letter" (`LetterSheets` in `src/components/club/print/LetterPrintables.tsx`), the same component as the other three-part kits.

**One sheet, two sides:** a double-sided 8.5 × 11 in letter, sent flat in a quality envelope. One letter, three simple connection actions, one optional planning tool. Useful without scanning: the challenge, the prompts and the back page work on paper alone.

Mailer cutoff 2027-01-15, mail drop around 2027-01-20, kit opens 2027-02-01. Nothing depends on a date.

## Design

The Club stationery with February's one touch (`mailer.accent: 'blush'`): a single fine-line heart in muted rose above the title and beside the back-page heading, and blush panels for the challenge and the prompts (the calendar note goes sage). No red, no pink, no hearts beyond that, no Valentine's imagery. Georgia, Montserrat, Kalam only for the signature, generous margins.

## Front

1. **Header:** ORGANIZED FAMILY CLUB · FEBRUARY 2027, then the heart.
2. **Title:** Better Together. **Subtitle:** Less managing life. More enjoying it together.
3. **The letter: Make Room for Each Other** (about 170 words with greeting and sign-off). **A draft for Megan to approve or rewrite**; the kit can't be scheduled while it's marked `draft`. No invented stories or experiences: if Megan wants a story of her own, it replaces the third paragraph. "Hi Ana," when her first name is on her profile; otherwise "Hi friend,".

   > It's possible to spend a whole day caring for your family without really getting to enjoy them. Meals, rides, homework, laundry, bedtime. Everything keeps moving, and at the end of the day you realize you barely sat down together.
   >
   > That isn't a failing. It's what busy weeks do. But it's also the reason we organize at all: not to get more done, but to make room for the people we love.
   >
   > Connection doesn't need a vacation or a perfectly planned family night. It can be a conversation over dinner, fifteen minutes on the floor with one child, or laughing together while you clear the living room.
   >
   > And it doesn't all have to come from you. You don't need to be the family's entertainment director. Ask everyone for ideas, and let them help make it happen.
   >
   > The challenge below is three small things. Do one, or all three, whenever they fit.
   >
   > At dinner this week, ask: "What's something you'd love for us to do together more often?"
   >
   > Warmly, *Megan*

4. **Our Family Connection Challenge** (blush panel): "Three little ways to enjoy each other more this month." Three checkboxes, each with its sentence and an **Our idea: ______** line under it. No dates, assignments or scores.
   1. **Do something together.** Choose one simple activity the whole family can enjoy, like a board game, a walk or cooking dinner. It can be free.
   2. **Make time for one-on-one.** Fifteen minutes with one child or family member counts. Every grown-up takes a turn, not just Mom.
   3. **Make a shared space more inviting.** Reset one spot together, like the living room floor or the game shelf, on that room's cleaning-zone day. (The wall calendar has a daily cleaning zone; this rides on it, no separate schedule.)

## Back

1. **Make Room for Connection.**
   - **Make ordinary moments count.** Connection doesn't always require special plans. Use moments already in the day.
   - **Let everyone contribute.** Ask children and other family members to suggest activities and help make them happen.
   - **Keep it simple enough to repeat.** A small family tradition that actually happens is better than an elaborate plan that never does.
2. **For dinner, the car, or a slow evening** (blush panel), three prompts: What's something that made you laugh this week? / What's something you'd love for us to do together more often? / What's one thing you appreciate about someone in our family? The letter's question is the second prompt, word for word, so it appears once on the back rather than twice in two wordings.
3. **Family Connection Planner:** the QR code beside "Find simple activities that fit your family's ages, time, and budget. Scan the code, then tap "Find Something to Do Together": answer a few questions, choose one of three ideas, and print or copy your plan." and **organizedmomcollective.com/club/kits/2027-02-better-together**. The code encodes `https://www.organizedmomcollective.com/club/kits/2027-02-better-together?source=mailer`, verified by decoding the printed code; that page opens the planner from its button. Test the printed proof on two phones.
4. **On the family calendar** (sage band): Choose one moment to enjoy together this month. Put it on the calendar and let everyone help make it happen.

## The Family Connection Planner

A new site tool, built on the same idea rules as December's traditions picker (`src/lib/idea-picker.ts`, extracted from it; December's results are unchanged). Component `src/components/site/ConnectionPlanner.astro` + `connection-planner.ts`, ideas `src/data/connection-ideas.ts` (29 ideas: family moments, one-on-one moments, simple rhythms). Hosted in the Club at `/club/tools/connection-planner`; no public page yet, built to take one (and Pinterest traffic) without a handoff.

- Optional questions with defaults: children's ages (the profile's, or four age chips), whole family / one-on-one / both, 15 minutes to more time, budget, at home or out.
- Three ideas straight away: a family moment, a one-on-one moment, a simple rhythm (two of one kind if she asks for it). Ranked by time, then how many of the family's age bands an idea suits (a family with a preschooler and teens gets ideas for both), then budget. Rhythms are always small. Nothing childish when every child is a teen; nothing too old for a toddler.
- Each idea: title, one or two sentences, time, cost, simple prep, and how it's shared ("Any grown-up, grandparent or older sibling can take a turn"). No idea names a parent or assumes two.
- Swap, edit (title and description), choose one. The plan: the idea, who's joining (the family's first names, or typed), when, simple prep, a question. Download (US Letter) or copy. "Write it in the family and friends section of the wall calendar."
- Not in it: dashboards, scores, streaks, reminders, recurring schedules, assessments, bookings, a month-long calendar.

## Not the other months

January improves one rhythm; August prepares for school; October resets spaces; November shares responsibilities; December is celebrations. February is connection: the shared-space reset is one small supporting action, not a cleaning project.

## Open questions

- Megan's approval or rewrite of the letter, and whether she wants a story of her own in it.
- The mail-house quote (D1, D9), same format as August.
