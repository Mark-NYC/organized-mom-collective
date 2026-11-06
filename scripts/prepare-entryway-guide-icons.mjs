/** Transparent OMC hand-drawn icon exports for the Family Entryway Reset guide. */
import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {normalizeGuideCollection} from './lib/normalize-guide-ink.mjs';
const dest=resolve('public/assets/icons/ofc/guides/entryway');
const artwork={
 shoes:'assets/icons/ofc/updatedicons/svg/sneakers.svg',
 coat:'assets/icons/ofc/updatedicons/svg/coat.svg',
 backpack:'assets/icons/ofc/updatedicons/svg/backpack.svg',
 lunch:'assets/icons/ofc/updatedicons/svg/lunchbox.svg',
 papers:'assets/icons/ofc/updatedicons/svg/school-folder.svg',
 basket:'assets/icons/ofc/updatedicons/svg/basket.svg',
 wipe:'assets/icons/ofc/updatedicons/svg/spray-bottle-cloth.svg',
 floor:'assets/icons/ofc/updatedicons/svg/broom.svg',
 trash:'assets/icons/ofc/updatedicons/svg/trash-bin.svg',
 calendar:'assets/icons/ofc/updatedicons/svg/calendar.svg'
};
await mkdir(dest,{recursive:true});
for(const [name,path] of Object.entries(artwork)){
 const file=join(dest,name+'.png');
 await sharp(resolve(path),{density:720}).ensureAlpha().resize(480,480,{fit:'contain',background:{r:255,g:255,b:255,alpha:0},withoutEnlargement:true}).png().toFile(file);
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let visible=0;for(let i=3;i<data.length;i+=4)if(data[i]>10)visible++;
 if(info.width<40||visible<70)throw Error('Missing or blank OMC icon '+name+': '+path);
 console.log('Prepared entryway hand-drawn icon '+name);
}

await normalizeGuideCollection(dest,Object.keys(artwork));
