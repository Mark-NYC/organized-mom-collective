/** Four matching illustrated page previews for the downloadable laundry PDF.
 * WebP previews follow the guide's print layout, colors and canonical content.
 * Build-time only, no runtime dependency or third-party service.
 */
import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const folder=resolve('public/assets/icons/ofc/guides/laundry');
const out=resolve('public/images/guides');
const ink='#545454',muted='#6f6a65',line='#D8D1CB',ivory='#FBF7F1';
const accents=['#CDDDE1','#D4DFC4','#F1D8A8','#E8D2D6'];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const rect=(x,y,w,h,fill)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
const text=(x,y,value,size=10,bold=false,serif=false)=>`<text x="${x}" y="${y}" fill="${ink}" font-family="${serif?'Georgia,serif':'Arial,sans-serif'}" font-size="${size}" font-weight="${bold?700:400}">${esc(value)}</text>`;
function lines(x,y,value,max=55,size=9,leading=13) {
 const words=value.split(' ');let rows=[''];
 for(const word of words){const last=rows.length-1;const next=rows[last]?rows[last]+' '+word:word;if(next.length>max){rows.push(word)}else{rows[last]=next;}}
 return rows.map((v,i)=>text(x,y+i*leading,v,size)).join('');
}
const cache={};
async function icon(name,x,y,size=44){if(!cache[name])cache[name]='data:image/png;base64,'+(await readFile(join(folder,name+'.png'))).toString('base64');return `<image x="${x}" y="${y}" width="${size}" height="${size}" href="${cache[name]}"/>`;}
function base(index,kicker,title,sub) {
 return rect(0,0,612,792,'#fff')+text(42,31,'ORGANIZED MOM COLLECTIVE',8.5,true)+text(406,31,'FAMILY LAUNDRY SYSTEM / '+index+' OF 4',7.5)+rect(42,42,528,6,accents[index-1])+text(42,72,kicker,9,true)+text(42,108,title,26,true,true)+lines(42,133,sub,87,10,14)+rect(42,756,528,1,line)+text(42,775,'SMALL HABITS. SHARED RESPONSIBILITY.',7.6,true)+text(429,775,'organizedmomcollective.com',7.5);
}
const steps=[
 ['hamper','Collect','Put worn clothes into a reachable hamper.','No loose clothes on the floor.'],
 ['sort','Sort + prepare','Check pockets, care labels and delicate items.','The load is ready for washing.'],
 ['washer','Wash + move','Set a reminder to move laundry when done.','Nothing forgotten wet in the washer.'],
 ['fold','Fold + sort','Make one folded pile or basket per person.','Clean clothes have a clear owner.'],
 ['drawer','Put away','Everyone returns their own clothes home.','No permanent clean laundry piles.']
];
const rhythms=[
 ['hamper','DAILY - TWO MINUTES','Clothes in hampers; hang towels and rewearable pieces.'],
 ['clock','TWO REGULAR LOAD WINDOWS','Choose times long enough to start and finish a load.'],
 ['towel','TOWELS + SHEETS','Add a separate window when your household needs it.'],
 ['drawer','AFTER EVERY LOAD','Move, sort and put everything away.']
];
const roles=[
 ['hamper','AGES 3-5','Use hamper, match socks, put away simple clothes with help.'],
 ['towel','AGES 6-8','Collect, fold small items and put clothes away.'],
 ['fold','AGES 9-12','Practice sorting, folding and a safe sequence.'],
 ['washer','TEENS + ADULTS','Own complete loads, labels, settings and timing.']
];
const issues=[
 ['drawer','Clean clothes stay in piles','Use one labeled basket per person and a put-away time.'],
 ['clock','Wet clothes stay in the washer','The washer starter sets a timer to transfer the load.'],
 ['hands','One person does everything','Write down an owner for each stage.'],
 ['sort','Sorting feels overwhelming','Keep sorting simple; adults check care labels.'],
 ['washer','Laundry starts but never ends','Reserve time to finish, not just start.'],
 ['shelf','Kids cannot find where clothes go','Clear crowded drawers; label bins and practice.']
];
async function page1(){
 let s=base(1,'01 / A FINISHED LOAD','From Hamper to Drawer','Five steps that make laundry a shared responsibility.');
 s+=rect(42,160,528,52,ivory)+text(55,181,'WHAT FINISHED LOOKS LIKE',9,true)+lines(55,199,'Clothes are clean, dry, sorted and put away.',85,9.5);
 for(let i=0;i<steps.length;i++){const y=235+i*85,r=steps[i];s+=await icon(r[0],53,y,48)+text(105,y+16,String(i+1).padStart(2,'0'),16,false,true)+text(142,y+13,r[1],12,true)+lines(142,y+33,r[2],66,9)+text(142,y+59,'DONE: '+r[3],8.5)+rect(48,y+69,514,1,line);}
 s+=rect(42,688,528,55,accents[0])+text(55,708,'ONE RULE',9,true)+lines(55,727,'The load is not finished until all clothes are put away.',93,9);
 return s;
}
async function page2(){
 let s=base(2,'02 / A WEEKLY RHYTHM','Keep It Moving Each Week','Pick a rhythm your family can actually repeat.');
 for(let i=0;i<rhythms.length;i++){const y=170+i*107,r=rhythms[i];s+=rect(42,y,528,90,ivory)+rect(42,y,528,5,accents[1])+await icon(r[0],55,y+23,42)+text(105,y+37,r[1],10,true)+lines(105,y+60,r[2],72,9.6);}
 s+=rect(42,636,528,105,accents[1])+text(55,659,'OUR LAUNDRY WINDOWS',10,true)+text(55,688,'Clothes day: ______________   Second window: ______________',10)+text(55,717,'Towels / sheets: __________   Transfer reminder: __________',10);
 return s;
}
async function page3(){
 let s=base(3,'03 / FAMILY RESPONSIBILITY','Our Family Laundry Team','Match each job to ability. Show it, practice it, hand it over.');
 for(let i=0;i<4;i++){const [art,age,desc]=roles[i],x=42+(i%2)*269,y=165+Math.floor(i/2)*118;s+=rect(x,y,259,105,ivory)+rect(x,y,259,6,accents[2])+await icon(art,x+12,y+35,43)+text(x+65,y+31,age,9,true)+lines(x+65,y+52,desc,33,8.5,11.5);}
 s+=text(42,436,'ASSIGN THE FIVE STEPS',11,true)+lines(42,457,'At the family meeting, name the owner and when each part happens.',92,9.2)+rect(42,487,528,24,accents[2])+text(55,503,'JOB',9,true)+text(277,503,'OWNER',9,true)+text(461,503,'WHEN',9,true);
 for(let i=0;i<steps.length;i++){const y=517+i*37;s+=text(55,y+22,steps[i][1],9.3)+rect(42,y+34,528,1,line)+rect(267,y,1,35,line)+rect(452,y,1,35,line);}
 s+=rect(42,710,528,35,accents[2])+text(55,733,'SHOW  /  PRACTICE  /  HAND OVER',9,true);return s;
}
async function page4(){
 let s=base(4,'04 / TROUBLESHOOTING','Fix the Handoff','When the same problem returns, fix the next step.');
 for(let i=0;i<issues.length;i++){const [art,title,desc]=issues[i],y=166+i*70;s+=await icon(art,52,y+3,42)+text(107,y+17,title,11,true)+lines(107,y+38,desc,75,9.3)+rect(48,y+59,516,1,line);}
 s+=rect(42,616,528,128,ivory)+text(55,637,'LAUNDRY SAFETY',10,true)+lines(55,661,'Adults control detergent, pods, bleach, stain removers and appliance safety. Secure products, follow labels, and keep children out of machines.',100,9.4,14);return s;
}
await mkdir(out,{recursive:true});
for(const [i,make] of [page1,page2,page3,page4].entries()){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1424" viewBox="0 0 612 792">${await make()}</svg>`;
 const path=join(out,`laundry-guide-page-${i+1}.webp`);
 await sharp(Buffer.from(svg)).webp({quality:92}).toFile(path);
 const m=await sharp(path).metadata();if(m.width!==1100||m.height!==1424)throw new Error('Invalid preview size');
 console.log('Rendered laundry page preview '+(i+1));
}
