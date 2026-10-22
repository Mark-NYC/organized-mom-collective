# Organized Family Club: monthly kit template

**Status (2026-10-22): the configuration system is built (Phase 1); no kit is published.** Types: `src/data/club/types.ts`. Kits: `src/data/club/kits/<slug>.ts`, listed in `src/data/club/kits/index.ts`, checked by `kitProblems()` and `tests/club-kits.test.ts`. Each kit also gets one database row (`club_kits`) for its release time and mailer cutoff once the migration exists ([IMPLEMENTATION_PLAN.md → Phase 1 progress](IMPLEMENTATION_PLAN.md#12-phase-1-progress)).

## Making a kit, step by step

1. **Brief** (`docs/club/briefs/<slug>.md`, copy the brief section below): theme, the one shift it asks of the family, flagship engine, inputs, worksheets, mailer contents, overlap check against the free tools and earlier kits.
2. **Rules**: the item library for its engine (jobs, steps, prompts) with stable ids, ages and requirements. Reuse `src/data/responsibilities.ts`, `src/data/chores-by-age.ts`, `src/data/routines.ts` and cleaning content from `src/data/cleaning.ts` (read it, never retype it).
3. **Config** (`src/data/club/kits/<slug>.ts`, shape below) and registry entry in `kits` (`src/data/club/kits/index.ts`), oldest first.
4. **Tests**: `tests/club-kits.test.ts` validates every kit automatically; add engine cases for anything new the kit's rules do (a new `requires`, a new frequency).
5. **Printables**: each worksheet is useful printed on its own, US Letter, follows [TOOL-OUTPUT-DESIGN.md](../brand/TOOL-OUTPUT-DESIGN.md) (three palettes, Kalam headings, charcoal on white).
6. **Mailer**: Megan's letter (written by Megan; the config holds a `null` until she has), field guide, family activity, QR to `/club/kits/<slug>?source=mailer`. One print-ready PDF to the mail house.
7. **Schedule**: `/admin/club → Kits`: create the row (slug, month, title, `release_at`, `mailer_cutoff_at`), set it to *scheduled* once the PR is merged and deployed.
8. **QA**: open the kit with the four test households below, print each printable on iPhone Safari and desktop Chrome, scan the printed QR.

## Config shape

The source of truth is `src/data/club/types.ts`; read it there. In short:

- **`KitConfig`**: `slug` (`YYYY-MM-theme`, permanent once printed), `month`, `theme`, `shift` (the one change it asks of the family), `engine`, `engineVersion` (bump when rules change in a way saved edits must be checked against), up to two `inputs` with defaults, `items` (the flagship's rules), an optional `reset` (the companion's monthly project from `src/data/cleaning.ts` as owned jobs), `printables` (exactly one `flagship`), `mailer` (`letter: null` until Megan writes it, field guide, activity, `qrPath = /club/kits/<slug>?source=mailer`), `related` free tools (paths from `src/routes.ts`).
- **`KitItem`**: stable `id` (never reused or renamed once released), owner-language `title`, `doneMeans` (what "done" looks like, so nobody inspects it), `for` (`adult` whole jobs / `child` / `anyone`), `minAge`/`maxAge` (children and teens only), `levels` by age, ascending and ending at `owns`: `learning` (their job, with someone beside them), `with-check` (theirs start to finish, a coach checks), `owns` (theirs completely), `frequency`, `effort` 1–5, `section` (`family` / `space` / `self`), `scope` (`household`: one owner for the family; `each`: everyone eligible gets their own), `core` (every family needs it: never silently dropped), `excludes` (jobs covering the same ground), `requires` (household preferences), `illustration` (a `src/data/responsibilities.ts` id).

- **The three-part shape (August on; November moves to it later):** every month is **one letter, one action, one optional tool**, and the family calendar stays the family's plan. `subtitle`; `action` (`title`, `intro`, 3–8 short `items`, an optional `helperLabel` blank: no per-person assignments); `tool` (the printable with an editor it opens, `title`, `blurb`, `cta`); `mailer.letter` (`greeting`, `body`, `signoff`, `draft: true` until Megan approves: a draft can't be scheduled); the back of the letter from `mailer.fieldGuide` (up to four short tips), `mailer.example` (a worked example generated from the tool's own rules), `mailer.invite` (beside the QR code) and `mailer.calendarNote` (one calendar reminder). Printables: the tool's (`editor`), `Countdown` (the action alone) and `Letter` (front and back). Test: can she read the letter, understand the action and decide about the tool in about two minutes? If not, cut.
- **Also available:** `itemSets` (extra rule sets a printable names with `items`), `setup: 'school'` (each child's school, guessed from age and the homeschool preference), `overview` (a short list of first actions), `editor: 'routine'` (pick a child and a routine; at most `ROUTINE_MAX_STEPS` steps by `priority`) or `'command'`. On items: `requires.childSchool`, `lead` (due before a first day) and `priority`. The school-year sets in `src/data/club/libraries/school-year.ts` use them.

Never write "help" into a job title: the tests refuse it. Ownership is the point.

### Responsibility cards

Every card in `src/data/responsibilities.ts` is an item automatically (`cardItems()` in `src/data/club/libraries/ownership-jobs.ts`). Refine a card in `cardRules` there; a card added to the library without a rule still shows up, with defaults from its category (`myself` → self-care, each child; `room` → their space, each child; `home` → a family job with one owner) and its starting age. Only a card's id, title, category and starting age are used, never its how-to steps.

## November, as built

`src/data/club/kits/2026-11-family-ownership.ts`: the responsibilities engine over `ownershipJobs()` (the 16 cards, 8 family jobs, 12 teen and adult whole jobs), the November Kitchen & Pantry Reset (the five November tasks from `cleaning.ts`, with ages per task id), four printables (`ownership-chart` flagship, `kitchen-pantry-reset`, `who-owns-what`, `handing-over`), the field guide "Owning a Job, Not Helping With It", the 20-minute Team Meeting activity, and `letter: null`.

## August, as built

`src/data/club/kits/2027-08-school-year.ts`: the letter (draft), Our Back-to-School Countdown (six lines), and the routine chart tool (`items`: morning and after-school steps by age and school type, 4–6 per chart). The letter prints front and back from `LetterSheets` (src/components/club/print/LetterPrintables.tsx) with a QR code from `src/lib/club/qr.ts`.

## Test households (every kit, every month)

| Household | Members | Checks |
| --- | --- | --- |
| A | 2 adults (one account holder), kids 4, 7, 10, pets | Ages eligible; adults whole jobs; account holder ≤ the busiest other adult |
| B | 1 adult, kids 6 and 9 | Single parent: kids' levels move up; no partner rows |
| C | 2 adults, one child age 3 | Very young: `learning` levels only; nothing unsafe |
| D | 2 adults, kids 5, 8, 11, 13 + `pets: true`, `faith_content: false` | Requirements honored; teen gets "owns" jobs; nothing faith-based shown |

These four and eight more (no kids, one adult with no kids, teens, a single parent of six, a grandparent at home, toddlers, an 18-year-old at home, no account-holder flag) are `tests/club/fixtures.ts`; the engine and edit tests run every one. Then for household A: edit three items, add a child, archive one, change an age; the three edits must be unchanged, the archived person's jobs say "Needs a new owner", and the new child's jobs appear only as suggestions.

## Brief template

```md
# <slug>: <theme>

- Shift (one sentence):
- Flagship generator and engine:
- Kit-specific inputs (≤ 2, with defaults):
- Rules library: new items, reused ids, requirements:
- Worksheets (each useful on its own):
- Monthly team reset (from src/data/cleaning.ts, month <n>):
- Mailer: letter theme (Megan writes it), field guide outline, family activity, QR path:
- Overlap check: free tools and earlier kits this must not duplicate, and how it differs:
- Honesty check: nothing invented (stats, studies, quotes, experiences); no unbuilt feature mentioned:
```
