/**
 * Writes the November worksheet's fonts (public/fonts/worksheet/*.ttf) from the @fontsource WOFF files.
 *
 * PDFs need plain TrueType: pdf-lib embeds font bytes as they are, and a WOFF inside a PDF is unreadable. WOFF 1 is
 * only TrueType with zlib-compressed tables, so this unwraps it. The same .ttf files are the preview's @font-face,
 * so the screen and the PDF measure and draw identical glyphs. Rerun only to change a weight:
 *
 *   node scripts/build-worksheet-fonts.mjs
 *
 * Gelasio (SIL OFL) is a metric-compatible stand-in for Georgia, which is licensed and can't be embedded.
 * Montserrat (SIL OFL) is the site's body face. Latin subset: names outside it are simplified in
 * src/lib/worksheet/text.ts.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/fonts/worksheet');
const fonts = {
  'gelasio-400': '@fontsource/gelasio/files/gelasio-latin-400-normal.woff',
  'gelasio-400-italic': '@fontsource/gelasio/files/gelasio-latin-400-italic.woff',
  'gelasio-600-italic': '@fontsource/gelasio/files/gelasio-latin-600-italic.woff',
  'montserrat-400': '@fontsource/montserrat/files/montserrat-latin-400-normal.woff',
  'montserrat-500': '@fontsource/montserrat/files/montserrat-latin-500-normal.woff',
  'montserrat-600': '@fontsource/montserrat/files/montserrat-latin-600-normal.woff',
};

function woffToTtf(woff) {
  if (woff.readUInt32BE(0) !== 0x774f4646) throw new Error('not a WOFF 1 file');
  const flavor = woff.readUInt32BE(4);
  const numTables = woff.readUInt16BE(12);
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const at = 44 + i * 20;
    const [offset, compLength, origLength] = [woff.readUInt32BE(at + 4), woff.readUInt32BE(at + 8), woff.readUInt32BE(at + 12)];
    const raw = woff.subarray(offset, offset + compLength);
    tables.push({ tag: woff.subarray(at, at + 4), checksum: woff.readUInt32BE(at + 16), data: compLength < origLength ? inflateSync(raw) : raw });
  }
  const header = 12 + numTables * 16;
  const size = tables.reduce((n, t) => n + Math.ceil(t.data.length / 4) * 4, header);
  const ttf = Buffer.alloc(size);
  const log2 = Math.floor(Math.log2(numTables));
  ttf.writeUInt32BE(flavor, 0);
  ttf.writeUInt16BE(numTables, 4);
  ttf.writeUInt16BE(2 ** log2 * 16, 6);
  ttf.writeUInt16BE(log2, 8);
  ttf.writeUInt16BE(numTables * 16 - 2 ** log2 * 16, 10);
  let offset = header;
  tables.forEach((t, i) => {
    const at = 12 + i * 16;
    t.tag.copy(ttf, at);
    ttf.writeUInt32BE(t.checksum, at + 4);
    ttf.writeUInt32BE(offset, at + 8);
    ttf.writeUInt32BE(t.data.length, at + 12);
    t.data.copy(ttf, offset);
    offset += Math.ceil(t.data.length / 4) * 4;
  });
  return ttf;
}

mkdirSync(out, { recursive: true });
for (const [name, file] of Object.entries(fonts)) {
  const ttf = woffToTtf(readFileSync(join(root, 'node_modules', file)));
  writeFileSync(join(out, `${name}.ttf`), ttf);
  console.log(`${name}.ttf  ${(ttf.length / 1024).toFixed(0)} KB`);
}
