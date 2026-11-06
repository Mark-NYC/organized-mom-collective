/** Reuse and normalize OMC's existing hand-drawn art: transparent, black-and-white, tightly fitted. */
import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {normalizeGuideCollection} from './lib/normalize-guide-ink.mjs';
const dest=resolve('public/assets/icons/ofc/guides/paper');
const artwork={
 basket:'assets/icons/ofc/updatedicons/svg/basket.svg',
 papers:'assets/icons/ofc/updatedicons/svg/school-folder.svg',
 calendar:'assets/icons/ofc/updatedicons/svg/calendar.svg',
 folder:'assets/icons/ofc/updatedicons/svg/school-folder.svg',
 check:'assets/icons/ofc/updatedicons/svg/check-look.svg',
 backpack:'assets/icons/ofc/updatedicons/svg/backpack.svg',
 mail:'assets/icons/ofc/updatedicons/svg/school-folder.svg',
 art:'assets/icons/ofc/updatedicons/svg/book-stack.svg',
 shred:'assets/icons/ofc/updatedicons/svg/trash-bin.svg',
 hands:'assets/icons/ofc/updatedicons/svg/helping-hands.svg'
};
await mkdir(dest,{recursive:true});
for(const [name,path] of Object.entries(artwork)){
 const file=join(dest,name+'.png');
 await sharp(resolve(path),{density:720}).ensureAlpha().resize(480,480,{fit:'contain',background:{r:255,g:255,b:255,alpha:0},withoutEnlargement:true}).png().toFile(file);
}
await normalizeGuideCollection(dest,Object.keys(artwork));
