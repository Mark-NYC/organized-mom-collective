/** Four 1100x1424 printable-style previews, using the same canonical content as the PDF. */
import sharp from 'sharp';
import {readFile,mkdir} from 'node:fs/promises';
import {agenda,check,jobs,issues,familyPrompt} from './lib/weekly-guide-content.mjs';
const dir='public/assets/icons/ofc/guides/weekly/',out='public/images/guides/';
const ink='#545454',ivory='#FBF7F1',line='#D8D1CB',acc=['#CDDDE1','#D4DFC4','#F1D8A8','#E8D2D6'];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const box=(x,y,w,h,c)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+c+'"/>';
const tx=(x,y,s,z=10,b=false,serif=false)=>'<text x="'+x+'" y="'+y+'" fill="'+ink+'" font-family="'+(serif?'Georgia,serif':'Arial,sans-serif')+'" font-size="'+z+'" font-weight="'+(b?700:400)+'">'+esc(s)+'</text>';
function wrap(x,y,s,max=66,size=9,leading=13){let rows=[''];for(const word of s.split(' ')){const k=rows.length-1,next=rows[k]?rows[k]+' '+word:word;if(next.length>max&&rows[k])rows.push(word);else rows[k]=next;}return rows.map((v,i)=>tx(x,y+i*leading,v,size)).join('');}
const cache={};async function icon(n,x,y,size=42){if(!cache[n])cache[n]='data:image/png;base64,'+(await readFile(dir+n+'.png')).toString('base64');return '<image x="'+x+'" y="'+y+'" width="'+size+'" height="'+size+'" href="'+cache[n]+'"/>';}
function base(i,label,title,desc){return box(0,0,612,792,'white')+tx(42,31,'ORGANIZED MOM COLLECTIVE',8.5,true)+tx(389,31,'FAMILY WEEKLY RESET / '+i+' OF 4',7.3)+box(42,42,528,6,acc[i-1])+tx(42,72,label,9,true)+tx(42,108,title,25,true,true)+wrap(42,134,desc,81,10,14)+box(42,756,528,1,line)+tx(42,775,'SMALL HABITS. SHARED RESPONSIBILITY.',7.6,true)+tx(425,775,'organizedmomcollective.com',7.4);}
async function one(){let s=base(1,'01 / FIVE STEPS','Our 15-Minute Family Weekly Reset','A simple check of the coming week around the shared calendar.');
s+=box(42,163,528,54,ivory)+tx(55,184,'BRING THE FAMILY CALENDAR',9,true)+wrap(55,204,'This is a short logistics check, not a second family meeting.',92,9);
for(let i=0;i<agenda.length;i++){const [a,title,time,detail]=agenda[i],y=240+i*85;s+=await icon(a,52,y,43)+tx(104,y+20,time,9.5,true)+tx(156,y+16,title,10.5,true)+wrap(156,y+38,detail,62,9,12)+box(48,y+70,515,1,line);}
s+=box(42,681,528,65,acc[0])+tx(55,705,'THEN STOP',9,true)+wrap(55,725,'Write decisions on the shared calendar; save deeper conversations for the family meeting.',93,9);return s;}
async function two(){let s=base(2,'02 / SEVEN DAYS','A Week Everyone Can See','Review these five categories, then put details on the real calendar.');
for(let i=0;i<check.length;i++){const [a,title,detail]=check[i],y=172+i*85;s+=await icon(a,52,y,41)+tx(108,y+15,title,10.7,true)+wrap(108,y+36,detail,69,9.1,12)+box(48,y+67,514,1,line);}
s+=box(42,640,528,105,acc[1])+tx(55,665,'THIS WEEK’S ONE PRIORITY',9,true)+box(55,694,490,1,ink)+wrap(55,717,'Put the owner and date in the shared family calendar.',91,9);return s;}
async function three(){let s=base(3,'03 / FAMILY OWNERSHIP','Everyone Knows Their Part','A name on the task, not a reminder Mom still has to manage.');
for(let i=0;i<jobs.length;i++){const [a,title,detail]=jobs[i],x=42+(i%2)*269,y=165+Math.floor(i/2)*121;s+=box(x,y,259,109,ivory)+box(x,y,259,6,acc[2])+await icon(a,x+13,y+21,37)+tx(x+12,y+68,title,8.7,true)+wrap(x+12,y+85,detail,43,8,10);}
s+=tx(42,438,'OUR FAMILY HANDOFFS THIS WEEK',10.8,true)+wrap(42,458,'Name an owner and when each job needs to happen.',93,9)+box(42,485,528,25,acc[2])+tx(55,502,'WHAT NEEDS DOING',8.7,true)+tx(276,502,'OWNER',8.7,true)+tx(460,502,'WHEN',8.7,true);
const tasks=['Rides + school handoffs','Dinner plan + groceries','Household priority','One-time school or home task','Prepare for a busy day'];
for(let i=0;i<tasks.length;i++){const y=530+i*35;s+=tx(55,y,tasks[i],8.9)+box(42,y+12,528,1,line)+box(265,y-18,1,31,line)+box(453,y-18,1,31,line);}
s+=box(42,719,528,27,acc[2])+tx(55,737,'SHARE THE THINKING, NOT JUST THE TASK.',9,true);return s;}
async function four(){let s=base(4,'04 / TROUBLESHOOTING','When the Weekly Reset Falls Apart','Small fixes make it easier to return next week.');
for(let i=0;i<issues.length;i++){const [a,title,detail]=issues[i],y=166+i*74;s+=await icon(a,52,y+3,42)+tx(108,y+19,title,10.5,true)+wrap(108,y+39,detail,74,9,12)+box(48,y+60,514,1,line);}
s+=box(42,632,528,113,ivory)+tx(55,655,'FIVE-MINUTE RESCUE RESET',9.5,true)+wrap(55,678,'Check dates, rides, the next dinners and who owns loose ends. Update the calendar and stop.',93,9.2,14);return s;}
await mkdir(out,{recursive:true});for(const [i,fn] of [one,two,three,four].entries()){const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1424" viewBox="0 0 612 792">'+await fn()+'</svg>';const file=out+'weekly-guide-page-'+(i+1)+'.webp';await sharp(Buffer.from(svg)).webp({quality:92}).toFile(file);const m=await sharp(file).metadata();if(m.width!==1100||m.height!==1424)throw Error('Invalid preview');console.log('Generated weekly preview',i+1);}
