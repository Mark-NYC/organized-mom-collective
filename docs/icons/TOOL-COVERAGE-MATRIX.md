# OMC icon tool coverage matrix

Audit date: 2026-11-21. **Preliminary, code-backed findings only**, not an exhaustive per-line mapping. The Simple/Hand-drawn artwork must remain unchanged. Do not replace a task with an icon representing a different action.

| Tool | Source inspected | Actual task/asset examples | Soft Color needs | Risk / next audit |
|---|---|---|---|---|
| Cleaning Companion | `src/data/cleaning.ts` | Make beds; load/unload dishwasher; wipe sink; clean toilet; replace towels; wipe counters; sweep floor | `make-bed`, `unload-dishwasher`, `clean-sink`, `scrub-toilet`, `change-towels` | Existing daily/zone section art is `/icons/zones/*.png`; distinguish section art from line-task icons; check `src/components/app/CleaningParts.tsx` |
| Spring Cleaning Builder | `src/data/spring-cleaning.ts`, `src/components/site/SpringCleaningBuilder.astro` | Room-specific jobs across kitchen, bathroom, bedroom, entry, laundry, office | Priority cleaning group where exact job matches | Uses `initIllustrationChoice` with Simple label; confirm generated task mapping and avoid excess icons on dense pages |
| Laundry System | `src/pages/laundry-system.astro` | Sort clothes; washer/dryer; detergent; drying rack; move to drawer | Existing `sort-laundry`, `fold-laundry`, `put-away-laundry`; extra concepts only if proven necessary | Existing checklist is mostly text; washing-machine/dryer/detergent proposed outside 35, **not authorized** to generate |
| Lunch & Snack Station | `src/pages/lunch-and-snack-station.astro` | Icon-labeled lunch/snack poster items, plus editable text | `make-sandwich`, `wash-fruit`, `prepare-snack` may apply to actions; existing food icons for food objects | Source uses `/images/tools/lunch/${icon}.png` and `initIllustrationChoice`; distinguish specific food item from action icon |
| Back-to-School Checklist | `src/pages/back-to-school-checklist.astro` | Backpack; lunch box; water bottle; pencil case; labels; pack lunches and bags; set alarms | `pack-backpack`, `pack-lunch`, `set-alarm` | Checklist primarily text, section-level illustrations may be better than an icon per line |
| Weekly Family Planner | Pending source identification | Not yet audited | Pending | Do not claim coverage |
| Family Responsibility Chart | `src/data/responsibilities.ts`, `src/components/site/FamilyResponsibilityBuilder.astro` | Brush teeth; wash hands; pack backpack; make bed; bedroom chores | Group A exact matches | Do not map `pack-backpack` to `unpack-backpack`; avoid `make-bed` for `go-to-bed` |
| Screen Time Agreement | `src/data/screen-time.ts` | Homework; clean room; make bed; brush teeth; read; play outside; spelling | `do-homework`, `tidy-bedroom`, `make-bed`, `brush-teeth`, `read-together` only when reading **together**; `play-outside`, `study-spelling` | `read-a-book` vs `read-together` must not be conflated |
| Weekly Dinner Planner | Pending source identification | Not yet audited | Pending | Do not claim coverage |
| Family Meeting Club tools/printables | `src/data/club/kits/2027-03-spring-clean-together.ts`, `src/components/club/MarchSpringClean.astro` located; full contents not yet examined | March cleaning kit and family meeting materials | Priority cleaning and school/family groups as tasks warrant | Verify every month and print component before claiming full coverage |

## New concept proposals, **not** authorized for production

Washing machine, dryer, drying rack, detergent, turkey slices, whole wheat bread, cheese stick, hummus cup, cookie, chocolate square, pencil case, school labels, school forms, cleaning caddy, vacuum cleaner, device charging station, screen-time timer, grocery list. Check the full original 177-entry inventory first to avoid duplicates.

## Outstanding audit

For every tool extract complete runtime task labels, existing illustration source, canonical slug, mapping confidence, and whether the image is approved, merely available, or missing. Verify all task and section aliases and examine `src/lib/illustration-choice` fallback behavior. No live code modifications in this documentation branch.
