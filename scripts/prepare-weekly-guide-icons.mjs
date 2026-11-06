/** Reuse existing OMC black-and-white hand-drawn source artwork. */
import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {normalizeGuideCollection} from './lib/normalize-guide-ink.mjs';
const dest=resolve('public/assets/icons/ofc/guides/weekly');
const artwork={
 calendar:'calendar.svg',clock:'clock.svg',hands:'helping-hands.svg',pot:'cooking-pot.svg',
 heart:'family-group.svg',car:'car.svg',basket:'basket.svg',backpack:'backpack.svg',
 clipboard:'clipboard-with-checklist.svg',book:'book.svg'
};
await mkdir(dest,{recursive:true});
for(const [name,file] of Object.entries(artwork)){
 await sharp(resolve('assets/icons/ofc/updatedicons/svg/'+file),{density:720}).ensureAlpha()
 .resize(480,480,{fit:'contain',background:{r:255,g:255,b:255,alpha:0},withoutEnlargement:true})
 .png().toFile(join(dest,name+'.png'));
}
await normalizeGuideCollection(dest,Object.keys(artwork));
