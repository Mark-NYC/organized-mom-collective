/**
 * Pages → PDF with pdf-lib: vector text in the embedded fonts (subset), no browser, no print dialog.
 * Runs the same in the browser, Node, Cloudflare Workers or Deno.
 */
import fontkit from '@pdf-lib/fontkit';
import { Duplex, PDFDocument, PrintScaling, rgb, setCharacterSpacing, type PDFFont } from 'pdf-lib';
import type { FontBytes } from './fonts.ts';
import type { FontKey, Page } from './types.ts';

const color = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

export interface PdfMeta {
  title: string;
  subject?: string;
  /** Fixed for reproducible files; defaults to now. */
  date?: Date;
  /** Set false for separate, single-sided sheets (December gift cards). */
  duplex?: boolean;
}

export async function renderPdf(pages: Page[], bytes: FontBytes, meta: PdfMeta): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts = {} as Record<FontKey, PDFFont>;
  for (const key of Object.keys(bytes) as FontKey[]) fonts[key] = await doc.embedFont(bytes[key], { subset: true });

  const date = meta.date ?? new Date();
  doc.setTitle(meta.title, { showInWindowTitleBar: true });
  doc.setSubject(meta.subject ?? '');
  doc.setAuthor('Organized Mom Collective');
  doc.setCreator('Organized Family Club worksheet generator');
  doc.setProducer('Organized Family Club worksheet generator');
  doc.setCreationDate(date);
  doc.setModificationDate(date);
  // Print at 100% (never "fit to page"), double-sided, flipped on the long edge.
  const prefs = doc.catalog.getOrCreateViewerPreferences();
  prefs.setPrintScaling(PrintScaling.None);
  prefs.setDuplex(meta.duplex === false ? Duplex.Simplex : Duplex.DuplexFlipLongEdge);

  for (const p of pages) {
    const page = doc.addPage([p.width, p.height]);
    const Y = (y: number) => p.height - y;
    for (const op of p.ops) {
      if (op.t === 'rect') {
        page.drawRectangle({
          x: op.x, y: Y(op.y + op.h), width: op.w, height: op.h,
          ...(op.fill ? { color: color(op.fill) } : {}),
          ...(op.stroke ? { borderColor: color(op.stroke), borderWidth: op.sw ?? 0.6 } : {}),
        });
      } else if (op.t === 'line') {
        page.drawLine({ start: { x: op.x1, y: Y(op.y1) }, end: { x: op.x2, y: Y(op.y2) }, thickness: op.sw, color: color(op.color) });
      } else if (op.t === 'circle') {
        page.drawCircle({
          x: op.cx, y: Y(op.cy), size: op.r,
          ...(op.fill ? { color: color(op.fill) } : {}),
          ...(op.stroke ? { borderColor: color(op.stroke), borderWidth: op.sw ?? 0.6 } : {}),
        });
      } else if (op.t === 'dots') {
        for (const x of dotPositions(op.x1, op.x2, op.gap)) page.drawCircle({ x, y: Y(op.y), size: op.r, color: color(op.color) });
      } else {
        if (op.tracking) page.pushOperators(setCharacterSpacing(op.tracking));
        page.drawText(op.text, { x: op.x, y: Y(op.y), font: fonts[op.font], size: op.size, color: color(op.color) });
        if (op.tracking) page.pushOperators(setCharacterSpacing(0));
      }
    }
  }
  return doc.save();
}

/** Dot centers for a dotted line, spread evenly between both ends. Shared with the SVG preview. */
export function dotPositions(x1: number, x2: number, gap: number): number[] {
  const n = Math.max(Math.floor((x2 - x1) / gap), 1);
  const step = (x2 - x1) / n;
  return Array.from({ length: n + 1 }, (_, i) => x1 + i * step);
}
