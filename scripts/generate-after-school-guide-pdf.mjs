/** Four-page illustrated after-school routine PDF on standard OMC US Letter sheets. */
import {mkdir,writeFile} from 'node:fs/promises';
import {makeGuide} from './lib/omc-guide-pdf.mjs';
import {arrival,steps,handoff,problems,question} from './lib/after-school-guide-content.mjs';
const {pdf,palette:c,text,paragraph,rect,rule,icon,newPage}=await makeGuide('The Family After-School Routine | Organized Mom Collective',{runningTitle:'AFTER-SCHOOL ROUTINE'});
const art=n=>'public/assets/icons/ofc/guides/after-school/'+n+'.png';
let p=newPage('01 / The first 10 minutes','The First Ten Minutes Home','Make a short landing routine so school things get put away once.',c.blue,1);
rect(p,42,572,528,51,c.ivory);text(p,'SET UP THE LANDING SPOT',55,605,9,'bold');paragraph(p,'One place for bags and shoes, one for lunch gear, one adult inbox for school papers.',55,586,492,{size:9,leading:12});
for(let i=0;i<arrival.length;i++){const [img,title,detail]=arrival[i],y=544-i*85;
 await icon(p,art(img),53,y-29,43);text(p,String(i+1).padStart(2,'0'),105,y,14,'serifBold',c.muted);text(p,title,145,y+3,10.8,'bold');paragraph(p,detail,145,y-18,394,{size:9.15,leading:12});rule(p,48,y-57,515);
}
rect(p,42,81,528,50,c.blue);text(p,'THE FINISH LINE',55,111,9,'bold');paragraph(p,'Gear has a home. Papers are handed off. Hands are washed. Next comes snack and the family plan.',55,94,494,{size:9,leading:12});
p=newPage('02 / The picture routine','Our After-School Routine','The five prepared August Club steps, ready to practice as a family.',c.green,2);
for(let i=0;i<steps.length;i++){const [img,title,detail]=steps[i],y=595-i*91;
 await icon(p,art(img),54,y-33,49);text(p,String(i+1).padStart(2,'0'),113,y-1,14,'serifBold',c.muted);
 text(p,title,150,y+3,11.4,'bold');paragraph(p,detail,150,y-18,387,{size:9.5,leading:13});rule(p,48,y-61,515);
}
rect(p,42,96,528,73,c.green);text(p,'THE REAL ROUTINE MAY BE SHORTER',55,146,9,'bold');paragraph(p,'On busy days, finish the essentials first. In the free Routine Chart Builder, change the pictures, order, and times for your child.',55,127,492,{size:9.2,leading:12});
p=newPage('03 / Shared responsibility','Our Family After-School Team','Kids take responsibility for their things. Adults own the decisions and safety.',c.apricot,3);
for(let i=0;i<handoff.length;i++){const [img,age,detail]=handoff[i],x=42+(i%2)*269,y=540-Math.floor(i/2)*119;
 rect(p,x,y,259,107,c.ivory);rect(p,x,y+101,259,6,c.apricot);await icon(p,art(img),x+11,y+58,38);text(p,age,x+62,y+79,9,'bold');paragraph(p,detail,x+62,y+56,183,{size:8.6,leading:11});
}
text(p,'OUR FAMILY HANDOFF',42,388,10.6,'bold');paragraph(p,'Write who handles each part and where finished things belong.',42,370,506,{size:9.1,leading:12});
rect(p,42,333,528,24,c.apricot);text(p,'JOB',55,341,8.6,'bold');text(p,'WHO',280,341,8.6,'bold');text(p,'WHERE / WHEN',442,341,8.6,'bold');
const tasks=['Shoes, coat + backpack home','Lunch gear to the kitchen','School papers to adult inbox','Snack and afternoon plan','Adult reviews messages + rides'];
for(let i=0;i<tasks.length;i++){const y=308-i*40;text(p,tasks[i],55,y,8.5,'bold');rule(p,42,y-12,528);rect(p,270,y-12,1,39,c.rule);rect(p,435,y-12,1,39,c.rule);}
rect(p,42,76,528,49,c.apricot);text(p,'ASK TOGETHER',55,106,9,'bold');paragraph(p,question,55,89,493,{size:9.6,leading:12});
p=newPage('04 / Real afternoons','When Afternoons Go Sideways','Change the handoff, not just the number of reminders.',c.blush,4);
for(let i=0;i<problems.length;i++){const [img,title,fix]=problems[i],y=598-i*73;await icon(p,art(img),54,y-32,41);text(p,title,110,y,10.5,'bold');paragraph(p,fix,110,y-19,435,{size:9,leading:12});rule(p,48,y-51,515);}
rect(p,42,81,528,84,c.ivory);text(p,'GROWN-UPS OWN THE SAFETY CHECKS',55,145,9,'bold');paragraph(p,'An adult handles school notices, transportation changes, food safety, and supervision. A child’s picture routine helps practice independence but never replaces needed support.',55,126,493,{size:9,leading:12});
await mkdir('public/downloads',{recursive:true});await writeFile('public/downloads/family-after-school-routine.pdf',await pdf.save());if(pdf.getPageCount()!==4)throw Error('Expected 4 pages');
console.log('Generated Family After-School Routine PDF');
