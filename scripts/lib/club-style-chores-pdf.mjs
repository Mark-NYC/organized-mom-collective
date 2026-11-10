/**
 * Five OMC one-page printables, rebuilt from approved Club-style layouts.
 * Source copy stays in the guide content modules; no flattened AI images in downloadable PDFs.
 * US Letter portrait, selectable vector text, existing transparent hand-drawn illustration assets.
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {makeGuide,color} from './omc-guide-pdf.mjs';
import {miniGuides} from './kids-chores-mini-guides.mjs';
import {categories as eightCategories} from './chores-8-9-content.mjs';

const ink=color('#373735'),softBlue=color('#E5EFEE');
const paleGreen=color('#F2F2E3'),paleBlush=color('#F9EBE7');
const cardTints=[color('#EAF2F2'),color('#F3F2E4'),color('#FBECE0')];
const handDrawn=n=>'public/assets/icons/ofc/guides/responsibility/'+n+'.png';

const ageGuides={
 'chores-for-4-5-year-olds':{
   lines:['Chores for','4–5-Year-Olds'], subtitle:'First Responsibilities for Little Helpers',
   intro:'Kids this age can join in with short, simple tasks. They need practice with a grown-up.',
   bullets:['Practice together','Choose 1–2 small jobs','Use one clear routine cue','Notice effort and progress'],
   labels:['My Things','Helping at Home','With a Grown-Up'], bottom:'My First Responsibilities',
   icons:['backpack','basket','hands']
 },
 'chores-for-6-7-year-olds':{
   lines:['Chores for','6–7-Year-Olds'], subtitle:'Simple Daily Responsibilities for Growing Independence',
   intro:'Kids can begin remembering familiar jobs with visual cues and a predictable routine.',
   bullets:['Pick 2 useful jobs','Show what done means','Attach it to a routine','Review together each week'],
   labels:['Morning & Evening','After-School Reset','Family Contributions'],bottom:'My Daily Responsibilities',
   icons:['clock','backpack','dish']
 },
 'chores-for-8-9-year-olds':{
   lines:['Chores for','8–9-Year-Olds'], subtitle:'Age-Appropriate Responsibilities for Growing Independence',
   intro:'Kids can take on multi-step routines and regular household jobs with teaching and support.',
   bullets:['Teach the task and show what done looks like','Choose 2–3 consistent responsibilities','Use a simple routine cue','Praise follow-through and effort'],
   labels:['Personal Responsibilities','Around the House','Family Contributions'],bottom:'My Weekly Responsibilities',
   icons:['backpack','basket','dish']
 },
 'chores-for-10-12-year-olds':{
   lines:['Chores for','10–12-Year-Olds'], subtitle:'Growing Independence and Real Household Contribution',
   intro:'Preteens can begin owning complete responsibilities with clear expectations and support.',
   bullets:['Agree on the whole job','Teach safe skills first','Give room to own it','Review together weekly'],
   labels:['Personal Ownership','Shared Household Care','Meal & Family Team'],bottom:'My Responsibility Planner',
   icons:['clipboard','basket','dish']
 },
 'kids-chores-without-reminders':{
   lines:["Kids' Chores Without",'Constant Reminders'],subtitle:'The Responsibility Handoff',
   intro:'Vague jobs and repeated prompting keep adults managing the mental load. Clear ownership and practice help.',
   bullets:['Choose one real job','Set a clear cue','Define what done means','Review it next week'],
   labels:['Name the Job','Practice the Handoff',"Review, Don't Nag"],
   bottom:'The Responsibility Handoff',icons:['clipboard','hands','calendar']
 }
};

function rounded(p,x,y,w,h,r,fill) {
  // Four discs + two rectangles create true vector rounded corners.
  p.drawRectangle({x:x+r,y,width:w-2*r,height:h,color:fill});
  p.drawRectangle({x,y:y+r,width:w,height:h-2*r,color:fill});
  for(const cx of [x+r,x+w-r])for(const cy of [y+r,y+h-r])
    p.drawEllipse({x:cx,y:cy,xScale:r,yScale:r,color:fill});
}
const bulletSquare=(p,x,y,ruleColor)=>{
 p.drawRectangle({x,y,width:10,height:10,color:color('#FFFFFF'),borderColor:ruleColor,borderWidth:0.9});
};
function wordsIn(s,wrap,size,width){return wrap(s,'regular',size,width)}
function linesInBox(p,s,x,top,w,h,wrap,text,size=8.6,leading=10.9){
 const rows=wordsIn(s,wrap,size,w);
 if(rows.length>2)throw new Error('Too many wrapped lines for "'+s+'": '+rows.length);
 if(top-(rows.length-1)*leading<h)throw new Error('Text collision: '+s);
 rows.forEach((row,j)=>text(p,row,x,top-j*leading,size));
}
async function build(guide){
 const {pdf,palette:c,text,wrap,paragraph,icon,rule}=await makeGuide(guide.title+' | Organized Mom Collective');
 const p=pdf.addPage([612,792]);
 const design=ageGuides[guide.slug];
 const noReminders=guide.slug==='kids-chores-without-reminders';
 if(!design)throw new Error('No approved design: '+guide.slug);
 p.drawRectangle({x:0,y:0,width:612,height:792,color:c.white});

 // Quiet masthead and large high-contrast Georgia-like serif typography.
 p.drawLine({start:{x:205,y:765},end:{x:246,y:765},thickness:.55,color:c.ink});
 p.drawLine({start:{x:465,y:765},end:{x:506,y:765},thickness:.55,color:c.ink});
 text(p,'ORGANIZED MOM COLLECTIVE',256,759,10,'serif');
 const titleSize=noReminders?29:35;
 text(p,design.lines[0],43,707,titleSize,'serifBold');
 text(p,design.lines[1],43,671,titleSize,'serifBold');
 // This blue strip is intentionally restrained, like the approved mockup's watercolor subtitle.
 rounded(p,44,636,524,23,11,softBlue);
 text(p,design.subtitle,54,643,10.1,'serif');

 // Intro and teaching notes, pale organic Club-style blocks.
 rounded(p,43,507,205,111,13,paleGreen);
 rounded(p,260,507,309,111,13,paleBlush);
 text(p,noReminders?"WHY REMINDERS DON'T STICK":'AT THIS AGE...',56,593,noReminders?11.4:13.0,'serifBold');
 const introLines=wrap(design.intro,'regular',9.6,177);
 if(introLines.length>5)throw new Error('Intro overflows for '+guide.slug);
 introLines.forEach((l,i)=>text(p,l,56,571-i*13.2,9.6));
 text(p,noReminders?'HOW TO HAND OFF A JOB':'HOW TO BUILD OWNERSHIP',272,591,13.5,'serifBold');
 design.bullets.forEach((item,i)=>{
   const y=568-i*17;
   bulletSquare(p,273,y-3,c.ink);
   const rows=wrap(item,'regular',8.9,267);
   if(rows.length>1)text(p,rows.join(' '),289,y,8.2); else text(p,item,289,y,8.9);
 });

 // Three colored chore/action cards. All lists are editorial text, not flattened imagery.
 const sectionTitle=noReminders?'BUILD RESPONSIBILITY STEP BY STEP':'CHORE IDEAS TO CHOOSE FROM';
 p.drawLine({start:{x:44,y:484},end:{x:158,y:484},thickness:.7,color:c.ink});
 text(p,sectionTitle,noReminders?162:164,476,noReminders?12.5:16.8,'serifBold');
 p.drawLine({start:{x:noReminders?463:427,y:484},end:{x:568,y:484},thickness:.7,color:c.ink});
 const data=noReminders?guide.sections:guide.sections;
 for(let i=0;i<3;i++){
  const x=43+i*178,w=169,cat=data[i];
  rounded(p,x,209,w,250,14,cardTints[i]);
  await icon(p,handDrawn(design.icons[i]),x+115,407,43);
  const labelLines=wrap(design.labels[i],'serifBold',12.8,145);
  labelLines.forEach((line,j)=>text(p,line,x+11,420-j*15,12.8,'serifBold'));
  for(let j=0;j<cat.jobs.length;j++){
    const y=365-j*25;
    bulletSquare(p,x+12,y-1,c.ink);
    linesInBox(p,cat.jobs[j],x+28,y+1,132,y-22,wrap,text,8.0,10);
  }
 }

 // Lower practical planner is what makes the resource actually useful on a fridge.
 rounded(p,43,58,526,132,15,paleBlush);
 await icon(p,handDrawn(noReminders?'clipboard':'calendar'),54,94,63);
 text(p,design.bottom,130,158,noReminders?17:18.5,'serifBold');
 if(noReminders){
  const rows=[['JOB',''],['OWNER',''],['START CUE',''],['FINISHED MEANS',''],['CHECK-IN DAY','']];
  rows.forEach(([label],i)=>{
   const y=137-i*17.5;
   text(p,label,131,y,8.2,'bold');
   p.drawLine({start:{x:251,y:y-1},end:{x:552,y:y-1},thickness:.7,color:c.ink});
  });
 }else{
  const days=['M','T','W','T','F','S','S'];
  days.forEach((d,i)=>text(p,d,398+i*23,144,8.5,'bold'));
  for(let r=0;r<2;r++){
   const y=114-r*32;
   bulletSquare(p,130,y-1,c.ink);
   p.drawLine({start:{x:147,y:y+2},end:{x:375,y:y+2},thickness:.75,color:c.ink});
   for(let i=0;i<7;i++)bulletSquare(p,397+i*23,y-1,c.ink);
  }
 }
 text(p,'ORGANIZED MOM COLLECTIVE  |  SMALL HABITS. SHARED RESPONSIBILITY.',44,34,7.2,'bold',c.muted);
 const name=guide.slug+'.pdf';
 if(pdf.getPageCount()!==1)throw new Error('Expected one page for '+guide.slug);
 const bytes=await pdf.save();
 if(bytes.length<7000)throw new Error('Suspiciously small printable: '+name);
 await writeFile('public/downloads/'+name,bytes);
 console.log('Created '+name+' ('+bytes.length+' bytes, 1 page)');
}
export async function generateMiniClubChorePrintables(){
 await mkdir('public/downloads',{recursive:true});
 for(const guide of miniGuides)await build(guide);
}
export async function generateEightClubChorePrintable(){
 await mkdir('public/downloads',{recursive:true});
 await build({slug:'chores-for-8-9-year-olds',title:'Chores for 8–9-Year-Olds',sections:eightCategories});
}
