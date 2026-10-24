/**
 * July activity-board icon build. Source PNGs have printed labels baked in below
 * the illustrations. Extract the illustration pixels before the public assets
 * are served; never use nested images inside SVG or browser CSS clipping.
 * Source images: 256 × 256, transparent background.
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const source = join(root, 'assets/icons/ofc/updated');
const destination = join(root, 'public/images/club/july');
const icons = [
  ['supporting', 'book'], ['supporting', 'blocks'],
  ['supporting', 'puzzle-piece'], ['supporting', 'tree'],
  ['supporting', 'scissors'], ['supporting', 'bike'],
  ['supporting', 'jump-rope'], ['supporting', 'friend-pair'],
  ['utility', 'lightbulb'],
];
await mkdir(destination, { recursive: true });
for (const [folder, name] of icons) {
  const original = join(source, folder, name + '.png');
  const output = join(destination, name + '.png');
  const info = await sharp(original).metadata();
  if (info.width !== 256 || info.height !== 256) {
    throw new Error('Unexpected July icon dimensions for ' + name + ': ' + info.width + 'x' + info.height);
  }
  // The labels start below y=176; the drawn illustration stays inside this box.
  await sharp(original)
    .extract({ left: 20, top: 38, width: 216, height: 138 })
    .png()
    .toFile(output);
}
console.log('Prepared ' + icons.length + ' illustration-only July PNG icons.');
