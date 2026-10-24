/** Wrapping and shrink-to-fit, measured with the embedded fonts so the preview and the PDF break lines identically. */
import type { FontKey, Metrics } from './types.ts';

/** Break text into lines no wider than `width`. Words wider than a line are split. Explicit line breaks are kept. */
export function wrap(m: Metrics, font: FontKey, size: number, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    // Break at spaces and after hyphens ("Montgomery-" / "Vanderbilt").
    for (const [, space, word] of paragraph.matchAll(/(\s*)([^\s-]*-+|[^\s]+)/g)) {
      const next = line ? `${line}${space ? ' ' : ''}${word}` : word;
      if (m.width(font, next, size) <= width) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      // A word that alone is too wide: split it by characters.
      let piece = '';
      for (const ch of word) {
        if (m.width(font, piece + ch, size) > width && piece) {
          lines.push(piece);
          piece = '';
        }
        piece += ch;
      }
      line = piece;
    }
    lines.push(line);
  }
  return lines;
}

export interface Fit {
  lines: string[];
  size: number;
}

/**
 * The largest size from `size` down to `min` (half-point steps) at which the text fits in `maxLines`.
 * If even `min` overflows, the last line ends in an ellipsis: the layout never grows.
 */
export function fit(m: Metrics, font: FontKey, text: string, opts: { width: number; maxLines: number; size: number; min: number }): Fit {
  for (let size = opts.size; size >= opts.min; size -= 0.5) {
    const lines = wrap(m, font, size, text, opts.width);
    if (lines.length <= opts.maxLines) return { lines, size };
  }
  const size = opts.min;
  const lines = wrap(m, font, size, text, opts.width).slice(0, opts.maxLines);
  let last = lines[lines.length - 1];
  while (last && m.width(font, `${last}…`, size) > opts.width) last = last.slice(0, -1);
  lines[lines.length - 1] = `${last.trimEnd()}…`;
  return { lines, size };
}
