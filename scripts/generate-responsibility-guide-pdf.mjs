/** Family Responsibility System, four illustrated letter-size printable pages. */
import {mkdir,writeFile} from 'node:fs/promises';
import {makeGuide} from './lib/omc-guide-pdf.mjs';
import {cycle,examples,handover,familyTalk,issues,prompt} from './lib/responsibility-guide-content.mjs';
const {pdf,palette:c,text,paragraph,rect,rule,icon,newPage}=await makeGuide('The Family Responsibility System | Organized Mom Collective',{runningTitle:'FAMILY RESPONSIBILITY'});
const art=n=>'public/assets/icons/ofc/guides/responsibility/'+n+'.png';
// 1. Explain shared mental load, with a usable first-three-jobs worksheet.
let p=newPage('01 / Help versus ownership','Helping Is Not the Same as Owning','Move the whole job, including the remembering, out of Mom’s head.',c.blue,1);
for(let i=0;i<cycle.length;i++){const [a,title,desc]=cycle[i],x=42+i*134;rect(p,x,529,125,113,c.ivory);await icon(p,art(a),x+8,585,a==='eye'?32:38);text(p,title,x+8,562,10,'bold');paragraph(p,desc,x+8,546,106,{size:8,leading:10});}
text(p,'WHAT DOES OWNERSHIP LOOK LIKE?',42,502,10.5,'bold');
for(let i=0;i<examples.length;i++){const [a,title,detail]=examples[i],y=465-i*62;await icon(p,art(a),51,y-26,34);text(p,title,102,y,10,'bold');paragraph(p,detail,102,y-17,448,{size:9.1,leading:12});rule(p,48,y-40,515);}
rect(p,42,172,528,28,c.blue);text(p,'THREE JOBS I AM STILL MANAGING',55,181,9,'bold');
for(let i=0;i<3;i++){const y=146-i*31;text(p,(i+1)+'.',56,y,9,'bold');rule(p,76,y-4,476);}
rect(p,42,72,528,37,c.ivory);paragraph(p,'Choose one job to teach first. Do not hand over three new things at once.',55,91,488,{size:9,leading:12});
// 2. The pivotal handover instructions and write-in agreement.
p=newPage('02 / Practice the handoff','Hand Over the Whole Job','Six steps from a spoken request to actual shared responsibility.',c.green,2);
for(let i=0;i<handover.length;i++){const [a,title,detail]=handover[i],y=604-i*57;await icon(p,art(a),53,y-24,34);text(p,(i+1)+'. '+title,102,y,9.9,'bold');paragraph(p,detail,102,y-17,447,{size:8.9,leading:11});rule(p,48,y-39,515);}
rect(p,42,213,528,27,c.green);text(p,'OUR ONE-JOB HANDOVER AGREEMENT',55,222,9,'bold');
const fields=[['Job:',179],['Owner:',154],['When it starts:',129],['Finished means:',104],['Help or supplies needed:',79]];
for(const [label,y] of fields){text(p,label,55,y,9,'bold');rule(p,label.length>14?198:label.length>10?160:116,y-3,label.length>14?349:label.length>10?388:432);}
// 3. Team meeting and actual owned jobs.
p=newPage('03 / Our family team','Who Owns What in Our Home?','Grown-ups share their ownership, then each person chooses one part.',c.apricot,3);
for(let i=0;i<familyTalk.length;i++){const [a,title,detail]=familyTalk[i],x=42+(i%2)*269,y=541-Math.floor(i/2)*122;rect(p,x,y,258,111,c.ivory);rect(p,x,y+105,258,6,c.apricot);await icon(p,art(a),x+11,y+60,33);text(p,String(i+1)+'. '+title,x+51,y+85,9.1,'bold');paragraph(p,detail,x+11,y+49,231,{size:8.5,leading:11});}
text(p,'OUR FAMILY RESPONSIBILITY AGREEMENTS',42,383,10.3,'bold');paragraph(p,'Start small. Every row should include an owner and a clear finish.',42,365,501,{size:9,leading:12});
rect(p,42,331,528,25,c.apricot);text(p,'PERSON',55,339,8.8,'bold');text(p,'OWNS WHAT',177,339,8.8,'bold');text(p,'WHEN / DONE',412,339,8.8,'bold');
for(let i=0;i<5;i++){const y=307-i*39;rule(p,42,y-14,528);rect(p,166,y-14,1,37,c.rule);rect(p,403,y-14,1,37,c.rule);}
rect(p,42,79,528,48,c.apricot);text(p,'ASK AT THE FAMILY MEETING',55,107,9,'bold');paragraph(p,prompt,55,90,492,{size:9.8,leading:12});
// 4. Realistic no-nagging recovery.
p=newPage('04 / When habits slip','When Responsibility Does Not Stick','Change the cue, the teaching or the expectations before adding reminders.',c.blush,4);
for(let i=0;i<issues.length;i++){const [a,title,detail]=issues[i],y=595-i*72;await icon(p,art(a),54,y-30,a==='eye'?32:40);text(p,title,106,y,10.2,'bold');paragraph(p,detail,106,y-19,442,{size:8.95,leading:11.8});rule(p,48,y-49,515);}
rect(p,42,81,528,87,c.ivory);text(p,'THE ONE-WEEK CHECK-IN',55,148,9,'bold');paragraph(p,'Ask: What worked? What was harder? Does the cue or finish line need to change? Keep one owner and practice again. No streaks, prize system or guilt required.',55,128,490,{size:9,leading:12});
await mkdir('public/downloads',{recursive:true});await writeFile('public/downloads/family-responsibility-system.pdf',await pdf.save());
if(pdf.getPageCount()!==4)throw Error('Expected four pages');
console.log('Generated Family Responsibility System PDF');
