# Organized Family development instructions

Read [docs/product/RESPONSIBILITY_DEVELOPMENT_FRAMEWORK.md](docs/product/RESPONSIBILITY_DEVELOPMENT_FRAMEWORK.md) and [docs/product/RESOURCE_ALIGNMENT.md](docs/product/RESOURCE_ALIGNMENT.md) **before** modifying Family, the weekly Family Meeting, Club personalization, onboarding, household responsibilities, recommendation content, child skill progression, or seasonal-kit strategy, **including public age-based guides, printed Responsibility Cards, free chore charts, and routines**.

This framework is the governing product contract. Preserve these invariants:
- Age suggests a starting skill but never limits a child or automatically changes their MAWL stage.
- MAWL is **Model → Assist → Watch → Launch**: Model and Assist transfer mechanics; Watch develops quality, consistency and ability to handle changed circumstances; Launch is a family decision to entrust ownership.
- Habit work starts from a reliable existing cue, a small action, and a natural satisfying finish. Do not default to bribing for chores.
- The family may accept, change, step up, step back, stay, pause or dismiss. Never silently assign, advance or resurface a dismissed recommendation.
- A suggested idea is not an agreement. Family decisions persist independently of generated suggestions and monthly/seasonal content.
- Use one unified weekly Family Meeting; free features remain accessible, paid guidance is entitlement-checked.
- Do not create a parallel household, agreement or skill-progress datastore without an approved additive design.
- Do not change existing twelve monthly generators, print files, approvals, billing, or fulfillment as a side effect of this initiative.

For every related PR, document the affected skill, MAWL/habit/context/family-choice behavior, where choices are saved, safe fallbacks, and tests for minimal intake, age/ability variation, prolonged Watch, rejection and family override. Changes to this doctrine require an explicit owner decision and a versioned edit to its source document.

Implementation contracts and tests: `src/lib/family-development/framework.ts`, `tests/family-development-framework.test.ts`. These are foundation code; do not claim the new engine is live until integrated and tested against actual household persistence.
