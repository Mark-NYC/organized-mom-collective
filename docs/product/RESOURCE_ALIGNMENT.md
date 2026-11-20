# Responsibility resources: one developmental pathway

**Status:** Alignment audit and binding design contract, 2026-11-20. No existing product, PDFs, card artwork, guides, downloads, paid resource generators or billing are changed by this document.

**Authoritative philosophy:** [RESPONSIBILITY_DEVELOPMENT_FRAMEWORK.md](RESPONSIBILITY_DEVELOPMENT_FRAMEWORK.md).

## One progression, different entry points

Each artifact teaches a *different moment in the same skill journey*, rather than selling an unrelated system.

| Entry point | Job in the journey | Existing source of truth | Required future alignment |
| --- | --- | --- | --- |
| Age-based guides, e.g. 4–5, 6–7, 8–9, 10–12 | Discover plausible skills and find one appropriate starting point | `scripts/lib/kids-chores-mini-guides.mjs`, `scripts/lib/age-chore-card-config.mjs`, `src/data/guides/guide-directory.ts` | Age is illustrative not a limit; highlight Model/Assist and the path to Watch, one skill/cue/finish rather than an achievement list |
| Kids' Responsibility Cards | **Teach the mechanics** of a particular skill with illustrated steps; adults Model then Assist | `src/data/responsibility-cards.ts`, artwork and card assets | Cards teach *how* to do the skill, not that ownership transfers after reading the card; use same stable skill identity, plain outcome and finish line |
| Free chore and routine charts | Choose the skill, anchor to a cue and visibly practice; record the family's choice | `src/components/site/ChoreChart.astro`, `src/data/chore-recommendations.ts`, `src/data/chore-chart.ts`, `src/components/site/OriginalChoreChart.astro` | No age requirement or automatic stage promotion; no forced full set or reward; family selects/rewords/omits |
| Free family rhythm and responsibility builder | Agree who owns what, when, and what done looks like | `src/pages/family-chore-chart.astro`, family responsibility tools | Shared cue and whole-job ownership; link a family agreement to individual skills without scoring |
| Personalized first-week plan | Introduce a small habit and a family check-in | `src/components/site/ChoreCompanion.astro` | One small plan, reliable cue, meaningful natural payoff, practice rather than forced compliance |
| Organized Family app | Remember the family, skill, stage and chosen cue | `src/lib/family-development/framework.ts` (foundation); existing household and agreement stores | Family confirms stage; never infer competence or overwrite previous decisions |
| Weekly Family Meeting | Talk, choose, notice quality in Watch, agree on next step | `src/components/ourweek/WeeklyMeeting.tsx`, `src/components/family/FollowThrough.tsx` | One recommendation at a time, existing agreements first; family can stay/advance/step back/pause |
| Future seasonal kits | Introduce relevant skills at school/summer/new year transitions | Existing monthly pages remain as-is | Use the same library and family development history; do not reset stage because the calendar changes |

**Desired stair-step:** Age guide (what fits?) → Responsibility Card (how do I do it?) → Habit cue and family chart (when does it happen?) → weekly Family Meeting (what did we choose and how is it going?) → MAWL Watch practice across circumstances → family-confirmed Launch → next season/skill when ready.

This is **not a mandatory purchase funnel**. Each free resource must be independently useful. No skill should require purchasing a card or Club membership to learn it.

## Evidence from current repository

### Strong alignment already

- `scripts/lib/kids-chores-mini-guides.mjs` already teaches showing first, practicing together, using familiar cues, and reviewing at a family meeting. Its age-band copy explicitly treats readiness as variable and emphasizes confidence rather than perfection.
- `src/data/chore-recommendations.ts` has stable choice IDs, minimum suggested ages and safety notes for some chores. It offers beginner/experienced selection in the new `ChoreChart`.
- `src/pages/family-chore-chart.astro` introduces shared moments, visible responsibility, and practicing together.
- `src/data/responsibility-cards.ts` says the physical cards teach *how* with illustrations and three steps. They are not yet on sale according to the current source, and there is no live card product link in that file.

### Gaps to reconcile deliberately, not as part of this foundation PR

1. **Age labels vs actual readiness.** Both `src/data/chore-chart.ts` and `src/data/chore-recommendations.ts` contain static age-based starting sets. They are useful illustrations but cannot become strict gates for individualized MAWL stages. Where `minAge` reflects safety, preserve adult supervision limits; where it reflects typical readiness, label as guidance.
2. **Uneven MAWL language.** Mini-guides cover Model/Assist, cue, and review but do not consistently articulate the purpose of **Watch**: developing quality and adaptation under changed circumstances before the adult confidently Launches.
3. **Reward framing conflict.** `src/data/chore-chart.ts` defines default rewards, including treats, allowances, privileges and screen time. `src/components/site/OriginalChoreChart.astro` renders completion-threshold reward boxes. `src/pages/chore-chart.astro` still advertises three rewards even as the modern chart emphasizes ownership. The framework prefers natural payoff and intrinsic contribution; any reward fields should be optional and never positioned as the default motivation. Do not silently remove old downloadable functionality or user-saved fields.
4. **Different names and duplicate skills.** Printable titles, card titles, `choreChoices` IDs, mini-guide job phrasing and personalized Club assignments can describe the same skill differently. Build a crosswalk to **one canonical stable ID**; preserve existing copy, image keys and download IDs as aliases until migrated.
5. **Physical card detail not represented in code.** Current `src/data/responsibility-cards.ts` records only product name and link status. Do not claim the full print card inventory or three-step wording was validated. Audit physical artwork/source PDFs before publishing a definitive card-by-card mapping.
6. **Versions and delivery.** Current twelve monthly Club kits, PDF approvals and print snapshots must stay unchanged. A future seasonal product can be driven by the same skill library without rewriting them.

