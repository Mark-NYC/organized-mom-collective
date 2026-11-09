/** Four single-page mini guide PDFs, using existing OMC art and pdf-lib primitives. */
import {mkdir,writeFile} from 'node:fs/promises';
import {makeGuide} from './lib/omc-guide-pdf.mjs';
import {miniGuides} from './lib/kids-chores-mini-guides.mjs';
const art=n=>'public/assets/icons/ofc/guides/responsibility/'+n+'.png';
await mkdir('public/downloads',{recursive:true});
for(const guide of miniGuides){
 const {pdf,palette:c,text,paragraph,rect,rule,icon}=await makeGuide(guide.title+' | Organized Mom Collective');
 const page=pdf.addPage([612,792]),accent=c.green;
 rect(page,0,0,612,792,c.white);
 text(page,'ORGANIZED MOM COLLECTIVE',42,755,8.4,'bold');
 const bands=[c.blue,c.green,c.apricot];rect(page,42,740,528,6,bands[0]);
 text(page,guide.title.replace('How to Get Kids to Do Chores Without Constant Reminders','The Responsibility Handoff'),42,696,guide.slug.includes('without')?25:27,'serifBold');
 paragraph(page,guide.printableNote,42,677,528,{size:10.0,leading:13});
 const headings=guide.slug.includes('without')?['NAME THE JOB','PRACTICE THE HANDOFF','REVIEW TOGETHER']:['MY THINGS','SHARED SPACES','FAMILY TEAM'];
 for(let i=0;i<3;i++){
   const cat=guide.sections[i],x=42+i*179,y=372,w=170;
   rect(page,x,y,w,266,c.ivory);rect(page,x,y+261,w,5,bands[i]);
   await icon(page,art(cat.icon),x+9,y+218,36);
   text(page,headings[i],x+9,y+201,8.9,'bold');
   for(let j=0;j<cat.jobs.length;j++){
     const yy=y+175-j*27;
     rect(page,x+10,yy,8,8,c.white,c.rule);
     paragraph(page,cat.jobs[j],x+24,yy+1,137,{size:8.05,leading:9.7});
   }
 }
 rect(page,42,337,528,25,c.blush);text(page,guide.slug.includes('without')?'OUR ONE-JOB HANDOFF':'THIS WEEK: PRACTICE TWO REAL JOBS',55,346,9.1,'bold');
 if(guide.slug.includes('without')){
    text(page,'JOB: ____________________________________   OWNER: ___________________',50,311,9,'bold');
    text(page,'START CUE: __________________________________________________________',50,275,9,'bold');
    text(page,'FINISHED MEANS: _____________________________________________________',50,239,9,'bold');
    text(page,'SUPPORT OR SUPPLIES: _______________________________________________',50,203,9,'bold');
    text(page,'CHECK-IN DAY: __________________   WHAT WE WILL ASK: __________________',50,167,8.7,'bold');
 }else{
   text(page,'NAME: ___________________________________   WEEK OF: ________________',48,307,9,'bold');
   const days=['M','T','W','T','F','S','S'];
   days.forEach((d,i)=>text(page,d,294+i*37,278,9,'bold'));
   for(let r=0;r<2;r++){
     const y=235-r*70;
     text(page,guide.trackerLabels[r]+':',48,y+16,9,'bold');
     rule(page,145,y+13,132);
     text(page,'When: ___________________',48,y-4,8.6);
     for(let d=0;d<7;d++)rect(page,294+d*37,y,15,15,c.white,c.rule);
     rule(page,42,y-20,528);
   }
 }
 rect(page,42,63,528,54,c.ivory);text(page,'START SMALL',55,97,8.9,'bold');
 paragraph(page,guide.starterNote,55,81,494,{size:8.7,leading:11});
 rule(page,42,45);text(page,'SMALL HABITS. SHARED RESPONSIBILITY.',42,30,7.7,'bold');text(page,'organizedmomcollective.com',418,30,7.7,'regular',c.muted);
 if(pdf.getPageCount()!==1)throw new Error('Expected one-page PDF for '+guide.slug);
 await writeFile('public/downloads/'+guide.slug+'.pdf',await pdf.save());
 console.log('Generated one-page printable:',guide.slug);
}
