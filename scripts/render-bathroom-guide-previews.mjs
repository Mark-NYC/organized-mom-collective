/** Generate four Bathroom Reset preview images with the same processed art as the PDF.
 * Keeps preview illustrations consistent whenever the guide icon treatment changes.
 */
import sharp from 'sharp';
import {readFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const iconsDir=resolve('public/assets/icons/ofc/guides/bathroom');
const outDir=resolve('public/images/guides');
const ink='#545454',ivory='#FBF7F1',rule='#D8D1CB';
const colors=['#CDDDE1','#D4DFC4','#F1D8A8','#E8D2D6'];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const rect=(x,y,w,h,color)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`;
const txt=(x,y,value,size=10,bold=false,serif=false)=>`<text x="${x}" y="${y}" fill="${ink}" font-size="${size}" font-weight="${bold?700:400}" font-family="${serif?'Georgia,serif':'Arial,sans-serif'}">${esc(value)}</text>`;
const lines=(x,y,v,max=75,size=9,leading=12)=>{
 const rows=[''];for(const word of String(v).split(' ')){const i=rows.length-1,t=rows[i]?rows[i]+' '+word:word;if(t.length>max && rows[i])rows.push(word);else rows[i]=t;}
 return rows.map((r,i)=>txt(x,y+i*leading,r,size)).join('');
};
const cache={};
async function icon(name,x,y,size=44){
 if(!cache[name])cache[name]='data:image/png;base64,'+(await readFile(join(iconsDir,name+'.png'))).toString('base64');
 return `<image x="${x}" y="${y}" width="${size}" height="${size}" href="${cache[name]}"/>`;
}
function base(n,kicker,title,description){
 return rect(0,0,612,792,'white')+txt(42,31,'ORGANIZED MOM COLLECTIVE',8.5,true)+
 txt(408,31,'FAMILY BATHROOM RESET / '+n+' OF 4',7.4)+rect(42,42,528,6,colors[n-1])+
 txt(42,72,kicker,9,true)+txt(42,108,title,25,true,true)+lines(42,132,description,86,10,14)+
 rect(42,756,528,1,rule)+txt(42,775,'SMALL HABITS. SHARED RESPONSIBILITY.',7.6,true)+
 txt(425,775,'organizedmomcollective.com',7.5);
}
const daily=[
 ['towel','Hang your towel to dry','Spread it out so it dries between uses.'],
 ['hamper','Clothes in the hamper','Dirty clothes go in one easy-to-reach spot.'],
 ['sink','Wipe toothpaste and splashes','Leave the sink and counter dry.'],
 ['toothbrush','Put supplies back','Return toiletries to their proper homes.'],
 ['counter','Check before leaving','Look at the sink, floor and counter.']
];
const jobs=[
 ['sink','Sink + counter','Clear, wipe and dry.'],
 ['counter','Mirror','Remove spots and fingerprints.'],
 ['bathroom','Toilet','An adult or trained teen handles products.'],
 ['towel','Tub or shower','Remove soap film and rinse safely.'],
 ['floor','Floor','Clear items, sweep and mop appropriately.'],
 ['trash','Trash + towels','Empty bin and replace used towels.']
];
const ages=[
 ['towel','AGES 3-5','Hang a towel and put clothes in the hamper.'],
 ['trash','AGES 6-8','Take on one simple job with help.'],
 ['sink','AGES 9-12','Practice safe sink and mirror care.'],
 ['bathroom','TEENS + ADULTS','Own deeper cleaning and safety.']
];
const issues=[
 ['towel','Towels stay on the floor','Add a reachable labeled hook.'],
 ['sink','Toothpaste stays in the sink','Keep a clean cloth close to the sink.'],
 ['hamper','Clothes pile up','Move the hamper where clothes come off.'],
 ['bathroom','One person does everything','Choose an owner for each job.'],
 ['counter','The job stops halfway','Show the finish line for each task.'],
 ['bathroom','Musty smell keeps returning','Dry textiles; adults check ventilation and leaks.']
];
async function p1(){
 let s=base(1,'01 / DAILY HABITS','The 2-Minute Bathroom Reset','A small reset after using the bathroom keeps the space ready for everyone.');
 s+=rect(42,162,528,53,ivory)+txt(55,182,'WHAT DONE LOOKS LIKE',9,true)+lines(55,200,'Towels dry, clothes away, sink wiped and supplies returned.',95,9.2);
 for(let i=0;i<daily.length;i++){const [name,title,detail]=daily[i],y=233+i*85;
 s+=await icon(name,52,y,48)+txt(106,y+18,String(i+1).padStart(2,'0'),15,false,true)+txt(143,y+16,title,11.6,true)+lines(143,y+35,detail,69,9.2)+rect(48,y+70,516,1,rule);}
 s+=rect(42,682,528,62,colors[0])+txt(55,703,'AFTER EVERY SHOWER',9,true)+lines(55,724,'Spread towels and curtain to dry; ventilate appropriately.',92,9);return s;
}
async function p2(){
 let s=base(2,'02 / WEEKLY JOBS','Six Jobs. One Shared Bathroom.','Choose a job owner, teach the safe steps, and check what done looks like.');
 for(let i=0;i<jobs.length;i++){const [name,title,detail]=jobs[i],x=42+(i%2)*269,y=167+Math.floor(i/2)*163;
 s+=rect(x,y,259,149,ivory)+rect(x,y,259,5,colors[1])+await icon(name,x+12,y+20,48)+txt(x+69,y+33,title,12,true,true)+lines(x+12,y+92,detail,42,9.3,13);}
 s+=rect(42,665,528,76,colors[1])+txt(55,687,'SAFETY FIRST',9,true)+lines(55,709,'Adults manage chemical cleaners, toilet products and serious maintenance.',96,9);return s;
}
async function p3(){
 let s=base(3,'03 / FAMILY OWNERSHIP','Everyone Can Own a Part','Match tasks to skills. Show the job, practice, then hand it over.');
 for(let i=0;i<ages.length;i++){const [name,title,detail]=ages[i],x=42+(i%2)*269,y=162+Math.floor(i/2)*116;
 s+=rect(x,y,259,105,ivory)+rect(x,y,259,5,colors[2])+await icon(name,x+12,y+36,42)+txt(x+64,y+29,title,9,true)+lines(x+64,y+52,detail,32,8.6,12);}
 s+=txt(42,429,'ASSIGN THE SIX WEEKLY JOBS',10.5,true)+rect(42,473,528,24,colors[2])+txt(55,489,'JOB',9,true)+txt(285,489,'OWNER',9,true)+txt(466,489,'WHEN',9,true);
 for(let i=0;i<jobs.length;i++){const y=501+i*33;
 s+=await icon(jobs[i][0],53,y+1,27)+txt(91,y+20,jobs[i][1],9.3)+rect(42,y+30,528,1,rule)+rect(279,y,1,31,rule)+rect(458,y,1,31,rule);}
 s+=rect(42,713,528,32,colors[2])+txt(55,735,'SHOW  /  PRACTICE  /  HAND OVER',9.3,true);return s;
}
async function p4(){
 let s=base(4,'04 / TROUBLESHOOTING','Fix the System, Not the Mess','The same mess returning usually means something needs to be easier.');
 for(let i=0;i<issues.length;i++){const [name,title,fix]=issues[i],y=165+i*69;
 s+=await icon(name,52,y+1,43)+txt(106,y+17,title,10.7,true)+lines(106,y+37,fix,77,9.2)+rect(48,y+59,516,1,rule);}
 s+=rect(42,604,528,140,ivory)+txt(55,627,'SAFETY FIRST',10,true)+lines(55,651,'Never mix cleaners. Keep products out of children\'s reach. Adults handle persistent mold, leaks and damaged caulk.',98,9.4,14);
 return s;
}
await mkdir(outDir,{recursive:true});
for(const [i,fn] of [p1,p2,p3,p4].entries()){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1424" viewBox="0 0 612 792">${await fn()}</svg>`;
 const path=join(outDir,`bathroom-guide-page-${i+1}.webp`);
 await sharp(Buffer.from(svg)).webp({quality:92}).toFile(path);
 console.log('Rendered updated bathroom guide page '+(i+1));
}
