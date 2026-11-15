# January 2027: one Family Meeting rhythm (proposal for owner approval)

Status: **proposal, 2026-11-15. Nothing in January's content has been changed.** January is the Family Meeting
introduction month. The established meeting is four parts over ten minutes: **Our Focus 2 · Let's Talk 3 ·
Everyone's Part 3 · Let's Practice 2** (`src/data/club/meeting-guide.ts`, the Welcome Kit's standard guide).

## What January is made of today

| Piece | File | Meeting format | Approval |
| --- | --- | --- | --- |
| Welcome Kit Family Meeting guide | `src/data/club/meeting-guide.ts`, `/club/family-meeting-guide` | **Four parts, ten minutes** ✓ | Draft copy for owner approval (WELCOME_KIT.md) |
| January's monthly meeting (personalized) | `src/data/club/family-meeting.ts` month 1, engine `src/lib/club/family-meeting.ts` | **Four parts, ten minutes** ✓ ("Our Family Weekly Meeting": focus, questions, everyone's part, practice) | Personalization rules approved and tested (75 engine tests) |
| January's Family Focus page | `src/data/club/meeting-guides/2027-01.ts`, `/app/club/january` ("Our Family Focus") | A companion *for* the meetings: shared focus, habit ideas, Words of the Week. No meeting format of its own ✓ | Personalization and quality reviewed (JANUARY_QUALITY.md) |
| January kit: action, letter, tool, printables | `src/data/club/kits/2027-01-fresh-start-together.ts`, mailer `docs/club/mailers/2027-01-fresh-start-together.md` | **Five steps, fifteen minutes** ✗ | Design draft for owner review; letter `draft: true`; field guide and tool copy are placeholders |
| Family Weekly Reset Builder (the kit's tool) | `src/data/family-reset.ts`, `/club/tools/family-reset`, public `/guides/family-weekly-reset` | **Five steps, fifteen minutes** ✗ (the website's free "weekly reset", after article FP-04) | Live on the public site |

So the approved, personalized parts already teach the right meeting. The conflict is confined to the January **kit
config** (all draft) and its choice of tool.

## The conflicts, exactly

In `src/data/club/kits/2027-01-fresh-start-together.ts`:

1. `shift`: "a **15-minute** meeting around the wall calendar".
2. `action.title`: "Our First **15-Minute** Family Meeting"; `action.items`: five steps that don't map to the four
   parts: Gather around the calendar (3) · Look at the week ahead (4) · Decide who's doing what (3) · Make the week
   easier (3) · Ask who needs help (2).
3. `action.note`: "The minutes are a guide…" (fine in spirit; tied to the fifteen).
4. `tool`: `family-reset`, the Weekly Reset Builder, which makes "a **15-minute** guide" (`blurb`), five steps.
5. `printables[0]`: flagship printable "Our First **15-Minute** Family Meeting".
6. `mailer.letter.body`: "The meeting below takes about **fifteen** minutes."
7. `mailer.fieldGuide`: "**Fifteen** minutes most weeks does more than an hour now and then."
8. `mailer.invite`: "a one-page, **15-minute** meeting guide".
9. `mailer.screenNote`: "It comes in the mail with the same meeting": true today, but of the five-step meeting.

Elsewhere:

10. `/app/club/january` passes `meeting={false}`, so January's own four-part meeting (family-meeting.ts month 1) is
    **not reachable**. The app's Family tab links to `/app/club/january?view=meeting`, which shows no meeting in January.
11. Four names for one month: theme "A Week Everyone Can See" (also September's kit slug), slug
    `fresh-start-together`, meeting page "Our Family Weekly Meeting", Family Focus page "Our Family Focus". The mailer
    doc's letter title ("You Don't Need a Whole New Routine") differs from the kit's ("You Don't Have to Remember
    Everything").

A founding member's Welcome Kit holds the standard guide (four parts, ten minutes) and January's printed action (five
steps, fifteen minutes) in the same envelope.

## Smallest correction (proposed)

Keep every approved and personalized piece. Change only the kit config and one page flag:

1. **Action → the four parts.** Keep the checklist shape and January's own words, mapped onto the established parts and
   minutes (titles and minutes read from `MEETING_GUIDE.parts`, so they can't drift):

   | Part | Minutes | January's existing text, reused |
   | --- | --- | --- |
   | Our Focus | 2 | "Everyone where they can see the wall calendar." + the month's focus: everyone knowing what's coming this week |
   | Let's Talk | 3 | "What's one thing happening this week that everyone needs to know about?" (already the kit's question and the meeting page's) + "Ask who needs help" |
   | Everyone's Part | 3 | "Rides, getting ready for activities, important jobs. A whole job each, not reminders." (+ busy-day meals, from step 4) |
   | Let's Practice | 2 | "Look at the week ahead together and add anything missing to the calendar." |

   Title: "Our First Family Meeting". Note kept: "With little ones, keep it shorter."
2. **"Fifteen" → "ten"** in `shift`, the letter (still a draft for Megan), the field guide line and the printable title.
3. **Tool:** drop the Weekly Reset Builder from January. January's optional tool becomes its own personalized **Our
   Family Focus** page (already built and reviewed). The invite and screen note point there. The Builder stays on the
   public website unchanged (customer-facing; not touched until the release plan).
4. **Turn on January's monthly meeting** on `/app/club/january` (`meeting` on), so the four-part January meeting is
   reachable from the Family tab, as in every other month.
5. **One name:** proposal "**Our First Family Meeting**" as January's theme (the kit's subject), with "Our Family Focus"
   as the page and resource title everywhere (kit `tool`, `family-meeting.ts` `resourceTitle`, mailer doc). Slug stays
   (internal; changing it would break saved data keys).

Not changed: the letter's message and structure, the age guide, the tip, the conversation question, the habit and
Words-of-the-Week personalization, the meeting engine's rules, the Welcome Kit guide.

## Later (not part of this change)

- The public website's "weekly family reset" (article FP-04 and the Builder) is a second, fifteen-minute weekly
  ritual. With the free weekly Family Meeting in Our Week, decide whether the website keeps it as a separate idea or
  points to the Family Meeting. Website copy is unchanged until the release plan is approved.
