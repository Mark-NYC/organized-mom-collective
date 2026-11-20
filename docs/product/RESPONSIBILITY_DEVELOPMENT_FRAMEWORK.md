# Organized Family Responsibility Development Framework

**Status:** Product doctrine v1, approved in conversation 2026-11-20. Implementation contract, not a claim that every feature below is shipped.

**Product aim:** The rhythms of the household become the habits of its children; through those habits, children develop skills and progressively own their part of family life.

**Scope:** Organized Family (free), Family Meeting Club (personalized paid layer), weekly Family Meeting, and future seasonal kits. This file is the source of truth for future product, UX, recommendation, and data-model decisions. Related architecture: [UNIFIED_FAMILY_ARCHITECTURE.md](UNIFIED_FAMILY_ARCHITECTURE.md). Existing month resources and their approvals remain unchanged until a separately approved migration.

## The model: Skill × MAWL × Habit × Context × Family choice

**Skill:** What the child is learning and what competent completion looks like. A skill belongs to an individual; never assign a global maturity score. Age is a *starting suggestion*, not a ceiling, diagnosis, promotion trigger, or deadline. Concrete readiness, accessibility, and adult judgment override default age guidance.

**MAWL:** How competence and ownership are transferred:
- **Model:** Demonstrate the skill and a clear finish line.
- **Assist:** Do it together and transfer the mechanics. Model and Assist are usually short, but never time-boxed.
- **Watch:** Child performs while the adult observes and coaches *quality, consistency, judgment and adaptation across situations* (including a busy day, unusual timing, missing supplies, or a change in routine). Watch can take as long as needed.
- **Launch:** After enough real examples build the adult's confidence, transfer ownership. The child can notice, initiate, prepare, do, check, and recover when things change. Launch is not flawless performance, a trophy, or a requirement to teach siblings.

**Habit:** Attach the new action to a reliable existing cue (habit stacking), make the first step easy, remove friction, repeat in context, and let the natural benefit or satisfying finish make it worth repeating. Do not make bribes, chore payments, or artificial rewards the default. Habit consistency does not equal ownership: a child may repeat an action but still rely on adults to notice supplies, initiation or exceptions.

**Context:** Relevant school/summer/new-year transitions, actual household rhythm, available time and resources, shared responsibilities, challenges, family composition, and agreed priorities. Calendar information may inform a week-ahead conversation but must never silently imply a child's skill, a household problem, or a new obligation.

**Family choice:** Family can accept, change wording or timing, choose a higher or lower MAWL stage, remain in Watch, pause, or dismiss. A dismissal is not a deficiency. An explicit family decision wins over inferred age or seasonal defaults. A family may revisit it later deliberately.

## Coaching and recommendation rules

1. Give at most **one meaningful next step per person in a meeting** and prioritize what the family already chose over a fresh suggestion. A household may choose fewer or none.
2. Prefer the family's active priority and existing agreement; do not reset a goal because the month changes. A season changes *relevance*, not ownership.
3. MAWL is **per person, per skill**. Do not infer that being launched for one job means another is launched.
4. A recommendation must be explainable: skill, situation/season, why now, suggested MAWL stage, existing cue, one action, observable finish, and optional support. When detail is unknown, state it's a starting idea rather than inventing personal facts.
5. Advancement is never automatic based on age, days, repetitions, check marks, or month. The family decides when Watch has produced adequate quality across contexts.
6. Never automatically turn a recommendation, downloaded resource, or approved print into an agreement. Explicit “We agreed” (or equivalent) is required.
7. Keep the family's own edits, skips, approved print snapshots, and recorded progress. Never silently overwrite them with regenerated suggestions. Retain an audit trail of changes and reversals.
8. Use progressive, optional intake: ask one question only if its answer immediately improves the next step; don't require an exhaustive assessment of every child.
9. Avoid scoring, grades, competitive sibling comparisons, rigid milestone ages, clinical claims, and parent-shaming. Safeguard dangerous tasks and follow age/ability/accessibility constraints.
10. The weekly meeting is the central ongoing interaction, with **Our Focus · Let's Talk · Everyone's Part · Let's Practice** in the existing ten-minute order. The paid Club supplies personalized guidance *inside* that meeting, not a second mandatory meeting.
11. Family member data is shared for legitimate family features with existing account/household permissions; do not introduce child accounts or collect sensitive histories as a personalization shortcut.
12. Printed seasonal kits may eventually align with late spring/summer transition, back-to-school, and new year. This is a **direction, not a shipping, billing, or fulfillment change**. The current twelve resource pages and approved print files are frozen for this initiative.

## Skill library contract

