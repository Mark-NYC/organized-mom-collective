# November 10 Pinterest destination recovery

Source of truth for original 19 pins (pin #4 intentionally excluded). **Never resubmit accepted pins**. Check Pinterest scheduled pins and confirmation emails first; CSV retries must include rejected rows only.

## Destination mapping

| Pin | Final intended target | Decision |
|---|---|---|
| 1 10-Minute Family Reset | /resources/weekly-family-reset/#share-the-work-before-the-check-in | Article section |
| 2 Stop Being the Family Reminder | /family-responsibility-builder/ | Free builder |
| 3 Holiday Entryway | pending dedicated entryway lifestyle article | HOLD |
| 5 One Weekly Plan | /planner/ | Free planner |
| 6 Holiday Jobs by Age | /resources/chores-for-kids-by-age/#age-appropriate-chores-age-by-age | Article section |
| 7 Holiday Command Center | /resources/home-command-center/#what-belongs-there-and-what-doesnt | Article section; review seasonal promise |
| 8 Chores Teach More Than Cleaning | /resources/chores-for-kids-by-age/#example-a-responsibility-chart-for-a-7-year-old | Article section; review promise |
| 9 Morning Routine | /routine-chart/ | Free tool |
| 10 From Helping to Owning | /family-responsibility-builder/ | Free builder |
| 11 Sunday Reset | /resources/weekly-family-reset/#share-the-work-before-the-check-in | Article section |
| 12 Five Things Kids Can Own | /chore-chart/ | Free tool |
| 13 Family Laundry Station | pending dedicated laundry station lifestyle article | HOLD per owner's decision |
| 14 After-School Routine | /routine-chart/ | Free tool |
| 15 Thanksgiving Jobs | /resources/holiday-family-planning-checklist/#give-someone-the-whole-responsibility | Article section, HOLD until image URL corrected |
| 16 Kitchen Reset Station | pending dedicated kitchen reset lifestyle article | HOLD |
| 17 Questions Instead of Nagging | /family-responsibility-builder/ | Free builder |
| 18 Free Chore Chart | /chore-chart/ | Free tool |
| 19 School Break Daily Rhythm | /routine-chart/ | Free tool |
| 20 Family Responsibility Builder | /family-responsibility-builder/ | Free builder |

## Rules

1. Article pages use Astro's heading-generated IDs, so sections already support fragments. Check the **built** heading ID before use, especially punctuation and apostrophes. The heading-based fragment candidates above must not be treated as confirmed until the deployed site is checked.
2. Never use `/club/` as a fallback link. Pin promise must match its destination.
3. Never create artificial fragments solely to bypass Pinterest duplication checks; a fragment must land at content that fulfills the promise.
4. Each CSV may only have one row per destination URL. But multiple files being uploaded together can still fail; upload one CSV, wait for accepted status, then continue.
5. Only retry confirmed rejected pins. Reconcile Pinterest accepted/scheduled pins before every retry.
6. All images must be public, correct MIME type, and downloadable. The Thanksgiving filename `omc-thanksgiving-everyone-helps` needs an image extension or a verified direct image response.
7. Pin #4 is deliberately excluded. Pins #3, #13, #16 remain held for dedicated editorial pages. Do not schedule them.
8. Use exact original file extensions. The current screenshots show `.jpeg`, not `.png`.
