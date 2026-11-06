/**
 * A single ink treatment for all five public OMC guides.
 * Preserve the silhouettes/hand-drawn marks and transparency, remove pastel
 * colors. Original source art stays untouched. The same PNG is used on
 * webpages, in the generated four-page PDFs and in matching preview images.
 */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

export async function normalizeGuideInk(path) {
  const {data,info}=await sharp(path).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let visible=0,colorPixels=0;
  for(let i=0;i<data.length;i+=4){
    const alpha=data[i+3];if(alpha===0)continue;
    const r=data[i],g=data[i+1],b=data[i+2];
    const brightness=.2126*r+.7152*g+.0722*b;
    // Keep dark hand-drawn strokes. Fade antialiasing and discard light
    // tinted surfaces or off-white backgrounds to maintain white paper.
    const inkAlpha=brightness<=155?1:brightness>=225?0:(225-brightness)/70;
    data[i]=50;data[i+1]=50;data[i+2]=50;
    data[i+3]=Math.round(alpha*inkAlpha);
    if(data[i+3]>35)visible++;
    if(data[i+3]>10 && (Math.abs(r-g)>18||Math.abs(g-b)>18||Math.abs(b-r)>18))colorPixels++;
  }
  if(visible<65)throw new Error('Ink treatment erased artwork: '+path);
  await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png({compressionLevel:9}).toFile(path);
  return {visible,colorPixels};
}

export async function normalizeGuideCollection(dest, names) {
  for(const name of names){
    const path=dest+'/'+name+'.png';
    const result=await normalizeGuideInk(path);
    console.log('Monochrome OMC guide art:',name, result.visible,'ink pixels');
  }
}
