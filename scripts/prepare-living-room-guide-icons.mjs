/** Reuse existing OMC black-and-white hand-drawn artwork; never invent another icon set. */
import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {normalizeGuideCollection} from './lib/normalize-guide-ink.mjs';
const dest=resolve('public/assets/icons/ofc/guides/living-room');
const artwork={
 toys:'assets/icons/ofc/updatedicons/svg/blocks.svg',
 books:'assets/icons/ofc/updatedicons/svg/book-stack.svg',
 blanket:'assets/icons/ofc/updatedicons/svg/blanket.svg',
 dishes:'assets/icons/ofc/updatedicons/svg/dish.svg',
 basket:'assets/icons/ofc/updatedicons/svg/basket.svg',
 trash:'assets/icons/ofc/updatedicons/svg/trash-bin.svg',
 vacuum:'assets/icons/ofc/updatedicons/svg/vacuum-cleaner.svg',
 dust:'assets/icons/ofc/march/png/dust.png',
 check:'assets/icons/ofc/updatedicons/svg/check-look.svg',
 hands:'assets/icons/ofc/updatedicons/svg/helping-hands.svg',
 broom:'assets/icons/ofc/updatedicons/svg/broom.svg'
};
await mkdir(dest,{recursive:true});
for(const [name,path] of Object.entries(artwork)){
 const file=join(dest,name+'.png');
 await sharp(resolve(path),{density:720}).ensureAlpha().resize(480,480,{fit:'contain',background:{r:255,g:255,b:255,alpha:0},withoutEnlargement:true}).png().toFile(file);
}
await normalizeGuideCollection(dest,Object.keys(artwork));
