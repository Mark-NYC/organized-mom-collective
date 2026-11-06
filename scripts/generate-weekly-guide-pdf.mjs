/** Four-page US Letter weekly family reset reference and working worksheets. */
import {mkdir,writeFile} from 'node:fs/promises';
import {makeGuide} from './lib/omc-guide-pdf.mjs';
import {agenda,check,jobs,issues,familyPrompt} from './lib/weekly-guide-content.mjs';
const {pdf,palette:c,text,paragraph,rect,rule,icon,newPage}=await makeGuide('The Family Weekly Reset | Organized Mom Collective',{runningTitle:'FAMILY WEEKLY RESET'});
const art=n=>'public/assets/icons/ofc/guides/weekly/'+n+'.png';
let p=newPage('01 / The agenda','Our 15-Minute Family Weekly Reset','A short logistics check, not another long family meeting.',c.blue,1);
rect(p,42,570,528,53,c.ivory);text(p,'BRING YOUR FAMILY CALENDAR',55,603,9,'bold');paragraph(p,'A regular time works best, but Sunday is not required. Use the same five steps each week.',55,584,493,{size:9,leading:12});
for(let i=0;i<agenda.length;i++){const [a,title,minutes,detail]=agenda[i],y=547-i*85;
 await icon(p,art(a),52,y-31,42);text(p,minutes,104,y+2,9.5,'bold');text(p,title,155,y+2,10.7,'bold');paragraph(p,detail,155,y-19,388,{size:9.3,leading:12});rule(p,48,y-57,515);
}
rect(p,42,81,528,54,c.blue);text(p,'THEN STOP',55,115,9,'bold');paragraph(p,'Write the agreed owners and details on the shared calendar. Save deeper conversations for the separate Family Meeting.',55,97,492,{size:9,leading:12});

p=newPage('02 / Seven days','A Week Everyone Can See','This is a meeting worksheet. The actual schedule stays on your family calendar.',c.green,2);
for(let i=0;i<check.length;i++){const [a,title,detail]=check[i],y=593-i*84;
 await icon(p,art(a),52,y-31,40);text(p,title,106,y+4,10.6,'bold');paragraph(p,detail,106,y-16,433,{size:9,leading:12});rule(p,48,y-50,514);
}
rect(p,42,101,528,70,c.green);text(p,'THIS WEEK’S ONE PRIORITY',55,148,9,'bold');text(p,'_____________________________________________________________',55,124,9.2);
paragraph(p,'What needs to happen, and when will we see it on the calendar?',55,110,492,{size:8.9,leading:11});

p=newPage('03 / Ownership','Everyone Knows Their Part','Put a name beside the task. Ownership includes noticing and following through.',c.apricot,3);
for(let i=0;i<jobs.length;i++){const [a,title,detail]=jobs[i],x=42+(i%2)*269,y=540-Math.floor(i/2)*120;
 rect(p,x,y,259,109,c.ivory);rect(p,x,y+103,259,6,c.apricot);await icon(p,art(a),x+12,y+63,38);
 text(p,title,x+12,y+47,8.4,'bold');paragraph(p,detail,x+12,y+29,232,{size:8.2,leading:10.5});
}
text(p,'OUR FAMILY HANDOFFS THIS WEEK',42,388,10.2,'bold');paragraph(p,'Choose fewer jobs and make sure each has a clear finish.',42,370,510,{size:9,leading:12});
rect(p,42,334,528,23,c.apricot);text(p,'WHAT NEEDS DOING',55,341,8.4,'bold');text(p,'OWNER',275,341,8.4,'bold');text(p,'WHEN',460,341,8.4,'bold');
const tasks=['Rides + school handoffs','Dinner plan + groceries','Household priority','One-time school or home task','Prepare for a busy day'];
for(let i=0;i<tasks.length;i++){const y=310-i*40;text(p,tasks[i],55,y,8.6,'bold');rule(p,42,y-12,528);rect(p,265,y-12,1,39,c.rule);rect(p,453,y-12,1,39,c.rule);}
rect(p,42,76,528,49,c.apricot);text(p,'OUR QUESTION',55,105,9,'bold');paragraph(p,familyPrompt,55,88,490,{size:10,leading:12});

p=newPage('04 / Real weeks','When the Weekly Reset Falls Apart','A lighter reset is better than abandoning the habit.',c.blush,4);
for(let i=0;i<issues.length;i++){const [a,title,detail]=issues[i],y=597-i*73;await icon(p,art(a),52,y-31,41);text(p,title,108,y,10.5,'bold');paragraph(p,detail,108,y-20,433,{size:9,leading:12});rule(p,48,y-51,514);}
rect(p,42,80,528,86,c.ivory);text(p,'FIVE-MINUTE RESCUE RESET',55,146,9,'bold');paragraph(p,'Check important dates, resolve rides, choose the next dinners and give loose ends an owner. Put it on the calendar. You can do the full routine next week.',55,127,492,{size:9.1,leading:12});
await mkdir('public/downloads',{recursive:true});await writeFile('public/downloads/family-weekly-reset.pdf',await pdf.save());
if(pdf.getPageCount()!==4)throw Error('Weekly reset PDF must have 4 pages');
console.log('Generated four-page Family Weekly Reset');
