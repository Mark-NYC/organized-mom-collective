/**
 * Build the downloadable two-page cleaning zone PDF from the very same
 * src/data/cleaning.ts and public/icons/zones/*.png used by the companion app.
 * Run before Astro build so the public asset is copied to dist/downloads/.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = join(root, 'public/downloads/weekly-cleaning-zones.pdf');
const source = await readFile(join(root, 'src/data/cleaning.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { dailyEssentials, weeklySchedule, weekend } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
);
if (weeklySchedule.length !== 4 || dailyEssentials.tasks.length !== 5) {
  throw new Error('Cleaning schedule layout changed; revisit the two-page PDF layout before publishing.');
}
const doc = await PDFDocument.create();
doc.setTitle('Our Weekly Cleaning Reset | Organized Mom Collective');
doc.setAuthor('Organized Mom Collective');
doc.setSubject('Daily reset and weekly zone cleaning printable');
doc.setKeywords(['weekly cleaning schedule', 'daily reset', 'zone cleaning', 'printable']);
const normal = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const serif = await doc.embedFont(StandardFonts.TimesRoman);
const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
const W = 612, H = 792;
const ink = hex('545454'), muted = hex('6e6863'), rule = hex('d5c5b8');
const ivory = hex('fbf7f1'), sage = hex('d4dfc4'), blue = hex('cddde1'), white = rgb(1,1,1);
const iconCache = new Map();

function hex(code) {
  const s = code.replace('#', '');
  return rgb(parseInt(s.slice(0,2),16)/255,parseInt(s.slice(2,4),16)/255,parseInt(s.slice(4,6),16)/255);
}
const ascii = s => String(s).replace(/\u2013/g,'-').replace(/\u2014/g,'-').replace(/\u2019/g,"'").replace(/\u201c|\u201d/g,'"');
function label(page, value, x, y, size=10, font=normal, color=ink) {
  page.drawText(ascii(value), {x,y,size,font,color});
}
function measure(value, size=10, font=normal) {
  return font.widthOfTextAtSize(ascii(value),size);
}
function fitted(page,value,x,y,maxWidth,size=10,font=normal,color=ink,min=8.6) {
  let s=size;
  while (measure(value,s,font)>maxWidth && s>min) s-=0.2;
  label(page,value,x,y,s,font,color);
}
function line(page,x1,y1,x2,y2,color=rule,thickness=0.8) {
  page.drawLine({start:{x:x1,y:y1},end:{x:x2,y:y2},color,thickness});
}
function checkbox(page,x,y,size=11) {
  page.drawRectangle({x,y,width:size,height:size,borderColor:ink,borderWidth:0.85});
}
async function iconFor(icon) {
  if (!iconCache.has(icon)) {
    const file=join(root,'public',icon.replace(/^\//,''));
    iconCache.set(icon,await doc.embedPng(await readFile(file)));
  }
  return iconCache.get(icon);
}
async function icon(page, path, x, y, size=37) {
  const img=await iconFor(path);
  page.drawCircle({x:x+size/2,y:y+size/2,size:size/2,color:sage,opacity:0.58});
  const ratio=Math.min((size-5)/img.width,(size-5)/img.height);
  const width=img.width*ratio, height=img.height*ratio;
  page.drawImage(img,{x:x+(size-width)/2,y:y+(size-height)/2,width,height});
}
function pageFrame(page,number) {
  page.drawRectangle({x:0,y:0,width:W,height:H,color:white});
  page.drawRectangle({x:0,y:H-19,width:W,height:19,color:ivory});
  page.drawRectangle({x:0,y:0,width:W,height:17,color:sage});
  label(page,'ORGANIZED MOM COLLECTIVE',39,35,8.5,bold,ink);
  label(page,String(number)+' / 2',548,35,8.5,bold,muted);
}
function header(page,overline,title,subtitle) {
  label(page,overline.toUpperCase(),39,755,9,bold,muted);
  label(page,title,39,711,29,serifBold,ink);
  label(page,subtitle,39,688,10,normal,muted);
  line(page,39,675,573,675,ink,1.6);
}
async function checklist(page,{x,top,width,height,title,kicker,time,iconPath,tasks,owner=false,days=false,fill=ivory}) {
  const bottom=top-height;
  page.drawRectangle({x,y:bottom,width,height,borderColor:rule,borderWidth:0.9,color:white});
  page.drawRectangle({x,y:top-54,width,height:54,color:fill});
  await icon(page,iconPath,x+13,top-45,35);
  label(page,kicker.toUpperCase(),x+57,top-21,8.4,bold,muted);
  fitted(page,title,x+57,top-41,width-125,17,serifBold,ink,12);
  // Small boxed time marker, matching the week view's TimeMark.
  let timeWidth=measure(time.toUpperCase(),8,bold)+16;
  page.drawRectangle({x:x+width-timeWidth-11,y:top-33,width:timeWidth,height:21,borderColor:ink,borderWidth:0.8,color:white});
  label(page,time.toUpperCase(),x+width-timeWidth-3,top-26,8,bold);
  const rowStart=top-78;
  const rowGap=days?24:(tasks.length>7?29:31);
  tasks.forEach((t,i)=>{
    const y=rowStart-i*rowGap;
    checkbox(page,x+17,y-3,11);
    fitted(page,t.label,x+39,y-1,width-53,tasks.length>7?9.7:10.4,normal,ink,8.5);
    if(i<tasks.length-1) line(page,x+14,y-11,x+width-14,y-11,rule,0.45);
  });
  if(owner){
    line(page,x+16,bottom+28,x+width-17,bottom+28,rule,0.7);
    label(page,'ZONE OWNER:',x+17,bottom+14,8,bold,muted);
    line(page,x+98,bottom+14,x+width-17,bottom+14,ink,0.5);
  }
  if(days){
    const labels=['M','T','W','T','F','S','S'];
    label(page,'CHECK THE RESET EACH DAY:',x+16,bottom+47,8.2,bold,muted);
    labels.forEach((d,i)=>{
      const dx=x+225+i*41;
      label(page,d,dx+2,bottom+47,8.5,bold,muted);
      checkbox(page,dx,bottom+29,12);
    });
    label(page,'One owner per task. The same five tasks every day.',x+16,bottom+16,8.8,normal,muted);
  }
}
const time=s=>s.replace(/\s*minutes?/i,' min').toUpperCase();

const p1=doc.addPage([W,H]);
pageFrame(p1,1);
header(p1,'Your family cleaning plan','Our Weekly Cleaning Reset','A 15-minute Daily Reset + one small zone Monday through Thursday.');
await checklist(p1,{
  x:39,top:658,width:534,height:251,title:dailyEssentials.title,kicker:'Every day',time:time(dailyEssentials.minutes),
  iconPath:dailyEssentials.icon,tasks:dailyEssentials.tasks,days:true,fill:blue
});
const monday=weeklySchedule[0],tuesday=weeklySchedule[1];
await checklist(p1,{
  x:39,top:391,width:260,height:308,title:monday.zone,kicker:monday.dayLabel,time:time(monday.minutes),
  iconPath:monday.icon,tasks:monday.tasks,owner:true,fill:ivory
});
await checklist(p1,{
  x:313,top:391,width:260,height:308,title:tuesday.zone,kicker:tuesday.dayLabel,time:time(tuesday.minutes),
  iconPath:tuesday.icon,tasks:tuesday.tasks,owner:true,fill:ivory
});
label(p1,'Stop when the timer ends. A missed zone does not carry over.',39,66,9.2,normal,muted);

const p2=doc.addPage([W,H]);
pageFrame(p2,2);
header(p2,'Your family cleaning plan','The Rest of the Week','One zone a day. Friday through Sunday stay flexible.');
const wed=weeklySchedule[2],thu=weeklySchedule[3];
await checklist(p2,{
  x:39,top:658,width:260,height:355,title:wed.zone,kicker:wed.dayLabel,time:time(wed.minutes),
  iconPath:wed.icon,tasks:wed.tasks,owner:true,fill:ivory
});
await checklist(p2,{
  x:313,top:658,width:260,height:355,title:thu.zone,kicker:thu.dayLabel,time:time(thu.minutes),
  iconPath:thu.icon,tasks:thu.tasks,owner:true,fill:ivory
});
p2.drawRectangle({x:39,y:89,width:534,height:199,borderColor:rule,borderWidth:0.9,color:white});
p2.drawRectangle({x:39,y:248,width:534,height:40,color:blue,opacity:0.42});
label(p2,'FRIDAY THROUGH SUNDAY',53,263,9.5,bold,ink);
label(p2,'OPTIONAL',504,263,8.6,bold,ink);
for(let i=0;i<weekend.days.length;i++){
  const day=weekend.days[i],y=211-i*45;
  await icon(p2,weekend.icon,54,y-6,28);
  label(p2,day.dayLabel.toUpperCase(),94,y+7,8.8,bold,muted);
  fitted(p2,day.zone,173,y+4,350,12,serifBold,ink);
  if(i<2)line(p2,53,y-18,558,y-18,rule,0.6);
}
label(p2,'One monthly home project task, catch up on a zone, or skip it.',49,71,9.2,normal,muted);
label(p2,'The monthly project changes each month; see the cleaning companion.',49,58,8.4,normal,muted);

await mkdir(dirname(destination),{recursive:true});
await writeFile(destination,await doc.save());
console.log('Generated '+destination+' from cleaning.ts and original zone icons.');
