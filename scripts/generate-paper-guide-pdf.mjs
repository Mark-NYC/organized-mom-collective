/** Four-page US Letter Family Paper Clutter Reset printable. */
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeGuide} from './lib/omc-guide-pdf.mjs';
import {habits,weekly,roles,issues} from './lib/paper-guide-content.mjs';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const destination=resolve('public/downloads/family-paper-clutter-reset.pdf');
const {pdf,palette:c,text,paragraph,rect,rule,icon,newPage}=await makeGuide('The Family Paper Clutter Reset | Organized Mom Collective',{runningTitle:'PAPER CLUTTER RESET'});
const art=n=>'public/assets/icons/ofc/guides/paper/'+n+'.png';
let p=newPage('01 / A clear counter','The Ten-Minute Paper Reset','Five small steps to turn the paper pile into decisions, not another chore.',c.blue,1);
rect(p,42,575,528,48,c.ivory);text(p,'FOUR DESTINATIONS',55,605,9,'bold');
paragraph(p,'ACTION: next step needed   KEEP: important record   RECYCLE: ordinary scraps   SHRED: sensitive paper',55,585,490,{size:8.8,leading:12});
for(let i=0;i<habits.length;i++){const [name,title,what,done]=habits[i],y=548-i*86;
 await icon(p,art(name),52,y-30,43);text(p,String(i+1).padStart(2,'0'),101,y,14,'serifBold',c.muted);
 text(p,title,143,y+3,11.5,'bold');paragraph(p,what,143,y-15,393,{size:8.8,leading:11});
 text(p,'DONE:',143,y-43,8.3,'bold');paragraph(p,done,183,y-43,350,{size:8.6,leading:10.5});rule(p,48,y-58,514);
}
rect(p,42,76,528,46,c.blue);text(p,'START SMALL',55,105,9,'bold');
paragraph(p,'Set a ten-minute timer. Sort what you can, then schedule another short session if the pile is large.',55,87,498,{size:9,leading:12});
p=newPage('02 / A paper home','One Simple Family Paper Station','One place for new papers, one place for work to do, one place for things going back out.',c.green,2);
const station=[
 ['basket','INBOX','School papers and mail land in one visible spot. Children can drop off papers; adults check them.'],
 ['papers','NEEDS ATTENTION','Only active forms, bills and tasks awaiting an adult decision belong here.'],
 ['folder','READY TO GO','Signed forms and papers to return go here or straight into the appropriate bag.'],
 ['calendar','KEEP + CALENDAR','Important records are filed; dates and deadlines are entered on the family calendar.']
];
for(let i=0;i<station.length;i++){const [name,title,desc]=station[i],y=550-i*107;
 rect(p,42,y-31,528,86,c.ivory);rect(p,42,y+49,528,5,c.green);
 await icon(p,art(name),55,y-17,40);text(p,title,109,y+25,10,'bold');paragraph(p,desc,109,y+2,432,{size:9.7,leading:13});
}
rect(p,42,78,528,80,c.green);text(p,'OUR FAMILY PAPER ROUTINE',55,135,9.5,'bold');
text(p,'Daily school-paper check: ____________  Weekly paper review: __________',55,110,9.0);
paragraph(p,'Adults own deadlines, sensitive documents, bills and decisions about what must be retained.',55,90,496,{size:9.2,leading:12});
p=newPage('03 / Family handoff','Our Family Paper Team','Kids can bring papers to the station. Adults own the decisions and deadlines.',c.apricot,3);
for(let i=0;i<roles.length;i++){const [name,age,desc]=roles[i],x=42+(i%2)*269,y=547-Math.floor(i/2)*113;
 rect(p,x,y,259,100,c.ivory);rect(p,x,y+94,259,6,c.apricot);
 await icon(p,art(name),x+12,y+39,39);text(p,age,x+64,y+70,9,'bold');paragraph(p,desc,x+64,y+50,177,{size:8.4,leading:11.3});
}
text(p,'WHO OWNS EACH PAPER HANDOFF?',42,398,10,'bold');
paragraph(p,'Write names and times for your family. One adult can own more than one decision.',42,380,515,{size:9,leading:12});
rect(p,42,338,528,23,c.apricot);text(p,'JOB',55,346,8.8,'bold');text(p,'OWNER',275,346,8.8,'bold');text(p,'WHEN',458,346,8.8,'bold');
const jobs=['Bring school papers in','Adult checks the inbox','Update dates + sign forms','File important records','Return forms + clear scraps'];
for(let i=0;i<jobs.length;i++){const y=314-i*41;text(p,jobs[i],55,y,8.8,'bold');rule(p,42,y-12,528);
 rect(p,265,y-12,.8,40,c.rule);rect(p,450,y-12,.8,40,c.rule);}
rect(p,42,70,528,58,c.apricot);text(p,'AT OUR FAMILY MEETING',55,107,9,'bold');
paragraph(p,'Show where papers land, who checks them, and where signed forms go. Review after one week.',55,88,492,{size:9.2,leading:12});
p=newPage('04 / Troubleshooting','When Paper Piles Return','Fix the place, the deadline or the handoff instead of adding more reminders.',c.blush,4);
for(let i=0;i<issues.length;i++){const [name,title,fix]=issues[i],y=593-i*70;
 await icon(p,art(name),52,y-31,42);text(p,title,107,y,10.4,'bold');
 paragraph(p,fix,107,y-18,437,{size:9.1,leading:12});rule(p,48,y-48,516);
}
rect(p,42,83,528,84,c.ivory);text(p,'KEEP PRIVATE INFORMATION PRIVATE',55,148,9,'bold');
paragraph(p,'Adults decide what to retain and what to shred. Secure paperwork containing addresses, medical or financial details, and account numbers. Check relevant record-retention needs before discarding.',55,129,497,{size:9.1,leading:12});
const bytes=await pdf.save();await mkdir(dirname(destination),{recursive:true});await writeFile(destination,bytes);
if(pdf.getPageCount()!==4)throw Error('Expected four pages');
console.log('Generated '+destination+' ('+bytes.length+' bytes; four US Letter pages)');
