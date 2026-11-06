/** Reuse OMC original hand-drawn black-and-white SVG art, never new clipart. */
import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {normalizeGuideCollection} from './lib/normalize-guide-ink.mjs';
const dest=resolve('public/assets/icons/ofc/guides/bedtime');
const art={
 dishes:'dish.svg',basket:'basket.svg',backpack:'backpack.svg',shirt:'shirt.svg',
 quiet:'quiet-time.svg',pajamas:'pajamas.svg',teeth:'toothbrush.svg',
 hands:'washing-hands.svg',book:'book.svg',pillow:'pillow.svg',
 clock:'clock.svg',blanket:'blanket.svg'
};
await mkdir(dest,{recursive:true});
for(const [name,file] of Object.entries(art)){
 await sharp(resolve('assets/icons/ofc/updatedicons/svg/'+file),{density:720}).ensureAlpha()
  .resize(480,480,{fit:'contain',background:{r:255,g:255,b:255,alpha:0},withoutEnlargement:true})
  .png().toFile(join(dest,name+'.png'));
}
await normalizeGuideCollection(dest,Object.keys(art));
