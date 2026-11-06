/** OMC Family Morning Routine, four illustrated US Letter pages. */
import {mkdir,writeFile} from 'node:fs/promises';
import {makeGuide} from './lib/omc-guide-pdf.mjs';
import {night,steps,jobs,problems,familyPrompt} from './lib/morning-guide-content.mjs';
const {pdf,palette:c,text,paragraph,rect,rule,icon,newPage}=await makeGuide('The Family Morning Routine | Organized Mom Collective',{runningTitle:'MORNING ROUTINE'});
const art=n=>'public/assets/icons/ofc/guides/morning/'+n+'.png';
// Page one: the night-before work.
let p=newPage('01 / The night before','A Calmer Morning Starts Tonight','Five small preparations make tomorrow easier for everyone.',c.blue,1);
rect(p,42,574,528,49,c.ivory);text(p,'THE GOAL',55,603,9,'bold');paragraph(p,'Shoes, school bag, clothes and food are ready before the morning rush.',55,585,490,{size:9,leading:12});
for(let i=0;i<night.length;i++){const [a,title,detail]=night[i],y=545-i*86;await icon(p,art(a),52,y-28,43);text(p,String(i+1).padStart(2,'0'),104,y,14,'serifBold',c.muted);text(p,title,142,y+3,11.1,'bold');paragraph(p,detail,142,y-19,397,{size:9.2,leading:12});rule(p,48,y-58,514);}
rect(p,42,79,528,51,c.blue);text(p,'ONE FAMILY RULE',55,110,9,'bold');paragraph(p,'Return ready items to the same place every night, so everyone knows where to look.',55,93,492,{size:9.2,leading:12});
// Page two: the actual August Club routine, no invented duplicate planner.
p=newPage('02 / School morning','Our Before-School Routine','Follow these same seven steps used in the August Club morning routine.',c.green,2);
for(let i=0;i<steps.length;i++){const [a,title,detail]=steps[i],y=612-i*70;
 await icon(p,art(a),53,y-34,42);text(p,String(i+1).padStart(2,'0'),104,y-5,13,'serifBold',c.muted);
 text(p,title,141,y,10.8,'bold');paragraph(p,detail,141,y-18,403,{size:8.95,leading:11.5});rule(p,49,y-47,513);
}
rect(p,42,78,528,47,c.green);text(p,'A VISIBLE FINISH LINE',55,107,9,'bold');paragraph(p,'Ready: dressed, fed, teeth brushed, lunch and water collected, backpack and shoes on.',55,89,496,{size:8.9,leading:11});
// Page three: role suggestions and usable ownership fields.
p=newPage('03 / Share ownership','Our Family Morning Team','Children practice their own steps. Grown-ups own safety and school logistics.',c.apricot,3);
for(let i=0;i<jobs.length;i++){const [a,age,detail]=jobs[i],x=42+(i%2)*269,y=539-Math.floor(i/2)*119;
 rect(p,x,y,259,107,c.ivory);rect(p,x,y+101,259,6,c.apricot);
 await icon(p,art(a),x+12,y+57,38);text(p,age,x+61,y+79,9,'bold');paragraph(p,detail,x+61,y+56,183,{size:8.6,leading:11});
}
text(p,'OUR FAMILY MORNING HANDOFF',42,390,10.4,'bold');
paragraph(p,'Choose owners and a predictable time. Practice before stepping back.',42,372,510,{size:9,leading:12});
rect(p,42,331,528,23,c.apricot);text(p,'JOB',55,338,8.8,'bold');text(p,'OWNER',275,338,8.8,'bold');text(p,'WHEN',458,338,8.8,'bold');
const owners=['Night-before school check','Clothes + backpack ready','Breakfast + lunch handoff','Teeth + shoes + bag','Final departure check'];
for(let i=0;i<owners.length;i++){const y=309-i*40;text(p,owners[i],55,y,8.7,'bold');rule(p,42,y-12,528);rect(p,265,y-12,1,39,c.rule);rect(p,450,y-12,1,39,c.rule);}
rect(p,42,74,528,48,c.apricot);text(p,'ASK AT THE FAMILY MEETING',55,103,9,'bold');paragraph(p,familyPrompt,55,86,494,{size:9.5,leading:12});
// Page four: troubleshooting.
p=newPage('04 / Real mornings','When Mornings Go Sideways','Fix the recurring problem, not just the reminder.',c.blush,4);
for(let i=0;i<problems.length;i++){const [a,title,fix]=problems[i],y=597-i*74;
 await icon(p,art(a),53,y-31,42);text(p,title,109,y,10.5,'bold');
 paragraph(p,fix,109,y-20,440,{size:9,leading:12});rule(p,48,y-51,517);
}
rect(p,42,80,528,86,c.ivory);text(p,'FAMILY SAFETY + REALISTIC EXPECTATIONS',55,147,9,'bold');
paragraph(p,'Grown-ups confirm transportation, school changes, medications and food safety. Keep perishable lunches chilled until departure. Young children need supervision; printed routines are practice tools, not safety checks.',55,128,493,{size:9,leading:12});
await mkdir('public/downloads',{recursive:true});await writeFile('public/downloads/family-morning-routine.pdf',await pdf.save());
if(pdf.getPageCount()!==4)throw Error('Morning guide expected exactly four pages');
console.log('Generated family morning routine PDF');
