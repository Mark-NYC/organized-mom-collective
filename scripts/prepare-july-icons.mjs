/**
 * Prepare July icons from the original 256px transparent PNGs.
 * IMPORTANT: These sources have embedded captions below the art. Cropping a
 * fixed rectangle truncated the illustration. Instead remove only small,
 * disconnected glyph components in the caption band, find the COMPLETE art's
 * alpha bounds, and fit that artwork into a generously padded output canvas.
 */
import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const root=process.cwd();
const source=join(root,'assets/icons/ofc/updated');
const destination=join(root,'public/images/club/july');
const icons=[
 ['supporting','book'],['supporting','blocks'],['supporting','puzzle-piece'],
 ['supporting','tree'],['supporting','scissors'],['supporting','bike'],
 ['supporting','jump-rope'],['supporting','friend-pair'],['utility','lightbulb']
];
await mkdir(destination,{recursive:true});

function removeCaptionPixels(data,width,height){
 const visited=new Uint8Array(width*height);
 let cleared=0;
 // Eight-neighbor components allow antialiased glyph strokes to remain together.
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const idx=y*width+x;
  if(visited[idx]||data[idx*4+3]<35)continue;
  const queue=[idx];visited[idx]=1;
  let head=0,left=x,right=x,top=y,bottom=y;
  while(head<queue.length){
   const at=queue[head++],px=at%width,py=Math.floor(at/width);
   left=Math.min(left,px);right=Math.max(right,px);
   top=Math.min(top,py);bottom=Math.max(bottom,py);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const nx=px+dx,ny=py+dy;if(!dx&&!dy||nx<0||nx>=width||ny<0||ny>=height)continue;
    const ni=ny*width+nx;
    if(!visited[ni]&&data[ni*4+3]>=35){visited[ni]=1;queue.push(ni)}
   }
  }
  // Actual illustrations are much larger and begin above the caption band.
  // Keep disconnected art strokes, including those that extend below y=176.
  const glyph=top>=169&&(bottom-top+1)<=21&&(right-left+1)<=65;
  if(glyph){
   for(const at of queue)data[at*4+3]=0;
   cleared++;
  }
 }
 return cleared;
}
function alphaBounds(data,width,height){
 let left=width,top=height,right=-1,bottom=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  if(data[(y*width+x)*4+3]<35)continue;
  left=Math.min(left,x);right=Math.max(right,x);
  top=Math.min(top,y);bottom=Math.max(bottom,y);
 }
 if(right<left)throw Error('Empty icon after caption cleanup');
 return {left,top,width:right-left+1,height:bottom-top+1};
}
for(const [folder,name] of icons){
 const input=join(source,folder,name+'.png'),output=join(destination,name+'.png');
 const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(info.width!==256||info.height!==256||info.channels!==4)throw Error('Unexpected icon dimensions: '+name);
 const removed=removeCaptionPixels(data,info.width,info.height);
 const bounds=alphaBounds(data,info.width,info.height);
 // Full surviving illustration, NOT a hardcoded rectangle in the source.
 // The output has transparent safe margins on all sides for print and preview.
 const image=await sharp(data,{raw:{width:256,height:256,channels:4}})
  .extract(bounds)
  .resize({width:170,height:102,fit:'contain',background:{r:0,g:0,b:0,alpha:0}})
  .extend({top:14,bottom:14,left:15,right:15,background:{r:0,g:0,b:0,alpha:0}})
  .png().toFile(output);
 const safe=await sharp(output).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const drawn=alphaBounds(safe.data,safe.info.width,safe.info.height);
 if(drawn.left<8||drawn.top<8||drawn.left+drawn.width>safe.info.width-8||drawn.top+drawn.height>safe.info.height-8){
  throw Error('July icon touches crop edge: '+name);
 }
 console.log(name+': removed '+removed+' caption components; full art bounds '+JSON.stringify(bounds)+'; output '+image.width+'x'+image.height);
}

const augustIcons=[
 ['primary','morning-start'],['supporting','shirt'],['supporting','breakfast-bowl'],
 ['supporting','toothbrush'],['supporting','basket'],['supporting','made-bed'],
 ['supporting','dish'],['supporting','book']
];
const augustDestination=join(root,'public/images/club/august');
await mkdir(augustDestination,{recursive:true});
for(const [folder,name] of augustIcons){
 const input=join(source,folder,name+'.png'),output=join(augustDestination,name+'.png');
 const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(info.width!==256||info.height!==256||info.channels!==4)throw Error('Unexpected August icon dimensions: '+name);
 removeCaptionPixels(data,info.width,info.height);
 const bounds=alphaBounds(data,info.width,info.height);
 await sharp(data,{raw:{width:256,height:256,channels:4}})
  .extract(bounds)
  .resize({width:170,height:102,fit:'contain',background:{r:0,g:0,b:0,alpha:0}})
  .extend({top:14,bottom:14,left:15,right:15,background:{r:0,g:0,b:0,alpha:0}})
  .png().toFile(output);
 const safe=await sharp(output).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const drawn=alphaBounds(safe.data,safe.info.width,safe.info.height);
 if(drawn.left<8||drawn.top<8||drawn.left+drawn.width>safe.info.width-8||drawn.top+drawn.height>safe.info.height-8)throw Error('August icon touches edge: '+name);
}
console.log('Prepared '+icons.length+' July and '+augustIcons.length+' August illustrated icon PNGs.');

