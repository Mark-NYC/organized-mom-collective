/** Four printable-style preview images sharing guide data with its PDF and landing page. */
import sharp from 'sharp';
import {readFile,mkdir} from 'node:fs/promises';
import {night,steps,jobs,problems,familyPrompt} from './lib/morning-guide-content.mjs';
const dir='public/assets/icons/ofc/guides/morning/',out='public/images/guides/';
const ink='#545454',ivory='#FBF7F1',line='#D8D1CB',acc=['#CDDDE1','#D4DFC4','#F1D8A8','#E8D2D6'];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const box=(x,y,w,h,c)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+c+'"/>';
const tx=(x,y,s,size=10,bold=false,serif=false)=>'<text x="'+x+'" y="'+y+'" fill="'+ink+'" font-family="'+(serif?'Georgia,serif':'Arial,sans-serif')+'" font-size="'+size+'" font-weight="'+(bold?700:400)+'">'+esc(s)+'</text>';
function wrap(x,y,s,max=60,size=9,leading=13){let rows=[''];for(const word of s.split(' ')){const n=rows.length-1,add=rows[n]?rows[n]+' '+word:word;if(add.length>max&&rows[n])rows.push(word);else rows[n]=add;}return rows.map((r,i)=>tx(x,y+i*leading,r,size)).join('');}
const cache={};async function img(name,x,y,size=44){if(!cache[name])cache[name]='data:image/png;base64,'+(await readFile(dir+name+'.png')).toString('base64');return '<image x="'+x+'" y="'+y+'" width="'+size+'" height="'+size+'" href="'+cache[name]+'"/>';}
function base(i,kicker,title,desc){return box(0,0,612,792,'white')+tx(42,31,'ORGANIZED MOM COLLECTIVE',8.5,true)+tx(397,31,'MORNING ROUTINE / '+i+' OF 4',7.6)+box(42,42,528,6,acc[i-1])+tx(42,73,kicker,9,true)+tx(42,108,title,25,true,true)+wrap(42,133,desc,86,10,14)+box(42,756,528,1,line)+tx(42,775,'SMALL HABITS. SHARED RESPONSIBILITY.',7.6,true)+tx(426,775,'organizedmomcollective.com',7.4);}
async function one(){let s=base(1,'01 / THE NIGHT BEFORE','A Calmer Morning Starts Tonight','Five small preparations make tomorrow easier.');
s+=box(42,162,528,53,ivory)+tx(55,183,'THE GOAL',9,true)+wrap(55,202,'Clothes, bags, lunch gear and shoes have a ready place.',88,9);
for(let i=0;i<night.length;i++){const [a,t,d]=night[i],y=234+i*85;s+=await img(a,52,y,44)+tx(104,y+18,String(i+1).padStart(2,'0'),14,false,true)+tx(140,y+15,t,11.1,true)+wrap(140,y+36,d,67,9,12)+box(47,y+69,515,1,line);}
s+=box(42,680,528,65,acc[0])+tx(55,703,'ONE FAMILY RULE',9,true)+wrap(55,724,'Return ready items to the same places each night.',91,9);return s;}
async function two(){let s=base(2,'02 / SCHOOL MORNING','Our Before-School Routine','Seven illustrated steps from the August Club routine.');
for(let i=0;i<steps.length;i++){const [a,t,d]=steps[i],y=165+i*69;s+=await img(a,54,y,42)+tx(105,y+20,String(i+1).padStart(2,'0'),13,false,true)+tx(141,y+15,t,10.8,true)+wrap(141,y+35,d,72,9,11.5)+box(48,y+57,516,1,line);}
s+=box(42,681,528,64,acc[1])+tx(55,705,'THE FINISH LINE',9,true)+wrap(55,724,'Dressed, fed, teeth brushed, lunch + water ready, backpack and shoes on.',92,9);return s;}
async function three(){let s=base(3,'03 / FAMILY OWNERSHIP','Our Family Morning Team','Practice jobs together. Grown-ups own logistics and safety.');
for(let i=0;i<jobs.length;i++){const [a,t,d]=jobs[i],x=42+(i%2)*269,y=164+Math.floor(i/2)*119;s+=box(x,y,259,107,ivory)+box(x,y,259,6,acc[2])+await img(a,x+12,y+35,39)+tx(x+63,y+36,t,9,true)+wrap(x+63,y+55,d,33,8.3,11);}
s+=tx(42,436,'OUR FAMILY MORNING HANDOFF',11,true)+wrap(42,458,'Write an owner and when each job gets done.',90,9)+box(42,483,528,25,acc[2])+tx(55,500,'JOB',9,true)+tx(275,500,'OWNER',9,true)+tx(459,500,'WHEN',9,true);
const rows=['Night-before school check','Clothes + backpack ready','Breakfast + lunch handoff','Teeth + shoes + bag','Final departure check'];
for(let i=0;i<rows.length;i++){const y=529+i*37;s+=tx(55,y,rows[i],9)+box(42,y+12,528,1,line)+box(265,y-20,1,33,line)+box(450,y-20,1,33,line);}
s+=box(42,717,528,29,acc[2])+tx(55,736,'PRACTICE TOGETHER. THEN STEP BACK.',9,true);return s;}
async function four(){let s=base(4,'04 / REAL MORNINGS','When Mornings Go Sideways','Fix the repeat problem instead of adding reminders.');
for(let i=0;i<problems.length;i++){const [a,t,d]=problems[i],y=164+i*74;s+=await img(a,52,y+3,42)+tx(107,y+19,t,10.6,true)+wrap(107,y+39,d,75,9.1,12)+box(48,y+60,516,1,line);}
s+=box(42,633,528,112,ivory)+tx(55,656,'SAFETY + REALISTIC EXPECTATIONS',9.8,true)+wrap(55,678,'Adults confirm transport, school notices and food safety. Practice routines before expecting independence.',93,9,14);return s;}
await mkdir(out,{recursive:true});
for(const [i,fn] of [one,two,three,four].entries()){const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1424" viewBox="0 0 612 792">'+await fn()+'</svg>',path=out+'morning-guide-page-'+(i+1)+'.webp';await sharp(Buffer.from(svg)).webp({quality:92}).toFile(path);const m=await sharp(path).metadata();if(m.width!==1100||m.height!==1424)throw Error('Invalid morning preview '+path);console.log('Generated morning guide page',i+1);}
