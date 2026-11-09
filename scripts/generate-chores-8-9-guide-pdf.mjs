/** Print-ready ages 8–9 mini-guide using OMC's established PDF drawing system and icons. */
import {mkdir,writeFile} from 'node:fs/promises';
import {makeGuide} from './lib/omc-guide-pdf.mjs';
import {categories,starter,weekly,safety} from './lib/chores-8-9-content.mjs';
const {pdf,palette:c,text,paragraph,rect,rule,icon,newPage}=await makeGuide('Chores for 8–9-Year-Olds | Organized Mom Collective',{runningTitle:'CHORES AGES 8-9'});
const art=n=>'public/assets/icons/ofc/guides/responsibility/'+n+'.png';
let p=newPage('01 / Find a good fit','A Few Real Jobs','At eight or nine, start with one daily job and one way to help the household. Practice together first.',c.blue,1);
for(let k=0;k<2;k++){const cat=categories[k],y=562-k*222;rect(p,42,y-166,528,198,c.ivory);rect(p,42,y+26,528,6,k?c.green:c.blue);await icon(p,art(cat.icon),54,y-22,48);text(p,cat.title,117,y+3,15,'serifBold');for(let i=0;i<cat.jobs.length;i++){text(p,'[  ] '+cat.jobs[i],64,y-52-i*22,9.5);}}
rect(p,42,62,528,55,c.blue);text(p,'START SMALL',55,97,9.5,'bold');paragraph(p,'Choose two realistic jobs. Independence grows through teaching, cues and practice.',55,79,500,{size:9.2,leading:12});
p=newPage('02 / Shared family jobs','We All Contribute','Family jobs work best when everyone knows what finished looks like.',c.green,2);
const cat=categories[2];await icon(p,art(cat.icon),48,549,55);text(p,cat.title,112,573,16,'serifBold');for(let i=0;i<cat.jobs.length;i++){const y=529-i*54;text(p,(i+1)+'. '+cat.jobs[i],65,y,11,'bold');rule(p,59,y-23,498);}
rect(p,42,117,528,78,c.ivory);text(p,'A NOTE ON READINESS AND SAFETY',55,174,9.5,'bold');paragraph(p,safety,55,153,491,{size:9.3,leading:12});
p=newPage('03 / Teach, cue, review','Hand Over One Job','The goal is not a perfect chart. It is a child who gradually owns one useful responsibility.',c.apricot,3);
for(let i=0;i<starter.length;i++){const [title,detail,artName]=starter[i],y=571-i*121;rect(p,42,y-87,528,105,c.ivory);rect(p,42,y+12,528,6,c.apricot);await icon(p,art(artName),54,y-43,49);text(p,(i+1)+'. '+title,117,y-9,12.5,'bold');paragraph(p,detail,117,y-29,419,{size:9.5,leading:13});}
rect(p,42,68,528,50,c.apricot);paragraph(p,'At the family meeting: What worked? What got stuck? What would make next week easier?',55,99,495,{size:10,leading:14});
p=newPage('04 / Print and practice','My Weekly Responsibility Plan','Start with 1 daily responsibility and 1 family job. Review together after one week.',c.blush,4);
rect(p,42,577,528,52,c.ivory);text(p,'MY NAME: ___________________________________',55,610,10,'bold');text(p,'WEEK OF: ___________________________________',55,587,10,'bold');
const days=['MON','TUE','WED','THU','FRI','SAT','SUN'];rect(p,42,526,528,32,c.blush);text(p,'MY JOB / WHEN',54,537,9,'bold');for(let d=0;d<7;d++)text(p,days[d],272+d*42,537,7.9,'bold');
for(let r=0;r<4;r++){const y=475-r*71;text(p,r===0?'Daily job':r===1?'Family job':r===2?'Practice job':'My choice',54,y+18,10,'bold');text(p,'When: ______________',54,y-4,8.8);for(let d=0;d<7;d++){rect(p,277+d*42,y,17,17,c.white,c.rule);}rule(p,42,y-20,528);}
rect(p,42,121,528,91,c.ivory);text(p,'WHAT DOES DONE LOOK LIKE?',55,187,9,'bold');rule(p,55,163,490);rule(p,55,142,490);
text(p,'FAMILY CHECK-IN: What worked? What would help?',55,98,9.3,'bold');rule(p,55,79,490);
await mkdir('public/downloads',{recursive:true});await writeFile('public/downloads/chores-for-8-9-year-olds.pdf',await pdf.save());if(pdf.getPageCount()!==4)throw Error('Expected four pages');
console.log('Generated printable ages 8–9 guide');
