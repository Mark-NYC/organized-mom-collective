/**
 * Responsive photos for public pages. Files are pre-sized webp copies named
 * `<name>-<width>.webp` (originals in design/etsy-listing/; see README → Where things live).
 */
export function photo(name: string, widths = [640, 960, 1280], dir = '/images/site') {
  const largest = widths[widths.length - 1];
  const middle = widths[Math.floor((widths.length - 1) / 2)];
  return {
    src: `${dir}/${name}-${middle}.webp`,
    srcset: widths.map((w) => `${dir}/${name}-${w}.webp ${w}w`).join(', '),
    largest: `${dir}/${name}-${largest}.webp`,
  };
}
