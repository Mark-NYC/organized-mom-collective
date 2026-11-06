/** Transparent, charcoal hand-drawn OMC icons from our existing SVG library. */
import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {normalizeGuideCollection} from './lib/normalize-guide-ink.mjs';
const dest=resolve('public/assets/icons/ofc/guides/responsibility');
const sources={eye:'check-look.svg',clock:'clock.svg',hands:'helping-hands.svg',
 check:'clipboard-with-checklist.svg',dish:'dish.svg',backpack:'backpack.svg',
 basket:'laundry-basket-with-clothes.svg',clipboard:'clipboard-with-checklist.svg',
 family:'family-group.svg',star:'star.svg',calendar:'calendar.svg'};
await mkdir(dest,{recursive:true});
for(const [name,file] of Object.entries(sources)){
 await sharp(resolve('assets/icons/ofc/updatedicons/svg/'+file),{density:720}).ensureAlpha()
 .resize(480,480,{fit:'contain',background:{r:255,g:255,b:255,alpha:0},withoutEnlargement:true})
 .png().toFile(join(dest,name+'.png'));
}
await normalizeGuideCollection(dest,Object.keys(sources));
