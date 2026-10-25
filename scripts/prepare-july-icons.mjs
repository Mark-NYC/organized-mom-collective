/**
 * Prepare July icons from the original 256px transparent PNGs.
 * IMPORTANT: These sources have embedded captions below the art. Cropping a
 * fixed rectangle truncated the illustration. Instead remove only small,
 * disconnected glyph components in the caption band, find the COMPLETE art's
 * alpha bounds, and fit that artwork into a generously padded output canvas.
 */
import sharp from 'sharp';
import {mkdir,copyFile,readFile,access} from 'node:fs/promises';
import {join} from 'node:path';
const root=process.cwd();
const source=join(root,'assets/icons/ofc/updatedicons/png');
const destination=join(root,'public/images/club/july');
const pngRoot=join(root,'assets/icons/ofc/updatedicons/png');
const svgRoot=join(root,'assets/icons/ofc/updatedicons/svg');
async function exists(path){try{await access(path);return true;}catch{return false;}}
const iconAliases={
 'blocks':'building-blocks',
 'bike':'bicycle',
 'friend-pair':'playing-with-friends',
 'puzzle-piece':'puzzele-piece',
 'book-stack':'book',
 'sneakers':'putting-on-shoes',
 'apple':'fruit',
 'carrot':'carrot-sticks',
};
async function iconInput(name, preferSvg=false){
 const png=join(pngRoot,name+'.png'),svg=join(svgRoot,name+'.svg');
 if(preferSvg && await exists(svg))return svg;
 if(await exists(png))return png;
 if(await exists(svg))return svg;
 const replacement=iconAliases[name];
 if(replacement){
  const aliasPng=join(pngRoot,replacement+'.png'),aliasSvg=join(svgRoot,replacement+'.svg');
  if(await exists(aliasPng)){console.log('Mapped '+name+' to '+replacement+'.png');return aliasPng;}
  if(await exists(aliasSvg)){console.log('Mapped '+name+' to '+replacement+'.svg');return aliasSvg;}
 }
 console.warn('Optional icon source missing: '+name);
 return null;
}
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
 const input=name==='lightbulb' ? join(root,'assets/icons/ofc/utility/lightbulb.png') : await iconInput(name);
 if(!input || !(await exists(input))) {console.warn('Skipping missing July icon: '+name);continue;}
 const output=join(destination,name+'.png');
 const {data,info}=await sharp(input).resize(256,256,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(info.width!==256||info.height!==256||info.channels!==4)throw Error('Unexpected icon dimensions: '+name);
 const removed=0; // Updated transparent icon exports contain no embedded captions.
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

// August: copy the new, padded vector exports unchanged. No pixel cropping.
const augustIcons=[
 'morning-start','shirt','breakfast-bowl','toothbrush','basket',
 'dish','book','check-look','home','book-stack'
];
const augustDestination=join(root,'public/images/club/august-v2');
await mkdir(augustDestination,{recursive:true});
for(const name of augustIcons){
 const input=join(root,'assets/icons/ofc/updatedicons/svg',name+'.svg');
 const output=join(augustDestination,name+'.svg');
 if(!(await exists(input))){console.warn('Skipping missing August SVG: '+name);continue;}
 const svg=await readFile(input,'utf8');
 if(!svg.includes('viewBox="0 0 48 48"')||!svg.includes('<path')){
  throw Error('Unexpected August vector icon: '+name);
 }
 await copyFile(input,output);
}
console.log('Prepared '+icons.length+' July illustrations and copied '+augustIcons.length+' new August vector icons.');
 
// v3 previews: retain high-resolution original PNGs; rasterize the newly
// redrawn SVGs at print-friendly resolution. Never crop or trace either source.
const expandedNames=[
 'backpack','sneakers','coat','lunchbox','school-folder','school-notebook',
 'school-bus','washing-hands','yogurt-cup','apple','carrot','cheese-wedge',
 'crackers','granola-bar'
];
const previewIconNames=[
 'morning-start','shirt','breakfast-bowl','toothbrush','book',
 ...expandedNames
];
const previewDir=join(root,'public/images/club/august-v3');
const snackDir=join(root,'public/images/club/snack-icons-v2');
await mkdir(previewDir,{recursive:true});
await mkdir(snackDir,{recursive:true});
const snacks=new Set(['yogurt-cup','apple','carrot','cheese-wedge','crackers','granola-bar']);
for(const name of previewIconNames){
 const isNew=expandedNames.includes(name);
 const input=await iconInput(name,isNew);
 if(!input){console.warn('Skipping missing preview icon: '+name);continue;}
 const meta=await sharp(input).metadata();
 if(isNew&&meta.format!=='svg'&&meta.format!=='png')throw Error('Unsupported OFC artwork: '+name);
 if(!isNew&&meta.format!=='png'&&meta.format!=='svg')throw Error('Unsupported OFC artwork: '+name);
 const out=join(previewDir,name+'.png');
 // Contain the entire original art with safe padding, regardless of aspect ratio.
 await sharp(input,{density:300}).resize({width:420,height:420,fit:'contain',background:'#00000000'})
  .extend({top:46,bottom:46,left:46,right:46,background:'#00000000'})
  .png().toFile(out);
 // June snacks are prepared independently from their current PNG sources below.
}
// June snack illustrations must follow the replacement PNG library, not legacy SVGs.
// Fail clearly if a required snack image is absent rather than shipping a broken printable.
const juneSnackNames=['yogurt-cup','apple','carrot','cheese-wedge','crackers','granola-bar'];
const juneMissing=[];
for(const name of juneSnackNames){
 const actual=iconAliases[name] || name;
 const preferred=join(pngRoot,name+'.png');
 const renamed=join(pngRoot,actual+'.png');
 const input=await exists(preferred) ? preferred : await exists(renamed) ? renamed : null;
 if(!input){juneMissing.push(name+' (expected '+actual+'.png)');continue;}
 const output=join(snackDir,name+'.png');
 await sharp(input).rotate().resize({width:420,height:420,fit:'contain',background:'#00000000'})
  .extend({top:46,bottom:46,left:46,right:46,background:'#00000000'})
  .png().toFile(output);
 console.log('June snack: '+name+'.png <- '+input.slice(root.length+1));
}
if(juneMissing.length)throw Error('Missing June snack PNGs: '+juneMissing.join(', '));
console.log('Prepared '+juneSnackNames.length+' June snack PNGs.');
console.log('Prepared August v3 icon previews.');


 // Shared reusable art for May, January, February and July Club previews.
 // Render supplied original PNGs as-is, and newer SVG-only illustrations to padded PNGs.
 const sharedIcons=['morning-start','move-play','create-explore','lunch-reset','quiet-time','free-afternoon','evening-reset','breakfast-bowl','backpack','pajamas','dish','family-group','friend-pair','book','home','made-bed','shirt','paintbrush','star','basket','puzzle-piece','blocks','scissors','tree','bike','jump-rope','sidewalk-chalk','conversation-bubbles','adult-and-child-together','helping-hands'];
 const sharedDir=join(root,'public/images/club/shared-icons');
 await mkdir(sharedDir,{recursive:true});
 const svgOnly=new Set(['backpack','conversation-bubbles','adult-and-child-together','helping-hands']);
 for(const name of sharedIcons){
  const svg=svgOnly.has(name);
  const input=await iconInput(name,svg);
  if(!input){console.warn('Skipping missing shared icon: '+name);continue;}
  const output=join(sharedDir,name+'.png');
  await sharp(input,{density:300}).resize({width:420,height:420,fit:'contain',background:'#00000000'})
   .extend({top:46,bottom:46,left:46,right:46,background:'#00000000'})
   .png().toFile(output);
 }
 console.log('Prepared '+sharedIcons.length+' consistent shared Club illustrations.');

// Publish original supplied PNGs unchanged for the Club preview printables.
const allIconSource=join(root,'assets/icons/ofc/updatedicons/png');
const iconLibraryOutput=join(root,'public/images/club/icon-library');
const {readdir}=await import('node:fs/promises');
await mkdir(iconLibraryOutput,{recursive:true});
const iconFiles=(await readdir(allIconSource)).filter(n=>n.endsWith('.png'));
for(const filename of iconFiles)await copyFile(join(allIconSource,filename),join(iconLibraryOutput,filename));
for(const name of Object.keys(iconAliases)){
 const existing=join(iconLibraryOutput,name+'.png');
 if(await exists(existing))continue;
 const input=await iconInput(name);
 if(!input)continue;
 await sharp(input,{density:300}).png().toFile(existing);
}
console.log('Published '+iconFiles.length+' original Club PNG icons without cropping or conversion.');
