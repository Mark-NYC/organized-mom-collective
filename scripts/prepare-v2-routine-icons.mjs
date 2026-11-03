/**
 * Build-only v2 PNG -> transparent 512px WebP exports.
 * Do NOT overwrite existing hand-drawn artwork or source v2 PNG masters.
 * Emit a separate /public/assets/icons/ofc/v2/routines/ directory.
 */
import sharp from 'sharp';
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const source = join(root, 'assets/icons/ofc/v2/masters');
const out = join(root, 'public/assets/icons/ofc/v2/routines');
await mkdir(out, { recursive: true });
const names = (await readdir(source)).filter(name => name.endsWith('.png'));
let converted = 0;
for (const name of names) {
  const input = join(source, name);
  const output = join(out, name.replace(/\.png$/, '.webp'));
  const img = sharp(input).rotate().resize(512, 512, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  }).ensureAlpha();
  await img.webp({ quality: 92, effort: 4 }).toFile(output);
  const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0, visible = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] === 0) transparent++;
    if (data[i] > 128) visible++;
  }
  if (!transparent || !visible || info.width !== 512 || info.height !== 512) {
    throw new Error('Invalid v2 WebP transparency/dimensions: ' + name);
  }
  converted++;
}
console.log('Prepared ' + converted + ' independent v2 color WebP icons (512x512). Original masters untouched.');
