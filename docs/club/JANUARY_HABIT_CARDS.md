# January 2027: Family Habit Cards (product direction updated October 24, 2026)

This supersedes the old January one-thing reset as the **physical product concept**. The mailed product must be useful without a separate web generator or routine tracking dashboard.

## The problem

Mom has to repeatedly initiate, prompt and check the same daily tasks. A routine chart specifies the sequence but does not supply a reliable cue at the exact moment a child needs to act.

## The product

**Our Family Habit Cards: Build the habit. Lose the reminder.**

- One premium US Letter sheet, four actual smaller cards arranged 2 × 2, with unobtrusive cut lines.
- Each card pairs a reliable existing action ("After I...") with one small next action ("Then I will...").
- Each card includes an owner and an explicit suggested place for the cue. A reminder at the point of use beats a master chart that Mom needs to interpret.
- Start with only one or two cards. The four-up format gives flexibility, **not** four assignments or a four-step required routine.
- No seven-day scorecard, stickers, points, streaks, daily check-ins or app reminders.
- Family profile should eventually prepare the most relevant 1-2 suggested cards automatically, with age-appropriate wording and names. For now, preview shows four useful editable examples.
- The editable web companion is for limited adjustment and reprinting, not a mandatory generator.

## Styling and print reference

Use `docs/brand/TOOL-OUTPUT-DESIGN.md`, `docs/brand/PUBLIC-VISUAL-DESIGN.md`, and the current Club stationery direction. White / warm ivory, warm charcoal, muted sage, editorial Montserrat labels, restrained handwritten Kalam emphasis, soft highlights, simple imperfect line icons. Real print dimensions and cut lines, not simulated cards on a single page with no ability to separate them.

## Current implementation

- Actual four-card print sheet: `src/components/club/JanuaryHabitCards.astro`.
- Ungated, noindex review: `/preview/january-habit-cards`.
- Club's January tool: `/club/tools/habit-builder` reuses that sheet pending route rename and member-data handoff.
- January kit's older five-step `Action` page and `docs/club/mailers/2027-01-fresh-start-together.md` are **not yet updated** to the card-first mailed product. Do not present the earlier letter/checklist as the final January physical mailer.
- This is a design prototype, not production-validated personalized printing. Must proof size, cut usability, legibility and actual print/mail vendor quality before fulfillment.

## Validation questions

Can a child recognize the current cue, understand the next action and use the physical reminder without Mom directing? Can a parent start using the delivered tool in under two minutes? Would Mom pay $5 for these pre-prepared cards without doing the formatting herself?


## Canonical visual references (October 24 update)

The January cards and editor must match these existing Club product prototypes, NOT the older Kalam-heavy printable-tools aesthetic:

1. `/club/december-preview/` and `src/pages/club/december-preview.astro`: Gelasio bold italic serif emphasis, Montserrat small uppercase labels, spacious mostly white workspace, charcoal button, restrained botanical/line motifs. Its print layouts live in `src/lib/december/layout.ts`.
2. `/club/worksheet-generator/` and `src/pages/club/worksheet-generator.astro`: prepared-plan editor on the left, actual printable preview on the right, simple gray inputs, thin month-color rules, generous margins, actual embedded Gelasio/Montserrat print fonts. Its print layouts live in `src/lib/worksheet/layout.ts`.
3. `src/theme.ts`: January's precise color is **#CDDDE1** (soft frost blue). Do not borrow December evergreen or November mushroom as January's accent.

Use deep blue-gray #527384 for readable serif emphasis, January blue only for pale decorative strips and rules. Keep each removable card at real physical size, with minimal iconography, "WHEN THIS HAPPENS" / "HERE'S WHAT I DO NEXT" / "PLACE THIS CARD" instructions. Four cards per US Letter print sheet is a useful preview layout, not a requirement for every family to adopt four habits.

**Production gap:** Current January prototype uses browser print-to-PDF, unlike the December and November true PDF renderers. Before print-mail integration, switch to the shared operation-based SVG/PDF pipeline so both previews and generated mailing PDFs use the same font metrics and physical positions. This prototype is not production-ready.
