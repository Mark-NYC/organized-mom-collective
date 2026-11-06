/**
 * Normalize illustrations for the five OMC practical guides.
 * Turn original marks into single-color charcoal on transparency, then crop
 * to the visible drawing and center in a 480x480 transparent frame.
 * This matters because both HTML <img> and pdf-lib otherwise scale invisible
 * margins as part of the icon, making the drawing look tiny in its slot.
 */
import sharp from 'sharp';

export const GUIDE_ICON_SIZE = 480;
const INK = 50;
const PADDING = 24; // 5% breathing room on each edge
const BBOX_ALPHA = 24;

export async function normalizeGuideInk(path) {
  const {data,info} = await sharp(path).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const w=info.width,h=info.height;
  let left=w,top=h,right=-1,bottom=-1,visible=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4;
    const a=data[i+3];if(!a)continue;
    const r=data[i],g=data[i+1],b=data[i+2];
    const brightness=.2126*r+.7152*g+.0722*b;
    // Strip light paper/pastel areas instead of leaving translucent colored
    // rectangles. Retain the original hand-drawn dark lines and their edges.
    const inkAlpha=brightness<=150?1:brightness>=205?0:(205-brightness)/55;
    const outAlpha=Math.round(a*inkAlpha);
    data[i]=INK;data[i+1]=INK;data[i+2]=INK;data[i+3]=outAlpha;
    if(outAlpha>BBOX_ALPHA){
      visible++;
      if(x<left)left=x;if(x>right)right=x;
      if(y<top)top=y;if(y>bottom)bottom=y;
    }
  }
  if(visible<65 || right<left)throw new Error('Icon lost its actual drawn object: '+path);
  // Trim from the nontransparent object bounds, not its old export canvas.
  // Keep 1px extra to retain original antialiasing at the boundary.
  left=Math.max(0,left-1);top=Math.max(0,top-1);
  right=Math.min(w-1,right+1);bottom=Math.min(h-1,bottom+1);
  const cropWidth=right-left+1,cropHeight=bottom-top+1;
  const cropped=await sharp(data,{raw:{width:w,height:h,channels:4}})
    .extract({left,top,width:cropWidth,height:cropHeight})
    .resize(GUIDE_ICON_SIZE-2*PADDING,GUIDE_ICON_SIZE-2*PADDING,{fit:'inside'})
    .png().toBuffer();
  const meta=await sharp(cropped).metadata();
  const outerLeft=Math.floor((GUIDE_ICON_SIZE-meta.width)/2);
  const outerTop=Math.floor((GUIDE_ICON_SIZE-meta.height)/2);
  await sharp(cropped).extend({
    left:outerLeft,
    right:GUIDE_ICON_SIZE-meta.width-outerLeft,
    top:outerTop,
    bottom:GUIDE_ICON_SIZE-meta.height-outerTop,
    background:{r:255,g:255,b:255,alpha:0}
  }).png({compressionLevel:9}).toFile(path);
  return {visible,sourceBounds:[cropWidth,cropHeight],finalBounds:[meta.width,meta.height]};
}

export async function normalizeGuideCollection(dest,names) {
  for(const name of names){
    const path=dest+'/'+name+'.png';
    const result=await normalizeGuideInk(path);
    console.log('Trimmed charcoal guide icon:',name,JSON.stringify(result));
  }
}
