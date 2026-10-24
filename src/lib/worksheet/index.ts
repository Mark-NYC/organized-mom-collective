/**
 * The November "I Own This Job" worksheet generator. One entry point for every caller:
 *
 *   const pdf = await createWorksheetPdf(input, fontBytes);        // Uint8Array, 2 pages, US Letter
 *
 * Browser: src/pages/club/worksheet-generator.astro. Node: scripts/render-worksheet.mjs. Mail fulfillment plan:
 * docs/club/WORKSHEET_PDF.md.
 */
import { WORKSHEET } from './content.ts';
import { createMetrics, type FontBytes } from './fonts.ts';
import { layoutWorksheet } from './layout.ts';
import { normalize } from './normalize.ts';
import { renderPdf } from './pdf.ts';
import type { Metrics, WorksheetInput } from './types.ts';

export { normalize } from './normalize.ts';
export { layoutWorksheet, PAGE_W, PAGE_H, MARGIN } from './layout.ts';
export { createMetrics, FONT_FILES, FONT_URL, FONT_DIR, FONT_CSS, type FontBytes } from './fonts.ts';
export { JOB_PRESETS, LIMITS, WORKSHEET } from './content.ts';
export type { WorksheetInput, WorksheetData, Page, Op } from './types.ts';

/** A file name safe for every OS: november-i-own-this-job-goering.pdf. */
export function worksheetFileName(input: WorksheetInput): string {
  const data = normalize(input);
  const slug = (data.familyName ?? '')
    .replace(/^the\s+|\s+family$/gi, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${WORKSHEET.month.toLowerCase()}-i-own-this-job${slug ? `-${slug}` : ''}.pdf`;
}

export async function createWorksheetPdf(input: WorksheetInput, fonts: FontBytes, opts: { metrics?: Metrics; date?: Date } = {}): Promise<Uint8Array> {
  const data = normalize(input);
  const pages = layoutWorksheet(opts.metrics ?? createMetrics(fonts), data);
  return renderPdf(pages, fonts, {
    title: `I Own This Job · ${WORKSHEET.month} ${WORKSHEET.year}${data.familyName ? ` · ${data.familyName}` : ''}`,
    subject: `${WORKSHEET.brand} family ownership worksheet`,
    date: opts.date,
  });
}
