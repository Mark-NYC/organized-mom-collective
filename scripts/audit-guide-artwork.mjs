/**
 * Fail CI when a Practical Guide icon is tiny inside its canvas, carries a
 * white rectangle, has unwanted colored pixels, or fails printable production.
 */
import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {PDFDocument} from 'pdf-lib';
const guides=[
 {slug:'bathroom',pdf:'family-bathroom-reset.pdf',preview:'bathroom'},
 {slug:'kitchen',pdf:'family-kitchen-reset.pdf',preview:'kitchen'},
 {slug:'laundry',pdf:'family-laundry-system-guide.pdf',preview:'laundry'},
 {slug:'entryway',pdf:'family-entryway-reset.pdf',preview:'entryway'},
 {slug:'bedroom',pdf:'family-bedroom-reset.pdf',preview:'bedroom'},
 {slug:'living-room',pdf:'family-living-room-reset.pdf',preview:'living-room'},
 {slug:'paper',pdf:'family-paper-clutter-reset.pdf',preview:'paper'}
];
let errors=[],images=0;
for(const {slug,pdf,preview} of guides){
 const folder=resolve('public/assets/icons/ofc/guides',slug);
 const {readdir}=await import('node:fs/promises');
 const names=(await readdir(folder)).filter(p=>p.endsWith('.png'));
 if(names.length<8)errors.push(slug+': expected at least 8 illustrations');
 for(const name of names){
  const path=resolve(folder,name);
  const {data,info}=await sharp(path).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  if(info.width!==480||info.height!==480){errors.push(slug+'/'+name+': expected 480x480');continue;}
  let x1=480,y1=480,x2=-1,y2=-1,ink=0;
  let edgeAlpha=0,nonInk=0;
  for(let y=0;y<480;y++)for(let x=0;x<480;x++){
   const i=(y*480+x)*4,a=data[i+3];
   if(a>24){x1=Math.min(x,x1);y1=Math.min(y,y1);x2=Math.max(x,x2);y2=Math.max(y,y2);ink++;}
   if((x<16||y<16||x>=464||y>=464)&&a>0)edgeAlpha++;
   if(a>16 && (data[i]!==50||data[i+1]!==50||data[i+2]!==50))nonInk++;
  }
  if(ink<65||x2<x1){errors.push(slug+'/'+name+': no visible illustration');continue;}
  if(edgeAlpha)errors.push(slug+'/'+name+': non-transparent edge or background');
  if(nonInk)errors.push(slug+'/'+name+': non-charcoal artwork pixels');
  const maxSize=Math.max(x2-x1+1,y2-y1+1);
  const smallEye = name==='check.png' && ['kitchen','living-room','paper'].includes(slug);
  if(smallEye ? (maxSize<302||maxSize>335) : (maxSize<405||maxSize>436))
    errors.push(slug+'/'+name+': drawing too small/large: '+maxSize+'px');
  if(Math.abs((x1+ x2)/2 - 239.5)>8||Math.abs((y1+y2)/2-239.5)>8)
   errors.push(slug+'/'+name+': drawing off-center');
  images++;
 }
 const bytes=await readFile(resolve('public/downloads',pdf));
 const doc=await PDFDocument.load(bytes);
 if(doc.getPageCount()!==4)errors.push(slug+': wrong PDF page count');
 for(const [i,p] of doc.getPages().entries()){
  const {width,height}=p.getSize();
  if(width!==612||height!==792)errors.push(slug+': PDF page '+(i+1)+' wrong size');
 }
 // Kitchen, laundry, entryway and bedroom preview generators are part of build.
 // Bathroom's original preview images are checked too, whether generated or committed.
 for(let n=1;n<=4;n++){
  const f=resolve('public/images/guides',preview+'-guide-page-'+n+'.webp');
  try {
   const metadata=await sharp(f).metadata();
   if(metadata.width!==1100||metadata.height!==1424)errors.push(slug+': page preview size incorrect '+n);
  }catch(e){errors.push(slug+': missing/invalid preview '+n+' ('+e.message+')');}
 }
 console.log('Audited '+slug+': '+names.length+' illustrations, four-page letter PDF, four previews');
}
if(errors.length){console.error(errors.map(x=>'FAIL '+x).join('\n'));process.exitCode=1;}
else console.log('Guide artwork QA passed: '+images+' fitted, transparent, monochrome drawings; seven PDFs; twenty-eight previews.');
