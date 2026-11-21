# Priority icon completion

Audit date: 2026-11-21. Branch: `docs/omc-icon-priority-audit-20261121`. This is a **preliminary source audit**, not visual or technical approval.

## Approval reconciliation

Owner explicitly confirms **80 existing icons approved**. The GitHub main branch has **100 top-level PNG master files** under `assets/icons/ofc/v2/masters/`, plus **10 PNGs** in `masters/png-1024/` duplicating slugs also present at the top level. **110 file instances are not 110 approved icons**. There is no exact approval registry visible in the checked GitHub tree. Preserve every existing master unchanged until a definitive 80-file approved manifest is reconciled. Do not downgrade owner approval. Older uploaded `MASTER-ICON-INVENTORY-UPDATED.csv` marks prior entries `new` and therefore does **not** reflect the later 80-icon approval. Do not import those obsolete approvals/statuses as truth.

The 35 priority canonical slugs below have **no matching top-level PNG master** in main branch at audit time. This is existence confirmation, **not** proof they lack historical pilot artwork. Six local pilot PNG+WebP pairs exist for Group A, but those pilot files are NOT presumed owner approved or identical to approved B01. No approved artwork was modified or overwritten.

## Status legend

- **Missing from master directory**: no exact canonical PNG slug present in the checked main branch
- **Pilot available**: separate local illustration exists, visual approval not inferred
- **Needs generation**: absent from approved GitHub master inventory; confirm pilot/references first
- **Generated / awaiting review**: standalone candidate exists, not accepted
- **Visual approval / technical QA / committed / integrated**: independent gates. None implied by presence of PNG alone

## Group A: Daily Routines

| Icon | GitHub master | Candidate | Visual approval | Technical QA | GitHub commit | Tool integration |
|---|---|---|---|---|---|---|
| `brush-teeth` | Missing | Generated candidate, awaiting review | Pending | Not passed | No new approved asset | Pending |
| `make-bed` | Missing | Local pilot; needs inspection | Pending | Not passed | No new approved asset | Pending |
| `wash-hands` | Missing | Local pilot; needs inspection | Pending | Not passed | No new approved asset | Pending |
| `pack-backpack` | Missing | Local pilot; needs inspection | Pending | Not passed | No new approved asset | Pending |
| `bath-or-shower` | Missing | Local pilot; needs inspection | Pending | Not passed | No new approved asset | Pending |
| `change-into-pajamas` | Missing | Local pilot; needs inspection | Pending | Not passed | No new approved asset | Pending |

## Group B: Cleaning

| Icon | GitHub master | Candidate | Visual approval | Technical QA | GitHub commit | Tool integration |
|---|---|---|---|---|---|---|
| `clean-sink` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `scrub-toilet` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `clean-fridge` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `clean-stovetop` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `clean-windows` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `clean-bathtub` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `change-towels` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `tidy-entryway` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `tidy-bedroom` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `change-bed-sheets` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |

## Group C: Kitchen and Laundry

| Icon | GitHub master | Candidate | Visual approval | Technical QA | GitHub commit | Tool integration |
|---|---|---|---|---|---|---|
| `unload-dishwasher` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `wipe-table` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `wash-dishes` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `wash-fruit` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `chop-vegetables` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `stir-pot` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `pour-water` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `put-away-groceries` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `make-sandwich` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |

## Group D: School and Family Activities

| Icon | GitHub master | Candidate | Visual approval | Technical QA | GitHub commit | Tool integration |
|---|---|---|---|---|---|---|
| `pack-lunch` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `set-alarm` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `do-homework` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `practice-writing` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `study-spelling` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `play-outside` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `family-game-night` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `read-together` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `water-plants` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |
| `prepare-snack` | Missing | Needs generation | Pending | Not passed | No new approved asset | Pending |

## Next decisions

1. Reconcile the exact 80 approved master file identities against the owner approval record. Do not infer approval from filename alone.
2. Confirm whether local Group A pilots are accepted or should be revised. The newly generated brush-teeth candidate has not passed technical/style QA and is not approved.
3. Complete the tool coverage audit in `docs/icons/TOOL-COVERAGE-MATRIX.md`, preserving the Simple/Hand-drawn option.
4. Add a canonical inventory to GitHub only after reconciling its outdated approval statuses; do not introduce a competing status register.
5. No PR, merge, website integration, or deploy without explicit authorization.
