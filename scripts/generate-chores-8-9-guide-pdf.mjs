/**
 * Responsibility Cards edition: ages 8–9 printable.
 * Nine illustrations are cropped at build time from the approved high-resolution
 * age-reference card (4.png), not upscaled from the 70px thumbnail icons.
 * One US Letter sheet, selectable text, standalone printable, no tabletop imagery.
 */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import fontkit from '@pdf-lib/fontkit';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';

const OUTPUT='public/downloads/chores-for-8-9-year-olds.pdf';
const SOURCE='public/assets/responsibility-cards/illustrations/4.png';
const LETTER=[612,792];
const hex=(s)=>{const q=s.replace('#','');return rgb(parseInt(q.slice(0,2),16)/255,parseInt(q.slice(2,4),16)/255,parseInt(q.slice(4,6),16)/255)};
const C={ivory:hex('#FBF7F1'),charcoal:hex('#545454'),peach:hex('#D8B79F'),leaf:hex('#D4DFC4'),blue:hex('#CDDDE1'),blush:hex('#E8D2D6'),white:rgb(1,1,1),rule:hex('#D5C5B8')};

// Original finished age-reference sheet is 1275 x 1875.
// Crops isolate the illustration, excluding the original printed chore labels.
const jobs=[
 {title:'Pack my backpack',x:155,y:210,w:235,h:224},
 {title:'Tidy my desk',x:397,y:210,w:235,h:224},
 {title:'Clear the table',x:637,y:210,w:235,h:224},
 {title:'Help with laundry',x:881,y:210,w:235,h:224},
 {title:'Wipe the counters',x:155,y:556,w:235,h:224},
 {title:'Tidy the entryway',x:397,y:556,w:235,h:224},
 {title:'After-school reset',x:637,y:556,w:235,h:224},
 {title:'Clean my floor',x:155,y:1235,w:235,h:224},
 {title:'Tidy the bathroom',x:637,y:1235,w:235,h:224}
];

