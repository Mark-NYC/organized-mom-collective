/**
 * Generates responsive WebP hero sizes from the original, retained in GitHub.
 * Idempotent and safe to run in local dev, CI and Cloudflare Pages builds.
 */
import sharp from 'sharp';
import { mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const original = join(root, 'design/photography/owner/if-13-christmas-generosity-hero.jpeg');
const destination = join(root, 'public/images/resources');
const basename = 'if-13-christmas-generosity-hero';
const sizes = [640, 960, 1080];
await access(original);
const metadata = await sharp(original).metadata();
if (metadata.width !== 1080 || metadata.height !== 810) {
  throw new Error('Unexpected IF-13 hero dimensions; update image registry before using a replacement');
}
await mkdir(destination, {recursive:true});
for(const width of sizes) {
  const output = join(destination, basename+'-'+width+'.webp');
  await sharp(original).resize({width,withoutEnlargement:true}).webp({quality:82,effort:6}).toFile(output);
  console.log('Prepared '+output);
}
