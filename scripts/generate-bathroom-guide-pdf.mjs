/** Build an actual downloadable four-page Family Bathroom Reset PDF.
 * Run before Astro build. All artwork is original OMC artwork from assets/icons/ofc.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeGuide } from './lib/omc-guide-pdf.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const destination=resolve('public/downloads/family-bathroom-reset.pdf');
const transparentFolder='public/assets/icons/ofc/guides/bathroom';
const art={
 towel:transparentFolder+'/towel.png',
 hamper:transparentFolder+'/hamper.png',
 sink:transparentFolder+'/sink.png',
 toothbrush:transparentFolder+'/toothbrush.png',
 counter:transparentFolder+'/counter.png',
 bathroom:transparentFolder+'/bathroom.png',
 floor:transparentFolder+'/floor.png',
 trash:transparentFolder+'/trash.png',
};
const {pdf,palette:c,text,paragraph,rect,rule,icon,newPage}=await makeGuide('The Family Bathroom Reset | Organized Mom Collective');
const daily=[
 [art.towel,'Hang your towel to dry','Spread it out on a bar or hook so it can dry between uses.'],
 [art.hamper,'Clothes in the hamper','Put dirty clothes away as soon as they come off.'],
 [art.sink,'Wipe toothpaste and splashes','Use your family-approved cloth and leave the sink and counter dry.'],
 [art.toothbrush,'Put supplies back','Toothbrush, toothpaste and personal items return to their own spots.'],
 [art.counter,'Check before leaving','Look at the counter, floor and sink. Leave the room ready for someone else.']
];
const jobs=[
 [art.sink,'Sink + counter','Clear items, wipe basin and faucet using the approved method, dry, put items back.','No toothpaste, visible grime or loose clutter.'],
 [art.counter,'Mirror','Wipe spots top to bottom with a suitable cloth and approved product.','No obvious fingerprints or streaks.'],
 [art.bathroom,'Toilet','Trained teens/adults only. Use a dedicated brush and label-approved cleaner.','Seat, rim, bowl and outside are clean.'],
 [art.towel,'Tub or shower','Trained teens/adults: remove visible soap film, rinse as the product label directs.','No obvious film or pooled water.'],
 [art.floor,'Floor','Clear items, sweep corners and edges, then mop appropriately.','Dry, clear floor, including around toilet.'],
 [art.trash,'Trash + towels','Empty bin, replace liner, set out clean towels, launder mat as needed.','Trash removed and fresh towels ready.']
];
const age=[
 [art.towel,'AGES 3-5','Help with the reset','Hang a towel, put clothes in the hamper, return personal items with help.'],
 [art.trash,'AGES 6-8','Own a simple job','Replace towels, empty light trash with help, wipe splashes using water.'],
 [art.sink,'AGES 9-12','Practice a whole routine','Clean a mirror with guidance, sweep or complete sink cleaning safely.'],
 [art.bathroom,'TEENS + ADULTS','Handle deeper cleaning','Manage toilet/shower cleaning and products, with instruction as needed.']
];
const issues=[
 [art.towel,'Towels on the floor','Add reachable labeled towel hooks; practice hanging after use.'],
 [art.sink,'Toothpaste in the sink','Keep a designated cloth nearby. Add a final wipe after brushing.'],
 [art.hamper,'Clothes pile up','Move the hamper to where clothes are removed.'],
 [art.bathroom,'One person does everything','Assign owners at the family meeting. Teach jobs before handing over.'],
 [art.counter,'Job is done halfway','Use page 2 finish lines. Show the expected result together.'],
 [art.bathroom,'Musty smell keeps returning','Dry textiles, improve ventilation; adults investigate leaks or mold.']
];
let p=newPage('01 / Daily habits','The 2-Minute Bathroom Reset','A small reset after each use saves time later. Keep this page where everyone can see it.',c.blue,1);
rect(p,42,573,528,51,c.ivory);text(p,'WHAT DONE LOOKS LIKE',55,604,9,'bold');
paragraph(p,'Towels can dry. Clothes are away. No toothpaste left in the sink. Supplies are back.',55,585,502,{size:9.3,leading:12});
for(let i=0;i<daily.length;i++){
 const y=559-i*76;
 await icon(p,daily[i][0],51,y-44,49);text(p,String(i+1).padStart(2,'0'),111,y-2,17,'serifBold',c.muted);
 text(p,daily[i][1],145,y+3,12.4,'bold');paragraph(p,daily[i][2],145,y-15,406,{size:9.9,leading:13});
 rule(p,48,y-58,516);
}
rect(p,42,78,528,67,c.blue);text(p,'AFTER EVERY SHOWER',55,122,9,'bold');paragraph(p,'Keep the fan running during and after showering, or ventilate appropriately. Spread towels and the shower curtain to dry. An adult handles moisture or maintenance problems.',55,105,494,{size:9.2,leading:12});
p=newPage('02 / Weekly jobs','Six Jobs. One Shared Bathroom.','Pick an owner for each job. Teach the steps together, then use the finish line to check it.',c.green,2);
for(let i=0;i<jobs.length;i++){
 const col=i%2,row=Math.floor(i/2),x=42+col*269,top=626-row*171;
 rect(p,x,top-158,259,154,c.ivory);rect(p,x,top-6,259,5,c.green);
 await icon(p,jobs[i][0],x+10,top-58,47);text(p,String(i+1),x+62,top-26,10,'bold',c.muted);
 text(p,jobs[i][1],x+78,top-27,12.5,'serifBold');
 paragraph(p,jobs[i][2],x+13,top-75,232,{size:9.35,leading:12.5});
 rule(p,x+13,top-119,233);
 text(p,'DONE:',x+13,top-136,8.2,'bold');
 paragraph(p,jobs[i][3],x+53,top-136,189,{size:8.5,leading:10.3});
}
rect(p,42,71,528,35,c.green);text(p,'Safety: adults manage chemical cleaners, toilet products and any persistent mold or leaks.',54,84,9,'bold');
p=newPage('03 / Family ownership','Everyone Can Own a Part.','Match each job to a person, not just an age. Show it, practice it, then hand it over.',c.apricot,3);
for(let i=0;i<age.length;i++){
 const x=42+(i%2)*269,y=543-Math.floor(i/2)*124;
 rect(p,x,y,259,113,c.ivory);rect(p,x,y+107,259,6,c.apricot);
 await icon(p,age[i][0],x+12,y+48,47);text(p,age[i][1],x+70,y+83,8.3,'bold');
 text(p,age[i][2],x+70,y+65,11.2,'serifBold');paragraph(p,age[i][3],x+12,y+39,232,{size:9.1,leading:12.2});
}
text(p,'OUR WEEKLY BATHROOM JOBS',42,404,10,'bold');
paragraph(p,'At your family meeting: write the owner and day. Review the assignments next week.',42,386,520,{size:9.2,leading:12});
rect(p,42,352,528,23,c.apricot);
text(p,'JOB',54,360,8.5,'bold');text(p,'OWNER',286,360,8.5,'bold');text(p,'WHEN',472,360,8.5,'bold');
for(let i=0;i<jobs.length;i++){
 const y=313-i*36;await icon(p,jobs[i][0],51,y-1,27);text(p,jobs[i][1],88,y+7,9.7,'regular');
 rule(p,43,y-6,526);
 rect(p,279,y-6,0.6,35,c.rule);rect(p,463,y-6,0.6,35,c.rule);
}
rect(p,42,73,528,43,c.apricot);
text(p,'THE HANDOFF:',54,99,9,'bold');text(p,'1. Show the job.    2. Practice together.    3. Let them own it.',54,82,9.5);
p=newPage('04 / Troubleshooting','Fix the System, Not the Mess.','The same mess returning often means the habit, the setup, or the job assignment needs to change.',c.blush,4);
for(let i=0;i<issues.length;i++){
 const y=609-i*69;await icon(p,issues[i][0],50,y-34,41);
 text(p,issues[i][1],101,y-2,10.7,'bold');paragraph(p,issues[i][2],101,y-21,451,{size:9.4,leading:12});
 rule(p,48,y-48,515);
}
rect(p,42,118,528,65,c.ivory);text(p,'SAFETY FIRST',54,164,9.2,'bold');
paragraph(p,"Never mix cleaners, especially bleach with ammonia or acids. Follow product labels and keep chemicals out of children's reach. Adults handle leaks, mold and damaged caulk. For substantial or hidden damage, get qualified help.",54,147,498,{size:9.1,leading:12.3});
rect(p,42,62,528,46,c.blush);text(p,'AT YOUR NEXT FAMILY MEETING',54,91,8.7,'bold');
paragraph(p,'Ask what was missed, who needs help, and what one change will make the habit easier.',54,74,495,{size:9.1,leading:12});
const bytes=await pdf.save();await mkdir(dirname(destination),{recursive:true});await writeFile(destination,bytes);
console.log('Generated '+destination+' ('+bytes.length+' bytes, '+pdf.getPageCount()+' pages).');
if(pdf.getPageCount()!==4)throw new Error('Unexpected PDF page count.');
