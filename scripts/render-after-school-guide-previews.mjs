/** Four branded printable previews for Family After-School Routine. */
import sharp from 'sharp';
import {readFile,mkdir} from 'node:fs/promises';
import {arrival,steps,handoff,problems,question} from './lib/after-school-guide-content.mjs';
const dir='public/assets/icons/ofc/guides/after-school/',out='public/images/guides/';
const ink='#545454',ivory='#FBF7F1',line='#D8D1CB',acc=['#CDDDE1','#D4DFC4','#F1D8A8','#E8D2D6'];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const box=(x,y,w,h,c)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+c+'"/>';
const tx=(x,y,s,size=10,bold=false,serif=false)=>'<text x="'+x+'" y="'+y+'" fill="'+ink+'" font-family="'+(serif?'Georgia,serif':'Arial,sans-serif')+'" font-size="'+size+'" font-weight="'+(bold?700:400)+'">'+esc(s)+'</text>';
function wrap(x,y,s,max=62,size=9,leading=12){const words=s.split(' '),rows=[''];for(const w of words){const i=rows.length-1,t=rows[i]?rows[i]+' '+w:w;if(t.length>max&&rows[i])rows.push(w);else rows[i]=t;}return rows.map((v,i)=>tx(x,y+i*leading,v,size)).join('');}
const cache={};async function icon(name,x,y,size=42){if(!cache[name])cache[name]='data:image/png;base64,'+(await readFile(dir+name+'.png')).toString('base64');return '<image x="'+x+'" y="'+y+'" width="'+size+'" height="'+size+'" href="'+cache[name]+'"/>';}
function base(n,kicker,title,intro){return box(0,0,612,792,'#fff')+tx(42,31,'ORGANIZED MOM COLLECTIVE',8.5,true)+tx(388,31,'AFTER SCHOOL / '+n+' OF 4',7.7)+box(42,42,528,6,acc[n-1])+tx(42,72,kicker,9,true)+tx(42,108,title,25,true,true)+wrap(42,133,intro,82,10,14)+box(42,756,528,1,line)+tx(42,775,'SMALL HABITS. SHARED RESPONSIBILITY.',7.6,true)+tx(425,775,'organizedmomcollective.com',7.4);}
async function one(){let s=base(1,'01 / THE FIRST 10 MINUTES','The First Ten Minutes Home','One small landing routine before the rest of the afternoon.');
s+=box(42,162,528,57,ivory)+tx(55,184,'THE LANDING SPOT',9,true)+wrap(55,204,'A place for shoes and backpacks, lunch gear, and school papers.',90,9);
for(let i=0;i<arrival.length;i++){const [a,title,detail]=arrival[i],y=235+i*85;s+=await icon(a,52,y,43)+tx(104,y+18,String(i+1).padStart(2,'0'),14,false,true)+tx(144,y+15,title,10.8,true)+wrap(144,y+36,detail,66,9.1,12)+box(48,y+69,515,1,line);}
s+=box(42,684,528,61,acc[0])+tx(55,704,'THE FINISH LINE',9,true)+wrap(55,725,'School items have a home. Papers are handed off. Snack is next.',92,9.1);return s;}
async function two(){let s=base(2,'02 / AFTER-SCHOOL PICTURES','Our After-School Routine','The five prepared August Club steps, taught one at a time.');
for(let i=0;i<steps.length;i++){const [a,title,detail]=steps[i],y=178+i*98;s+=await icon(a,52,y,48)+tx(110,y+23,String(i+1).padStart(2,'0'),14,false,true)+tx(150,y+20,title,11.1,true)+wrap(150,y+43,detail,66,9.3,12)+box(48,y+79,515,1,line);}
s+=box(42,689,528,55,acc[1])+tx(55,711,'MAKE THE PICTURES YOUR OWN',9,true)+wrap(55,731,'Use the free Routine Chart Builder to adjust steps and times.',90,9);return s;}
async function three(){let s=base(3,'03 / FAMILY HANDOFFS','Our Family After-School Team','Kids handle their things. Adults own school decisions.');
for(let i=0;i<handoff.length;i++){const [a,age,detail]=handoff[i],x=42+(i%2)*269,y=166+Math.floor(i/2)*119;s+=box(x,y,259,108,ivory)+box(x,y,259,6,acc[2])+await icon(a,x+12,y+32,39)+tx(x+63,y+37,age,9,true)+wrap(x+63,y+57,detail,32,8.5,11);}
s+=tx(42,437,'OUR FAMILY HANDOFF',11,true)+wrap(42,457,'Assign who owns each part, and where it goes.',95,9)+box(42,482,528,26,acc[2])+tx(55,500,'JOB',8.8,true)+tx(274,500,'WHO',8.8,true)+tx(439,500,'WHERE / WHEN',8.8,true);
const tasks=['Shoes, coat + backpack home','Lunch gear to the kitchen','School papers to adult inbox','Snack and afternoon plan','Adult reviews messages + rides'];
for(let i=0;i<tasks.length;i++){const y=530+i*35;s+=tx(55,y,tasks[i],8.6)+box(42,y+12,528,1,line)+box(270,y-19,1,32,line)+box(435,y-19,1,32,line);}
s+=box(42,717,528,28,acc[2])+tx(55,735,'PRACTICE TOGETHER. THEN HAND IT OVER.',9,true);return s;}
async function four(){let s=base(4,'04 / TROUBLESHOOTING','When Afternoons Go Sideways','Fix the missing handoff instead of adding reminders.');
for(let i=0;i<problems.length;i++){const [a,title,detail]=problems[i],y=164+i*74;s+=await icon(a,52,y+3,42)+tx(108,y+19,title,10.5,true)+wrap(108,y+39,detail,73,9,12)+box(48,y+62,515,1,line);}
s+=box(42,634,528,111,ivory)+tx(55,656,'ADULTS OWN THE SAFETY CHECKS',9.7,true)+wrap(55,680,'School notices, rides, food safety and supervision stay with adults. The chart supports practice.',93,9.1,14);return s;}
await mkdir(out,{recursive:true});for(const [i,fn] of [one,two,three,four].entries()){const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1424" viewBox="0 0 612 792">'+await fn()+'</svg>';const path=out+'after-school-guide-page-'+(i+1)+'.webp';await sharp(Buffer.from(svg)).webp({quality:92}).toFile(path);const meta=await sharp(path).metadata();if(meta.width!==1100||meta.height!==1424)throw Error('Invalid preview');console.log('Rendered after-school preview',i+1);}
