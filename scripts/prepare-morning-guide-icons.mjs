/** Original OMC hand-drawn SVG icons, converted to 480x480 transparent monochrome guide art. */
import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {normalizeGuideCollection} from './lib/normalize-guide-ink.mjs';
const dest=resolve('public/assets/icons/ofc/guides/morning');
const sources={
 calendar:'calendar.svg',shirt:'shirt.svg',lunch:'lunchbox.svg',water:'water-bottle.svg',
 backpack:'backpack.svg',clock:'clock.svg',breakfast:'breakfast-bowl.svg',
 teeth:'toothbrush.svg',shoes:'sneakers.svg',hands:'washing-hands.svg'
};
await mkdir(dest,{recursive:true});
for(const [name,file] of Object.entries(sources)){
 await sharp(resolve('assets/icons/ofc/updatedicons/svg/'+file),{density:720}).ensureAlpha()
  .resize(480,480,{fit:'contain',background:{r:255,g:255,b:255,alpha:0},withoutEnlargement:true})
  .png().toFile(join(dest,name+'.png'));
}
await normalizeGuideCollection(dest,Object.keys(sources));
