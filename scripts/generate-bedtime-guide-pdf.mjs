/** Four illustrated, print-ready US Letter sheets for The Family Bedtime Routine. */
import {mkdir,writeFile} from 'node:fs/promises';
import {makeGuide} from './lib/omc-guide-pdf.mjs';
import {windDown,bedtime,ownership,issues,familyPrompt} from './lib/bedtime-guide-content.mjs';
const {pdf,palette:c,text,paragraph,rect,rule,icon,newPage}=await makeGuide('The Family Bedtime Routine | Organized Mom Collective',{runningTitle:'BEDTIME ROUTINE'});
const art=n=>'public/assets/icons/ofc/guides/bedtime/'+n+'.png';
// Page 1: predictable evening transition, without duplicating a chore or morning chart.
let p=newPage('01 / Evening wind-down','The Evening Wind-Down','Prepare tomorrow and slow the pace before bedtime begins.',c.blue,1);
rect(p,42,576,528,46,c.ivory);text(p,'KEEP IT SIMPLE',55,603,9,'bold');
paragraph(p,'Pick a repeatable start cue. Each step takes only the time your family needs.',55,585,498,{size:9,leading:12});
for(let i=0;i<windDown.length;i++){const [name,title,detail]=windDown[i],y=551-i*85;
 await icon(p,art(name),52,y-31,43);
 text(p,String(i+1).padStart(2,'0'),105,y,14,'serifBold',c.muted);
 text(p,title,145,y+3,11,'bold');
 paragraph(p,detail,145,y-18,397,{size:9.2,leading:12});
 rule(p,48,y-57,515);
}
rect(p,42,82,528,53,c.blue);text(p,'A FINISH LINE EVERYONE CAN SEE',55,116,9,'bold');
paragraph(p,'Tomorrow’s things are ready, the main space is usable, and the family has shifted into a quieter activity.',55,98,495,{size:8.9,leading:12});
// Page 2: illustrated sequence that can be personalized in existing builder.
p=newPage('02 / Bedtime pictures','Our Bedtime Routine','Six steps kids can practice in a familiar, predictable order.',c.green,2);
for(let i=0;i<bedtime.length;i++){const [name,title,detail]=bedtime[i],y=598-i*78;
 await icon(p,art(name),52,y-34,44);
 text(p,String(i+1).padStart(2,'0'),105,y-2,13,'serifBold',c.muted);
 text(p,title,145,y+1,11,'bold');
 paragraph(p,detail,145,y-19,395,{size:9.2,leading:12});
 rule(p,48,y-55,515);
}
rect(p,42,83,528,52,c.green);text(p,'START WITH FEWER STEPS IF NEEDED',55,116,9,'bold');
paragraph(p,'Choose the essentials first. The free Routine Chart Builder lets you personalize each child’s pictures and order.',55,97,495,{size:9,leading:12});
// Page 3: age suggestions and usable family ownership.
p=newPage('03 / Ownership','Our Family Bedtime Team','Show the job, practice it together, then hand it over when ready.',c.apricot,3);
for(let i=0;i<ownership.length;i++){const [name,age,detail]=ownership[i],x=42+(i%2)*269,y=543-Math.floor(i/2)*117;
 rect(p,x,y,259,105,c.ivory);rect(p,x,y+99,259,6,c.apricot);
 await icon(p,art(name),x+11,y+52,39);
 text(p,age,x+63,y+78,9,'bold');
 paragraph(p,detail,x+63,y+54,177,{size:8.5,leading:11});
}
text(p,'WHO OWNS EACH PART?',42,393,10,'bold');
paragraph(p,'Choose an owner and your family’s cue. Adults still own supervision and safety.',42,374,510,{size:9.2,leading:12});
rect(p,42,341,528,22,c.apricot);text(p,'BEDTIME JOB',55,348,8.6,'bold');text(p,'OWNER',280,348,8.6,'bold');text(p,'WHEN',457,348,8.6,'bold');
const assign=['Evening reset + tomorrow’s bag','Pajamas + clothes away','Teeth + bathroom','Book + quiet goodnight','Lights out + adult check'];
for(let i=0;i<assign.length;i++){const y=318-i*40;
 text(p,assign[i],55,y,8.7,'bold');rule(p,42,y-12,528);
 rect(p,269,y-12,1,39,c.rule);rect(p,451,y-12,1,39,c.rule);
}
rect(p,42,77,528,48,c.apricot);text(p,'ASK AT THE FAMILY MEETING',55,106,9,'bold');
paragraph(p,familyPrompt,55,89,495,{size:9.2,leading:12});
// Page 4: problem-solving and caution not to promise sleep outcomes.
p=newPage('04 / Real evenings','When Bedtime Goes Sideways','Small changes work better than adding more reminders.',c.blush,4);
for(let i=0;i<issues.length;i++){const [name,title,fix]=issues[i],y=596-i*73;
 await icon(p,art(name),52,y-31,42);
 text(p,title,109,y,10.5,'bold');
 paragraph(p,fix,109,y-20,436,{size:9.2,leading:12});
 rule(p,48,y-51,515);
}
rect(p,42,81,528,85,c.ivory);text(p,'KEEP EXPECTATIONS REALISTIC',55,146,9,'bold');
paragraph(p,'Adults handle medications, safe sleep arrangements, age-appropriate supervision and bedtime decisions. These routines support predictable habits; they are not medical advice or sleep training.',55,126,491,{size:9,leading:12});
await mkdir('public/downloads',{recursive:true});
await writeFile('public/downloads/family-bedtime-routine.pdf',await pdf.save());
if(pdf.getPageCount()!==4)throw new Error('Bedtime guide must have four pages');
console.log('Generated Family Bedtime Routine PDF');
