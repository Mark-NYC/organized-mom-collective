/**
 * The worksheet's fonts: TrueType files in public/fonts/worksheet/ (made by scripts/build-worksheet-fonts.mjs).
 * The PDF embeds them; the preview loads the same files as @font-face; metrics come from the same bytes.
 */
import fontkit from '@pdf-lib/fontkit';
import type { FontKey, Metrics } from './types.ts';

export const FONT_FILES: Record<FontKey, string> = {
  serif: 'gelasio-400.ttf',
  serifItalic: 'gelasio-400-italic.ttf',
  serifBoldItalic: 'gelasio-600-italic.ttf',
  sans: 'montserrat-400.ttf',
  sansMedium: 'montserrat-500.ttf',
  sansBold: 'montserrat-600.ttf',
};

/** Public URL folder (browser) and repo folder (Node) of the files. */
export const FONT_URL = '/fonts/worksheet/';
export const FONT_DIR = 'public/fonts/worksheet/';

/** CSS family, weight and style the preview uses for each key (see the @font-face rules on the generator page). */
export const FONT_CSS: Record<FontKey, { family: string; weight: number; style: 'normal' | 'italic' }> = {
  serif: { family: 'WS Gelasio', weight: 400, style: 'normal' },
  serifItalic: { family: 'WS Gelasio', weight: 400, style: 'italic' },
  serifBoldItalic: { family: 'WS Gelasio', weight: 600, style: 'italic' },
  sans: { family: 'WS Montserrat', weight: 400, style: 'normal' },
  sansMedium: { family: 'WS Montserrat', weight: 500, style: 'normal' },
  sansBold: { family: 'WS Montserrat', weight: 600, style: 'normal' },
};

export type FontBytes = Record<FontKey, Uint8Array>;

/** Metrics measured exactly as pdf-lib draws: glyph advance widths after layout (ligatures on, no kerning). */
export function createMetrics(bytes: FontBytes): Metrics {
  const fonts = Object.fromEntries(
    Object.entries(bytes).map(([key, b]) => [key, fontkit.create(b as never)]),
  ) as unknown as Record<FontKey, { unitsPerEm: number; layout(t: string): { glyphs: { advanceWidth: number }[] }; hasGlyphForCodePoint(c: number): boolean }>;
  const cache = new Map<string, number>();
  return {
    width(font, text, size) {
      const key = `${font}\u0000${text}`;
      let units = cache.get(key);
      if (units === undefined) {
        const f = fonts[font];
        units = f.layout(text).glyphs.reduce((w, g) => w + g.advanceWidth, 0) / f.unitsPerEm;
        if (cache.size > 5000) cache.clear();
        cache.set(key, units);
      }
      return units * size;
    },
    has(font, char) {
      return fonts[font].hasGlyphForCodePoint(char.codePointAt(0) ?? 0);
    },
  };
}
