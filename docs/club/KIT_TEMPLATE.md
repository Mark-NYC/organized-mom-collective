# Organized Family Club: monthly kit template

**Status (2026-10-22): proposed structure. No kit code exists yet.** The types below become `src/data/club/types.ts` in Phase 1 ([IMPLEMENTATION_PLAN.md → First implementation task](IMPLEMENTATION_PLAN.md#12-first-implementation-task)). Every kit is one TypeScript file, `src/data/club/kits/<slug>.ts`, reviewed in a pull request, plus one database row (`club_kits`) for its release time and mailer cutoff.

## Making a kit, step by step

1. **Brief** (`docs/club/briefs/<slug>.md`, copy the brief section below): theme, the one shift it asks of the family, flagship engine, inputs, worksheets, mailer contents, overlap check against the free tools and earlier kits.
2. **Rules**: the item library for its engine (jobs, steps, prompts) with stable ids, ages and requirements. Reuse `src/data/responsibilities.ts`, `src/data/chores-by-age.ts`, `src/data/routines.ts` and cleaning content from `src/data/cleaning.ts` (read it, never retype it).
3. **Config** (`src/data/club/kits/<slug>.ts`, shape below) and registry entry (`src/data/club/kits/index.ts`).
4. **Tests**: `tests/club-kits.test.ts` validates every kit automatically; add engine cases for anything new the kit's rules do (a new `requires`, a new frequency).
5. **Printables**: each worksheet is useful printed on its own, US Letter, follows [TOOL-OUTPUT-DESIGN.md](../brand/TOOL-OUTPUT-DESIGN.md) (three palettes, Kalam headings, charcoal on white).
6. **Mailer**: Megan's letter (written by Megan; the config holds a `null` until she has), field guide, family activity, QR to `/club/kits/<slug>?source=mailer`. One print-ready PDF to the mail house.
7. **Schedule**: `/admin/club → Kits`: create the row (slug, month, title, `release_at`, `mailer_cutoff_at`), set it to *scheduled* once the PR is merged and deployed.
8. **QA**: open the kit with the four test households below, print each printable on iPhone Safari and desktop Chrome, scan the printed QR.

## Config shape

```ts
// src/data/club/types.ts (Phase 1)
export type EngineId = 'responsibilities' | 'routines' | 'planning' | 'projects';
export type Frequency = 'daily' | 'weekdays' | 'weekly' | 'twice-weekly' | 'as-needed' | 'once';
export type OwnershipLevel = 'helps' | 'does-with-check' | 'owns';

/** One curated item an engine may place: a job, a routine step, a planning prompt or a project task. */
export interface KitItem {
  /** Stable forever once released: saved edits point at it. Rename the title freely; never reuse an id. */
  id: string;
  title: string;
  /** Who may own it. 'adult' items are whole jobs, written start to finish. */
  for: 'adult' | 'child' | 'anyone';
  minAge?: number;
  maxAge?: number;
  /** Owner level by age, e.g. [[4, 'helps'], [7, 'does-with-check'], [10, 'owns']]. */
  levels?: [age: number, level: OwnershipLevel][];
  frequency: Frequency;
  /** Relative load for balancing (1 small – 5 big). */
  effort: 1 | 2 | 3 | 4 | 5;
  area?: string;
  /** Only placed when the household preference says so. */
  requires?: { pets?: true; faith_content?: true; school?: 'homeschool' | 'public' };
  /** A responsibilities.ts id: the illustration and its category color. */
  illustration?: string;
}

export interface KitPrintable {
  /** club_documents.doc: stable. */
  id: string;
  title: string;
  page: 'letter-portrait' | 'letter-landscape';
  /** Personalized from the profile and saved edits, or the same for everyone (still fills in names). */
  kind: 'flagship' | 'worksheet' | 'reset' | 'activity';
  /** Component in src/components/club/print/. */
  component: string;
}

export interface KitConfig {
  slug: string;            // '2026-11-family-ownership', permanent once printed
  month: string;           // '2026-11'
  theme: string;           // 'Our Family, Our Team'
  /** The one shift this kit asks of the family, in a sentence. */
  shift: string;
  engine: EngineId;
  /** Bump when rules change in a way saved edits must be checked against. */
  engineVersion: number;
  /** At most two kit-specific choices, each with a default, so the kit opens filled in. */
  inputs?: { id: string; label: string; type: 'time' | 'date' | 'choice'; default: string; options?: string[] }[];
  items: KitItem[];
  printables: KitPrintable[];
  mailer: {
    /** Megan's letter, in her words. null until she's written it; the build refuses to schedule a kit with a null letter. */
    letter: { title: string; body: string } | null;
    fieldGuide: { title: string; sections: { heading: string; body: string }[] };
    activity: { title: string; minutes: number; steps: string[] };
    qrPath: string;        // '/club/kits/2026-11-family-ownership?source=mailer'
  };
  /** Free tools this kit points to instead of duplicating (src/data/free-tools.ts ids). */
  related?: string[];
}
```

## November example (abridged)

```ts
// src/data/club/kits/2026-11-family-ownership.ts (Phase 1)
export const kit: KitConfig = {
  slug: '2026-11-family-ownership',
  month: '2026-11',
  theme: 'Our Family, Our Team',
  shift: 'Every household job has one owner, start to finish, and it isn’t always Mom.',
  engine: 'responsibilities',
  engineVersion: 1,
  items: [
    { id: 'own-dinner-two-nights', title: 'Dinner on two weeknights, start to finish', for: 'adult', frequency: 'twice-weekly', effort: 5, area: 'kitchen' },
    { id: 'own-recycling', title: 'Recycling and trash, including pickup day', for: 'adult', frequency: 'weekly', effort: 2, area: 'home' },
    { id: 'set-the-table', title: 'Set the Table', for: 'child', minAge: 4, levels: [[4, 'helps'], [6, 'owns']], frequency: 'daily', effort: 1, illustration: 'set-the-table' },
    { id: 'clear-the-table', title: 'Clear the Table', for: 'child', minAge: 4, levels: [[4, 'does-with-check'], [7, 'owns']], frequency: 'daily', effort: 1, illustration: 'clear-the-table' },
    { id: 'feed-the-pet', title: 'Feed the pet', for: 'child', minAge: 5, levels: [[5, 'does-with-check'], [8, 'owns']], frequency: 'daily', effort: 1, requires: { pets: true } },
    { id: 'empty-dishwasher', title: 'Empty the dishwasher', for: 'anyone', minAge: 7, levels: [[7, 'does-with-check'], [9, 'owns']], frequency: 'daily', effort: 2 },
    // … the rest of the library, built from responsibilities.ts and chores-by-age.ts
  ],
  printables: [
    { id: 'ownership-chart', title: 'Our Family Responsibility Chart', page: 'letter-landscape', kind: 'flagship', component: 'ResponsibilityChart' },
    { id: 'who-owns-what', title: 'Who Owns What: Our Team Meeting', page: 'letter-portrait', kind: 'activity', component: 'ConversationCard' },
    { id: 'kitchen-pantry-reset', title: 'November Kitchen & Pantry Reset', page: 'letter-portrait', kind: 'reset', component: 'ResetChecklist' },
    { id: 'handing-over', title: 'Handing Over a Whole Job', page: 'letter-portrait', kind: 'worksheet', component: 'Checklist' },
  ],
  mailer: {
    letter: null, // Megan writes this.
    fieldGuide: { title: 'Owning a Job, Not Helping With It', sections: [] },
    activity: { title: 'The Team Meeting', minutes: 20, steps: [] },
    qrPath: '/club/kits/2026-11-family-ownership?source=mailer',
  },
  related: ['chore-chart', 'mental-load-worksheet', 'fall-pantry-stock-up'],
};
```

## Test households (every kit, every month)

| Household | Members | Checks |
| --- | --- | --- |
| A | 2 adults (one account holder), kids 4, 7, 10 | Ages eligible; adults whole jobs; account holder ≤ even adult share |
| B | 1 adult, kids 6 and 9 | Single parent: kids' levels move up; no partner rows |
| C | 2 adults, one child age 3 | Very young: "helps" levels only; nothing unsafe |
| D | 2 adults, kids 5, 8, 11, 13 + `pets: true`, `faith_content: false` | Requirements honored; teen gets "owns" jobs; nothing faith-based shown |

Then for household A: edit three items, add a child, archive one, change an age; the three edits must be unchanged, the archived person's jobs say "Needs a new owner", and the new child's jobs appear only as suggestions.

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
