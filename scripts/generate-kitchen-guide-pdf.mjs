/** Four-page Family Kitchen Reset PDF. Uses the OMC guide print blueprint. */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeGuide } from './lib/omc-guide-pdf.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const dest=resolve('public/downloads/family-kitchen-reset.pdf');
const folder='public/assets/icons/ofc/guides/kitchen/';
const icons=Object.fromEntries(['clear','sink','wipe','table','dishwasher','floor','trash','fridge','lunch','kitchen','check','hands'].map(k=>[k,folder+k+'.png']));
const {pdf,palette:c,text,paragraph,rect,rule,icon,newPage}=await makeGuide('The Family Kitchen Reset | Organized Mom Collective',{runningTitle:'FAMILY KITCHEN RESET'});
const daily=[
 ['clear','Carry your dishes to the sink','Everyone clears their own plate, cup and utensils.'],
 ['fridge','Put food and ingredients away','Adults check safe storage and refrigerate perishables promptly.'],
 ['wipe','Wipe your place','Use the assigned cloth or a child-safe method for crumbs and spills.'],
 ['dishwasher','Put dishes in their home','Load the dishwasher if trained, or stack in the designated spot.'],
 ['check','Give the room a final look','Check the table, counter and floor before leaving.'],
];
const jobs=[
 ['clear','Clear and sort dishes','Tray or dish bin.','Bring used dishes to the sink; separate leftover food and sort items.','No dirty dishes left at the table.'],
 ['dishwasher','Load or wash dishes','Dishwasher or soapy water.','An adult or trained helper loads safely. Adults handle sharp knives.','Dishes are washed or ready for the next cycle.'],
 ['wipe','Wipe table and counters','Clean cloth and safe cleaner.','Move small items, wipe food spots and crumbs, then replace items.','Surfaces are visibly clean and cleared.'],
 ['floor','Sweep food crumbs','Broom and dustpan.','Check under the table and around chairs. Sweep crumbs into the dustpan.','No visible food or sticky spots.'],
 ['trash','Trash and food away','Trash or compost bin; food containers.','Dispose of scraps; seal and refrigerate food that must be kept.','Scraps removed; leftovers stored safely.'],
];
const ages=[
 ['table','AGES 3-5','Start with one habit','Carry unbreakable items, put a napkin away, wipe with water and help.'],
 ['clear','AGES 6-8','Own a small reset','Clear a place, wipe the table, sort safe dishes, sweep with help.'],
 ['dishwasher','AGES 9-12','Learn a full job','Load safe dishes, wipe counters, empty the bin, sweep carefully.'],
 ['kitchen','TEENS + ADULTS','Handle heat and knives','Hot pans, sharp tools, cleaners, food-safety decisions and repairs.'],
];
const fixes=[
 ['clear','Dishes pile up','Put a dish bin beside the sink. Everyone carries their own plate after eating.'],
 ['wipe','Counters collect clutter','Give lunch boxes, mail and appliances permanent homes off the prep zone.'],
 ['lunch','Lunch gear goes missing','Make one landing spot for lunchboxes and bottles to unpack after school.'],
 ['floor','Crumbs return immediately','Keep a small broom nearby. Sweep after the messiest meal.'],
 ['trash','Food gets left out','Name the adult who checks leftover storage after each meal.'],
 ['hands','One person does everything','Give each job an owner and an agreed finish line; revisit next week.'],
];
let p=newPage('01 / After every meal','A Kitchen Ready for the Next Meal','Five small habits after eating prevent the mess from becoming someone else\'s job.',c.blue,1);
rect(p,42,574,528,49,c.ivory);
text(p,'WHAT FINISHED LOOKS LIKE',55,604,9,'bold');
paragraph(p,'Dishes are moved, food is safely stored, crumbs are wiped and everything has a place.',55,586,502,{size:9.25,leading:12});
for(let i=0;i<daily.length;i++){
 const y=556-i*75;
 await icon(p,icons[daily[i][0]],53,y-45,49);
 text(p,String(i+1).padStart(2,'0'),112,y-3,17,'serifBold',c.muted);
 text(p,daily[i][1],145,y+1,11.6,'bold');
 paragraph(p,daily[i][2],145,y-17,396,{size:9.6,leading:12.3});
 rule(p,48,y-57,516);
}
rect(p,42,78,528,74,c.blue);
text(p,'START SMALL',55,128,9,'bold');
paragraph(p,'On busy nights, focus on three things: food stored safely, dishes to the sink and the table cleared. Add the rest as the family learns the habit. Adults own sharp tools, heat and food safety.',55,110,500,{size:9.15,leading:12});
p=newPage('02 / The shared reset','Five Jobs. Ten Minutes Together.','Give each job an owner, teach the steps, and check the finish line. The goal is shared work, not a stopwatch.',c.green,2);
for(let i=0;i<jobs.length;i++){
 const col=i%2,row=Math.floor(i/2);
 const x=42+col*269, top=626-row*178, w=i===4?528:259;
 if(i===4){ // The last job stretches across both columns.
   rect(p,42,top-155,528,154,c.ivory);rect(p,42,top-5,528,5,c.green);
   await icon(p,icons[jobs[i][0]],55,top-71,58);
   text(p,'05',126,top-27,10,'bold',c.muted);
   text(p,jobs[i][1],157,top-29,14,'serifBold');
   text(p,'SUPPLIES:',157,top-50,8.4,'bold');
   paragraph(p,jobs[i][2],210,top-50,347,{size:9.2,leading:11});
   paragraph(p,jobs[i][3],157,top-72,385,{size:9.2,leading:12});
   rule(p,156,top-112,398);
   text(p,'DONE:',157,top-130,8.7,'bold');paragraph(p,jobs[i][4],206,top-130,343,{size:9.1,leading:11});
 }else{
   rect(p,x,top-161,w,157,c.ivory);rect(p,x,top-7,w,5,c.green);
   await icon(p,icons[jobs[i][0]],x+10,top-67,43);
   text(p,String(i+1).padStart(2,'0'),x+60,top-25,9,'bold',c.muted);
   text(p,jobs[i][1],x+79,top-26,11.7,'serifBold');
   paragraph(p,'SUPPLIES: '+jobs[i][2],x+12,top-81,232,{size:8.6,leading:11.2});
   paragraph(p,jobs[i][3],x+12,top-104,231,{size:9.05,leading:12});
   rule(p,x+12,top-139,235);
   text(p,'DONE:',x+12,top-153,8.1,'bold');
   paragraph(p,jobs[i][4],x+55,top-153,188,{size:8.2,leading:9.5});
 }
}
rect(p,42,71,528,38,c.green);
text(p,'SAFETY:',55,92,9,'bold');
paragraph(p,'Adults handle knives, hot cookware, chemicals and decisions about food storage. Do not rush.',106,92,449,{size:8.9,leading:11});
p=newPage('03 / Sharing the work','Our Family Kitchen Team','Match each job to ability and practice. Choose one daily habit before expecting a whole reset.',c.apricot,3);
for(let i=0;i<ages.length;i++){
 const x=42+(i%2)*269,y=543-Math.floor(i/2)*124;
 rect(p,x,y,259,113,c.ivory);rect(p,x,y+107,259,6,c.apricot);
 await icon(p,icons[ages[i][0]],x+12,y+46,48);
 text(p,ages[i][1],x+70,y+83,8.3,'bold');
 text(p,ages[i][2],x+70,y+65,11,'serifBold');
 paragraph(p,ages[i][3],x+12,y+39,232,{size:9,leading:12});
}
text(p,'THE FIVE RESET JOBS',42,405,10,'bold');
paragraph(p,'In your next family meeting, write a name and when each job happens. Practice together first.',42,388,520,{size:9.4,leading:12});
rect(p,42,350,528,24,c.apricot);
text(p,'JOB',54,359,8.7,'bold');text(p,'OWNER',288,359,8.7,'bold');text(p,'WHEN',474,359,8.7,'bold');
for(let i=0;i<jobs.length;i++){
 const y=311-i*39;
 await icon(p,icons[jobs[i][0]],52,y-5,30);
 text(p,jobs[i][1],88,y+5,9.4);
 rule(p,42,y-9,528);
 rect(p,279,y-9,.7,37,c.rule);rect(p,464,y-9,.7,37,c.rule);
}
rect(p,42,78,528,49,c.apricot);
text(p,'SHOW  /  PRACTICE  /  HAND OVER',54,109,9,'bold');
paragraph(p,'One adult demonstrates. Everyone practices. Next week ask what was missed and adjust the plan.',54,92,496,{size:9.1,leading:12});
p=newPage('04 / When it gets messy','Fix the Setup, Not the People','A kitchen reset sticks when supplies are easy to find and everyone knows what they own.',c.blush,4);
for(let i=0;i<fixes.length;i++){
 const y=616-i*67;
 await icon(p,icons[fixes[i][0]],50,y-35,42);
 text(p,fixes[i][1],103,y-2,10.8,'bold');
 paragraph(p,fixes[i][2],103,y-20,449,{size:9.2,leading:12});
 rule(p,48,y-47,516);
}
rect(p,42,144,528,64,c.ivory);
text(p,'ONCE-A-WEEK KITCHEN CHECK',54,190,9,'bold');
paragraph(p,'Check the fridge for expired food; wipe appliance fronts and cabinet handles; clean the sink and floor edges. Adults check products and food safety.',54,172,499,{size:9,leading:12});
rect(p,42,68,528,66,c.blush);
text(p,'ADULT SAFETY NOTE',54,116,9,'bold');
paragraph(p,'Wash hands before handling food and after raw meat. Keep raw foods separate from ready-to-eat foods; follow safe storage guidance. Children do not handle sharp knives, hot pans or cleaning chemicals without appropriate adult control.',54,99,500,{size:8.75,leading:11.6});
await mkdir(dirname(dest),{recursive:true});
const bytes=await pdf.save();await writeFile(dest,bytes);
if(pdf.getPageCount()!==4)throw new Error('Kitchen guide PDF is not four pages');
console.log('Generated '+dest+' ('+bytes.length+' bytes; '+pdf.getPageCount()+' US Letter pages)');
