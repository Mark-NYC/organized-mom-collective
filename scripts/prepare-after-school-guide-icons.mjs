/** Existing OMC black-and-white drawings, fitted to transparent 480px icon canvas. */
import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {normalizeGuideCollection} from './lib/normalize-guide-ink.mjs';
const dest=resolve('public/assets/icons/ofc/guides/after-school');
const src={
 shoes:'sneakers.svg',lunch:'lunchbox.svg',papers:'school-folder.svg',
 hands:'washing-hands.svg',snack:'yogurt-cup.svg',backpack:'backpack.svg',
 homework:'school-notebook.svg',clock:'clock.svg',quiet:'quiet-time.svg',
 book:'book.svg'
};
await mkdir(dest,{recursive:true});
for(const [name,file] of Object.entries(src)){
 await sharp(resolve('assets/icons/ofc/updatedicons/svg/'+file),{density:720}).ensureAlpha()
  .resize(480,480,{fit:'contain',background:{r:255,g:255,b:255,alpha:0},withoutEnlargement:true})
  .png().toFile(join(dest,name+'.png'));
}
await normalizeGuideCollection(dest,Object.keys(src));
