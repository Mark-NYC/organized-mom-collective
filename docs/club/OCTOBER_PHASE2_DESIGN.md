# October Sunday Reset: mobile experience (Phase 2 design)

Applies below 1100px (phones, tablets, landscape phones). Desktop (≥ 1100px) is unchanged.
Builds on Phase 1 (PR #233): household loading, the extracted plan rules, two-page printing.

## The idea

She opens a plan that's already finished. The screen reads like the resource itself:

- when the family resets
- the three steps
- each person's part
- the fall jobs and who's doing them

Anything she can change is the thing itself: tap it and a small sheet opens for just that detail. The printed sheet is the output. A thumbnail shows it exists, and a full-screen view is there if she wants it.

## Main screen (390px)

```
┌──────────────────────────────────────┐
│ organized family.                    │ app header (unchanged)
├──────────────────────────────────────┤
│ OCTOBER · ORGANIZED FAMILY CLUB      │ the one uppercase label
│ Our Family Sunday Reset              │ serif 34px
│ Prepared for the Rivera family       │ + "Sample" tag when it's a sample
│                                      │
│ ┌──────────────────────────────────┐ │ status: two quiet lines
│ │ ○ Not approved yet               │ │  → "✓ Approved" / "Changed since you approved"
│ │   Changes open until Sun, Oct 10 │ │  → weekday ≤ 72h, "tonight", "closed"
│ └──────────────────────────────────┘ │
│ ┌────┬────┐ Your printable           │ compact preview: real front/back,
│ │▒▒▒▒│▒▒▒▒│ Front and back, ready to │ scaled copies (not the print DOM)
│ └────┴────┘ print            View ›  │ whole card opens the full view
│                                      │
│ ┌──────────────────────────────────┐ │ sage-wash card; whole card = button
│ │ EVERY SUNDAY                     │ │
│ │ After lunch                Change│ │ serif 28px, the family's time
│ │ 10–15 minutes together with our  │ │
│ │ wall calendar.                   │ │
│ └──────────────────────────────────┘ │
│  ① Look ahead   What's coming up…    │ the three steps: icons, no edit cue
│  ② Prepare early  What can we pack…  │ (fixed content)
│  ③ Share the work  Who owns each…    │
│                                      │
│ Everyone has a part                  │ serif 24px
│ The same small job every Sunday.     │
│ ┌──────────────────────────────────┐ │ one bordered group, hairline rows
│ │ (M) Mom                         ›│ │ initial circle, name, their part
│ │     Review our shared plans…     │ │
│ │ (D) Dad                         ›│ │
│ │ (S) Sofia                       ›│ │
│ │ …                                │ │
│ └──────────────────────────────────┘ │
│ First, try it: fall readiness        │
│ Do these once, together.             │
│ ┌──────────────────────────────────┐ │
│ │ [icon] Check warmer clothes     ›│ │ real printable icons
│ │        Sofia                     │ │ owner as a sage tag
│ │ [icon] Sort summer clothes      ›│ │
│ │ [icon] Check seasonal gear      ›│ │
│ └──────────────────────────────────┘ │
│ Need a different version? Make a     │ quiet link, see "One-time copy"
│ one-time copy                        │
│ Preview: changes and approval stay   │ one honest footnote
│ in this browser tab. Nothing is      │
│ mailed yet.                          │
├──────────────────────────────────────┤
│ [    APPROVE THIS PLAN    ]  [ 🖨 ]  │ fixed, above the tab bar; never covers
├──────────────────────────────────────┤ content (padding reserves its height)
│  Home   Cleaning   Club   Account    │ existing app nav
└──────────────────────────────────────┘
```

## Editing: one sheet per detail

```
┌──────────────────────────────────────┐   Rhythm, 2 taps: tap "After lunch",
│ ───                                  │   tap a choice. The sheet closes by
│ When do you reset each Sunday?    ✕  │   itself.
│ ┌───────────────┐ ┌───────────────┐  │
│ │After breakfast│ │ After church  │  │   52px chips, 2×2, selected = sage
│ └───────────────┘ └───────────────┘  │
│ ┌───────────────┐ ┌───────────────┐  │
│ │ After lunch ✓ │ │Sunday evening │  │
│ └───────────────┘ └───────────────┘  │
│ Something else…                      │   reveals one field + Save
└──────────────────────────────────────┘

┌──────────────────────────────────────┐   A person: suggestions that fit their
│ Sofia's part each Sunday          ✕  │   age, the prepared one first.
│ (•) Check school and activity days…  │
│ ( ) Prepare my clothes, bag…         │
│ ( ) Pack my bag the night before…    │
│ ( ) In my own words: [__________]    │
│ Name on the sheet  [ Sofia      ]    │   e.g. "Mom" → "Mama"
│ [ Done ]            [ Next: Mateo › ]│   several people in a row
└──────────────────────────────────────┘

┌──────────────────────────────────────┐   A fall job: who, what, done.
│ Check warmer clothes              ✕  │
│ Who's doing this?                    │
│ (Mom) (Dad) (Sofia✓) (Mateo) (Elena) │   person chips, one tap
│ Job        [Check warmer clothes  ]  │
│ Done looks like [Try on long…     ]  │
│ Remove from this month               │   restorable from the plan
│ [ Done ]                             │
└──────────────────────────────────────┘
```

Each change shows on the plan and the printable immediately. Nothing that can't be changed (the three steps, the printed wording) has an edit cue.

## Full printable (optional)

```
┌──────────────────────────────────────┐
│ ✕   [ Front | Back ]           [🖨]  │  fixed bar; Esc closes
├──────────────────────────────────────┤
│                                      │
│    the real letter-size page,        │  the actual print DOM, shown
│    fitted to width, scrolls          │  full-screen in place (no moving)
│                                      │
└──────────────────────────────────────┘
```

## Approval

- **Approve this plan** changes the same screen: the status reads "✓ Approved", and the button becomes a disabled "Approved".
- Changing anything after approving flips the status to "Changed since you approved", and the button to "Approve changes". This is the production model.
- **Prototype honesty:** approval is kept in this browser tab against a fingerprint of the plan. The footnote says nothing is mailed. There's no confirmation screen; there's nothing irreversible to confirm.
- **After the cutoff** (date rule unchanged): details become read-only, and the primary button becomes "Print a copy".

## One-time copy (the variation, honestly)

"Make a one-time copy" opens the same screen in copy mode:

- A banner: "One-time copy. Changes here print only; your plan stays as it is. Not saved."
- Saving to the tab is paused.
- She edits, then taps "Print this copy", then "Done".
- Done puts the plan back exactly as it was, approval included.

It is independent because it is never stored. Saved, named variations need the backend below.

## Why this beats the previous three screens

| Before (Review → Print Preview → Version Reviewed) | Now |
| --- | --- |
| Four generic rows ("Prepared family assignments") | The family's actual rhythm, people, parts and jobs |
| Every ✎ opened one long editor, even on fixed content | Tap the detail, edit only that; no cues on fixed content |
| Approving required paging through a tiny PDF | Approve from the plan; the printable is optional |
| A done screen with three menu options | Approval updates the screen in place |
| "Create a New Version" edited the reviewed version | A one-time copy that really can't touch the plan |
| The printable DOM moved between screens | Thumbnails are copies; the full view shows the print DOM where it is |

## Backend needed for production (separate approval)

1. Save the plan to the account: `ClubStore.saveDocument('2027-10-…', 'sunday-reset', …)`. The store and its revisions exist; the migration isn't live.
2. Approval: `club_documents.approved_revision`, `approved_at`. "Approved" means `approved_revision = revision`.
3. Cutoff lock: `club_document_save` refuses edits after `clubEditingDeadline(month)`. Reconcile `mailer_cutoff_at`.
4. Mailed edition: copy the doc to `sunday-reset--edition` at the cutoff, read-only; the mailing export reads only that.
5. Saved variations: `sunday-reset--copy-1..3` with `edits.meta.name`. Never mailed.
