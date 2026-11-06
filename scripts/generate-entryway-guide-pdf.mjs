/** Four-page printable, actual US Letter PDF built with OMC's shared PDF primitives. */
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeGuide} from './lib/omc-guide-pdf.mjs';
import {habits,rhythm,roles,issues} from './lib/entryway-guide-content.mjs';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const dest=resolve('public/downloads/family-entryway-reset.pdf');
const {pdf,palette:c,text,paragraph,rect,rule,icon,newPage}=await makeGuide('The Family Entryway Reset | Organized Mom Collective',{runningTitle:'FAMILY ENTRYWAY RESET'});
const art=name=>'public/assets/icons/ofc/guides/entryway/'+name+'.png';
let p=newPage('01 / Coming home','A Place for Everything at the Door','Five tiny arrival habits keep the entryway usable without Mom collecting everything.',c.blue,1);
rect(p,42,575,528,48,c.ivory);text(p,'WHAT FINISHED LOOKS LIKE',55,605,9,'bold');
paragraph(p,'Shoes and coats have a home; bags are unpacked; lunch gear is in the kitchen and papers are seen.',55,587,501,{size:9.1,leading:12});
for(let i=0;i<habits.length;i++){const [name,title,what,done]=habits[i],y=548-i*86;
 await icon(p,art(name),52,y-30,43);text(p,String(i+1).padStart(2,'0'),101,y,14,'serifBold',c.muted);
 text(p,title,143,y+3,12.2,'bold');paragraph(p,what,143,y-16,402,{size:9.3,leading:12});
 text(p,'DONE:',143,y-43,8.3,'bold');paragraph(p,done,183,y-43,356,{size:8.8,leading:11});rule(p,48,y-59,514);
}
rect(p,42,76,528,47,c.blue);text(p,'FIRST WEEK',55,105,9,'bold');
paragraph(p,'Start with shoes and backpacks. Add papers and lunch gear after the first two jobs stick.',55,88,495,{size:9.5,leading:12});

p=newPage('02 / Daily and weekly','Two Short Resets','A home for each item, a time to put it there, and one family member who owns it.',c.green,2);
for(let i=0;i<rhythm.length;i++){const [name,title,detail]=rhythm[i],y=552-i*107;
 rect(p,42,y-31,528,86,c.ivory);rect(p,42,y+49,528,5,c.green);
 await icon(p,art(name),55,y-18,40);text(p,title,107,y+25,10,'bold');paragraph(p,detail,107,y+2,436,{size:10,leading:14});
}
rect(p,42,76,528,81,c.green);text(p,'OUR ENTRYWAY PLAN',55,135,10,'bold');
text(p,'Arrival reset time: ______________    Weekly check day: ______________',55,110,9.6);
text(p,'Paper pocket adult: _____________    Lunch gear landing spot: _________',55,88,9.2);

p=newPage('03 / Share the handoff','Our Family Entryway Team','Assign the five arrival jobs. Practice, then let everyone own their part.',c.apricot,3);
for(let i=0;i<roles.length;i++){const [name,age,desc]=roles[i],x=42+(i%2)*269,y=547-Math.floor(i/2)*113;
 rect(p,x,y,259,100,c.ivory);rect(p,x,y+94,259,6,c.apricot);
 await icon(p,art(name),x+12,y+38,39);text(p,age,x+64,y+71,9,'bold');
 paragraph(p,desc,x+64,y+51,177,{size:8.6,leading:11.5});
}
text(p,'ASSIGN THE FIVE ARRIVAL JOBS',42,398,10,'bold');
paragraph(p,'Put a name and a time beside each step. Younger children can share an adult owner.',42,380,515,{size:9.3,leading:12});
rect(p,42,338,528,23,c.apricot);text(p,'JOB',55,346,8.8,'bold');text(p,'OWNER',275,346,8.8,'bold');text(p,'WHEN',458,346,8.8,'bold');
for(let i=0;i<habits.length;i++){const y=314-i*41;text(p,habits[i][1],55,y,9.4,'bold');rule(p,42,y-12,528);
 rect(p,265,y-12,.8,40,c.rule);rect(p,450,y-12,.8,40,c.rule);
}
rect(p,42,70,528,58,c.apricot);text(p,'AT THE FAMILY MEETING',55,107,9,'bold');
paragraph(p,'Name the biggest drop zone. Choose one home for each item. Practice an arrival. Review next week.',55,88,498,{size:9.25,leading:12});

p=newPage('04 / When it piles up','Fix the Landing Spot','If the entryway keeps filling up, adjust the setup instead of repeating reminders.',c.blush,4);
for(let i=0;i<issues.length;i++){const [name,title,fix]=issues[i],y=596-i*70;
 await icon(p,art(name),52,y-32,40);text(p,title,107,y,10.4,'bold');
 paragraph(p,fix,107,y-19,440,{size:9.4,leading:12});rule(p,48,y-49,516);
}
rect(p,42,85,528,77,c.ivory);text(p,'SAFETY + SMALL SPACES',55,144,9.2,'bold');
paragraph(p,'Keep exits and doorways clear. Use stable, securely mounted hooks and shelves. Adults handle sharp objects, important forms and heavy overhead storage. Never block access to a door.',55,125,496,{size:9.2,leading:12.2});
const bytes=await pdf.save();if(pdf.getPageCount()!==4)throw Error('Expected four US Letter pages');
await mkdir(dirname(dest),{recursive:true});await writeFile(dest,bytes);
console.log('Generated '+dest+' ('+bytes.length+' bytes; four pages)');
