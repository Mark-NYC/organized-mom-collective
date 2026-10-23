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

- **The three-part shape (August on; November moves to it later):** every month is **one letter, one action, one optional tool**, and the family calendar stays the family's plan. `subtitle`; `action` (`kind`: `'countdown'` dates each line from a date she enters, items `{ text, daysBefore, essential? }` (August); `'checklist'` is the lines alone, no dates (October); `title`, optional `screenTitle`, `intro`, 3–8 short `items`, an optional `helperLabel` blank, `editable` to let her reword a line; no per-person assignments; state and helpers in src/lib/club/countdown.ts). Don't force every month into one pattern: pick the kind that fits the action; `tool` (one of the site's own tools, by id from `src/data/club/tools.ts`, with `title`, `blurb`, `cta`); `mailer.letter` (`greeting`, `namedGreeting` with `{name}` for her first name when it's known, `body`, `signoff`, `draft: true` until Megan approves: a draft can't be scheduled); the back of the letter from `mailer.conversation` (one family question; `placement` first or after the example), `mailer.fieldGuide` (an optional `intro`, up to four short tips), `mailer.story` (a worked example in words) or `mailer.example` (the tool's own starter, e.g. the routine chart's morning: `{ title, variant }`), `mailer.invite` (beside the QR code) and `mailer.calendarNote` (one calendar reminder); on the kit page `mailer.screenNote` (paper copy or her printout, never both to keep) and `letterLinkTop`; `tool.note` under the tool's button; `tool.start`, the tool's own starting choice when the kit offers none. Printables: `Action` and `Letter`. Printables: `Countdown` (the action alone) and `Letter` (front and back). Test: can she read the letter, understand the action and decide about the tool in about two minutes? If not, cut.
- **Also available:** `itemSets` (extra rule sets a printable names with `items`), `setup: 'school'` (each child's school, guessed from age and the homeschool preference), `overview` (a short list of first actions), `editor: 'routine'` (pick a child and a routine; at most `ROUTINE_MAX_STEPS` steps by `priority`) or `'command'`. On items: `requires.childSchool`, `lead` (due before a first day) and `priority`. The school-year sets in `src/data/club/libraries/school-year.ts` use them.

Never write "help" into a job title: the tests refuse it. Ownership is the point.

### Responsibility cards

Every card in `src/data/responsibilities.ts` is an item automatically (`cardItems()` in `src/data/club/libraries/ownership-jobs.ts`). Refine a card in `cardRules` there; a card added to the library without a rule still shows up, with defaults from its category (`myself` → self-care, each child; `room` → their space, each child; `home` → a family job with one owner) and its starting age. Only a card's id, title, category and starting age are used, never its how-to steps.

## November, as built

`src/data/club/kits/2026-11-family-ownership.ts`: the responsibilities engine over `ownershipJobs()` (the 16 cards, 8 family jobs, 12 teen and adult whole jobs), the November Kitchen & Pantry Reset (the five November tasks from `cleaning.ts`, with ages per task id), four printables (`ownership-chart` flagship, `kitchen-pantry-reset`, `who-owns-what`, `handing-over`), the field guide "Owning a Job, Not Helping With It", the 20-minute Team Meeting activity, and `letter: null`.

## Tools: reuse the site's, never copy them

A kit's tool is always one of the site's own tools, opened inside the Club. There is one implementation: improve it on the site and every kit gets it. Three so far: the routine chart (August), the chore chart (October) and the Family Christmas Traditions Picker (December, a new site tool with no public page yet). The pattern:

1. **The tool is one component with one behavior module** that the public page and the Club page both render (`RoutineChart.astro` + `routine-chart.ts`; `ChoreChart.astro` + `chore-chart.ts`, extracted from `/chore-chart` on 2026-10-23). If a tool still lives inside its public page, extract it first, then check the public page is unchanged. Shared handoff behavior (saved-copy check, age-ordered picker): `src/components/site/tool-handoff-ui.ts`.
2. **A handoff mode on the component** (`handoff` prop): it reads `readToolHandoff(id)` (`src/lib/tool-handoff.ts`) for a child's first name and age and a starting choice, keeps a separate saved copy per handoff key, and otherwise behaves exactly as on the public page. Public pages never set it.
3. **A Club page** at `src/pages/club/tools/<id>.astro`: `ClubLayout` (noindex, no trackers, no site navigation), `ClubToolBar` (member header, back to the kit, whose it is) and the public component with `handoff`. Off behind `PUBLIC_CLUB_ENABLED` like every /club page.
4. **List it** in `src/data/club/tools.ts` (`path`, `publicPath` (null while there's no public page), `perChild`, starting `variants`, `familyAges` for a family tool that takes the children's ages and the family's name, `title`, `intro`), and name it in the kit's `tool`. The kit's button asks who it's for (one child: opens straight away; none: opens as any visitor sees it), calls `setToolHandoff()` and goes to the Club page. Names travel in this tab's sessionStorage, never in the URL; Club pages other than a tool's clear it, and saved copies are keyed by household, so families never share a chart. A public tool's own extras that don't belong to members stay on the public page (the chore chart's email-before-download is keyed to `/chore-chart`).
5. **Check the public page didn't change:** same markup and the same behavior on desktop and mobile (steps, picker, reordering, saving, download, analytics events). `tests/tool-sharing.test.ts` fails if a Club copy of a tool appears.

The hosted preview (`scripts/build-club-preview.mjs`) embeds each Club tool page's built markup and wires it with the same module.

## August, as built

`src/data/club/kits/2027-08-school-year.ts`: the letter (draft), Our Back-to-School Countdown (six lines, dated from her first day of school), and the site's routine chart (`tool: 'routine-chart'`), opened for the child she picks. The letter prints front and back from `LetterSheets` (src/components/club/print/LetterPrintables.tsx) with a QR code from `src/lib/club/qr.ts`.

## October, as built

`src/data/club/kits/2027-10-home-works-together.ts`: the letter (draft), Our Fall Home Reset (`kind: 'checklist'`, five lines, editable wording, no dates), and the site's chore chart (`tool: 'chore-chart'`, `start: 'one-job'`), opened for anyone she picks, grown-ups included, with one job to start. Same page, print and letter components as August.

## December, as built

`src/data/club/kits/2027-12-christmas-family-affair.ts`: the letter (draft), Our Family Christmas Plan (`kind: 'checklist'`, five lines each with a `detail` sentence, an `action.note` for families already planned, editable wording, no dates), and the Family Christmas Traditions Picker (`tool: 'traditions-picker'`), opened once for the whole family with the children's ages (`ToolHandoff.ages`). `mailer.accent: 'evergreen'` adds the letter's sprig and muted evergreen and clay colors. Same page, print and letter components as August and October.

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
