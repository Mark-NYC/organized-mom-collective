/** Shared print primitives for OMC practical guide PDFs. US Letter, white paper, modest ink use.
 * Pages are laid out in points; every guide can reuse this without inheriting another brand's styling.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const PAGE = { width:612, height:792, left:42, right:570 };
export const color = code => {const h=code.replace('#','');return rgb(parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255);};
export const palette={ink:color('545454'),ivory:color('FBF7F1'),blue:color('CDDDE1'),green:color('D4DFC4'),apricot:color('F1D8A8'),blush:color('E8D2D6'),rule:color('D8D1CB'),muted:color('6F6A65'),white:rgb(1,1,1)};
const clean=s=>String(s).replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/[\u2022]/g,'-').replace(/[^\x20-\x7e]/g,'');
export async function makeGuide(title, { runningTitle='FAMILY BATHROOM RESET' }={}) {
 const pdf=await PDFDocument.create();pdf.setTitle(title);pdf.setAuthor('Organized Mom Collective');pdf.setSubject('Family-friendly household reference printable');
 const fonts={regular:await pdf.embedFont(StandardFonts.Helvetica),bold:await pdf.embedFont(StandardFonts.HelveticaBold),serif:await pdf.embedFont(StandardFonts.TimesRoman),serifBold:await pdf.embedFont(StandardFonts.TimesRomanBold)};
 const cache=new Map();
 async function art(path){if(!cache.has(path)){const bytes=await readFile(resolve(path));cache.set(path,await (path.endsWith('.jpg')?pdf.embedJpg(bytes):pdf.embedPng(bytes)));}return cache.get(path);}
 function text(p,value,x,y,size=10,font='regular',fill=palette.ink){p.drawText(clean(value),{x,y,size,font:fonts[font],color:fill});}
 function wrap(value,font='regular',size=10,max=300){let lines=[],line='';for(const word of clean(value).split(/\s+/)){const test=line?line+' '+word:word;if(fonts[font].widthOfTextAtSize(test,size)>max&&line){lines.push(line);line=word;}else line=test;}if(line)lines.push(line);return lines;}
 function paragraph(p,value,x,y,max=430,{size=10,leading=size*1.45,font='regular',fill=palette.ink}={}){let lines=wrap(value,font,size,max);for(let i=0;i<lines.length;i++)text(p,lines[i],x,y-i*leading,size,font,fill);return y-lines.length*leading;}
 function rect(p,x,y,w,h,fill,border){p.drawRectangle({x,y,width:w,height:h,color:fill,borderColor:border,borderWidth:border?0.65:0});}
 function rule(p,x,y,w=528){rect(p,x,y,w,0.8,palette.rule);}
 async function icon(p,path,x,y,w=45){if(!path)return;const im=await art(path),scale=Math.min(w/im.width,w/im.height),iw=im.width*scale,ih=im.height*scale;p.drawImage(im,{x:x+(w-iw)/2,y:y+(w-ih)/2,width:iw,height:ih});}
 function heading(p,kicker,title,intro,accent,index){rect(p,0,0,612,792,palette.white);text(p,'ORGANIZED MOM COLLECTIVE',42,758,8.3,'bold');text(p,runningTitle.toUpperCase()+'  /  '+index+' OF 4',407,758,7.8,'regular',palette.muted);rect(p,42,745,528,6,accent);text(p,kicker.toUpperCase(),42,722,8.5,'bold');text(p,title,42,684,27,'serifBold');paragraph(p,intro,42,662,528,{size:10.3,leading:15});rule(p,42,47);text(p,'SMALL HABITS. SHARED RESPONSIBILITY.',42,31,7.8,'bold');text(p,'organizedmomcollective.com',421,31,7.8,'regular',palette.muted);}
 function newPage(kicker,title,intro,accent,index){const p=pdf.addPage([612,792]);heading(p,kicker,title,intro,accent,index);return p;}
 return {pdf,fonts,palette,text,wrap,paragraph,rect,rule,icon,newPage};
}
