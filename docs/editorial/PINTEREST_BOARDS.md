# Organized Mom Collective: actual Pinterest boards

**Status:** Owner-provided account screenshot, October 19, 2026. This is the authoritative board-name registry for writing pin metadata and Pinterest Import Content CSVs.

**Pinterest account:** `organizedmomcollective`

## Existing topic boards

These are the board names to use, **exactly as written**, unless a newer owner screenshot or the live Pinterest account shows that a name changed.

| Actual board name | Best-fitting content | Example pin topics |
| --- | --- | --- |
| **Meal Planning for Families** | Meals, groceries, dinner rotation, lunch/snack prep | Weekly meal plans, family grocery lists |
| **Chores & Shared Responsibilities** | Kids' chores, age-appropriate jobs, teaching tasks, shared work | Chore chart generator, chores for kids by age, what “done” looks like |
| **Family Organization Ideas** | Family planning, command centers, calendars, school-launch stations, routine generators | 2027 wall calendar, family entryway, morning routine chart |
| **Cleaning Schedules for Busy Moms** | Cleaning zones, daily and weekly cleaning, household reset routines | Zone cleaning schedule, missed cleaning day, daily reset |
| **Mom Life & Mental Load** | Family ownership and mental load, family communication and shared responsibility | Get plans out of mom's head, shared responsibility |
| **Weekly Reset Routines** | Sunday/weekly planning and reset routines | 15 minutes on Sunday, weekly family reset |

### Pinterest-owned collection

- **All Pins** is the automatically generated aggregate collection visible in the screenshot. It is **not** a separate editorial topic board. Do not target it as a content category for import.

## Evidence and name clarification

- Source: Screenshot of the owner's Pinterest **Saved** tab provided October 19, 2026.
- The screenshot renders the complete text **Chores & Shared Responsibilities**, as explicitly confirmed by the owner.
- Some board labels are visually truncated on the profile cards due to viewport width. The expanded full names above for **Meal Planning for Families**, **Family Organization Ideas**, and **Cleaning Schedules for Busy Moms** are from the owner's earlier explicitly established board list, cross-checked against the visible prefixes in the screenshot. Verify exact current spelling in the live Pinterest account before final CSV import.
- **Mom Life & Mental Load** and **Weekly Reset Routines** are readable in the screenshot.
- Do not substitute older planning names from historical strategy tables.

## Board assignment rules

1. Select the most specific relevant **existing board**; do not invent new boards to fit a pin.
2. Kids' chore charts and teaching responsibility → **Chores & Shared Responsibilities**.
3. A free morning routine chart, family command center, entryway launch pad, or wall calendar → **Family Organization Ideas**.
4. Weekly cleaning zones, the daily cleaning reset, and cleaning fallback advice → **Cleaning Schedules for Busy Moms**.
5. Sunday or weekly family reset → **Weekly Reset Routines**.
6. Mental-load storytelling → **Mom Life & Mental Load**, unless it is primarily a hands-on chore or family planning tutorial.
7. Meal and grocery content → **Meal Planning for Families**.
8. Preserve the exact board spelling in Pinterest import CSV `Pinterest board` column. The board must exist in the actual Pinterest account.
9. Re-check the account screenshot or board list when the owner reports a rename or new board.

## Gemini batch 01 mapping

For `design/pinterest/gemini-batch-01/approved-2026-10-19/`, the appropriate existing boards are:

| Pin number | Asset / headline | Existing board |
| --- | --- | --- |
| 1 | Missed a day? | Cleaning Schedules for Busy Moms |
| 2 | 15 minutes on Sunday | Weekly Reset Routines |
| 3 | The week on one page | Family Organization Ideas |
| 4 | Mornings without the hunt | Family Organization Ideas |
| 5 | One spot by the door | Family Organization Ideas |
| 6 | Free Chore Chart Generator for Kids | Chores & Shared Responsibilities |
| 7 | A little job. A bigger “I can.” | Chores & Shared Responsibilities |
| 8 | What does “done” look like? | Chores & Shared Responsibilities |
| 9 | One zone each day | Cleaning Schedules for Busy Moms |
| 10 | 15 minutes. Then stop | Cleaning Schedules for Busy Moms |

**Important:** Earlier `pinterest-metadata.csv` and `pinterest-import-ready.csv` in Gemini batch 01 were written with unverified planning board names. **Do not import those CSVs until the `board` / `Pinterest board` columns are corrected to this registry and reviewed.** Update the CSVs separately before import; the board mapping here does not mean the older CSVs have already been corrected.

## For ChatGPT, Claude, and future production batches

Read this file **at the start of every Pinterest batch**, together with `PINTEREST_STRATEGY.md`, `PINTEREST_PRODUCTION.md`, and the existing brand and creative guidelines. This file supersedes historical or proposed board lists for actual Pinterest account board names. It is a source-of-truth repository document, not an instruction to publish without the owner's approval.
