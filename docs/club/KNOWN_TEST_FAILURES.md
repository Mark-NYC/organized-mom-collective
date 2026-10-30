# Known test failures on `main` (recorded 2026-10-30)

`npx vitest run` on `main` at `6c29546` (after PR #258): **42 failed, 686 passed, 101 skipped**, in 14 files (one of
them, `club-countdown.test.ts`, fails while loading). These predate the Welcome Kit work and are **not regressions** from
it: the Welcome Kit branch fails exactly the same 42 tests, by name, and adds 6 passing ones
(`tests/club-onboarding.test.ts`). Compare by name, not by count, before calling anything a regression:

```bash
npx vitest run 2>&1 | grep -E "^ FAIL " | sort -u > /tmp/fails.txt
```

Nothing below was changed to make it pass. Each group needs an owner decision: update the test to the approved product,
or restore what the test describes.

## 1. Kit tests still describe earlier drafts (37 tests)

The kits' configs were revised to the newer product directions (one practical printed tool per month), but their
tests still assert the earlier drafts' titles, steps, letters and tools:

| File | Fails | What changed in the kit (test expects → kit has) |
| --- | --- | --- |
| `tests/club-august.test.ts` | 7 | Theme “Ready for the School Year” → “My School Day”; countdown action → `school-day` printable; letter now 111 words (test: 150–200); no back-page question; letter example no longer the routine chart's morning |
| `tests/club-countdown.test.ts` | file | Crashes on load: it reads August's `action.items`, which August no longer has |
| `tests/club-january.test.ts` | 5 | Title “A Fresh Start, Together” → “Our Family Habit Cards”; five-step reset → habit plan (docs/club/JANUARY_HABIT_CARDS.md); the tool handoff and plain-text copy have more fields/lines |
| `tests/club-july.test.ts` | 5 | One outing + packing builder → “What Can I Do Right Now?” activity board; no `tool`; letter 128 words; back-page framework title changed |
| `tests/club-june.test.ts` | 5 | “Summer With a Plan” agreement + two tools → “My Family’s Snack Station”; letter 105 words; back-page tip title changed |
| `tests/club-march.test.ts` | 5 | “Spring Clean as a Team” reset → “Our Family Spring Prep” plan; printable ids and field guide title changed; no `tool` |
| `tests/club-may.test.ts` | 6 | Wrap-up → “Our Summer Day” rhythm; letter 108 words; QR path doesn't point at the kit's own page (`qrPath must point at this kit`); tool handoff has more fields |
| `tests/club-kits.test.ts` | 1 | The same May `qrPath` problem, seen by the all-kits check |
| `tests/club-october.test.ts` | 1 | A printable's shape no longer has `kind` |
| `tests/worksheet.test.ts` | 3 | November worksheet renamed “I Own This Job” → “Our Family Ownership Plan” (file name, PDF title); blank-field handling changed |

**Worth a look before printing anything:** May's QR code (`qrPath must point at this kit`) is the one that would end
up on paper pointing at the wrong page.

## 2. Other pages moved (3 tests)

| File | Fails | Cause |
| --- | --- | --- |
| `tests/logic.test.ts` | 1 | “keeps the QR entry point and app routes stable”: the cleaning companion's day link is now `/app/cleaning?day=monday`; the test expects `/app?day=monday`. The test exists to keep printed QR entry points stable, so confirm what the printed calendar's QR code targets before deciding which side is right. |
| `tests/shop.test.ts` | 1 | `src/data/scheduler.ts` links to the website checkout, which the test allows only for the offer pages, calendar options and mug page |
| `src/lib/club/engines/march-chore-charts.test.ts` | 1 | The missing-art fallback for March's chore icons returns a different shape |

## 3. Slow in some environments (1 test)

| File | Fails | Cause |
| --- | --- | --- |
| `tests/club-edits.test.ts` | 1 | The 200-run property test takes ~6 s; vitest's default timeout is 5 s. It passes with a longer timeout. |

Related: `npm run test:club` (`tests/club-billing-e2e.test.ts`, local Postgres) spawns many `psql` processes and can
hit the same 5-second timeout on a slow machine. `bash scripts/test-club.sh --testTimeout=120000` runs all 32 green.
