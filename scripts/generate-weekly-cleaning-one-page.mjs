/** One-page Letter checklist, using exactly the app's cleaning data and PNG icons. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const src=await readFile(join(root,'src/data/cleaning.ts'),'utf8');
const compiled=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {dailyEssentials,weeklySchedule,weekend}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
if(weeklySchedule.length!==4||dailyEssentials.tasks.length!==5||weekend.days.length!==3)throw Error('Cleaning content changed: review one-page layout');
const doc=await PDFDocument.create();doc.setTitle('Our Weekly Cleaning Reset | One Page');doc.setAuthor('Organized Mom Collective');
const page=doc.addPage([612,792]),regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold),serif=await doc.embedFont(StandardFonts.TimesRomanBold);
const color=(h)=>rgb(...[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255));
const ink=color('545454'),muted=color('6E6863'),rule=color('D5C5B8'),pale=color('FBF7F1'),blue=color('CDDDE1'),white=rgb(1,1,1);
const clean=s=>String(s).replace(/[\u2013\u2014]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"');
function txt(str,x,y,size=9,font=regular,col=ink){page.drawText(clean(str),{x,y,size,font,color:col})}
function fit(s,x,y,max,size=9,font=regular,min=7.3){while(font.widthOfTextAtSize(clean(s),size)>max&&size>min)size-=.15;txt(s,x,y,size,font)}
function rect(x,y,w,h,fill=white,border=rule){page.drawRectangle({x,y,width:w,height:h,color:fill,borderColor:border,borderWidth:.7})}
function check(x,y,size=9){page.drawRectangle({x,y,width:size,height:size,borderColor:ink,borderWidth:.75})}
const imageCache=new Map();
async function icon(path,x,y,size){if(!imageCache.has(path))imageCache.set(path,await doc.embedPng(await readFile(join(root,'public',path.slice(1)))));const img=imageCache.get(path);let scale=Math.min(size/img.width,size/img.height);page.drawImage(img,{x:x+(size-img.width*scale)/2,y:y+(size-img.height*scale)/2,width:img.width*scale,height:img.height*scale})}
page.drawRectangle({x:0,y:0,width:612,height:792,color:white});
page.drawRectangle({x:0,y:772,width:612,height:20,color:pale});
txt('ORGANIZED MOM COLLECTIVE  /  FREE FAMILY PRINTABLE',30,759,8,bold,muted);
txt('Our Weekly Cleaning Reset',30,727,24,serif);
txt('15-minute Daily Reset + one small zone Monday through Thursday + a flexible weekend',30,711,8.5);
rect(30,598,552,100,white);
rect(30,656,552,42,blue);
await icon(dailyEssentials.icon,40,660,32);txt('DAILY RESET',80,674,14,serif);txt('15 MINUTES · EVERY DAY',80,662,8,bold);
dailyEssentials.tasks.forEach((t,i)=>{const col=i<3?0:1;const idx=i<3?i:i-3;const x=43+col*267,y=638-idx*17;check(x,y-2);fit(t.label,x+16,y,244,9)});
txt('MON',386,672,7,bold); // daily tracking boxes
['M','T','W','T','F','S','S'].forEach((d,i)=>{let x=386+i*26;txt(d,x,670,7,bold);check(x-1,657,9)});
function rowBox(x,top,w,h){rect(x,top-h,w,h)}
async function zone(d,x,top,w,h){rowBox(x,top,w,h);rect(x,top-43,w,43,pale);await icon(d.icon,x+8,top-37,30);txt(d.dayLabel.toUpperCase(),x+45,top-16,7,bold,muted);fit(d.zone,x+45,top-32,w-56,13,serif,10);let y=top-58;const gap=d.tasks.length>7?18.5:20;d.tasks.forEach(t=>{check(x+11,y-1,8.5);fit(t.label,x+25,y,w-38,8.6,regular,7.4);y-=gap});txt('OWNER:',x+11,top-h+15,7.5,bold,muted);page.drawLine({start:{x:x+55,y:top-h+15},end:{x:x+w-12,y:top-h+15},thickness:.5,color:ink})}
const gap=10,w=271;
await zone(weeklySchedule[0],30,585,w,205);
await zone(weeklySchedule[1],311,585,w,205);
await zone(weeklySchedule[2],30,369,w,218);
await zone(weeklySchedule[3],311,369,w,218);
rect(30,55,552,88,white);rect(30,123,552,20,blue);txt('FRIDAY - SUNDAY  /  FLEXIBLE',40,130,8.5,bold);
const descriptions=['Choose one deep-cleaning task','Work on one monthly home project','Catch up on one zone, reset, or rest'];
for(let i=0;i<3;i++){const x=40+i*181;await icon(weekend.icon,x,91,23);txt(weekend.days[i].dayLabel.toUpperCase(),x+30,106,7,bold);fit(weekend.days[i].zone,x+30,94,139,10,serif,8);fit(descriptions[i],x,71,166,7.4);check(x+157,105,9)}
txt('Skip missed zones rather than stacking them. Share responsibilities; see the app for monthly project tasks.',30,40,8,regular,muted);
txt('organizedmomcollective.com',30,23,7.5,bold,ink);
const dest=join(root,'public/downloads/weekly-cleaning-reset-one-page.pdf');await mkdir(dirname(dest),{recursive:true});await writeFile(dest,await doc.save());console.log('Generated '+dest);
