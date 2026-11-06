/** Four-page family laundry guide. Uses existing OMC print blueprint and white US Letter paper. */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeGuide } from './lib/omc-guide-pdf.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const dest=resolve('public/downloads/family-laundry-system-guide.pdf');
const {pdf,palette:c,text,paragraph,rect,rule,newPage}=await makeGuide('The Family Laundry System | Organized Mom Collective',{runningTitle:'FAMILY LAUNDRY SYSTEM'});
const steps=[
 ['Collect','Put dirty clothes in a reachable hamper. Wet items dry before going into a basket.','No dirty clothes left on bedroom floors.'],
 ['Sort + prepare','Check pockets and care labels. Adults check stains and delicate or special-care fabrics.','The load is ready for the correct wash.'],
 ['Wash + move','A trained person starts the washer and sets a timer to transfer the load promptly.','Nothing forgotten wet in the washer.'],
 ['Fold + sort','Sort clean clothes into one pile or basket per person; fold or hang what needs it.','Every item belongs to a person.'],
 ['Put away','Each person puts their clothes into drawers or closets with help as needed.','No clean clothes left in the living room.']
];
let p=newPage('01 / A finished load','From Hamper to Drawer','The five steps that make laundry a shared responsibility, not a permanent pile.',c.blue,1);
rect(p,42,575,528,48,c.ivory);text(p,'WHAT FINISHED LOOKS LIKE',55,605,9,'bold');
paragraph(p,'Clothes are clean, dry, sorted and put away. The job is not done when the dryer stops.',55,587,500,{size:9.2,leading:12});
for(let i=0;i<steps.length;i++){
 const y=547-i*86;
 text(p,String(i+1).padStart(2,'0'),54,y,19,'serifBold',c.muted);
 text(p,steps[i][0],117,y+3,12.3,'bold');
 paragraph(p,steps[i][1],117,y-15,425,{size:9.4,leading:12});
 text(p,'DONE:',117,y-43,8.3,'bold');paragraph(p,steps[i][2],158,y-43,385,{size:8.5,leading:10.6});
 rule(p,48,y-58,514);
}
rect(p,42,75,528,46,c.blue);text(p,'ONE RULE',55,103,9,'bold');
paragraph(p,'Each load has an owner until it reaches the sorting point. Each family member owns putting away their clothes.',55,86,500,{size:9.1,leading:12});

p=newPage('02 / Choose a rhythm','Keep It Moving Each Week','A simple laundry rhythm beats trying to remember everything every day.',c.green,2);
const rhythm=[
 ['DAILY - TWO MINUTES','Put worn clothes in the hamper. Hang towels and rewearable items to dry or air.'],
 ['TWO REGULAR LOAD WINDOWS','Choose two times your household can start and finish loads, not just begin them.'],
 ['TOWELS + SHEETS','Add a separate day or load window when needed. Adjust to family size and laundry volume.'],
 ['AFTER EVERY LOAD','Move laundry when the cycle finishes. Sort by person and put it away the same day when possible.']
];
for(let i=0;i<rhythm.length;i++){
 const y=550-i*107;
 rect(p,42,y-31,528,86,c.ivory);rect(p,42,y+49,528,5,c.green);
 text(p,rhythm[i][0],57,y+25,10,'bold');
 paragraph(p,rhythm[i][1],57,y+2,493,{size:10,leading:14});
}
rect(p,42,76,528,80,c.green);
text(p,'OUR LAUNDRY WINDOWS',55,134,10,'bold');
text(p,'Clothes day: ___________________    Second window: ___________________',55,109,10);
text(p,'Towels / sheets: ________________   Load transfer reminder: __________',55,87,9.5);

p=newPage('03 / Share the handoff','Our Family Laundry Team','Write a name beside each step, practice together and check back next week.',c.apricot,3);
const roles=[
 ['AGES 3-5','Hamper, sock matching, simple drawers with help.'],
 ['AGES 6-8','Collect, sort safe items, fold towels, put away clothes.'],
 ['AGES 9-12','Learn sorting, folding and safe appliance use with supervision.'],
 ['TEENS + ADULTS','Own complete loads, labels, settings and timing.']
];
for(let i=0;i<4;i++){
 const x=42+(i%2)*269,y=547-Math.floor(i/2)*113;
 rect(p,x,y,259,100,c.ivory);rect(p,x,y+94,259,6,c.apricot);
 text(p,roles[i][0],x+13,y+70,9,'bold');paragraph(p,roles[i][1],x+13,y+49,229,{size:9.2,leading:12.5});
}
text(p,'ASSIGN THE FIVE STEPS',42,398,10,'bold');
paragraph(p,'Choose a realistic owner for each task. One person may own more than one step.',42,380,515,{size:9.1,leading:12});
rect(p,42,338,528,23,c.apricot);
text(p,'STEP',55,346,8.8,'bold');text(p,'OWNER',275,346,8.8,'bold');text(p,'WHEN',458,346,8.8,'bold');
for(let i=0;i<5;i++){
 const y=314-i*41;
 text(p,steps[i][0],55,y,10,'bold');rule(p,42,y-12,528);
 rect(p,265,y-12,.8,40,c.rule);rect(p,450,y-12,.8,40,c.rule);
}
rect(p,42,70,528,58,c.apricot);
text(p,'AT YOUR NEXT FAMILY MEETING',55,106,9,'bold');
paragraph(p,'Notice where laundry gets stuck. Choose owners. Practice one load. Review the plan together next week.',55,88,490,{size:9.2,leading:12});

p=newPage('04 / When it piles up','Fix the Handoff','If the same problem keeps returning, make the next step easier to see and own.',c.blush,4);
const issues=[
 ['Clean clothes stay in piles','Give everyone a labeled clean basket and a specific put-away time.'],
 ['Wet clothes stay in the washer','The person starting the load sets the reminder and owns the transfer.'],
 ['One person does everything','Assign names to steps instead of asking everyone to help sometimes.'],
 ['Sorting feels overwhelming','Keep sorting simple; adults handle care-label exceptions.'],
 ['Laundry starts but never ends','Choose load windows long enough to wash, dry and put away.'],
 ['Kids cannot find where things go','Clear crowded drawers, label bins and practice one put-away together.']
];
for(let i=0;i<issues.length;i++){
 const y=596-i*70;
 text(p,issues[i][0],54,y,11,'bold');
 paragraph(p,issues[i][1],54,y-19,495,{size:9.4,leading:12});
 rule(p,48,y-48,516);
}
rect(p,42,86,528,76,c.ivory);
text(p,'LAUNDRY SAFETY',55,143,9.3,'bold');
paragraph(p,'Adults control detergent, pods, bleach and stain removers; store products securely. Follow garment care labels and appliance instructions. Children must never climb into washers or dryers. Supervise appliance use as skills develop.',55,125,497,{size:9,leading:12.3});
const bytes=await pdf.save();await mkdir(dirname(dest),{recursive:true});await writeFile(dest,bytes);
if(pdf.getPageCount()!==4)throw new Error('Expected exactly four pages');
console.log('Generated '+dest+' ('+bytes.length+' bytes; four US Letter pages)');
