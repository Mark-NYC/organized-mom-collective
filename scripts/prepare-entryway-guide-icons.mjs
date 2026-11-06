/** Transparent OMC hand-drawn icon exports for the Family Entryway Reset guide. */
import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const dest=resolve('public/assets/icons/ofc/guides/entryway');
const artwork={
 shoes:'assets/icons/ofc/v2/masters/shoes-and-coat-away.png',
 coat:'assets/icons/ofc/v2/masters/coat.png',
 backpack:'assets/icons/ofc/v2/masters/unpack-backpack.png',
 lunch:'assets/icons/ofc/v2/masters/lunchbox.png',
 papers:'assets/icons/ofc/v2/masters/school-notebook.png',
 basket:'assets/icons/ofc/v2/masters/basket.png',
 wipe:'assets/icons/ofc/v2/masters/wipe-counter.png',
 floor:'assets/icons/ofc/v2/masters/clean-floor.png',
 trash:'assets/icons/ofc/v2/masters/take-out-trash.png',
 calendar:'assets/icons/ofc/v2/masters/calendar.png'
};
await mkdir(dest,{recursive:true});
for(const [name,path] of Object.entries(artwork)){
 const file=join(dest,name+'.png');
 await sharp(resolve(path)).ensureAlpha().resize(480,480,{fit:'contain',background:{r:255,g:255,b:255,alpha:0},withoutEnlargement:true}).png().toFile(file);
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let visible=0;for(let i=3;i<data.length;i+=4)if(data[i]>10)visible++;
 if(info.width<40||visible<70)throw Error('Missing or blank OMC icon '+name+': '+path);
 console.log('Prepared entryway hand-drawn icon '+name);
}
