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
