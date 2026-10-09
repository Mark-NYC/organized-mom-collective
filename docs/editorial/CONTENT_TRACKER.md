# Content tracker

Status of every planned and published article. Strategy, priority and overlap boundaries: [CONTENT_CLUSTERS.md](CONTENT_CLUSTERS.md). Process: [ARTICLE_WORKFLOW.md](ARTICLE_WORKFLOW.md).

**Statuses:** `Planned` → `Briefed` (brief in `briefs/`) → `Drafted` (in `src/content/articles/`, `draft: true`) → `Published`.

**Kept in sync automatically:** `npm run check:site` fails if a published article's `trackerId`, slug or `published` date doesn't match its row here, or if a row says `Published` without an article. Keep the table format as is (one row per article, these eight columns); the check reads it.

**Target links:** P = parent (pillar guide), S = siblings, B = bridge to another cluster, N = next (frontmatter `next`). Links to articles that aren't published yet are added when they are (see [INTERNAL_LINKING.md](INTERNAL_LINKING.md#maintaining-incoming-links)).

★ = pillar guide.

| ID | Title | Slug | Cluster | Status | Primary intent | Target links | Published |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FS-01 | ★ How to Organize Your Family's Week: A Simple System That Sticks | `how-to-organize-your-familys-week` | Family Schedules & Routines | Planned | how to organize family schedule | Children FS-02…06 · B CR-01, MP-01 · N FS-02 | — |
| FS-02 | How to Organize a Family Calendar Everyone Actually Uses | `how-to-organize-a-family-calendar` | Family Schedules & Routines | Planned | how to organize a family calendar | P FS-01 · S FS-03 · B MP-01, CR-01 · N FS-03 | — |
| FS-03 | The Weekly Family Reset: 15 Minutes to Plan the Week | `weekly-family-reset` | Family Schedules & Routines | Planned | sunday reset routine / weekly planning routine | P FS-01 · S FS-02, FS-04 · B MP-01, CR-01 · N MP-01 | — |
| FS-04 | How to Share the Mental Load at Home | `how-to-share-the-mental-load` | Family Schedules & Routines | Planned | how to share the mental load | P FS-01 · S FS-02, FS-03 · B CR-06 · N CR-06 | — |
| FS-05 | An Evening Routine That Makes Mornings Easier | `evening-routine-for-moms` | Family Schedules & Routines | Planned | evening routine for moms | P FS-01 · S FS-06 · B CR-02 · N FS-06 | — |
| FS-06 | A School Morning Routine That Runs Without Nagging | `school-morning-routine` | Family Schedules & Routines | Planned | school morning routine for kids | P FS-01 · S FS-05 · B MP-06 · N MP-06 | — |
| CR-01 | ★ A Weekly Cleaning Schedule for Busy Moms (That Survives a Bad Week) | `weekly-cleaning-schedule-for-busy-moms` | Cleaning Routines | Planned | weekly cleaning schedule for busy moms | Children CR-02…06 · B FS-02, MP-01 · N CR-02 | — |
| CR-02 | The 15-Minute Daily Reset | `daily-cleaning-routine` | Cleaning Routines | Planned | daily cleaning routine / 15 minute cleaning routine | P CR-01 · S CR-03, CR-05 · B FS-05 · N FS-05 | — |
| CR-03 | Zone Cleaning: One Area a Day, Without the Overwhelm | `zone-cleaning-schedule` | Cleaning Routines | Planned | zone cleaning schedule | P CR-01 · S CR-02, CR-04 · N CR-04 | — |
| CR-04 | A Monthly Deep Cleaning Plan: One Project a Month | `monthly-deep-cleaning-schedule` | Cleaning Routines | Planned | monthly deep cleaning checklist | P CR-01 · S CR-03, CR-05 · N CR-05 | — |
| CR-05 | How to Catch Up on Housework When You're Behind | `how-to-catch-up-on-housework` | Cleaning Routines | Planned | how to catch up on housework | P CR-01 · S CR-02, CR-04 · N CR-01 | — |
| CR-06 | Age-Appropriate Chores for Kids (and How to Hand Them Over) | `chores-for-kids-by-age` | Cleaning Routines | Planned | chores for kids by age | P CR-01 · S CR-02 · B FS-04 · N FS-04 | — |
| MP-01 | ★ Weekly Meal Planning for Families: Stop Deciding Dinner Every Night | `weekly-meal-planning-for-families` | Meal Planning | Planned | weekly meal planning for families | Children MP-02…06 · B FS-02, CR-01 · N MP-03 | — |
| MP-02 | How to Make a Grocery List From Your Meal Plan | `grocery-list-from-meal-plan` | Meal Planning | Planned | how to make a grocery list | P MP-01 · S MP-05 · N MP-05 | — |
| MP-03 | How to Build a Dinner Rotation Your Family Will Eat | `dinner-rotation` | Meal Planning | Planned | dinner rotation / meal rotation ideas | P MP-01 · S MP-04 · N MP-04 | — |
| MP-04 | Backup Dinners for Chaotic Nights | `backup-dinners-for-busy-nights` | Meal Planning | Planned | easy dinners for busy nights / pantry meals | P MP-01 · S MP-03 · B FS-02 · N MP-01 | — |
| MP-05 | Meal Planning on a Budget for Families | `budget-meal-planning-for-families` | Meal Planning | Planned | budget meal planning for family | P MP-01 · S MP-02 · N MP-04 | — |
| MP-06 | How to Plan School Lunches for the Week | `plan-school-lunches-for-the-week` | Meal Planning | Planned | how to plan school lunches | P MP-01 · B FS-06 · N FS-05 | — |
