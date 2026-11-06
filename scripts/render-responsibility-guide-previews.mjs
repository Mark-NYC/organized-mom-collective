/** Four print-style WebP previews from the guide's canonical content arrays. */
import sharp from 'sharp';
import {readFile,mkdir} from 'node:fs/promises';
import {cycle,examples,handover,familyTalk,issues,prompt} from './lib/responsibility-guide-content.mjs';
const dir='public/assets/icons/ofc/guides/responsibility/',out='public/images/guides/';
const ink='#545454',ivory='#FBF7F1',line='#D8D1CB',acc=['#CDDDE1','#D4DFC4','#F1D8A8','#E8D2D6'];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const box=(x,y,w,h,c)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+c+'"/>';
const tx=(x,y,s,z=10,b=false,serif=false)=>'<text x="'+x+'" y="'+y+'" fill="'+ink+'" font-family="'+(serif?'Georgia,serif':'Arial,sans-serif')+'" font-size="'+z+'" font-weight="'+(b?700:400)+'">'+esc(s)+'</text>';
function wrap(x,y,s,max=60,size=9,leading=12){let rows=[''];for(const w of s.split(' ')){const i=rows.length-1,next=rows[i]?rows[i]+' '+w:w;if(next.length>max&&rows[i])rows.push(w);else rows[i]=next;}return rows.map((v,i)=>tx(x,y+i*leading,v,size)).join('');}
const cache={};async function icon(n,x,y,size=42){if(!cache[n])cache[n]='data:image/png;base64,'+(await readFile(dir+n+'.png')).toString('base64');return '<image x="'+x+'" y="'+y+'" width="'+size+'" height="'+size+'" href="'+cache[n]+'"/>';}
function base(n,kicker,title,intro){return box(0,0,612,792,'white')+tx(42,31,'ORGANIZED MOM COLLECTIVE',8.5,true)+tx(383,31,'FAMILY RESPONSIBILITY / '+n+' OF 4',7.2)+box(42,42,528,6,acc[n-1])+tx(42,73,kicker,9,true)+tx(42,108,title,24,true,true)+wrap(42,133,intro,86,10,14)+box(42,756,528,1,line)+tx(42,775,'SMALL HABITS. SHARED RESPONSIBILITY.',7.5,true)+tx(425,775,'organizedmomcollective.com',7.4);}
async function one(){let s=base(1,'01 / HELP VS OWNERSHIP','Helping Is Not the Same as Owning','The whole job includes noticing, doing and checking.');
for(let i=0;i<cycle.length;i++){const [a,t,d]=cycle[i],x=42+i*134;s+=box(x,166,125,119,ivory)+await icon(a,x+10,178,a==='eye'?31:38)+tx(x+10,231,t,9.8,true)+wrap(x+10,248,d,20,8.2,10);}
s+=tx(42,325,'WHAT DOES OWNERSHIP LOOK LIKE?',10.8,true);
for(let i=0;i<examples.length;i++){const [a,t,d]=examples[i],y=345+i*65;s+=await icon(a,52,y,38)+tx(103,y+14,t,10.2,true)+wrap(103,y+34,d,76,9,12)+box(48,y+55,514,1,line);}
s+=box(42,561,528,27,acc[0])+tx(55,579,'THREE JOBS I AM STILL MANAGING',9,true);
for(let i=0;i<3;i++){const y=615+i*31;s+=tx(56,y,(i+1)+'.',9,true)+box(77,y+3,480,1,line);}
s+=box(42,712,528,33,ivory)+wrap(55,733,'Choose one job to hand over first, not three new jobs at once.',93,9.1);return s;}
async function two(){let s=base(2,'02 / PRACTICE THE HANDOFF','Hand Over the Whole Job','Six steps to teach, practice and let someone own the remembering.');
for(let i=0;i<handover.length;i++){const [a,t,d]=handover[i],y=160+i*56;s+=await icon(a,54,y,34)+tx(100,y+13,(i+1)+'. '+t,10,true)+wrap(100,y+31,d,76,8.9,11)+box(48,y+48,514,1,line);}
s+=box(42,510,528,27,acc[1])+tx(55,529,'OUR ONE-JOB HANDOVER AGREEMENT',9,true);
const fs=['Job','Owner','When it starts','Finished means','Help or supplies needed'];
for(let i=0;i<fs.length;i++){const y=566+i*32;s+=tx(55,y,fs[i]+':',9.1,true)+box(224,y+3,332,1,line);}
return s;}
async function three(){let s=base(3,'03 / OUR FAMILY TEAM','Who Owns What in Our Home?','Everyone contributes according to their skills and support needs.');
for(let i=0;i<familyTalk.length;i++){const [a,t,d]=familyTalk[i],x=42+(i%2)*269,y=163+Math.floor(i/2)*125;s+=box(x,y,258,113,ivory)+box(x,y,258,6,acc[2])+await icon(a,x+12,y+21,37)+tx(x+55,y+33,String(i+1)+'. '+t,9,true)+wrap(x+12,y+73,d,43,8.3,11);}
s+=tx(42,435,'OUR FAMILY RESPONSIBILITY AGREEMENTS',10.5,true)+wrap(42,456,'Start with one owned job per person, including adults.',94,9)+box(42,481,528,26,acc[2])+tx(55,499,'PERSON',8.7,true)+tx(176,499,'OWNS WHAT',8.7,true)+tx(413,499,'WHEN / DONE',8.7,true);
for(let i=0;i<5;i++){const y=531+i*34;s+=box(42,y+12,528,1,line)+box(167,y-20,1,33,line)+box(403,y-20,1,33,line);}
s+=box(42,714,528,31,acc[2])+tx(55,735,'ONE REAL RESPONSIBILITY EACH. START SMALL.',9,true);return s;}
async function four(){let s=base(4,'04 / WHEN IT DOES NOT STICK','When Responsibility Does Not Stick','Keep the owner and improve the cue, skill or finish line.');
for(let i=0;i<issues.length;i++){const [a,t,d]=issues[i],y=164+i*73;s+=await icon(a,52,y+4,a==='eye'?31:42)+tx(108,y+20,t,10.4,true)+wrap(108,y+40,d,74,9,12)+box(48,y+60,515,1,line);}
s+=box(42,633,528,112,ivory)+tx(55,657,'ONE-WEEK FAMILY CHECK-IN',9.8,true)+wrap(55,680,'Ask what worked and what got stuck. Adjust the cue or help needed. Keep the job owned, without streaks or guilt.',94,9.1,14);return s;}
await mkdir(out,{recursive:true});
for(const [i,fn] of [one,two,three,four].entries()){const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1424" viewBox="0 0 612 792">'+await fn()+'</svg>';const path=out+'responsibility-guide-page-'+(i+1)+'.webp';await sharp(Buffer.from(svg)).webp({quality:92}).toFile(path);const m=await sharp(path).metadata();if(m.width!==1100||m.height!==1424)throw Error('Invalid responsibility preview');console.log('Rendered responsibility preview',i+1);}