## Canonical skill mapping contract

An authored skill is not an icon, a chore-label string, or a calendar event. It has one stable ID and aliases connecting:
- guide slug / featured example
- Responsibility Card ID, display title and source artwork
- public chart `choreChoices.id` and legacy starter chore labels
- Club generator recommendation IDs and future seasonal-kit slots
- shared family agreement references (only after an explicit family choice)

Every mapped record needs a skill category, outcome, *typical* age guidance, safety/supervision, MAWL coaching examples, existing-cue options, a concrete finish line, natural satisfaction and at least one **Watch** variation. A card explains the steps of the same skill that a weekly meeting coaches. Changing displayed wording does not change that skill ID.

**Avoid forced one-to-one mappings:** "Own my laundry start to finish" may be a composite skill built from separate sort/fold/wash skills. Shared family rhythms are not always a child's solo skill; model their component contributions explicitly.

## Curated skill registry v1 (implemented in the branch)

- **Source:** `src/lib/family-development/skills.ts`, with `SKILLS_LIBRARY_VERSION = 1`. Contains **43 authored skills**, grouped across self-care, personal spaces, school preparation, home care, meals, laundry, food independence, initiative, routines, care of others and family teamwork.
- **Available lookups:** `skillById`, `skillForChoreChoice`, `skillForCardIllustration`, and `skillsForContext`. Seasonal and age relevance **rank authored suggestions only**; they do not select MAWL stage or write progress.
- **Existing chart crosswalk:** every one of the 30 `choreChoices.id` values is mapped to a stable skill ID, currently identically named. This is a mapping layer, not a rewrite of existing charts.
- **Illustration crosswalk:** every illustration ID used in the existing 4–5, 6–7 and 10–12 age-guide card previews maps to a skill. These IDs are image references from `scripts/lib/age-chore-card-config.mjs`, **not verified printed physical-card identifiers**. No card text or print-ready artwork is recreated.
- **Authoring rules:** each skill includes an observable finish line, suggested cue, natural benefit, Model/Assist/Watch/Launch guidance, a Watch variation and seasonal relevance; hazardous tasks explicitly retain adult-supervision guidance.
- **Coverage tests:** `tests/family-skill-library.test.ts`; MAWL invariants remain in `tests/family-development-framework.test.ts`.
- **Not connected:** current recommendations in public tools. Family stage persistence and the paid weekly meeting integration are built but **not live** (migration 20261207 not applied): [FAMILY_DEVELOPMENT_ENGINE.md](FAMILY_DEVELOPMENT_ENGINE.md).

## Proposed QA crosswalk to curate

| Skill family | Guide examples | Existing chart IDs | Card / artwork validation | Watch variation |
| --- | --- | --- | --- | --- |
| Belongings and school prep | Hang backpack, unpack lunchbox, prepare tomorrow's things | `hamper` is separate; school bag may appear in age starter labels | Match card sources only after artwork review | Unusual school day or early departure |
| Setting/clearing table | Napkins, utensils, safe dishes, whole table | `table`, `dishes` | Confirm title and finished standard on card | Different number of diners or time pressure |
| Bedroom and shared-space reset | Toys, bedroom floor, five-minute reset | `toys`, `floor`, `room`, `shared` | Distinguish tidying from full room ownership | Unexpected guests or a different room |
| Laundry | Sort/fold/put away and full laundry | `sort`, `fold`, `load`, `own-laundry` | Ensure appliance safety and adult supervision | New fabric or change to laundry day |
| Snacks/meal contribution | Cold breakfast, safe prep, family dinner | `dinner-help`, `dinner` | Review risk-specific directions | Missing ingredient or changed schedule |
| Routine participation | Brush teeth, after-school reset, ready for bed | Existing guides and `src/data/routines.ts` | Habit/routine may compose several skills | Late arrival, school holiday, sleepover |

These are mapping *candidates*, not a claim that every corresponding physical card was inspected.

## Acceptance criteria for aligning each resource

1. Uses the canonical skill ID or documented alias and correct safety constraint.
2. Describes age as an *example starting point*, not a requirement or automatic next stage.
3. Teaches **Model/Assist** for acquiring the mechanics; explicitly supports extended **Watch** for quality and variation; Launch is family judgment.
4. Suggests a reliable habit cue and natural payoff instead of default extrinsic rewards.
5. Allows a family to reword, choose fewer, change difficulty, pause, or dismiss.
6. Distinguishes completing a chart row from initiating and owning the whole responsibility.
7. Is useful by itself and points naturally to the next resource without implying a purchase is required.
8. Preserves existing public URLs, downloads, legacy chart data, prints, Club approvals and paid access until a separately approved change.

## Next implementation, after owner review

1. Verify actual Responsibility Card print artwork and instructions; confirm or correct the provisional illustration-to-skill crosswalk.
2. Curate printable guide language and aliases against the implemented v1 library, including the 8–9 guide and routine tools.
3. Replace recommendation *lookups* across public tools only after parity tests; do not simultaneously redesign their layouts.
4. Align educational copy and default motivation patterns through a separately reviewed copy change.
5. Integrate persisted family-controlled MAWL decisions into the paid weekly meeting; keep monthly resources unchanged.
