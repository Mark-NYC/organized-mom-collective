/** One-page ages 8–9 printable. Uses the existing OMC PDF palette and hand-drawn icons. */
import {mkdir,writeFile} from 'node:fs/promises';
import {makeGuide} from './lib/omc-guide-pdf.mjs';
import {categories} from './lib/chores-8-9-content.mjs';
const {pdf,palette:c,text,paragraph,rect,rule,icon}=await makeGuide('Chores for 8–9-Year-Olds | Organized Mom Collective',{runningTitle:'CHORES AGES 8-9'});
const p=pdf.addPage([612,792]);
rect(p,0,0,612,792,c.white);
text(p,'ORGANIZED MOM COLLECTIVE',42,756,8.5,'bold');
rect(p,42,743,528,6,c.blue);
text(p,'Chores for 8–9-Year-Olds',42,699,26,'serifBold');
paragraph(p,'Real jobs they can learn to own. Pick one daily job and one family contribution.',42,679,520,{size:9.8,leading:13});
const art=n=>'public/assets/icons/ofc/guides/responsibility/'+n+'.png';
const accents=[c.blue,c.green,c.apricot];
for(let k=0;k<categories.length;k++){
 const cat=categories[k],x=42+k*179,y=366,w=170;
 rect(p,x,y,w,280,c.ivory);rect(p,x,y+275,w,5,accents[k]);
 await icon(p,art(cat.icon),x+10,y+222,40);
 const titles=['MY EVERYDAY THINGS','SHARED SPACES','OUR FAMILY TEAM'];
 text(p,titles[k],x+10,y+202,8.7,'bold');
 cat.jobs.forEach((job,i)=>{const yy=y+177-i*28;rect(p,x+11,yy-1,8,8,c.white,c.rule);paragraph(p,job,x+25,yy,w-34,{size:8.15,leading:10});});
}
rect(p,42,330,528,25,c.blush);text(p,'THIS WEEK: CHOOSE JUST TWO JOBS',55,338,9.2,'bold');
text(p,'Name: ____________________________________     Week of: ___________________',47,306,9);
text(p,'MY JOB',48,275,8.5,'bold');
const days=['M','T','W','T','F','S','S'];
days.forEach((d,i)=>text(p,d,296+i*37,275,9,'bold'));
for(let r=0;r<2;r++){
 const yy=238-r*63;
 text(p,r===0?'1. Daily job:':'2. Family job:',47,yy,9,'bold');
 rule(p,117,yy-4,160);
 text(p,'When: ____________________',47,yy-24,8.5);
 for(let d=0;d<7;d++)rect(p,295+d*37,yy-4,15,15,c.white,c.rule);
 rule(p,42,yy-36,528);
}
rect(p,42,63,528,45,c.ivory);
text(p,'START SMALL',55,90,8.8,'bold');
paragraph(p,'Show the job, agree on what done means, then attach it to a daily cue. Review together next week.',55,75,495,{size:8.8,leading:11});
rule(p,42,45);text(p,'SMALL HABITS. SHARED RESPONSIBILITY.',42,30,7.8,'bold');text(p,'organizedmomcollective.com',421,30,7.8,'regular',c.muted);
if(pdf.getPageCount()!==1)throw new Error('Expected one page');
await mkdir('public/downloads',{recursive:true});
await writeFile('public/downloads/chores-for-8-9-year-olds.pdf',await pdf.save());
console.log('Generated single-page printable');
