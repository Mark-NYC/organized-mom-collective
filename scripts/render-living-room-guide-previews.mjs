/** Four illustrated WebP previews using the same canonical content as the Living Room Reset PDF. */
import sharp from 'sharp';
import {readFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {habits,weekly,roles,issues} from './lib/living-room-guide-content.mjs';
const folder=resolve('public/assets/icons/ofc/guides/living-room'),out=resolve('public/images/guides');
const ink='#545454',rule='#D8D1CB',ivory='#FBF7F1',accents=['#CDDDE1','#D4DFC4','#F1D8A8','#E8D2D6'];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const rect=(x,y,w,h,fill)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+fill+'"/>';
const text=(x,y,s,size=10,bold=false,serif=false)=>'<text x="'+x+'" y="'+y+'" fill="'+ink+'" font-family="'+(serif?'Georgia,serif':'Arial,sans-serif')+'" font-size="'+size+'" font-weight="'+(bold?700:400)+'">'+esc(s)+'</text>';
function lines(x,y,value,max=60,size=9,leading=13){const words=value.split(' '),rows=[''];for(const word of words){const i=rows.length-1,next=rows[i]?rows[i]+' '+word:word;if(next.length>max&&rows[i])rows.push(word);else rows[i]=next;}return rows.map((s,i)=>text(x,y+i*leading,s,size)).join('');}
const cache={};async function icon(name,x,y,size=45){if(!cache[name])cache[name]='data:image/png;base64,'+(await readFile(join(folder,name+'.png'))).toString('base64');return '<image x="'+x+'" y="'+y+'" width="'+size+'" height="'+size+'" href="'+cache[name]+'"/>';}
function base(i,kicker,title,intro){return rect(0,0,612,792,'#fff')+text(42,31,'ORGANIZED MOM COLLECTIVE',8.5,true)+text(401,31,'LIVING ROOM RESET / '+i+' OF 4',7.4)+rect(42,42,528,6,accents[i-1])+text(42,72,kicker,9,true)+text(42,108,title,25,true,true)+lines(42,133,intro,86,10,14)+rect(42,756,528,1,rule)+text(42,775,'SMALL HABITS. SHARED RESPONSIBILITY.',7.6,true)+text(425,775,'organizedmomcollective.com',7.4);}
async function page1(){let s=base(1,'01 / DAILY RESET','Our Five-Minute Living Room Reset','Five small steps everyone can learn together.');s+=rect(42,162,528,53,ivory)+text(55,182,'WHAT FINISHED LOOKS LIKE',9,true)+lines(55,200,'Toys, books, blankets and dishes are away. Shared paths are clear.',85,9.2);
 for(let i=0;i<habits.length;i++){const [a,title,what,done]=habits[i],y=237+i*84;s+=await icon(a,52,y,44)+text(104,y+18,String(i+1).padStart(2,'0'),15,false,true)+text(141,y+15,title,11.5,true)+lines(141,y+34,what,68,9.1)+text(141,y+61,'DONE: '+done,8.2)+rect(48,y+69,515,1,rule);}
 s+=rect(42,682,528,63,accents[0])+text(55,704,'FIRST WEEK',9,true)+lines(55,724,'Start with toys, dishes and a clear path. Add other steps as they stick.',92,9);return s;}
async function page2(){let s=base(2,'02 / WEEKLY CARE','Our Weekly Shared-Space Jobs','Six small jobs prevent clutter from becoming a huge cleanup.');
 for(let i=0;i<weekly.length;i++){const [a,title,detail]=weekly[i],x=42+(i%2)*269,y=166+Math.floor(i/2)*151;s+=rect(x,y,259,139,ivory)+rect(x,y,259,6,accents[1])+await icon(a,x+12,y+27,43)+lines(x+64,y+31,title,27,10.1,12)+lines(x+12,y+81,detail,47,9,12);}
 s+=rect(42,637,528,108,accents[1])+text(55,658,'OUR RESET TIMES',10,true)+text(55,686,'Five-minute daily reset: _______________________________',10)+text(55,713,'Weekly care day: ______________________________________',10);return s;}
async function page3(){let s=base(3,'03 / FAMILY HANDOFF','Our Family Living Room Team','Choose one job each person can own. Practice before handing over.');
 for(let i=0;i<roles.length;i++){const [a,age,desc]=roles[i],x=42+(i%2)*269,y=163+Math.floor(i/2)*118;s+=rect(x,y,259,104,ivory)+rect(x,y,259,6,accents[2])+await icon(a,x+12,y+35,42)+text(x+64,y+30,age,9,true)+lines(x+64,y+53,desc,33,8.6,11.5);}
 s+=text(42,438,'ASSIGN THE FIVE RESET JOBS',10.7,true)+lines(42,460,'Choose an owner, a time and an agreed finish line.',93,9.2)+rect(42,484,528,25,accents[2])+text(55,501,'JOB',9,true)+text(275,501,'OWNER',9,true)+text(461,501,'WHEN',9,true);
 for(let i=0;i<habits.length;i++){const y=514+i*38;s+=text(55,y+22,habits[i][1],9.1)+rect(42,y+34,528,1,rule)+rect(265,y,1,36,rule)+rect(450,y,1,36,rule);}s+=rect(42,714,528,32,accents[2])+text(55,735,'SHOW  /  PRACTICE  /  HAND OVER',9.3,true);return s;}
async function page4(){let s=base(4,'04 / TROUBLESHOOTING','When the Mess Comes Back','Fix a repeating problem with one small change to the system.');
 for(let i=0;i<issues.length;i++){const [a,title,fix]=issues[i],y=169+i*70;s+=await icon(a,52,y+2,42)+text(107,y+16,title,10.7,true)+lines(107,y+37,fix,77,9.2)+rect(48,y+58,516,1,rule);}
 s+=rect(42,619,528,124,ivory)+text(55,641,'SHARED-SPACE SAFETY',10,true)+lines(55,668,'Keep walkways and exits clear. Anchor heavy shelves. Adults handle cords, cleaning products and electronics safely.',97,9.4,14);return s;}
await mkdir(out,{recursive:true});
for(const [i,fn] of [page1,page2,page3,page4].entries()){const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1424" viewBox="0 0 612 792">'+await fn()+'</svg>';const path=join(out,'living-room-guide-page-'+(i+1)+'.webp');await sharp(Buffer.from(svg)).webp({quality:92}).toFile(path);const m=await sharp(path).metadata();if(m.width!==1100||m.height!==1424)throw Error('Invalid preview size');console.log('Rendered living room preview '+(i+1));}
