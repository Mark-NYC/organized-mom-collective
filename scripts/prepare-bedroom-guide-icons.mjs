/** Reuse original OMC hand-drawn icon art in the public Kids Bedroom Reset guide. */
import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const dest=resolve('public/assets/icons/ofc/guides/bedroom');
const artwork={
 bed:'assets/icons/ofc/march/png/make-bed.png',
 hamper:'assets/icons/ofc/v2/masters/clothes-in-hamper.png',
 clothes:'assets/icons/ofc/v2/masters/put-away-clothes.png',
 toys:'assets/icons/ofc/v2/masters/put-away-toys.png',
 books:'assets/icons/ofc/v2/masters/book-stack.png',
 trash:'assets/icons/ofc/v2/masters/take-out-trash.png',
 vacuum:'assets/icons/ofc/march/png/vacuum.png',
 dust:'assets/icons/ofc/v2/masters/dust-furniture.png',
 basket:'assets/icons/ofc/v2/masters/basket.png',
 floor:'assets/icons/ofc/v2/masters/clean-floor.png',
 dresser:'assets/icons/ofc/february/dresser.png'
};
await mkdir(dest,{recursive:true});
for(const [name,path] of Object.entries(artwork)){
 const file=join(dest,name+'.png');
 await sharp(resolve(path)).ensureAlpha().resize(480,480,{fit:'contain',background:{r:255,g:255,b:255,alpha:0},withoutEnlargement:true}).png().toFile(file);
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let count=0;for(let i=3;i<data.length;i+=4)if(data[i]>10)count++;
 if(info.width<40||count<70)throw Error('Bad icon '+name+': '+path);
 console.log('Prepared hand-drawn bedroom icon '+name);
}
