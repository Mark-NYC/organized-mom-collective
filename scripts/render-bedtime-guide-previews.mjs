/** Illustrated page previews from the same source as the PDF and landing page. */
import sharp from 'sharp';
import {readFile,mkdir} from 'node:fs/promises';
import {windDown,bedtime,ownership,issues,familyPrompt} from './lib/bedtime-guide-content.mjs';
const source='public/assets/icons/ofc/guides/bedtime/',out='public/images/guides/';
const ink='#545454',ivory='#FBF7F1',line='#D8D1CB',accent=['#CDDDE1','#D4DFC4','#F1D8A8','#E8D2D6'];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const rect=(x,y,w,h,c)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+c+'"/>';
const txt=(x,y,s,size=10,bold=false,serif=false)=>'<text x="'+x+'" y="'+y+'" fill="'+ink+'" font-family="'+(serif?'Georgia,serif':'Arial,sans-serif')+'" font-size="'+size+'" font-weight="'+(bold?700:400)+'">'+esc(s)+'</text>';
function lines(x,y,s,max=65,size=9,leading=12){const words=s.split(' '),rows=[''];for(const word of words){const i=rows.length-1,t=rows[i]?rows[i]+' '+word:word;if(t.length>max&&rows[i])rows.push(word);else rows[i]=t;}return rows.map((l,i)=>txt(x,y+i*leading,l,size)).join('');}
const cache={};async function icon(key,x,y,w=43){if(!cache[key])cache[key]='data:image/png;base64,'+(await readFile(source+key+'.png')).toString('base64');return '<image x="'+x+'" y="'+y+'" width="'+w+'" height="'+w+'" href="'+cache[key]+'"/>';}
function base(i,kicker,title,intro){return rect(0,0,612,792,'white')+txt(42,31,'ORGANIZED MOM COLLECTIVE',8.5,true)+txt(397,31,'BEDTIME ROUTINE / '+i+' OF 4',7.5)+rect(42,42,528,6,accent[i-1])+txt(42,73,kicker,9,true)+txt(42,108,title,25,true,true)+lines(42,133,intro,82,10,14)+rect(42,755,528,1,line)+txt(42,774,'SMALL HABITS. SHARED RESPONSIBILITY.',7.5,true)+txt(425,774,'organizedmomcollective.com',7.4);}
async function one(){let s=base(1,'01 / EVENING WIND-DOWN','The Evening Wind-Down','A short sequence to prepare tomorrow and slow the pace.');
s+=rect(42,162,528,51,ivory)+txt(55,182,'THE GOAL',9,true)+lines(55,201,'Tomorrow is ready and the family can shift into a quieter activity.',89,9);
for(let i=0;i<windDown.length;i++){const [a,t,d]=windDown[i],y=236+i*85;s+=await icon(a,52,y,43)+txt(105,y+18,String(i+1).padStart(2,'0'),14,false,true)+txt(145,y+15,t,11,true)+lines(145,y+35,d,66,9,12)+rect(48,y+68,515,1,line);}
s+=rect(42,681,528,64,accent[0])+txt(55,705,'ONE FAMILY RULE',9,true)+lines(55,725,'Keep ready items in the same places each night.',92,9);return s;}
async function two(){let s=base(2,'02 / BEDTIME PICTURES','Our Bedtime Routine','Six steps to learn together and practice every evening.');
for(let i=0;i<bedtime.length;i++){const [a,t,d]=bedtime[i],y=165+i*78;s+=await icon(a,52,y+2,44)+txt(105,y+20,String(i+1).padStart(2,'0'),13,false,true)+txt(145,y+16,t,11,true)+lines(145,y+37,d,67,9.1,12)+rect(48,y+64,515,1,line);}
s+=rect(42,682,528,63,accent[1])+txt(55,704,'KEEP ONLY WHAT HELPS',9,true)+lines(55,726,'Use the free Routine Chart Builder to personalize the sequence.',92,9);return s;}
async function three(){let s=base(3,'03 / FAMILY OWNERSHIP','Our Family Bedtime Team','Give everyone a role that fits their skills and supervision.');
for(let i=0;i<ownership.length;i++){const [a,age,detail]=ownership[i],x=42+(i%2)*269,y=164+Math.floor(i/2)*118;s+=rect(x,y,259,106,ivory)+rect(x,y,259,6,accent[2])+await icon(a,x+12,y+36,39)+txt(x+63,y+38,age,9,true)+lines(x+63,y+59,detail,32,8.5,11);}
s+=txt(42,436,'WHO OWNS EACH PART?',11,true)+lines(42,457,'Write an owner and the family cue for each job.',90,9);
s+=rect(42,484,528,25,accent[2])+txt(55,501,'BEDTIME JOB',8.8,true)+txt(277,501,'OWNER',8.8,true)+txt(459,501,'WHEN',8.8,true);
const labels=['Evening reset + tomorrow’s bag','Pajamas + clothes away','Teeth + bathroom','Book + quiet goodnight','Lights out + adult check'];
for(let i=0;i<labels.length;i++){const y=530+i*36;s+=txt(55,y,labels[i],8.9)+rect(42,y+12,528,1,line)+rect(269,y-19,1,32,line)+rect(451,y-19,1,32,line);}
s+=rect(42,717,528,29,accent[2])+txt(55,736,'SHOW IT. PRACTICE IT. HAND IT OVER.',9,true);return s;}
async function four(){let s=base(4,'04 / TROUBLESHOOTING','When Bedtime Goes Sideways','Make the transition easier instead of adding reminders.');
for(let i=0;i<issues.length;i++){const [a,t,d]=issues[i],y=164+i*74;s+=await icon(a,52,y+3,42)+txt(108,y+20,t,10.6,true)+lines(108,y+39,d,75,9.1,12)+rect(48,y+61,515,1,line);}
s+=rect(42,634,528,111,ivory)+txt(55,657,'REALISTIC EXPECTATIONS',9.9,true)+lines(55,681,'Grown-ups handle safety, medications and bedtime decisions. This is a habit guide, not sleep training.',96,9.1,14);return s;}
await mkdir(out,{recursive:true});
for(const [i,fn] of [one,two,three,four].entries()){
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1424" viewBox="0 0 612 792">'+await fn()+'</svg>';
 const path=out+'bedtime-guide-page-'+(i+1)+'.webp';
 await sharp(Buffer.from(svg)).webp({quality:92}).toFile(path);
 const meta=await sharp(path).metadata();if(meta.width!==1100||meta.height!==1424)throw Error('Bad preview size');
 console.log('Rendered bedtime preview',i+1);
}
