# Content tracker

Status of every planned and published article and its Pinterest pins. Strategy, priority and overlap boundaries: [CONTENT_CLUSTERS.md](CONTENT_CLUSTERS.md). Process: [ARTICLE_WORKFLOW.md](ARTICLE_WORKFLOW.md). Pinterest rules: [PINTEREST_STRATEGY.md](PINTEREST_STRATEGY.md).

## Columns

- **Status:** `Planned` → `Briefed` (brief in `briefs/`) → `Drafted` (in `src/content/articles/`, `draft: true`) → `Published`.
- **Target links:** P = parent (pillar guide or hub article), S = siblings, B = bridge to another cluster, N = next (frontmatter `next`). Links to articles that aren't published yet are added when they are (see [INTERNAL_LINKING.md](INTERNAL_LINKING.md#maintaining-incoming-links)).
- **Pinterest plan:** `—` (none yet) or `Yes` (complete plan at `pinterest/{ID}.md`).
- **Pins (search / curiosity / save):** the production status of the three pins, in that order, copied from the plan: `planned`, `generated`, `reviewed` or `published`. `—` until the plan exists.

★ = pillar guide.

## Kept in sync automatically

`npm run check:site` fails if:

- a published article's `trackerId`, slug or `published` date doesn't match its row, or a row says `Published` without an article;
- a published article has no Pinterest plan, the plan is incomplete (not exactly three pins, leftover placeholders, wrong ID or URL), or the row's Pinterest plan / Pins columns don't match the plan file.

Keep the table format as is: one row per article, these ten columns, in this order. The check reads it.

## Articles

