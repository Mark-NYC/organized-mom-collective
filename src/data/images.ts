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
  'if-10-planning-desk-hero': { widths: [640, 838], width: 838, height: 559, source: 'Owner photo (owner states they took it), supplied 2026-10-21 as the IF-10 cover; original design/photography/owner/organized-family-habits-cover.jpg (1024x559); centered crop 0.0905,0,0.9095,1 trims the sides to 3:2 only; resize only, no upscaling; dedicated IF-10 hero' },
  'if-10-seven-habits-home': { widths: [640, 960, 1024], width: 1024, height: 687, source: 'Generated illustration (Google Gemini, owner-created concept: The Home That Runs Together), not a photograph and not a product image; original design/photography/kaboompics/organized-family-habits/organized-family-habits-seven-habits-home.png (1024x687); uncropped, resize only, no upscaling; owner-supplied 2026-10-21; dedicated IF-10 inline' },
  'if-10-child-building-blocks': { widths: [640, 960, 1200], width: 1200, height: 800, source: 'Kaboompics photo, source ID unconfirmed (owner-identified as Kaboompics); original design/photography/kaboompics/organized-family-habits/organized-family-habits-child.jpg (1200x800); uncropped, resize only, no upscaling; owner-supplied for installation 2026-10-21 (chat upload); Kaboompics page not reachable from the build environment (HTTP 403), so ID and license not re-checked; dedicated IF-10 inline' },
  'if-10-weekly-planning-notebook': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'Kaboompics photo, source ID unconfirmed (owner-identified as Kaboompics); original design/photography/kaboompics/organized-family-habits/organized-family-habits-weekly-planning.jpg (2000x1333); uncropped, resize only; owner-supplied for installation 2026-10-21 (chat upload); Kaboompics page not reachable from the build environment (HTTP 403), so ID and license not re-checked; dedicated IF-10 inline' },
  'fp-20-screen-time-routine-for-kids-hero': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'Kaboompics 1913, Karolina Grabowska (ID per six-article sourcing brief); https://kaboompics.com/photo/1913/coffee-on-table-with-a-tablet; original design/photography/kaboompics/six-article-heroes-2026-10-20/fp-20-screen-time-routine-for-kids-hero-original.jpg (2000x1333); uncropped, resize only; owner-supplied for installation 2026-10-20; Kaboompics page not reachable from the build environment (HTTP 403), so ID and license not re-checked; dedicated FP-20 hero' },
  'fp-19-busy-family-calendar-hero': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'Kaboompics 21474, Karolina Grabowska (ID per docs/editorial/briefs/SIX_ARTICLE_KABOOMPICS_HERO_SOURCING_2026-10-20.md); https://kaboompics.com/photo/21474/hand-writing-in-notebook-with-wooden-desk-copy-space; original design/photography/kaboompics/six-article-heroes-2026-10-20/fp-19-busy-family-calendar-hero-original.jpg (2000x1333); uncropped, resize only; owner-supplied for installation 2026-10-20; Kaboompics page not reachable from the build environment (HTTP 403), so ID and license not re-checked; dedicated FP-19 hero' },
  'hc-08-missed-cleaning-day-hero': { widths: [400, 600], width: 600, height: 900, source: 'Kaboompics 30800, Karolina Grabowska (ID per six-article sourcing brief); https://kaboompics.com/photo/30800/portrait-table-setting-background-with-neutral-plates-and-cutlery-and-generous-copy-space; original design/photography/kaboompics/six-article-heroes-2026-10-20/hc-08-missed-cleaning-day-hero-original.jpg (600x900); uncropped, resize only, no upscaling; owner-supplied for installation 2026-10-20; Kaboompics page not reachable from the build environment (HTTP 403), so ID and license not re-checked; dedicated HC-08 hero' },
  'if-08-teaching-kids-independence-hero': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'Kaboompics 22717, Karolina Grabowska (ID per six-article sourcing brief); https://kaboompics.com/photo/22717/student-packing-school-backpack-at-home; original design/photography/kaboompics/six-article-heroes-2026-10-20/if-08-teaching-kids-independence-hero-original.jpg (2000x1334); uncropped, resize only; owner-supplied for installation 2026-10-20; Kaboompics page not reachable from the build environment (HTTP 403), so ID and license not re-checked; dedicated IF-08 hero' },
  'hc-09-ten-minute-living-room-reset-hero': { widths: [400, 640, 1024], width: 1024, height: 1536, source: 'Kaboompics photo, source ID unconfirmed (the brief candidate 30364 is described as a book on an empty sofa; the supplied photo shows a woman reading); original design/photography/kaboompics/six-article-heroes-2026-10-20/hc-09-ten-minute-living-room-reset-hero-original.jpg (1024x1536); uncropped, resize only, no upscaling; owner-supplied for installation 2026-10-20; Kaboompics page not reachable from the build environment (HTTP 403), so ID and license not re-checked; dedicated HC-09 hero' },
  'if-09-kids-helping-with-dinner-hero': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'Kaboompics photo, source ID unconfirmed (the brief candidate 39343 is described on a marble counter; the supplied photo is on a steel counter); original design/photography/kaboompics/six-article-heroes-2026-10-20/if-09-kids-helping-with-dinner-hero-original.jpg (1929x1350); crop 0,0.0237,1,0.9763 trims to 3:2 only; owner-supplied for installation 2026-10-20; Kaboompics page not reachable from the build environment (HTTP 403), so ID and license not re-checked; dedicated IF-09 hero' },
  'fp-18-monthly-maker': { widths: [400, 640, 960, 1280], width: 1280, height: 1666, source: 'Screenshot of our free monthly maker (/try-the-calendar) after "Fill in an example month", October 2026, captured 2026-10-20 from a local build; original design/photography/screenshots/FP-18/try-the-calendar-example-month-2026-10.png; crop trims the panel border only' },
  'fp-15-boynton-my-family': { widths: [400, 640, 960], width: 960, height: 955, source: 'Third-party product photo (cover), Andrews McMeel Publishing, via the Linden Tree Books product page og:image https://www.lindentreebooks.com/sandra-boyntons-17-month-2026-2027-my-family-wall.html; original design/photography/products/FP-15/boynton-my-family-2026-2027-cover.jpg; resize only; owner-requested product images for FP-15, 2026-10-20' },
  'fp-15-knapp-big-grid': { widths: [400, 640, 960], width: 960, height: 704, source: 'Third-party product photo (cover), Sourcebooks, via the Barnes & Noble product page og:image https://www.barnesandnoble.com/w/2027-amy-knapps-big-grid-family-organizer-wall-calendar-amy-knapp/1148765301?ean=9781728292243; original design/photography/products/FP-15/knapp-big-grid-2027-cover.jpg; resize only; owner-requested product images for FP-15, 2026-10-20' },
  'fp-15-ubrands-core-command': { widths: [400, 640, 960], width: 960, height: 507, source: 'Third-party product photo, U Brands, first image on https://ubrands.com/products/core-command-dry-erase-monthly-organization-center-white; original design/photography/products/FP-15/ubrands-core-command.png; crop 0.15,0.32,0.85,0.69 trims empty backdrop only; owner-requested product images for FP-15, 2026-10-20' },
  'fp-15-skylight-calendar': { widths: [400, 640, 960], width: 960, height: 504, source: 'Third-party product photo, Skylight, og:image of https://myskylight.com/products/the-skylight-calendar-2-classic-white-with-plus-plan; original design/photography/products/FP-15/skylight-calendar-15.jpg; resize only; owner-requested product images for FP-15, 2026-10-20' },
  'fp-15-cozi': { widths: [400, 640, 960], width: 960, height: 541, source: 'Third-party product screenshot graphic, Cozi, og:image of https://www.cozi.com/compare-plans/; original design/photography/products/FP-15/cozi-family-screen.png; resize only; owner-requested product images for FP-15, 2026-10-20' },
  'fp-13-papers': { widths: [640, 960, 1280], width: 1280, height: 853, source: 'Kaboompics 36685, Karolina Grabowska; original design/photography/kaboompics/FP-13/36685.jpg; first use FP-13 2026-10-19' },
  'fp-13-drop-zone': { widths: [640, 960, 1280], width: 1280, height: 853, source: 'Kaboompics 36702, Karolina Grabowska; original design/photography/kaboompics/FP-13/36702.jpg; first use FP-13 2026-10-19' },
  'hc-07-bathroom-counter': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'Kaboompics 17876, Karolina Grabowska; https://kaboompics.com/photo/17876/olive-soap-wooden-nail-brush-bamboo-toothbrushes; original design/photography/kaboompics/HC-07-full/17876-2400.jpg; crop 0.08,0.25,0.83,1 removes bottles and their labels; dedicated HC-07 hero 2026-10-20' },
  'hc-07-fresh-towel': { widths: [400, 640, 877], width: 877, height: 1096, source: 'Kaboompics 42839, Karolina Grabowska; https://kaboompics.com/photo/42839/everyday-bathroom-routine-at-home; original design/photography/kaboompics/HC-07-full/42839-2400.jpg; crop 0.35,0.36,1,0.817 removes labelled bottles and towel tag; dedicated HC-07 inline 2026-10-20' },
  'fp-14-planner-phone': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'Kaboompics 44099, Karolina Grabowska; https://kaboompics.com/photo/44099/2027-year-planner-with-smartphone-and-pen-on-bed; original design/photography/kaboompics/FP-14-FP-17-full/44099-2400.jpg; uncropped; dedicated FP-14 hero 2026-10-20' },
  'fp-17-chalkboard-week': { widths: [400, 640, 960], width: 960, height: 1234, source: 'Kaboompics 2368, Karolina Grabowska; https://kaboompics.com/photo/2368/kitchen-clock-with-a-daily-schedule-on-a-blackboard; original design/photography/kaboompics/FP-14-FP-17-full/2368-2400.jpg; crop 0.30,0.10,1,0.70 removes the branded coffee machine; dedicated FP-17 inline 2026-10-20' },
  'fp-17-skylight-hero': { widths: [640, 960, 1440], width: 1440, height: 960, source: 'Skylight press kit (For Media: Skylight Press Kit, Calendar Imagery / 15 Calendar / White Background / BB-01.jpg), credit "Image: Skylight" per the kit fact sheet; owner-cleared as FP-17 hero 2026-10-20; original design/photography/skylight-press-kit/BB-01.jpg; crop 0,0.175,1,0.885 then white canvas extended to 3:2 (backdrop is pure white), product unaltered; FP-17 only, never in pins' },
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
