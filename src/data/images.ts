/**
 * Article photography in public/images/resources/, made with scripts/article-image.py
 * from originals that are never edited (product photos: design/etsy-listing/).
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
  'hc-01-counter': { widths: [640, 960, 1440], width: 1440, height: 1152, source: 'design/etsy-listing/03.webp (text overlay cropped out)' },
  'hc-01-zone-tags': { widths: [640, 960, 1440], width: 1440, height: 720, source: 'design/etsy-listing/10.webp (text overlay cropped out)' },
  'hc-01-wall-calendar': { widths: [640, 960, 1402], width: 1402, height: 1122, source: 'design/etsy-listing/01.webp' },
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