| ID | Title | Slug | Cluster | Status | Primary intent | Target links | Published | Pinterest plan | Pins (search / curiosity / save) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FP-01 | ★ How to Organize Your Family's Week: A Simple System That Sticks | `how-to-organize-your-familys-week` | Family Planning & Routines | Published | how to organize family schedule | Children FP-02, FP-03, FP-04, FP-05, FP-08 (linked), FP-06 (linked), FP-07 (link when published) · B HC-01, IF-01 (linked) · N FP-02 | 2026-10-12 | Yes | planned / planned / planned |
| FP-02 | How to Organize a Family Calendar Everyone Actually Uses | `how-to-organize-a-family-calendar` | Family Planning & Routines | Published | how to organize a family calendar | P FP-01 (linked) · S FP-03, FP-04 (linked) · B FP-05, HC-01 (linked) · N FP-03 | 2026-10-12 | Yes | planned / planned / planned |
| FP-03 | How to Set Up a Home Command Center That Actually Gets Used | `home-command-center` | Family Planning & Routines | Published | family command center ideas | P FP-01 (linked) · S FP-02, FP-04 (linked) · B HC-01 (optional) · N FP-04 · Incoming FP-01, FP-02, FP-08 (linked) | 2026-10-12 | Yes | planned / generated / planned |
| FP-04 | The Weekly Family Reset: 15 Minutes to Plan the Week | `weekly-family-reset` | Family Planning & Routines | Published | sunday reset routine / weekly planning routine | P FP-01 (linked) · S FP-02, FP-05 (linked) · N FP-05 · Incoming FP-01, FP-02, FP-03 (linked) | 2026-10-12 | Yes | generated / planned / planned |
| FP-05 | Weekly Meal Planning for Families: Stop Deciding Dinner Every Night | `weekly-meal-planning-for-families` | Family Planning & Routines | Published | weekly meal planning for families | P FP-01 (linked) · Children FP-06 (linked), FP-07 (link when published) · B HC-01, HC-02 (linked) · Incoming FP-02 (linked) · N FP-06 (linked; FP-07 when published) | 2026-10-10 | Yes | planned / generated / planned |
| FP-06 | How to Make a Grocery List From Your Meal Plan | `grocery-list-from-meal-plan` | Family Planning & Routines | Published | how to make a grocery list | P FP-05, FP-01 (linked) · S FP-07 (link when published) · N FP-04 · Incoming FP-01, FP-05 (linked) | 2026-10-14 | Yes | planned / planned / planned |
| FP-07 | How to Build a Dinner Rotation Your Family Will Eat | `dinner-rotation` | Family Planning & Routines | Planned | dinner rotation / meal rotation ideas | P FP-05, FP-01 · S FP-06 · N FP-06 | — | — | — |
| FP-08 | Command Center Reset: Where Did My Time Go? | `where-does-my-time-go` | Family Planning & Routines | Published | time audit for moms | P FP-01 (linked) · S FP-03, FP-04 (linked) · B IF-02 (linked) · N FP-04 · Incoming FP-01, FP-03 (linked) | 2026-10-13 | Yes | planned / planned / planned |
| FP-09 | Free morning routine chart generator: a plan kids can follow | `morning-routine-chart-generator` | Family Planning & Routines | Published | morning routine chart generator | P FP-01 · B IF-03 · N IF-03 · Incoming FP-01, FP-04 | 2026-10-13 | Yes | planned / planned / planned |
| FP-10 | A Launch Pad by the Door So Mornings Don’t Start With a Hunt | `launch-pad-by-the-door` | Family Planning & Routines | Published | family launch pad by the door | P FP-01 · S FP-03, FP-09 · N FP-09 · Incoming FP-01, FP-09 | 2026-10-13 | Yes | planned / planned / planned |
| HC-01 | ★ A Weekly Cleaning Schedule for Busy Moms (That Survives a Bad Week) | `weekly-cleaning-schedule-for-busy-moms` | Simple Home Cleaning | Published | weekly cleaning schedule for busy moms | Children HC-02, HC-03 (linked), HC-04 (linked), HC-05 (link when published) · B FP-05, FP-02 (linked) · N HC-02 | 2026-10-09 | Yes | planned / planned / planned |
| HC-02 | The 15-Minute Daily Reset: A Simple Daily Cleaning Routine | `daily-cleaning-routine` | Simple Home Cleaning | Published | daily cleaning routine / 15 minute cleaning routine | P HC-01 · S HC-03 (linked), HC-05 (link when published) · B FP-05 (linked), IF-03 (link when published) · N HC-03 | 2026-10-10 | Yes | planned / generated / planned |
| HC-03 | Zone Cleaning: One Area a Day, Without the Overwhelm | `zone-cleaning-schedule` | Simple Home Cleaning | Published | zone cleaning schedule | P HC-01 (linked) · S HC-02 (linked), HC-04 (linked) · N HC-04 (linked) | 2026-10-12 | Yes | generated / planned / planned |
| HC-04 | A Monthly Deep Cleaning Plan: One Project a Month | `monthly-deep-cleaning-schedule` | Simple Home Cleaning | Published | monthly deep cleaning checklist | P HC-01 (linked) · S HC-03 (linked), HC-05 (link when published) · B FP-04 (linked) · N HC-05 (set when published; HC-01 for now) · Incoming HC-01, HC-03 (linked) | 2026-10-14 | Yes | planned / planned / planned |
| HC-05 | How to Catch Up on Housework When You're Behind | `how-to-catch-up-on-housework` | Simple Home Cleaning | Planned | how to catch up on housework | P HC-01 · S HC-02, HC-04 · N HC-01 | — | — | — |
| IF-01 | ★ Intentional Family Life: Making Room for What Matters in a Busy Week | `intentional-family-life` | Intentional Family Life | Published | intentional family living / how to be intentional with family | Children IF-02 (linked), IF-03…06 (link when published) · B FP-01, HC-02 (linked), FP-04 (link when published) · N IF-02 | 2026-10-12 | Yes | planned / planned / planned |
| IF-02 | How to Share the Mental Load at Home | `how-to-share-the-mental-load` | Intentional Family Life | Published | how to share the mental load | P IF-01 (linked) · S IF-03 (link when published) · B FP-03, FP-04 (linked) · N IF-03 (set when published; FP-04 for now) · Incoming IF-01, FP-03 (linked) | 2026-10-12 | Yes | planned / planned / planned |
| IF-03 | Kids’ Responsibility Chart by Age (Free Printable) | `chores-for-kids-by-age` | Intentional Family Life | Published | chores for kids by age | P IF-01 · S IF-02 · B HC-02, FP-09 · N HC-02 · Incoming IF-01, IF-02, FP-09 | 2026-10-13 | Yes | generated / planned / generated |
| IF-04 | A Simple Family Gratitude Habit That Fits a Busy Week | `family-gratitude-habit` | Intentional Family Life | Planned | gratitude practices for families | P IF-01 · S IF-05, IF-06 · N IF-05 | — | — | — |
| IF-05 | How to Make Time for Prayer as a Busy Mom | `prayer-time-for-busy-moms` | Intentional Family Life | Planned | how to make time for prayer as a mom | P IF-01 · S IF-04, IF-06 · N IF-06 | — | — | — |
| IF-06 | Realistic Self-Care for Busy Moms: Small Habits That Fit | `self-care-for-busy-moms` | Intentional Family Life | Planned | self-care for busy moms | P IF-01 · S IF-04, IF-05 · B HC-02 · N IF-04 | — | — | — |
| FP-11 | Wall Calendar vs. Digital Calendar: What's Better for Busy Families? | `wall-calendar-vs-digital-calendar-for-families` | Family Planning & Routines | Published | wall calendar vs digital calendar for families | P FP-01 · S FP-02, FP-03 · B IF-02 · N FP-02 | 2026-10-15 | Yes | planned / planned / planned |
| FP-12 | Best Family Command Center Systems: Which Setup Fits Your Family? | `best-family-command-center-systems` | Family Planning & Routines | Planned | best family command center systems | P FP-01 · S FP-03, FP-11 · N FP-03 | — | — | — |
| HC-06 | Clean Mama vs. FlyLady: Which Cleaning Routine Fits Busy Moms? | `clean-mama-vs-flylady` | Simple Home Cleaning | Planned | clean mama vs flylady | P HC-01 · S HC-02, HC-03 · N HC-01 | — | — | — |
| HC-07 | A 15-Minute Bathroom Reset You Can Actually Finish | `bathroom-reset-checklist` | Simple Home Cleaning | Published | bathroom reset checklist / 15-minute bathroom cleaning | P HC-01, HC-03 · S HC-02 · N HC-03 · Incoming links pending review | 2026-10-19 | Yes | planned / planned / planned |
| FP-13 | After-School Routine for Kids: Start With a Drop Zone | `after-school-routine-for-kids` | Family Planning & Routines | Published | after school routine for kids | P FP-01 · S FP-10, FP-03 · B FP-09 · N FP-10 | 2026-10-19 | Yes | planned / planned / planned |
| FP-16 | Free Weekly Family Planner Printable: Put the Whole Week on One Page | `free-weekly-family-planner-printable` | Family Planning & Routines | Published | free weekly family planner printable | P FP-01 (linked) · S FP-04, FP-05, FP-03 (linked) · N FP-01 | 2026-10-19 | Yes | planned / planned / planned |
| IF-07 | Bathroom Chores for Kids by Age | `bathroom-chores-for-kids` | Intentional Family Life | Published | bathroom chores for kids | P IF-03 (linked) · S HC-07 (linked) · N IF-03 | 2026-10-19 | Yes | planned / reviewed / planned |
| FP-14 | Digital Wall Calendars vs. Paper Wall Calendars: Which Fits Your Family? | `digital-wall-calendar-vs-paper-calendar` | Family Planning & Routines | Published | digital wall calendar vs paper calendar | P FP-01 (linked) · S FP-11 (linked), FP-04 (linked), FP-15, FP-17 (link when published) · N FP-02 · Incoming FP-01, FP-11 (linked) | 2026-10-20 | Yes | planned / planned / planned |
| FP-15 | The Best Family Wall Calendars for 2027 | `best-family-wall-calendars` | Family Planning & Routines | Published | best family wall calendar 2027 / best family calendar for wall | P FP-01 (linked) · S FP-14, FP-11, FP-02, FP-16 (linked) · N FP-02 · Incoming FP-01, FP-14, FP-11 (linked) · FP-17 (link both ways when published) | 2026-10-20 | Yes | planned / planned / planned |
| FP-17 | Skylight Calendar vs. a Paper Wall Calendar: Which Is Worth It for Your Family? | `skylight-calendar-vs-paper-wall-calendar` | Family Planning & Routines | Briefed | skylight calendar vs paper calendar | P FP-01, FP-14 · S FP-15 (link when published) · S FP-11, FP-02 · B IF-02 · N FP-02 · Incoming FP-11, FP-02, FP-01 (add when published) | — | — | — |
