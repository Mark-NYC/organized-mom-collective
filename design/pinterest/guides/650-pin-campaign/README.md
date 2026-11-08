# 650 Guide Pins Campaign

Source of truth for the 650-pin, 13-guide rotating Pinterest campaign.

- **Master queue:** [OMC_650_Guide_Pins_Queue.csv](./OMC_650_Guide_Pins_Queue.csv). 650 pin rows, 50 rounds of 13 guides, five publishing slots per campaign day, with creative direction, destinations, boards, asset filenames and progress columns.
- **Design uploads:** [round-01](./round-01/) and [round-02](./round-02/) contain pins 001–026. Round 03 starts at pin 027.
- **Original workbook:** `OMC_650_Guide_Pins_Rotating_Plan_UPDATED.xlsx` was provided alongside this CSV and includes Overview, 650 Pin Queue, 50 Angles, 13 Guides, Guide Source Map, and Production Rules. The CSV is now the tracked text source; retain the original workbook until its binary can be added without loss.

## Workflow

1. Choose the next 13 rows in ascending Queue # order (one of each guide per round).
2. Generate assets using the provided creative direction and exact `Asset Filename`; upload to `round-XX/`.
3. Check actual uploaded filenames, including JPEG/PNG extensions, before Pinterest CSV export.
4. Update `Creation Status`, `Published?`, `Scheduled Date`, and `Live Pin URL` to reflect actual publishing state. The imported CSV's preexisting `Planned` states are not proof that existing assets are absent.
5. Preserve each pin's original guide URL, Pinterest board, headline, and angle when scheduling. Never overwrite the master queue with a subset.

Brand: Georgia headlines; Montserrat supporting text; charcoal #545454, warm ivory #FBF7F1, soft frost blue #CDDDE1, soft leaf green #D4DFC4, pale apricot #F1D8A8, powder blush #E8D2D6; black-and-white hand-drawn icons; portrait 1000×1500.
