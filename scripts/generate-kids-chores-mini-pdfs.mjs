/** Four single-page mini guide PDFs, using existing OMC art and pdf-lib primitives. */
import {mkdir,writeFile} from 'node:fs/promises';
import {makeGuide} from './lib/omc-guide-pdf.mjs';
import {miniGuides} from './lib/kids-chores-mini-guides.mjs';
const art=n=>'public/assets/icons/ofc/guides/responsibility/'+n+'.png';
await mkdir('public/downloads',{recursive:true});
for(const guide of miniGuides){
 // Editorial edition 01: ages 4-5. Preserve one-page US Letter and existing OMC icons.
 // The guide webpage retains all 18 chore ideas; the printable prioritizes two real jobs.
 if(guide.slug==='chores-for-4-5-year-olds'){
  const {pdf,palette:c,text,paragraph,rect,rule,icon}=await makeGuide(
   'My First Responsibilities | Organized Mom Collective',
   {runningTitle:'MY FIRST RESPONSIBILITIES'}
  );
  const p=pdf.addPage([612,792]);
  rect(p,0,0,612,792,c.white);
  // Quiet magazine-style masthead. No giant color blocks or rounded cards.
  text(p,'ORGANIZED MOM COLLECTIVE',44,755,9,'bold');
  text(p,'FAMILY PRINTABLES  /  AGES 4-5',402,755,8,'regular',c.muted);
  rect(p,44,740,524,2,c.green);
  text(p,'LITTLE HANDS. REAL HELP.',44,714,8.4,'bold',c.muted);
  text(p,'My First',44,672,31,'serifBold');
  text(p,'Responsibilities',44,636,31,'serifBold');
  paragraph(p,'Two little jobs. One week to practice. A big first step in helping at home.',45,610,500,{size:10.25,leading:14.5});
  // Feature a single existing hand-drawn illustration with a calm editorial sidebar.
  rect(p,44,470,137,119,c.ivory);
  await icon(p,art('hands'),64,482,98);
  rect(p,204,477,3,98,c.blue);
  text(p,'Start together',220,560,17,'serifBold');
  paragraph(p,'At this age, the goal is learning to join in, not getting every job perfect.',220,536,337,{size:10,leading:15});
  paragraph(p,'Show it, practice side by side, then let your child have a turn.',220,489,336,{size:10,leading:15});
  // A short menu instead of three repetitive filled cards.
  text(p,'CHOOSE TWO JOBS TO TRY',44,445,9.5,'bold');
  text(p,'These are ideas, not a checklist to finish.',300,445,8.8,'regular',c.muted);
  rule(p,44,435,524);
  const left=[
   'Shoes in their spot',
   'Toys into a basket',
   'Books back on the shelf',
   'Pajamas into the hamper'
  ];
  const right=[
   'Napkins on the table',
   'Match clean socks',
   'Water a plant with help',
   'Bring a plate to the counter'
  ];
  for(let i=0;i<4;i++){
   const y=411-i*25;
   rect(p,47,y-2,10,10,c.white,c.rule);
   text(p,left[i],66,y,9.5,'regular');
   rect(p,307,y-2,10,10,c.white,c.rule);
   text(p,right[i],327,y,9.5,'regular');
  }
  // The actual artifact is the weekly plan, given most of the bottom half.
  rect(p,44,292,524,2,c.blue);
  text(p,'Our week of practice',44,264,21,'serifBold');
  text(p,'Name: __________________________',45,240,9.6);
  text(p,'Week of: ___________________',349,240,9.6);
  const days=['M','T','W','T','F','S','S'];
  for(let j=0;j<2;j++){
   const y=j===0?208:153;
   text(p,j===0?'01  MY LITTLE JOB':'02  MY HELPING JOB',45,y,8.8,'bold');
   text(p,'_______________________________',246,y,9);
   text(p,'When we do it: ______________________________',45,y-20,9.2);
   days.forEach((d,i)=>{
    const x=282+i*40;
    text(p,d,x+3,y-20,8,'bold',c.muted);
    rect(p,x,y-43,14,14,c.white,c.rule);
   });
   rule(p,44,y-51,524);
  }
  rect(p,44,58,3,37,c.apricot);
  text(p,'A LITTLE NOTE FOR GROWN-UPS',58,85,8.8,'bold');
  paragraph(p,'Keep it short. Show what finished looks like, notice the effort, and practice again tomorrow. Grown-up help counts.',58,67,491,{size:8.7,leading:11});
  rule(p,44,43,524);
  text(p,'SMALL HABITS. SHARED RESPONSIBILITY.',44,27,8,'bold');
  text(p,'organizedmomcollective.com',420,27,7.6,'regular',c.muted);
  if(pdf.getPageCount()!==1)throw new Error('Expected one page for first responsibilities');
  await writeFile('public/downloads/'+guide.slug+'.pdf',await pdf.save());
  console.log('Generated premium editorial one-page printable:',guide.slug);
  continue;
 }
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
