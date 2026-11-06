/** Reuse the February Club's ORIGINAL hand-drawn laundry art for public guide and PDF.
 * Single source of truth: assets/icons/ofc/february/*.webp. Never redraw or mutate masters.
 * The generated transparent PNGs are only for the PDF builder's PNG-compatible icon API.
 */
import sharp from 'sharp';
import {normalizeGuideCollection} from './lib/normalize-guide-ink.mjs';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const sources=resolve('assets/icons/ofc/february');
const dest=resolve('public/assets/icons/ofc/guides/laundry');
const artwork={
  hamper:'laundry-hamper.webp',
  sort:'sorting-clothes.webp',
  washer:'washing-machine.webp',
  fold:'folding-clothes.webp',
  drawer:'putting-clothes-away.webp',
  towel:'folded-shirt.webp',
  clock:'transfering-clothes.webp',
  hands:'laundry-basket.webp',
  check:'checking-care-label.webp',
  shelf:'dresser.webp',
};
await mkdir(dest,{recursive:true});
for(const [name,file] of Object.entries(artwork)){
  const path=join(sources,file);
  const {data,info}=await sharp(path).ensureAlpha().resize(480,480,{
    fit:'contain',background:{r:255,g:255,b:255,alpha:0},withoutEnlargement:true,
  }).png({compressionLevel:9}).toBuffer({resolveWithObject:true});
  if(info.width<40||info.height<40)throw new Error('Unexpected artwork dimensions: '+file);
  const output=join(dest,name+'.png');
  await sharp(data).toFile(output);
  const image=await sharp(output).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let visible=0;
  for(let i=3;i<image.data.length;i+=4)if(image.data[i]>10)visible++;
  if(visible<75)throw new Error('Empty February artwork: '+file);
  console.log('Reused February hand-drawn art '+file+' as '+name+'.png');
}

// Website, PDF and page previews all use the exact same single-ink PNGs.
await normalizeGuideCollection(dest,Object.keys(artwork));
