/**
 * Renders the November "I Own This Job" worksheet PDF without a browser, from JSON:
 *
 *   node scripts/render-worksheet.mjs input.json out.pdf
 *   echo '{"familyName":"Goering","owner":"Andrew"}' | node scripts/render-worksheet.mjs - out.pdf
 *
 * Input fields: src/lib/worksheet/types.ts → WorksheetInput. The same engine the generator page uses; this is the
 * piece a fulfillment job would call per family (docs/club/WORKSHEET_PDF.md). Requires Node 22.18+ (runs the .ts directly).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorksheetPdf, FONT_DIR, FONT_FILES } from '../src/lib/worksheet/index.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) {
  console.error('usage: node scripts/render-worksheet.mjs <input.json | -> <out.pdf>');
  process.exit(1);
}
const input = JSON.parse(readFileSync(inPath === '-' ? 0 : inPath, 'utf8'));
const fonts = Object.fromEntries(Object.entries(FONT_FILES).map(([k, f]) => [k, readFileSync(join(root, FONT_DIR, f))]));
const pdf = await createWorksheetPdf(input, fonts);
writeFileSync(outPath, pdf);
console.log(`${outPath}  ${(pdf.length / 1024).toFixed(0)} KB`);
