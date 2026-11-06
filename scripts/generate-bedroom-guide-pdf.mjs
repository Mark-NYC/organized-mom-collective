/** Kids' Bedroom Reset: four true US Letter PDF pages using OMC print helpers. */
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeGuide} from './lib/omc-guide-pdf.mjs';
import {habits,rhythm,roles,issues} from './lib/bedroom-guide-content.mjs';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const dest=resolve('public/downloads/family-bedroom-reset.pdf');
const {pdf,palette:c,text,paragraph,rect,rule,icon,newPage}=await makeGuide('The Kids Bedroom Reset | Organized Mom Collective',{runningTitle:'KIDS BEDROOM RESET'});
const art=n=>'public/assets/icons/ofc/guides/bedroom/'+n+'.png';
let p=newPage('01 / Daily reset','My Five-Minute Bedroom Reset','Five small habits kids can practice without a grown-up directing every step.',c.blue,1);
rect(p,42,575,528,48,c.ivory);text(p,'WHAT DONE LOOKS LIKE',55,605,9,'bold');
paragraph(p,'Bed made, clothes sorted, toys and books home, and a clear floor. It does not have to look perfect.',55,587,500,{size:9.1,leading:12});
for(let i=0;i<habits.length;i++){const [name,title,what,done]=habits[i],y=547-i*86;
 await icon(p,art(name),52,y-30,43);text(p,String(i+1).padStart(2,'0'),101,y,14,'serifBold',c.muted);
 text(p,title,143,y+3,12,'bold');paragraph(p,what,143,y-15,395,{size:9.2,leading:12});
 text(p,'DONE:',143,y-43,8.3,'bold');paragraph(p,done,183,y-43,355,{size:8.8,leading:11});rule(p,48,y-58,514);
}
rect(p,42,75,528,47,c.blue);text(p,'START SMALL',55,104,9,'bold');
paragraph(p,'Begin with bed, hamper and floor. Add books and clean clothes when those steps feel familiar.',55,88,497,{size:9.2,leading:12});

p=newPage('02 / Weekly care','My Weekly Bedroom Jobs','The daily reset keeps the room usable. Weekly care takes care of the rest.',c.green,2);
for(let i=0;i<rhythm.length;i++){const [name,title,detail]=rhythm[i],y=551-i*107;
 rect(p,42,y-31,528,86,c.ivory);rect(p,42,y+49,528,5,c.green);
 await icon(p,art(name),55,y-18,41);text(p,title,108,y+25,10,'bold');
 paragraph(p,detail,108,y+2,435,{size:10,leading:14});
}
rect(p,42,75,528,82,c.green);text(p,'OUR ROOM RESET TIMES',55,135,10,'bold');
text(p,'Daily reset time: _________________   Weekly care day: _______________',55,109,9.5);
text(p,'One job I own: ___________________   One job I need help with: ________',55,87,9.2);

p=newPage('03 / Family handoff','My Room, My Responsibility','Choose a repeatable plan. Age ranges are examples; match jobs to skills.',c.apricot,3);
for(let i=0;i<roles.length;i++){const [name,age,desc]=roles[i],x=42+(i%2)*269,y=547-Math.floor(i/2)*113;
 rect(p,x,y,259,100,c.ivory);rect(p,x,y+94,259,6,c.apricot);
 await icon(p,art(name),x+12,y+38,39);text(p,age,x+64,y+70,9,'bold');paragraph(p,desc,x+64,y+50,177,{size:8.5,leading:11.5});
}
text(p,'WHO OWNS THE RESET?',42,398,10,'bold');
paragraph(p,'Choose an owner and time. Younger children may share the job with a grown-up.',42,380,515,{size:9.1,leading:12});
rect(p,42,338,528,23,c.apricot);text(p,'JOB',55,346,8.8,'bold');text(p,'OWNER',275,346,8.8,'bold');text(p,'WHEN',458,346,8.8,'bold');
for(let i=0;i<habits.length;i++){const y=314-i*41;text(p,habits[i][1],55,y,9.2,'bold');
 rule(p,42,y-12,528);rect(p,265,y-12,.8,40,c.rule);rect(p,450,y-12,.8,40,c.rule);
}
rect(p,42,70,528,58,c.apricot);text(p,'AT OUR FAMILY MEETING',55,107,9,'bold');
paragraph(p,'Choose one easy first job. Practice together. Agree what done means. Check how it went next week.',55,88,495,{size:9.2,leading:12});

p=newPage('04 / Troubleshooting','When My Room Gets Messy Again','If the same pile returns, adjust the system instead of adding more reminders.',c.blush,4);
for(let i=0;i<issues.length;i++){const [name,title,fix]=issues[i],y=596-i*70;
 await icon(p,art(name),52,y-32,40);text(p,title,107,y,10.4,'bold');
 paragraph(p,fix,107,y-19,440,{size:9.4,leading:12});rule(p,48,y-49,516);
}
rect(p,42,85,528,77,c.ivory);text(p,'STORAGE AND CLEANING SAFETY',55,144,9.2,'bold');
paragraph(p,'Anchor furniture and shelving securely; keep heavy items low. Adults handle chemical cleaners, high storage, electrical equipment and donation decisions. Keep clear exits and walkways.',55,125,495,{size:9,leading:12.2});
const bytes=await pdf.save();if(pdf.getPageCount()!==4)throw Error('Expected exactly 4 pages');
await mkdir(dirname(dest),{recursive:true});await writeFile(dest,bytes);
console.log('Generated '+dest+' ('+bytes.length+' bytes; 4 US Letter pages)');
