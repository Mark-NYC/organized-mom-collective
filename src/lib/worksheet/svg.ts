/** Pages → SVG for the on-screen preview: the same operations the PDF draws, in the same fonts. */
import { FONT_CSS } from './fonts.ts';
import type { Page } from './types.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r = (n: number) => Math.round(n * 100) / 100;

/** Dot centers, as the PDF spreads them (pdf.ts → dotPositions; duplicated to keep pdf-lib out of this module). */
function dots(x1: number, x2: number, gap: number) {
  const n = Math.max(Math.floor((x2 - x1) / gap), 1);
  const step = (x2 - x1) / n;
  return Array.from({ length: n + 1 }, (_, i) => x1 + i * step);
}

export function renderSvg(page: Page, label: string): string {
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${page.width} ${page.height}" role="img" aria-label="${esc(label)}" style="font-kerning:none;text-rendering:geometricPrecision">`,
    `<rect width="${page.width}" height="${page.height}" fill="#fff"/>`,
  ];
  for (const op of page.ops) {
    if (op.t === 'rect') {
      out.push(`<rect x="${r(op.x)}" y="${r(op.y)}" width="${r(op.w)}" height="${r(op.h)}" fill="${op.fill ?? 'none'}"${op.stroke ? ` stroke="${op.stroke}" stroke-width="${op.sw ?? 0.6}"` : ''}/>`);
    } else if (op.t === 'line') {
      out.push(`<line x1="${r(op.x1)}" y1="${r(op.y1)}" x2="${r(op.x2)}" y2="${r(op.y2)}" stroke="${op.color}" stroke-width="${op.sw}"/>`);
    } else if (op.t === 'circle') {
      out.push(`<circle cx="${r(op.cx)}" cy="${r(op.cy)}" r="${op.r}" fill="${op.fill ?? 'none'}"${op.stroke ? ` stroke="${op.stroke}" stroke-width="${op.sw ?? 0.6}"` : ''}/>`);
    } else if (op.t === 'dots') {
      out.push(`<g fill="${op.color}">${dots(op.x1, op.x2, op.gap).map((x) => `<circle cx="${r(x)}" cy="${r(op.y)}" r="${op.r}"/>`).join('')}</g>`);
    } else {
      const f = FONT_CSS[op.font];
      out.push(
        `<text x="${r(op.x)}" y="${r(op.y)}" fill="${op.color}" style="font-family:'${f.family}';font-weight:${f.weight};font-style:${f.style};font-size:${op.size}px${op.tracking ? `;letter-spacing:${op.tracking}px` : ''}" xml:space="preserve">${esc(op.text)}</text>`,
      );
    }
  }
  out.push('</svg>');
  return out.join('');
}
