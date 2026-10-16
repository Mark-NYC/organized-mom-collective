# Responsibility illustrations

Originals of the custom Kids' Responsibility Cards illustrations (square, transparent background). Never crop, redraw or recolor them. Web sizes are made by `scripts/responsibility-image.py SOURCE ID`, which copies the original here as `{id}.{ext}` and writes `public/images/responsibilities/{id}-128.webp` (picker tiles) and `{id}-256.webp` (chart icon, sharp in the 2× PNG). Then set `image: true` for that id in `src/data/responsibilities.ts`. `tests/responsibilities.test.ts` fails if the flag and the files disagree.

The website only uses the illustration and title. The cards' three how-to steps and card layouts stay off the website.

All files here are 1254 × 1254 transparent WebP as provided, renamed to their ids. If higher-resolution PNG originals exist, replace them and rerun the script.

| Id | Title | Artwork | Status |
| --- | --- | --- | --- |
| brush-my-teeth | Brush My Teeth | Blue and clay toothbrushes in a sage cup with a heart | In |
| get-dressed | Get Dressed | Ivory and blue T-shirt with tan drawstring shorts | In |
| wash-my-hands | Wash My Hands | Soapy hands, water drops, sage pump bottle | In |
| pack-my-backpack | Pack My Backpack | Sage backpack with a heart and a water bottle | In |
| get-ready-for-bed | Get Ready for Bed | Blue moon pajamas and a moon pillow | In |
| comb-my-hair | Comb My Hair | Mint hairbrush and a tan comb | In |
| make-my-bed | Make My Bed | Wooden bed, sage flower blanket, pink heart pillow | In |
| put-toys-away | Put Toys Away | Sage bin with teddy bear, ball and blocks (no books) | In |
| put-clothes-away | Put Clothes Away | Woven basket with folded green shirt, jeans and socks | In |
| tidy-my-desk | Tidy My Desk | Wooden desk with pencil cup and stacked books | In |
| clean-my-floor | Clean My Floor | Broom and sage dustpan | In |
| set-the-table | Set the Table | Plate with a blue rim, fork and knife | In |
| clear-the-table | Clear the Table | Hands carrying stacked plates, cup and forks | In |
| help-with-laundry | Help With Laundry | Laundry basket of blue, green and cream clothes | In |
| wipe-the-counters | Wipe the Counters | Hand wiping a counter with a blue cloth, sparkles | In |
| take-out-the-trash | Take Out the Trash | Gray can with lid and a tied black bag | In |

The toys-only bin (uploaded as pick-up-toys) is "Put Toys Away". "Put My Things Away" was dropped from the library (owner decision, 2026-10-16) as redundant with Put Toys Away.
