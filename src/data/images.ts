/**
 * Article photography in public/images/resources/, made with scripts/article-image.py
 * from originals that are never edited (product photos: design/etsy-listing/; lifestyle
 * scenes, some generated: design/photography/).
 *
 * Each entry lists the widths on disk ({name}-{width}.webp) and the largest
 * file's size, so pages reserve the right space (no layout shift).
 * Photography rules and the shot list: docs/editorial/BLOG_EDITORIAL_STYLE.md.
 */
export interface ArticleImage {
  widths: number[];
  width: number;
  height: number;
  /** Where the original came from (for the record, never shown). */
  source: string;
}

export const articleImages = {
  'fp-13-papers': { widths: [640, 960, 1280], width: 1280, height: 853, source: 'Kaboompics 36685, Karolina Grabowska; original design/photography/kaboompics/FP-13/36685.jpg; first use FP-13 2026-10-19' },
  'fp-13-drop-zone': { widths: [640, 960, 1280], width: 1280, height: 853, source: 'Kaboompics 36702, Karolina Grabowska; original design/photography/kaboompics/FP-13/36702.jpg; first use FP-13 2026-10-19' },
  'if-07-bathroom-sink-hands': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'Kaboompics 7888, Karolina Grabowska; https://kaboompics.com/photo/7888/washing-of-hands-under-running-water; dedicated IF-07 hero 2026-10-19' },
  'if-07-bathroom-folded-towels': { widths: [400, 600, 800], width: 800, height: 1200, source: 'Kaboompics 35020, Karolina Grabowska; https://kaboompics.com/photo/35020/wooden-bench-with-folded-towels-and-body-brush; dedicated IF-07 inline 2026-10-19' },
  'fp-11-hero': { widths: [640, 960, 1200], width: 1200, height: 800, source: 'Owner-supplied photo for FP-11, 2026-10-15; original design/photography/owner/fp-11-hero-original.jpg (1200x800); resize only, no crop or alteration; original photographer/site not stated by owner' },
  'hc-04-cleaning-basket': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'Kaboompics 32344, Karolina Grabowska; archived HC-03-full/32344-2400.jpg; crop 0,0.075,0.9,0.975 removes partial chin; first site use HC-04, 2026-10-14' },
  'hc-04-window-cleaning': { widths: [400, 600], width: 600, height: 900, source: 'Kaboompics 32349, Karolina Grabowska; licensed 600x900 archived HC-03/32349.jpg; max 400 CSS px; first site use HC-04, 2026-10-14' },
  'fp-06-market-zucchini': { widths: [640, 960, 1200], width: 1200, height: 800, source: 'Owner-uploaded Kaboompics 40035; original in design/photography/kaboompics/FP-06-owner-2026-10-14/market-zucchini-original.jpg; landscape crop 0,0.28,1,0.724444; no content alteration' },
  'fp-06-vegetable-flatlay': { widths: [640, 960, 1200], width: 1200, height: 800, source: 'Owner-uploaded Kaboompics 38833; original in design/photography/kaboompics/FP-06-owner-2026-10-14/vegetable-flatlay-original.jpg; full-size 1200x1800 owner source; landscape crop 0,0.2,1,0.644444; no upscaling' },
  'fp-06-bread-grocery-bag': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'Kaboompics 28538, Karolina Grabowska; original in design/photography/kaboompics/FP-01-full/28538-2400.jpg; clearance K06, 2026-10-14; resize only' },
  'if-01-family-baking': { widths: [640, 960, 1280], width: 1280, height: 1024, source: 'Existing owner-approved homepage family-kitchen image; reused unchanged for Intentional Family Life at owner request, 2026-10-14' },
  'fp-09-morning-fridge': { widths: [640, 898], width: 898, height: 1087, source: 'Owner-supplied morning routine fridge mockup, 2026-10-13; original design/photography/owner/fp-09-morning-fridge-original.webp; crop 0.19,0.085,0.99,0.86, chart unchanged' },
  'if-03-chore-chart-fridge': { widths: [640, 960, 1122], width: 1122, height: 786, source: 'Owner-supplied chore chart refrigerator mockup, 2026-10-13; library libfile_537a824683288191988021ab971bb4a4; cropped 0,0.19,1,0.75 without altering chart design' },
  'if-02-highlighters': { widths: [640, 960, 1200], width: 1200, height: 912, source: 'Kaboompics 18814, Karolina Grabowska; tight crop 0.25,0.61,1,0.99; original archived on codex/mental-load-highlighters in design/photography/kaboompics/IF-02-highlighters/' },
  'fp-04-planning-desk': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'Kaboompics 16979, Karolina Grabowska; original and download evidence archived on codex/reset-requested-photo in design/photography/kaboompics/FP-04-requested/' },
  'fp-03-school-bag': { widths: [640, 960, 1312], width: 1312, height: 828, source: 'Kaboompics 22548, Karolina Grabowska (faceless crop; original archived on codex/command-center-hero-photo in design/photography/kaboompics/FP-03-hero-detail/22548-2400.jpg)' },
  'hc-01-hero': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'design/etsy-listing/11.webp (cropped)' },
  'hc-01-zone-tags': { widths: [640, 960, 1440], width: 1440, height: 720, source: 'design/etsy-listing/10.webp (text overlay cropped out)' },
  'hc-01-wall-calendar': { widths: [640, 960, 1402], width: 1402, height: 1122, source: 'design/etsy-listing/01.webp' },
  'hc-02-hero': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'design/photography/kitchen-counter-wipe-dishwasher.png (generated lifestyle scene)' },
  'fp-05-week': { widths: [640, 960, 1440], width: 1440, height: 966, source: 'design/etsy-listing/04.webp (cropped: text overlay and phone removed)' },
  'fp-05-meal-plan': { widths: [640, 960, 1040], width: 1040, height: 540, source: 'design/etsy-listing/11.webp (cropped to the meal plan and grocery list)' },
  'fp-05-open-fridge': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'design/photography/meal-plan-open-fridge.png (generated lifestyle scene)' },
  'fp-05-taco-skillet': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'design/photography/meal-plan-taco-skillet.png (generated lifestyle scene)' },
  'fp-05-grocery-list-writing': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'design/photography/meal-plan-grocery-list-writing.png (generated lifestyle scene)' },
  'fp-05-leftovers-table': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'design/photography/meal-plan-leftovers-table.png (generated lifestyle scene)' },
  'fp-02-hero': { widths: [640, 960, 1254], width: 1254, height: 836, source: 'design/photography/calendar-filled-in-original.webp (cropped to 3:2; the printed calendar, real product photo)' },
  'fp-02-week-entries': { widths: [640, 960, 1440], width: 1440, height: 888, source: 'design/etsy-listing/06.webp (cropped to Monday–Friday: text overlay removed)' },
  'hc-03-zone-basket': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'Kaboompics 32280, Karolina Grabowska (original in design/photography/kaboompics/HC-03-full/; library K02)' },
  'hc-03-living-room-rug': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'Kaboompics 32324, Karolina Grabowska (original in design/photography/kaboompics/HC-03-full/; library K07)' },
  'fp-01-groceries': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'Kaboompics 28541, Karolina Grabowska (original in design/photography/kaboompics/FP-01-full/; library K08)' },
  'fp-01-week-on-one-page': { widths: [640, 960, 1440], width: 1440, height: 1318, source: 'design/etsy-listing/02.webp (header text cropped off)' },
  'if-01-notepad': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'Kaboompics 21478, Karolina Grabowska (original in design/photography/kaboompics/IF-01-full/; library K09)' },
  'if-01-quiet-mug': { widths: [640, 960, 1600], width: 1600, height: 2000, source: 'Kaboompics 9262, Karolina Grabowska (cropped to 4:5; original in design/photography/kaboompics/IF-01-full/; library K10)' },
  'hc-02-caddy': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'design/photography/kitchen-cleaning-caddy.png (generated lifestyle scene)' },
} as const satisfies Record<string, ArticleImage>;

export type ArticleImageName = keyof typeof articleImages;

export const articleImageNames = Object.keys(articleImages) as [ArticleImageName, ...ArticleImageName[]];

/** src, srcset and intrinsic size for an <img>. */
export function imageAttrs(name: ArticleImageName) {
  const img: ArticleImage = articleImages[name];
  const path = (w: number) => `/images/resources/${name}-${w}.webp`;
  const mid = img.widths.find((w) => w >= 960) ?? img.widths[img.widths.length - 1];
  return {
    src: path(mid),
    srcset: img.widths.map((w) => `${path(w)} ${w}w`).join(', '),
    width: img.width,
    height: img.height,
  };
}

/** The largest file, for Open Graph and structured data. */
export const largestImage = (name: ArticleImageName) => `/images/resources/${name}-${articleImages[name].width}.webp`;