Curated, authored, versioned skills, not open-ended invented developmental milestones. Seed categories:
- Self-care and personal belongings
- Household contribution and maintaining shared spaces
- Food and meal preparation
- Planning, school preparation and time management
- Initiative, independent play and managing boredom
- Caring for others and shared family leadership
- Shared routines and meeting participation

Each skill needs: stable ID, category, plain-language outcome, **indicative** age band, prerequisites and safety/adult-supervision flags, what finished means, MAWL examples, common reliable cues, natural payoff, variations for Watch, and optional context tags (summer, school entry, school year, new year, everyday). Do not treat all skills as safely launchable. Keep a small curated library before expanding.

## Family development record contract

Store the family’s *actual decisions*, independently of the authored library. Logical fields:
- household_id, member_id, skill_id (or carefully reviewed custom skill)
- current MAWL stage, chosen by the family; provenance (suggested vs family-chosen)
- cue/trigger and routine context, observable finish and support
- active/paused/launched/dismissed status, with optional reason
- who last confirmed, last family check-in, lightweight history of changes
- current season and active family priority as *context*, never forced annual resets

Suggested != accepted. Stage != progress label: “needs reminders” might describe Watch but cannot be silently converted into Model or Assist; “on my own” does not automatically authorize Launch. The existing `club_responsibilities`, `household_agreement_*` and `FamilyPlan` models remain authoritative until an explicit, backward-compatible migration. **Do not create a parallel household, agreement or meeting datastore.**

## The intended recommendation flow

1. Load authorized household, its people, chosen priorities, existing responsibilities, agreed work, and any verified progress.
2. Select a few relevant authored skills based on season and context; age and safety narrow the initial candidates but never trump explicit family choices.
3. Filter out dismissed/paused skills (unless the family reopens), already-owned responsibilities, duplicate or conflicting recommendations, and unsafe options.
4. If this is an existing skill, use family-chosen MAWL stage and last observation. In Watch, coach quality and changed circumstances before proposing Launch.
5. Attach to a *confirmed* stable cue where available, otherwise offer a choice of cues. Give one concrete step and a clear finish.
6. Present as a suggestion with **Try / Make easier / More responsibility / Stay here / Not now** controls as appropriate.
7. Save only a family-confirmed choice. Check back naturally at a later weekly meeting; reflect the answer in future suggestions without auto-promoting or inventing a new monthly target.

### Example

Skill: packing a school bag. Age makes it plausible, but the family chooses **Watch**. Normal cue: after dinner. Watch variation: prepare for a day with an unusually early departure. Parent observes whether the child checks necessary items and adjusts independently. If the family says “not yet,” keep Watch, simplify the step, or adapt the cue. If the family reports confidence across enough varied situations, *they* can choose Launch. The child's development record persists beyond the school-year boundary.

## UX standards for every relevant screen

- One next action, not a dashboard full of ratings, stages, checklists and tasks.
- If MAWL is shown, explain it in simple language; parents need not complete an MAWL questionnaire for every child.
- Distinguish an **idea**, a **family agreement**, and an **observed outcome** with honest language.
- Offer explicit edit, skip, stay, step back and move forward paths without hiding prior decisions.
- Keep the full family calendar optional and concise in meetings. Avoid interpreting private imported calendar data as family-shared events.
- Prefer direct use in the weekly Family Meeting. Resource print editors, billing and fulfillment remain separate.

## Changes, review and acceptance

This document is the **product guardrail**. For every personalization, family profile, meeting, recommendations, or seasonal-kit PR:
1. Describe which of Skill / MAWL / Habit / Context / Family choice it supports.
2. Say what facts it reads, what family decisions it persists, and what it never infers.
3. Demonstrate at least these cases: minimal profile, younger child, older child, family-selected higher/lower stage, prolonged Watch, dismissal, existing responsibility, seasonal transition, two-adult edits, and previous agreements.
4. Verify free versus Club entitlement, saved snapshots, accessibility, and safe fallbacks.
5. Any change to this philosophy requires an explicit owner decision and a documented revision here, not accidental drift in UI copy or recommendation rules.

## Implementation sequence (not yet shipped)

**Foundation (this change):** versioned philosophy, typed MAWL and family-choice contracts, pure recommendation decision functions and invariant tests. No production migration and no change to month resources.

**Next:** curated skill library; map existing desired/existing/confirmed responsibilities; design additive persistence and privacy review; connect selection into the unified weekly Family Meeting behind the Club entitlement.

**Then:** check-ins remembering adult judgment of quality, real variation, cue reliability, and family-controlled Launch. Remove duplicate surfaces only after the unified meeting and calendar are verified.

**Later:** connect future seasonal kits to the same durable record; keep old month resources intact until a separate, reviewed product decision.
