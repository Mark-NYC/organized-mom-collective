/**
 * Prepare transparent WebP artwork for the Routine Chart and Family Responsibility Builder.
 * Source artwork is retained untouched. Generated assets are rebuilt before Astro runs.
 *
 * White/near-white JPEG mattes are converted to per-pixel alpha, including antialiased
 * strokes. Native transparent icons retain their original alpha when no matte exists.
 * Each output is checked for real transparency, not merely a WebP filename.
 */
import sharp from 'sharp';
import { mkdir, readdir } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

const root = process.cwd();
const sets = [
  ['shared', join(root, 'assets/icons/ofc/updatedicons/svg')],
  ['routine', join(root, 'assets/icons/ofc/routines')],
  ['march', join(root, 'assets/icons/ofc/march')],
];
const destination = join(root, 'assets/icons/ofc/tool-transparent');
const extensions = ['.webp', '.svg', '.png', '.jpg', '.jpeg'];
const mustHave = {
  // Use the names actually returned by choreLineIcon and choreLineIconForText.
  // Avoid copying unrelated artwork into the Cloudflare deploy.
  shared: ['toothbrush','shirt','backpack','pajamas','comb-my-hair','made-bed','toys-away','folded-clothes','tidy-desk','vacuum-cleaner','dish','clear-dishes','laundry-basket-with-clothes','wipe-surface','trash-bin','tidy-living-room','clothes-in-hamper','sort-laundry','dust-furniture','morning-start','book','cooking-pot','car','basket','calendar','spray-bottle-cloth','tree','feed-pets'],
  routine: ['shoes-and-coat-away','eat-breaktfast','eat-a-snack','homework-and-reading','free-play','bath-or-shower','lay-out-clothes','read-a-book','wake-up','grocery-shopping','screens-off','prayer-or-gratitude','practice-music','fill-water-bottle','ride-bike','quiet-time-rest','plan-the-week','wash-my-hands'],
};

async function makeTransparent(source, output) {
  // Constrain dimensions so the original line art remains crisp in the picker and PNG.
  const {data, info} = await sharp(source, {density: 144})
    .rotate()
    .resize({width: 768, height: 768, fit: 'inside', withoutEnlargement: true})
    .ensureAlpha()
    .raw().toBuffer({resolveWithObject: true});
  const {width, height} = info;
  let minAlpha = 255, whiteOpaqueCount = 0;
  for (let i=0; i<data.length; i+=4) {
    const r=data[i], g=data[i+1], b=data[i+2], a=data[i+3];
    minAlpha=Math.min(minAlpha,a);
    if(a>250 && r>240 && g>240 && b>240) whiteOpaqueCount++;

  }
  const total=width*height;
  // Even normally transparent icons can carry a white opaque rectangle behind the
  // strokes. Detect that by checking the outside perimeter rather than center art.
  let borderOpaqueWhite=0, borderPixels=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    if(x>=3 && y>=3 && x<width-3 && y<height-3) continue;
    const i=(y*width+x)*4, w=Math.min(data[i],data[i+1],data[i+2]);
    if(data[i+3]>250 && w>238)borderOpaqueWhite++;
    borderPixels++;
  }
  const matte = borderPixels>0 && borderOpaqueWhite/borderPixels>0.72;
  // If the original already has genuine alpha and no white boundary, leave every
  // original pixel alone, including antialiasing and colored strokes.
  if(matte || (minAlpha===255 && whiteOpaqueCount/total>0.16)) {
    for(let i=0;i<data.length;i+=4){
      const r=data[i],g=data[i+1],b=data[i+2],oldA=data[i+3];
      // White-matte unmixing: a grey fringe becomes a partially transparent
      // charcoal/black pixel rather than a pale halo on warm ivory backgrounds.
      const darkness=255-Math.min(r,g,b);
      const alpha=Math.round(oldA*darkness/255);
      data[i]=45; data[i+1]=45; data[i+2]=45; data[i+3]=alpha;
    }
  }
  // Convert perfectly-white and black line-art to lossless alpha WebP.
  await sharp(data,{raw:{width,height,channels:4}})
    .webp({lossless:true,effort:5}).toFile(output);
  const {data:verified,info:verifiedInfo}=await sharp(output).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let border=0,clearBorder=0,visible=0;
  for(let y=0;y<verifiedInfo.height;y++)for(let x=0;x<verifiedInfo.width;x++){
    const a=verified[(y*verifiedInfo.width+x)*4+3];
    if(a>90) visible++;
    if(x<3||y<3||x>=verifiedInfo.width-3||y>=verifiedInfo.height-3){
      border++;
      if(a<45)clearBorder++;
    }
  }
  if(!visible || !border || clearBorder/border<0.70) {
    throw new Error('Missing clear background or visible strokes in '+output+
      ' (transparent border '+(100*clearBorder/Math.max(border,1)).toFixed(1)+'%)');
  }
  return {width,height,clearBorder:clearBorder/border,matte};
}
let converted=0;
for(const [set,dir] of sets){
  const files=(await readdir(dir)).filter(name=>extensions.includes(extname(name).toLowerCase()));
  const available=new Map();
  for(const name of files){
    const ext=extname(name).toLowerCase(), stem=basename(name,ext);
    if(!available.has(stem))available.set(stem,[]);
    available.get(stem).push(name);
  }
  const required=mustHave[set] ?? mustHave.shared;
  const missing=required.filter(stem=>!available.has(stem));
  if(missing.length) {
    // Some legacy responsibilities may intentionally fall back to other formats.
    if(set==='routine')throw new Error('Required routine artwork missing: '+missing.join(', '));
    console.warn('Missing legacy artwork sources: '+missing.join(', '));
  }
  const out=join(destination,set); await mkdir(out,{recursive:true});
  for(const [stem,variants] of available){
    if(!required.includes(stem))continue;
    // Avoid converting captioned source files over an available clean transparent source.
    variants.sort((a,b)=>extensions.indexOf(extname(a).toLowerCase())-extensions.indexOf(extname(b).toLowerCase()));
    const source=join(dir,variants[0]);
    try {
      const result=await makeTransparent(source,join(out,stem+'.webp'));
      converted++;
      console.log('Transparent WebP '+set+'/'+stem+'.webp ('+result.width+'x'+result.height+', matte='+result.matte+')');
    }catch(e){throw new Error('Could not process '+source+': '+e.message)}
  }
}
console.log('Validated '+converted+' alpha-channel WebP icons for the two generators.');
