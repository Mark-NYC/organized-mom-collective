/**
 * Kitchen guide: create transparent PNGs for both the website and generated PDF.
 * Never modify source artwork. Remove only edge-connected near-white matte pixels,
 * leaving interior white details and all non-white hand-drawn strokes intact.
 */
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = process.cwd();
const dest = join(root, 'public/assets/icons/ofc/guides/kitchen');
const sources = {
 clear: 'assets/icons/ofc/march/clear-dishes.webp',
 sink: 'assets/icons/ofc/updatedicons/svg/dish.svg',
 wipe: 'assets/icons/ofc/march/wipe-surface.webp',
 table: 'assets/icons/ofc/march/set-table.webp',
 dishwasher: 'assets/icons/ofc/march/empty-dishwasher.webp',
 floor: 'assets/icons/ofc/march/clean-floor.webp',
 trash: 'assets/icons/ofc/march/take-out-trash.webp',
 fridge: 'assets/icons/ofc/march/clean-fridge.webp',
 lunch: 'assets/icons/ofc/updatedicons/svg/lunchbox.svg',
 kitchen: 'assets/icons/ofc/updatedicons/svg/cooking-pot.svg',
 check: 'assets/icons/ofc/updatedicons/svg/check-look.svg',
 hands: 'assets/icons/ofc/updatedicons/svg/helping-hands.svg',
};
const minWhite = 221;
function nearWhite(buf, pixel) {
  const i=pixel*4, r=buf[i], g=buf[i+1], b=buf[i+2];
  return Math.min(r,g,b)>=minWhite && Math.max(r,g,b)-Math.min(r,g,b)<=34 && buf[i+3]>0;
}
function eraseOutsideWhite(data,width,height){
  const total=width*height, seen=new Uint8Array(total), stack=[];
  function add(p){
    if(seen[p])return;
    seen[p]=1;
    if(nearWhite(data,p))stack.push(p);
  }
  for(let x=0;x<width;x++){add(x);add((height-1)*width+x);}
  for(let y=0;y<height;y++){add(y*width);add(y*width+width-1);}
  // Some old files have a white rectangular tile *inside* an alpha-padded
  // canvas. Treat the visible artwork bbox as another possible matte border,
  // but only if its perimeter is predominantly near-white.
  let left=width,top=height,right=-1,bottom=-1;
  for(let p=0;p<total;p++)if(data[p*4+3]>10){
    const x=p%width,y=Math.floor(p/width);
    if(x<left)left=x;if(x>right)right=x;if(y<top)top=y;if(y>bottom)bottom=y;
  }
  if(right>=left&&bottom>=top){
    const edge=[];
    for(let x=left;x<=right;x++){edge.push(top*width+x,bottom*width+x);}
    for(let y=top+1;y<bottom;y++){edge.push(y*width+left,y*width+right);}
    const fraction=edge.filter(p=>nearWhite(data,p)).length/Math.max(1,edge.length);
    if(fraction>0.58)for(const p of edge)add(p);
  }
  let removed=0;
  while(stack.length){
    const p=stack.pop(),i=p*4;
    if(data[i+3]!==0){data[i+3]=0;removed++;}
    const x=p%width,y=Math.floor(p/width);
    if(x>0)add(p-1);
    if(x<width-1)add(p+1);
    if(y>0)add(p-width);
    if(y<height-1)add(p+width);
  }
  // The boundary can contain JPEG antialiasing. Feather ONLY matte-adjacent
  // nearly-white pixels; no blanket removal of white (which damages the drawing).
  const snapshot=new Uint8Array(data);
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
    const p=y*width+x, i=p*4;
    if(data[i+3]<1)continue;
    const r=data[i],g=data[i+1],b=data[i+2];
    if(Math.min(r,g,b)<194 || Math.max(r,g,b)-Math.min(r,g,b)>38)continue;
    if(snapshot[(p-1)*4+3]||snapshot[(p+1)*4+3]||snapshot[(p-width)*4+3]||snapshot[(p+width)*4+3])continue;
    data[i+3]=Math.round(data[i+3]*(255-Math.min(r,g,b))/61);
  }
  return removed;
}
await mkdir(dest,{recursive:true});
for(const [name,path] of Object.entries(sources)){
  const source=resolve(root,path);
  const {data,info}=await sharp(source,{density:256})
    .resize({width:480,height:480,fit:'inside',withoutEnlargement:true})
    .ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const removed=eraseOutsideWhite(data,info.width,info.height);
  let visible=0;
  for(let i=3;i<data.length;i+=4)if(data[i]>50)visible++;
  if(visible<75)throw new Error(name+' has no remaining visible artwork');
  // Transparent padding means the art never touches the tile edges in the guide.
  const destination=join(dest,name+'.png');
  await sharp(data,{raw:{width:info.width,height:info.height,channels:4}})
    .extend({top:12,bottom:12,left:12,right:12,background:{r:255,g:255,b:255,alpha:0}})
    .png({compressionLevel:9}).toFile(destination);
  const {data:verify,info:verified}=await sharp(destination).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let clear=0,total=0;
  for(let x=0;x<verified.width;x++)for(const y of [0,verified.height-1]){
    total++;if(verify[(y*verified.width+x)*4+3]===0)clear++;
  }
  for(let y=1;y<verified.height-1;y++)for(const x of [0,verified.width-1]){
    total++;if(verify[(y*verified.width+x)*4+3]===0)clear++;
  }
  if(clear!==total)throw new Error(name+' has opaque output borders');
  console.log('Cleaned kitchen icon '+name+' (edge matte pixels removed: '+removed+', transparent border: 100%)');
}
console.log('Prepared '+Object.keys(sources).length+' transparent OMC kitchen icons.');
