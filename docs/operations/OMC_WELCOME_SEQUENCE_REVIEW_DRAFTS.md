# Organized Mom Collective: resource signup welcome sequence

**Status:** Copy for owner review. Not in Resend, not scheduled, not sent.
**Audience:** Brand-new subscribers who explicitly chose marketing emails through a free tool or guide form.
**Delivery proposal:** Day 2 and Day 6 after first opt-in, then enter One Small Win on the next normal newsletter send day.
**Rules:** A repeat signup or free download never restarts the welcome series. No retroactive enrollment of existing subscribers without a separate decision. One marketing email max per recipient per day. Respect suppressions, and never send a welcome email to someone who did not opt in. Do not send existing One Small Win tips as welcome emails.

## Day 2

**Subject:** Start smaller than you think
**Preview:** One change, one person, one week. That's enough.
**Header:** A SMALL START · Build one thing that lasts

When everything at home needs attention, it's tempting to fix five routines at once.

But you don't need a new system for the whole house today.

Pick **one small job** that would make your week easier if somebody else owned it.

It could be putting shoes away, clearing their place after dinner, or putting dirty clothes in the hamper.

Then do three things together:

1. Show what finished looks like.
2. Let them practice while you're there.
3. Give that same job another try tomorrow.

Don't worry about making a chart yet.

Start with one person, one clear job, and a few repetitions. That's enough to build on.

**Your small win:** Choose the job today and practice it together once.

Organized Mom Collective

## Day 6

**Subject:** Give the reminder a place to live
**Preview:** The goal isn't more reminders. It's fewer reminders from you.
**Header:** A SMALL START · Make the next step visible

You know the kind of reminder that happens every day?

“Shoes in the basket.”
“Did you take your lunchbox out?”
“Is your backpack ready?”

If the reminder only lives in your head, you're still responsible for remembering it.

Try moving **one reminder into the room where it happens**.

Put a handwritten note next to the hook or basket. Or draw three tiny pictures your child can follow.

Then point to the cue and practice the routine together.

The goal isn't that a sign magically changes everything. It's that your child can begin noticing the next step without waiting for you to say it.

If the cue doesn't work, move it. Simplify it. Try again.

**Your small win:** Pick one daily reminder and put it where the action happens.

Organized Mom Collective

## Email formatting

Use the approved One Small Win look: Georgia heading, Montserrat text (with safe fallbacks), charcoal #545454, warm ivory #FBF7F1, soft blue #CDDDE1 and green #D4DFC4 accents, no rounded buttons. Both emails are intentionally self-contained, with **no PDF downloads or CTA buttons**.

Before enabling any delivery: add the sender's required postal address and unsubscribe link, verify sender details and test rendering.

## Implementation contract (not yet deployed)

- Record first marketing consent timestamp and a durable per-address welcome progress state.
- Schedule Day 2 and Day 6 in a send queue or jobs table; do not use recurring Resend broadcasts as an onboarding drip.
- Before each send, recheck marketing opt-in, permanent suppression, Resend unsubscribe state, and recent send history to enforce 1 marketing email/day.
- Do not enroll past opt-ins automatically. Only net-new consent events enroll unless owner explicitly approves backfill.
- After Day 6, let the subscriber join the normal One Small Win cadence. If weekly send coincides with a welcome send, suppress the weekly issue for that recipient that day.
- Use idempotency keys, recoverable delivery states, and stop on unsubscribe/bounce/complaint. No sending without explicit launch approval.
