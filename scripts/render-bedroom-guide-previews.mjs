/** Four branded visual page previews from the Bedroom Reset's canonical text.
 * These are matching visual previews, not claims of pixel-perfect PDF screenshots.
 */
import sharp from 'sharp';
import {readFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {habits,rhythm,roles,issues} from './lib/bedroom-guide-content.mjs';
const folder=resolve('public/assets/icons/ofc/guides/bedroom'),out=resolve('public/images/guides');
const ink='#545454',rule='#D8D1CB',ivory='#FBF7F1',accents=['#CDDDE1','#D4DFC4','#F1D8A8','#E8D2D6'];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const rect=(x,y,w,h,fill)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+fill+'"/>';
const text=(x,y,s,size=10,bold=false,serif=false)=>'<text x="'+x+'" y="'+y+'" fill="'+ink+'" font-family="'+(serif?'Georgia,serif':'Arial,sans-serif')+'" font-size="'+size+'" font-weight="'+(bold?700:400)+'">'+esc(s)+'</text>';
function lines(x,y,value,max=60,size=9,leading=13){
 const words=value.split(' '),rows=[''];for(const w of words){let i=rows.length-1,v=rows[i]?rows[i]+' '+w:w;if(v.length>max&&rows[i])rows.push(w);else rows[i]=v;}
 return rows.map((r,i)=>text(x,y+i*leading,r,size)).join('');
}
const cached={};async function icon(name,x,y,size=45){
 if(!cached[name])cached[name]='data:image/png;base64,'+(await readFile(join(folder,name+'.png'))).toString('base64');
 return '<image x="'+x+'" y="'+y+'" width="'+size+'" height="'+size+'" href="'+cached[name]+'"/>';
}
function base(i,kicker,title,sub){
 return rect(0,0,612,792,'white')+text(42,31,'ORGANIZED MOM COLLECTIVE',8.5,true)+text(407,31,'KIDS BEDROOM RESET / '+i+' OF 4',7.4)+rect(42,42,528,6,accents[i-1])+text(42,72,kicker,9,true)+text(42,108,title,26,true,true)+lines(42,133,sub,85,10,14)+rect(42,756,528,1,rule)+text(42,775,'SMALL HABITS. SHARED RESPONSIBILITY.',7.6,true)+text(425,775,'organizedmomcollective.com',7.4);
}
async function p1(){
 let s=base(1,'01 / COMING HOME','My Five-Minute Bedroom Reset','Five small habits kids can learn and repeat each day.');
 s+=rect(42,162,528,53,ivory)+text(55,182,'WHAT FINISHED LOOKS LIKE',9,true)+lines(55,200,'Bed made, clothes sorted, toys home, and floor mostly clear.',87,9.2);
 for(let i=0;i<habits.length;i++){const [art,title,what,done]=habits[i],y=237+i*84;
 s+=await icon(art,52,y,44)+text(104,y+18,String(i+1).padStart(2,'0'),15,false,true)+text(141,y+15,title,11.8,true)+lines(141,y+34,what,69,9.1)+text(141,y+61,'DONE: '+done,8.5)+rect(48,y+69,515,1,rule);}
 s+=rect(42,682,528,63,accents[0])+text(55,704,'FIRST WEEK',9,true)+lines(55,724,'Start with bed, hamper and floor. Add toys and clean clothes next.',91,9);
 return s;
}
async function p2(){
 let s=base(2,'02 / DAILY AND WEEKLY','Daily and Weekly Bedroom Care','One quick daily reset and a small weekly room-care rhythm.');
 for(let i=0;i<rhythm.length;i++){const [art,title,desc]=rhythm[i],y=166+i*108;
 s+=rect(42,y,528,92,ivory)+rect(42,y,528,5,accents[1])+await icon(art,55,y+23,43)+text(107,y+37,title,10,true)+lines(107,y+59,desc,78,9.5);}
 s+=rect(42,631,528,115,accents[1])+text(55,654,'OUR BEDROOM PLAN',10,true)+text(55,684,'Daily reset time: _______________     Weekly care day: _____________',9.6)+text(55,714,'A job I own: __________________    A job I need help with: __________',9.5);
 return s;
}
async function p3(){
 let s=base(3,'03 / SHARE RESPONSIBILITY','My Room, My Responsibility','Choose jobs kids can do and practice with an adult first.');
 for(let i=0;i<roles.length;i++){const [art,age,desc]=roles[i],x=42+(i%2)*269,y=163+Math.floor(i/2)*118;
 s+=rect(x,y,259,104,ivory)+rect(x,y,259,6,accents[2])+await icon(art,x+12,y+35,42)+text(x+64,y+30,age,9,true)+lines(x+64,y+53,desc,34,8.6,11.5);}
 s+=text(42,438,'ASSIGN THE FIVE ROOM JOBS',10.7,true)+lines(42,460,'Choose an owner, a time, and a clear definition of done.',95,9.2)+rect(42,484,528,25,accents[2])+text(55,501,'JOB',9,true)+text(275,501,'OWNER',9,true)+text(461,501,'WHEN',9,true);
 for(let i=0;i<habits.length;i++){const y=514+i*38;s+=text(55,y+22,habits[i][1],9.1)+rect(42,y+34,528,1,rule)+rect(265,y,1,36,rule)+rect(450,y,1,36,rule);}
 s+=rect(42,714,528,32,accents[2])+text(55,735,'SHOW  /  PRACTICE  /  HAND OVER',9.3,true);return s;
}
async function p4(){
 let s=base(4,'04 / TROUBLESHOOTING','When My Room Gets Messy Again','A small setup change can solve a repeating pile.');
 for(let i=0;i<issues.length;i++){const [art,title,fix]=issues[i],y=169+i*70;
 s+=await icon(art,52,y+2,42)+text(107,y+16,title,10.7,true)+lines(107,y+37,fix,78,9.2)+rect(48,y+58,516,1,rule);}
 s+=rect(42,619,528,124,ivory)+text(55,641,'ROOM SAFETY',10,true)+lines(55,667,'Anchor furniture; keep heavy things low. Adults handle cleaning chemicals and high shelves.',97,9.6,14);
 return s;
}
await mkdir(out,{recursive:true});
for(const [i,fn] of [p1,p2,p3,p4].entries()){
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1424" viewBox="0 0 612 792">'+await fn()+'</svg>';
 const path=join(out,'bedroom-guide-page-'+(i+1)+'.webp');
 await sharp(Buffer.from(svg)).webp({quality:92}).toFile(path);
 const m=await sharp(path).metadata();if(m.width!==1100||m.height!==1424)throw Error('Bad preview page '+i);
 console.log('Rendered bedroom preview page '+(i+1));
}
