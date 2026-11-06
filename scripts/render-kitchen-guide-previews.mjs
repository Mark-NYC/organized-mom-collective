/** Portable kitchen guide WebP page previews.
 * Draws the same canonical copy as the print PDF with our OMC page styling,
 * using Sharp's SVG rasterizer. No Poppler/system packages required.
 * This is a visual page preview, not a rasterization of the PDF.
 */
import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { daily, jobs, ages, fixes } from './lib/kitchen-guide-content.mjs';
const root=process.cwd(),iconsDir=resolve(root,'public/assets/icons/ofc/guides/kitchen');
const outDir=resolve(root,'public/images/guides');
const W=612,H=792;
const colors={ink:'#545454',muted:'#6f6a65',ivory:'#FBF7F1',blue:'#CDDDE1',green:'#D4DFC4',apricot:'#F1D8A8',blush:'#E8D2D6',line:'#D8D1CB'};
const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const el=(tag,attrs,body='')=>'<'+tag+' '+Object.entries(attrs).map(([key,value])=>key+'="'+escape(value)+'"').join(' ')+'>'+body+'</'+tag+'>';
const rect=(x,y,w,h,fill)=>el('rect',{x,y,width:w,height:h,fill});
const rule=(x,y,w=528)=>rect(x,y,w,0.8,colors.line);
const text=(x,y,str,{size=10,bold=false,serif=false,fill=colors.ink}={})=>el('text',{x,y,fill,'font-family':serif?'Georgia, Times New Roman, serif':'Arial, Helvetica, sans-serif','font-size':size,'font-weight':bold?'700':'400'},escape(str));
const wrap=(value,max)=>{const words=String(value).split(/\s+/),out=[];let line='';for(const word of words){const test=line?line+' '+word:word;if(test.length>max&&line){out.push(line);line=word}else line=test}if(line)out.push(line);return out;};
const lines=(x,y,value,max=68,opts={})=>wrap(value,max).map((str,i)=>text(x,y+i*(opts.leading||13),str,opts)).join('');
const iconCache=new Map();
async function icon(name,x,y,size=44){
 if(!iconCache.has(name)){
  const file=await readFile(join(iconsDir,name+'.png'));
  iconCache.set(name,'data:image/png;base64,'+file.toString('base64'));
 }
 return el('image',{x,y,width:size,height:size,href:iconCache.get(name),preserveAspectRatio:'xMidYMid meet'});
}
function basePage(kicker,title,desc,accent,index){
 return rect(0,0,W,H,'#ffffff')+
  text(42,31,'ORGANIZED MOM COLLECTIVE',{size:8.5,bold:true})+
  text(408,31,'FAMILY KITCHEN RESET / '+index+' OF 4',{size:7.8,fill:colors.muted})+
  rect(42,42,528,6,accent)+
  text(42,72,kicker.toUpperCase(),{size:9,bold:true})+
  text(42,108,title,{size:27,bold:true,serif:true})+
  lines(42,133,desc,86,{size:10.2,leading:14})+
  rule(42,756)+
  text(42,775,'SMALL HABITS. SHARED RESPONSIBILITY.',{size:7.7,bold:true})+
  text(429,775,'organizedmomcollective.com',{size:7.5,fill:colors.muted});
}
function svg(inner){return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1100" height="1424" viewBox="0 0 ${W} ${H}">${inner}</svg>`;}
async function pageOne(){
 let s=basePage('01 / After every meal','A Kitchen Ready for the Next Meal','Five small habits after eating prevent the mess from becoming someone else\'s job.',colors.blue,1);
 s+=rect(42,164,528,52,colors.ivory)+text(55,181,'WHAT FINISHED LOOKS LIKE',{size:9,bold:true})+
   lines(55,197,'Dishes are moved, food is safely stored, crumbs are wiped and everything has a place.',91,{size:9.4,leading:12});
 for(let i=0;i<daily.length;i++){
  const y=230+i*73;
  s+=await icon(daily[i][0],52,y+3,48)+text(111,y+19,String(i+1).padStart(2,'0'),{size:16,serif:true})+
   text(145,y+14,daily[i][1],{size:11.6,bold:true})+
   lines(145,y+31,daily[i][2],66,{size:9.3,leading:12})+rule(48,y+60,515);
 }
 s+=rect(42,673,528,70,colors.blue)+text(55,695,'START SMALL',{size:9,bold:true})+
 lines(55,713,'On busy nights: food stored safely, dishes to the sink and the table cleared. Adults handle heat, knives and food safety.',96,{size:9,leading:12});
 return s;
}
async function pageTwo(){
 let s=basePage('02 / The shared reset','Five Jobs. Ten Minutes Together.','Give each job an owner, teach the steps, and check the finish line.',colors.green,2);
 for(let i=0;i<jobs.length;i++){
  const col=i%2,row=Math.floor(i/2),x=42+col*269,y=165+row*170;
  if(i===4){
   s+=rect(42,y,528,158,colors.ivory)+rect(42,y,528,5,colors.green)+await icon(jobs[i][0],55,y+35,56)+text(126,y+30,'05',{size:9,bold:true})+text(157,y+30,jobs[i][1],{size:14,serif:true,bold:true})+
   text(157,y+53,'SUPPLIES: '+jobs[i][2],{size:9})+lines(157,y+77,jobs[i][3],75,{size:9.2,leading:12})+
   rule(157,y+123,398)+text(157,y+141,'DONE: '+jobs[i][4],{size:9,bold:true});
  }else{
   s+=rect(x,y,259,157,colors.ivory)+rect(x,y,259,5,colors.green)+await icon(jobs[i][0],x+10,y+23,43)+
   text(x+59,y+27,String(i+1).padStart(2,'0'),{size:9,bold:true})+
   text(x+78,y+27,jobs[i][1],{size:11.5,bold:true,serif:true})+
   lines(x+12,y+80,'SUPPLIES: '+jobs[i][2],47,{size:8.7,leading:11})+
   lines(x+12,y+102,jobs[i][3],47,{size:8.6,leading:11})+
   rule(x+12,y+137,235)+lines(x+12,y+151,'DONE: '+jobs[i][4],49,{size:8,leading:9});
  }
 }
 s+=rect(42,699,528,42,colors.green)+text(55,716,'SAFETY:',{size:9,bold:true})+
  lines(104,716,'Adults manage knives, hot cookware, cleaning products and food safety.',75,{size:8.8,leading:11});
 return s;
}
async function pageThree(){
 let s=basePage('03 / Sharing the work','Our Family Kitchen Team','Match each job to ability and practice. Choose one small daily habit first.',colors.apricot,3);
 for(let i=0;i<ages.length;i++){
  const x=42+(i%2)*269,y=167+Math.floor(i/2)*124;
  s+=rect(x,y,259,113,colors.ivory)+rect(x,y,259,6,colors.apricot)+await icon(ages[i][0],x+12,y+44,46)+
   text(x+70,y+30,ages[i][1],{size:8.5,bold:true})+text(x+70,y+50,ages[i][2],{size:11,serif:true,bold:true})+
   lines(x+12,y+77,ages[i][3],52,{size:8.8,leading:12});
 }
 s+=text(42,434,'THE FIVE RESET JOBS',{size:10,bold:true})+
 lines(42,455,'Write a name and when each job gets done. Practice together before handing it over.',95,{size:9.2,leading:12})+
 rect(42,480,528,24,colors.apricot)+text(54,497,'JOB',{size:9,bold:true})+text(288,497,'OWNER',{size:9,bold:true})+text(473,497,'WHEN',{size:9,bold:true});
 for(let i=0;i<jobs.length;i++){
  const y=508+i*39;
  s+=await icon(jobs[i][0],52,y+2,28)+text(88,y+22,jobs[i][1],{size:9.5})+rule(42,y+36)+
   rect(279,y,0.7,37,colors.line)+rect(464,y,0.7,37,colors.line);
 }
 s+=rect(42,716,528,29,colors.apricot)+text(54,735,'SHOW  /  PRACTICE  /  HAND OVER',{size:9.3,bold:true});
 return s;
}
async function pageFour(){
 let s=basePage('04 / When it gets messy','Fix the Setup, Not the People','Keep it simple: make jobs easy to find, easy to learn and easy to finish.',colors.blush,4);
 for(let i=0;i<fixes.length;i++){
  const y=169+i*65;
  s+=await icon(fixes[i][0],52,y+5,42)+text(102,y+15,fixes[i][1],{size:10.9,bold:true})+
   lines(102,y+35,fixes[i][2],86,{size:9.1,leading:12})+rule(48,y+55,516);
 }
 s+=rect(42,569,528,74,colors.ivory)+text(54,589,'ONCE-A-WEEK KITCHEN CHECK',{size:9,bold:true})+
 lines(54,607,'Check fridge leftovers; wipe appliance fronts and handles; wash dishcloths; clean sink and floor edges. Adults handle food safety.',98,{size:9.2,leading:12});
 s+=rect(42,654,528,90,colors.blush)+text(54,674,'ADULT SAFETY NOTE',{size:9,bold:true})+
 lines(54,693,'Wash hands, separate raw from ready-to-eat food, refrigerate perishables promptly, and keep knives, hot cookware and chemicals controlled.',98,{size:9,leading:12});
 return s;
}
await mkdir(outDir,{recursive:true});
const renderers=[pageOne,pageTwo,pageThree,pageFour];
for(let i=0;i<renderers.length;i++){
 const body=await renderers[i]();
 const file=resolve(outDir,'kitchen-guide-page-'+(i+1)+'.webp');
 await sharp(Buffer.from(svg(body))).webp({quality:91,effort:5}).toFile(file);
 const meta=await sharp(file).metadata();
 if(meta.width!==1100||meta.height!==1424)throw new Error('Unexpected preview dimensions for page '+(i+1));
 console.log('Prepared kitchen guide visual page preview '+(i+1)+': '+meta.width+'x'+meta.height);
}
