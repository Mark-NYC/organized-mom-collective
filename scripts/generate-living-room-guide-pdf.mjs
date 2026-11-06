/** Four-page US Letter Family Living Room Reset PDF, original OMC line-art icons. */
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeGuide} from './lib/omc-guide-pdf.mjs';
import {habits,weekly,roles,issues} from './lib/living-room-guide-content.mjs';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const destination=resolve('public/downloads/family-living-room-reset.pdf');
const {pdf,palette:c,text,paragraph,rect,rule,icon,newPage}=await makeGuide('The Family Living Room Reset | Organized Mom Collective',{runningTitle:'LIVING ROOM RESET'});
const art=n=>'public/assets/icons/ofc/guides/living-room/'+n+'.png';
let p=newPage('01 / Daily reset','Our Five-Minute Living Room Reset','Five small steps everyone can learn before winding down for the evening.',c.blue,1);
rect(p,42,575,528,48,c.ivory);text(p,'WHAT DONE LOOKS LIKE',55,605,9,'bold');
paragraph(p,'Toys, books, blankets and dishes are back in place. Shared surfaces and paths are usable.',55,587,495,{size:9.2,leading:12});
for(let i=0;i<habits.length;i++){const [name,title,what,done]=habits[i],y=548-i*86;
 await icon(p,art(name),52,y-30,43);text(p,String(i+1).padStart(2,'0'),101,y,14,'serifBold',c.muted);
 text(p,title,143,y+3,11.8,'bold');paragraph(p,what,143,y-15,394,{size:9.2,leading:12});
 text(p,'DONE:',143,y-43,8.3,'bold');paragraph(p,done,183,y-43,355,{size:8.7,leading:10.5});rule(p,48,y-58,514);
}
rect(p,42,75,528,47,c.blue);text(p,'START SMALL',55,104,9,'bold');
paragraph(p,'Begin with toys, dishes and a clear walkway. Add books and blankets when those feel easy.',55,88,499,{size:9.2,leading:12});
p=newPage('02 / Weekly care','Our Weekly Shared-Space Jobs','Daily resets keep things usable. These six jobs prevent the bigger buildup.',c.green,2);
for(let i=0;i<weekly.length;i++){const [name,title,detail]=weekly[i],x=42+(i%2)*269,y=507-Math.floor(i/2)*149;
 rect(p,x,y,259,136,c.ivory);rect(p,x,y+130,259,6,c.green);
 await icon(p,art(name),x+12,y+72,44);
 paragraph(p,title,x+66,y+104,181,{size:10,leading:12,font:'bold'});
 paragraph(p,detail,x+13,y+65,230,{size:9.1,leading:12});
}
rect(p,42,78,528,80,c.green);text(p,'OUR RESET TIMES',55,134,9.5,'bold');
text(p,'Five-minute reset: ________________   Weekly care: _______________',55,110,9.4);
paragraph(p,'Choose one or two weekly jobs per family member. Nobody needs to do all six at once.',55,90,500,{size:9,leading:11});
p=newPage('03 / Shared ownership','Our Family Living Room Team','Give each person one clear job and practice what finished looks like.',c.apricot,3);
for(let i=0;i<roles.length;i++){const [name,age,desc]=roles[i],x=42+(i%2)*269,y=547-Math.floor(i/2)*113;
 rect(p,x,y,259,100,c.ivory);rect(p,x,y+94,259,6,c.apricot);
 await icon(p,art(name),x+12,y+39,39);text(p,age,x+64,y+70,9,'bold');paragraph(p,desc,x+64,y+50,179,{size:8.4,leading:11.5});
}
text(p,'WHO OWNS THE DAILY RESET?',42,398,10,'bold');
paragraph(p,'Write in names and times. Younger children can work alongside an adult.',42,380,515,{size:9,leading:12});
rect(p,42,338,528,23,c.apricot);text(p,'JOB',55,346,8.8,'bold');text(p,'OWNER',275,346,8.8,'bold');text(p,'WHEN',458,346,8.8,'bold');
for(let i=0;i<habits.length;i++){const y=314-i*41;text(p,habits[i][1],55,y,8.9,'bold');rule(p,42,y-12,528);
 rect(p,265,y-12,.8,40,c.rule);rect(p,450,y-12,.8,40,c.rule);
}
rect(p,42,70,528,58,c.apricot);text(p,'AT OUR FAMILY MEETING',55,107,9,'bold');
paragraph(p,'Notice where the mess returns. Choose owners. Show the steps. Review what worked next week.',55,88,490,{size:9.1,leading:12});
p=newPage('04 / Troubleshooting','When Shared Spaces Get Messy Again','Fix the place or the handoff instead of adding another reminder.',c.blush,4);
for(let i=0;i<issues.length;i++){const [name,title,fix]=issues[i],y=593-i*70;
 await icon(p,art(name),52,y-31,42);text(p,title,107,y,10.3,'bold');
 paragraph(p,fix,107,y-18,440,{size:9.2,leading:12});rule(p,48,y-48,516);
}
rect(p,42,82,528,86,c.ivory);text(p,'SHARED-SPACE SAFETY',55,148,9,'bold');
paragraph(p,'Keep exits and walking paths clear. Anchor unstable shelves and heavy storage. Adults handle cleaning chemicals, cords and electronics. Do not spray cleaners directly on devices; follow product instructions.',55,129,497,{size:9.1,leading:12});
const bytes=await pdf.save();await mkdir(dirname(destination),{recursive:true});await writeFile(destination,bytes);
if(pdf.getPageCount()!==4)throw Error('Expected four pages');
console.log('Generated '+destination+' ('+bytes.length+' bytes, four letter pages)');
