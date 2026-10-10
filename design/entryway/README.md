# Entryway scene

The homepage scene (`src/components/site/EntrywayScene.astro`, section "Life gets busy. Stay centered.") stays hidden unless `background` and every item in `src/data/entryway-scene.ts` exist.

## Current layers (October 2026)

Made by `prep.py` from two supplied entryway renders in `source/` (`empty.png`, `full.png`), not a photo shoot:

- The calendar in both renders was a re-drawn imitation (garbled text, wrong header and hole), so `background.png` is `source/empty.png` with that calendar painted out and **the real artwork** (`public/images/site/calendar-cutout-960.webp`) placed in its spot, only scaled, lit to the wall and given a shadow and nail.
- The two renders aren't the same frame (calendar, lamp, table and basket shift), so each item is cut out of `source/full.png` and placed on the empty frame with a soft contact shadow, not cross-faded.
- The water bottle from `full.png` is left out (murky cutout, would sit into the lamp). The lunchbox is partly hidden behind the papers in `full.png`, so it fades in with them.
- 1254 px source, so the scene is built at 720 and 1080 px (enough for the 544 px desktop size at 2×).

Replacing them with a real locked-off shoot (below) is still the better version.

## Reshooting for real: what to shoot

One locked-off camera (tripod, fixed focal length, manual exposure and white balance, no movement between frames), one entryway, natural warm light.

### 1. `background.png` (or `.jpg` / `.webp`): the plate

- **Square, at least 2160 × 2160 px.** Final crop is 1:1.
- A real family entryway: wall, a **narrow console table**, a bit of floor in front of it.
- **The real printed 11 × 17 in portrait Wire-O calendar** hanging on the wall above the table, horizontally centered, roughly the upper middle of the frame (about 25–30% of the frame width). Open to a real page, as printed. Don't retouch, recolor or rewrite the page.
  - If the calendar is added in post instead of shot on the wall, composite it from a real product photo (e.g. `design/etsy-listing/01.webp` or `design/hero/calendar-flat-original.webp`) with perspective, light and shadow matched, and the artwork itself unchanged.
- **Console table empty.** Leave clear room on the tabletop and the floor on both sides for the props below.
- Nothing in front of the calendar, ever. Props stay below its bottom edge.

### 2. `items/<id>.png`: one prop per file, nine files

Shoot each prop in place on the same set without moving the camera, then mask it out. Each file is **the full canvas, same pixel size as the plate**, transparent everywhere except the prop and its own contact shadow (keep the shadow; that's what sells it). Props should not overlap each other.

| File | Prop | Where | Appears |
| --- | --- | --- | --- |
| `items/backpack.png` | Kid's school backpack | Floor, leaning on the left table leg | 2–4 s |
| `items/soccer-ball.png` | Soccer ball | Floor, right of the table | 2–4 s |
| `items/ballet-bag.png` | Ballet / dance bag | Tabletop, left end | 4–6 s |
| `items/ballet-shoes.png` | Pair of ballet shoes | Floor or tabletop, near the bag | 4–6 s |
| `items/work-tools.png` | Work things (laptop bag, badge, tool pouch: whatever fits the family) | Tabletop, right end | 6–8 s |
| `items/lunchbox.png` | Lunchbox | Tabletop, left of center, behind the papers | 8–10 s |
| `items/keys.png` | House / car keys | Tabletop, center front | 6–8 s |
| `items/grocery-bag.png` | Reusable grocery bag with a few groceries | Floor, far right | 8–10 s |
| `items/school-papers.png` | A small stack of school papers / permission slip | Tabletop, center | 8–10 s |

Ids, order and timing are in `src/data/entryway-scene.ts`; rename a file there if a prop changes.

## Then

```sh
# drop the files in this folder (prep.py is only for the current render-based layers)
python3 scripts/entryway-scene.py    # writes public/images/site/entryway/*.webp + src/data/entryway-scene.json
npm run verify
```

The script resizes the plate to 720/1080/1440 px, trims each prop to its pixels (positions are saved to the JSON), and checks every layer matches the plate. The section appears on the homepage on the next build. Check it at 390 px and 1366 px wide and with reduced motion turned on (everything shown still).