function pill(page,x,y,w,h,r,fill,stroke=null){
 page.drawRectangle({x:x+r,y,width:w-2*r,height:h,color:fill});
 page.drawRectangle({x,y:y+r,width:w,height:h-2*r,color:fill});
 for(const cx of [x+r,x+w-r])for(const cy of [y+r,y+h-r])
  page.drawEllipse({x:cx,y:cy,xScale:r,yScale:r,color:fill});
 if(stroke){
  page.drawLine({start:{x:x+r,y:y+h},end:{x:x+w-r,y:y+h},thickness:1.2,color:stroke});
  page.drawLine({start:{x:x+r,y},end:{x:x+w-r,y},thickness:1.2,color:stroke});
  page.drawLine({start:{x,y:y+r},end:{x,y:y+h-r},thickness:1.2,color:stroke});
  page.drawLine({start:{x:x+w,y:y+r},end:{x:x+w,y:y+h-r},thickness:1.2,color:stroke});
  // Outline corner curves with PDF bezier SVG paths.
  const d=[
   'M '+(x+r)+' '+(y+h)+' C '+(x+r*.45)+' '+(y+h)+' '+x+' '+(y+h-r*.45)+' '+x+' '+(y+h-r),
   'M '+(x+w-r)+' '+(y+h)+' C '+(x+w-r*.45)+' '+(y+h)+' '+(x+w)+' '+(y+h-r*.45)+' '+(x+w)+' '+(y+h-r),
   'M '+x+' '+(y+r)+' C '+x+' '+(y+r*.45)+' '+(x+r*.45)+' '+y+' '+(x+r)+' '+y,
   'M '+(x+w)+' '+(y+r)+' C '+(x+w)+' '+(y+r*.45)+' '+(x+w-r*.45)+' '+y+' '+(x+w-r)+' '+y
  ];
  for(const path of d)page.drawSvgPath(path,{borderColor:stroke,borderWidth:1.2});
 }
}
function drawCentered(page,text,font,size,cx,y,color=C.charcoal){
 const w=font.widthOfTextAtSize(text,size);page.drawText(text,{x:cx-w/2,y,size,font,color});
}
function wrap(text,font,size,maxWidth){
 let line='',lines=[];
 for(const word of text.split(/\s+/)){
  const candidate=line?line+' '+word:word;
  if(line&&font.widthOfTextAtSize(candidate,size)>maxWidth){lines.push(line);line=word}else line=candidate;
 }
 if(line)lines.push(line);
 return lines;
}
function box(page,x,y,n=13){
 page.drawRectangle({x,y,width:n,height:n,color:C.white,borderColor:C.charcoal,borderWidth:0.85});
}
async function main(){
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 pdf.setTitle('Chores for 8-9-Year-Olds | Responsibility Cards Companion');
 pdf.setAuthor('Organized Mom Collective');
 const fontBase='node_modules/@fontsource/montserrat/files/';
 // Keep full font: fontkit WOFF2 subsetting previously failed in Cloudflare.
 const regular=await pdf.embedFont(await readFile(fontBase+'montserrat-latin-400-normal.woff2'),{subset:false});
 const semibold=await pdf.embedFont(await readFile(fontBase+'montserrat-latin-600-normal.woff2'),{subset:false});
 const serif=await pdf.embedFont(StandardFonts.TimesRomanBold);
 let handwritten=semibold;
 try{
  handwritten=await pdf.embedFont(await readFile('node_modules/@fontsource/kalam/files/kalam-latin-400-normal.woff2'),{subset:false});
 }catch{ // Montserrat fallback preserves build if optional handwriting font is missing.
 }
 const source=await readFile(SOURCE);
 const meta=await sharp(source).metadata();
 if(meta.width!==1275||meta.height!==1875)throw new Error('Reference card image dimensions changed; review illustration crops before building.');
 const p=pdf.addPage(LETTER);p.drawRectangle({x:0,y:0,width:612,height:792,color:C.ivory});

 // Clean reference-card-like header.
 drawCentered(p,'CHORES FOR 8-9-YEAR-OLDS',serif,25,306,747);
 drawCentered(p,'Pick a few jobs. Practice them together. Start owning the work.',regular,9.3,306,722);
 pill(p,42,688,528,17,8.5,C.leaf);
 drawCentered(p,'CHOOSE WHAT YOU WANT TO PRACTICE',semibold,9.5,306,691.8);

 // Three columns by three rows. Cards echo the printed deck with peach outlines,
 // deliberately roomy illustration crops and handwritten labels.
 const left=42,cellW=168,gap=12,cellH=140;
 const tops=[676,524,372];
 const embedded=[];
 for(const item of jobs){
  const bytes=await sharp(source).extract({left:item.x,top:item.y,width:item.w,height:item.h})
   .resize(320,305,{fit:'contain',background:{r:251,g:247,b:241,alpha:1}})
   .png().toBuffer();
  embedded.push(await pdf.embedPng(bytes));
 }
 jobs.forEach((job,i)=>{
  const col=i%3,row=Math.floor(i/3),x=left+col*(cellW+gap),y=tops[row]-cellH;
  pill(p,x,y,cellW,cellH,13,C.ivory,C.peach);
  const im=embedded[i];
  const maxW=114,maxH=94;const scale=Math.min(maxW/im.width,maxH/im.height);
  const iw=im.width*scale,ih=im.height*scale;
  p.drawImage(im,{x:x+(cellW-iw)/2,y:y+35+(maxH-ih)/2,width:iw,height:ih});
  const rows=wrap(job.title,handwritten,11.1,cellW-20);
  if(rows.length>2)throw new Error('Job label would overflow tile: '+job.title);
  rows.forEach((line,j)=>drawCentered(p,line,handwritten,11.1,x+cellW/2,y+24-j*12.5));
 });

 // Usable weekly ownership commitment. Two jobs, seven days each.
 pill(p,42,53,528,153,14,C.white,C.leaf);
 pill(p,201,182,210,25,10,C.leaf);
 drawCentered(p,"THIS WEEK I'M PRACTICING",semibold,10.5,306,190);
 const days=['M','T','W','T','F','S','S'];
 days.forEach((d,i)=>drawCentered(p,d,semibold,8.5,405+i*22,156));
 [132,95].forEach((y,j)=>{
  p.drawText(String(j+1)+'.',{x:62,y:y+2,size:10,font:semibold,color:C.charcoal});
  p.drawLine({start:{x:84,y:y+1},end:{x:377,y:y+1},thickness:.8,color:C.charcoal});
  days.forEach((d,i)=>box(p,399+i*22,y-1,12));
 });
 drawCentered(p,'Start with two. Show what done means. Review together next week.',regular,8,306,66);
 drawCentered(p,'ORGANIZED MOM COLLECTIVE',semibold,8.5,306,29,C.charcoal);
 await mkdir('public/downloads',{recursive:true});
 const out=await pdf.save();
 if(pdf.getPageCount()!==1)throw new Error('Expected one page');
 await writeFile(OUTPUT,out);
 console.log('Generated Responsibility Cards companion: '+OUTPUT+' ('+out.length+' bytes, one page)');
}
await main();
