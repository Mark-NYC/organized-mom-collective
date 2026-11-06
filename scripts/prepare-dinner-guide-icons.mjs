/** Use existing OMC hand-drawn icon artwork from the shared library.
 * Converted for PDF embedding and normalized with transparent, fitted charcoal ink.
 */
import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {normalizeGuideCollection} from './lib/normalize-guide-ink.mjs';
const dest=resolve('public/assets/icons/ofc/guides/dinner');
const root='assets/icons/ofc/updatedicons/svg/';
const artwork={
 calendar:'calendar.svg',
 clock:'clock.svg',
 sandwich:'sandwich.svg',
 pot:'cooking-pot.svg',
 grocery:'grocery-bag-with-produce.svg',
 clipboard:'clipboard-with-checklist.svg',
 table:'fork-spoon.svg',
 dish:'dish.svg',
 fork:'fork-spoon.svg',
 hands:'helping-hands.svg'
};
await mkdir(dest,{recursive:true});
for(const [name,file] of Object.entries(artwork)){
 await sharp(resolve(root+file),{density:720}).ensureAlpha()
  .resize(480,480,{fit:'contain',background:{r:255,g:255,b:255,alpha:0},withoutEnlargement:true})
  .png().toFile(join(dest,name+'.png'));
}
await normalizeGuideCollection(dest,Object.keys(artwork));
