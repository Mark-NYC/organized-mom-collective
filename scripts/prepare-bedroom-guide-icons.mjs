/** Reuse original OMC hand-drawn icon art in the public Kids Bedroom Reset guide. */
import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {normalizeGuideCollection} from './lib/normalize-guide-ink.mjs';
const dest=resolve('public/assets/icons/ofc/guides/bedroom');
const artwork={
 bed:'assets/icons/ofc/updatedicons/svg/made-bed.svg',
 hamper:'assets/icons/ofc/updatedicons/svg/laundry-basket-with-clothes.svg',
 clothes:'assets/icons/ofc/updatedicons/svg/folded-clothes.svg',
 toys:'assets/icons/ofc/updatedicons/svg/blocks.svg',
 books:'assets/icons/ofc/updatedicons/svg/book-stack.svg',
 trash:'assets/icons/ofc/updatedicons/svg/trash-bin.svg',
 vacuum:'assets/icons/ofc/updatedicons/svg/vacuum-cleaner.svg',
 dust:'assets/icons/ofc/march/png/dust.png',
 basket:'assets/icons/ofc/updatedicons/svg/basket.svg',
 floor:'assets/icons/ofc/updatedicons/svg/broom.svg',
 dresser:'assets/icons/ofc/february/dresser.png'
};
await mkdir(dest,{recursive:true});
for(const [name,path] of Object.entries(artwork)){
 const file=join(dest,name+'.png');
 await sharp(resolve(path),{density:720}).ensureAlpha().resize(480,480,{fit:'contain',background:{r:255,g:255,b:255,alpha:0},withoutEnlargement:true}).png().toFile(file);
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let count=0;for(let i=3;i<data.length;i+=4)if(data[i]>10)count++;
 if(info.width<40||count<70)throw Error('Bad icon '+name+': '+path);
 console.log('Prepared hand-drawn bedroom icon '+name);
}

await normalizeGuideCollection(dest,Object.keys(artwork));
