/** Four print-style illustrated previews from the same dinner data as the PDF. */
import sharp from 'sharp';
import {readFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {kinds,planning,team,issues,familyPrompt} from './lib/dinner-guide-content.mjs';
const base='public/assets/icons/ofc/guides/dinner/',dest='public/images/guides/';
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const ink='#545454',ivory='#FBF7F1',rule='#D8D1CB',accents=['#CDDDE1','#D4DFC4','#F1D8A8','#E8D2D6'];
const rect=(x,y,w,h,c)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+c+'"/>';
const txt=(x,y,v,size=10,bold=false,serif=false)=>'<text x="'+x+'" y="'+y+'" fill="'+ink+'" font-family="'+(serif?'Georgia,serif':'Arial,sans-serif')+'" font-size="'+size+'" font-weight="'+(bold?700:400)+'">'+esc(v)+'</text>';
function wrap(x,y,v,max=52,size=9,leading=13){let rows=[''];for(const w of v.split(' ')){let n=rows.length-1,s=rows[n]?rows[n]+' '+w:w;if(s.length>max&&rows[n])rows.push(w);else rows[n]=s;}return rows.map((r,i)=>txt(x,y+i*leading,r,size)).join('');}
const cache={};async function art(name,x,y,size=40){if(!cache[name])cache[name]='data:image/png;base64,'+(await readFile(base+name+'.png')).toString('base64');return '<image x="'+x+'" y="'+y+'" width="'+size+'" height="'+size+'" href="'+cache[name]+'"/>';}
function page(n,kicker,title,sub){return rect(0,0,612,792,'white')+txt(42,31,'ORGANIZED MOM COLLECTIVE',8.5,true)+txt(416,31,'FAMILY DINNER / '+n+' OF 4',7.5)+rect(42,42,528,6,accents[n-1])+txt(42,73,kicker,9,true)+txt(42,108,title,25,true,true)+wrap(42,134,sub,83,10,14)+rect(42,756,528,1,rule)+txt(42,775,'SMALL HABITS. SHARED RESPONSIBILITY.',7.5,true)+txt(425,775,'organizedmomcollective.com',7.4);}
async function p1(){let s=page(1,'01 / WEEKLY PLANNING','Plan the Nights Before the Food','Choose dinners around your real week, not the other way around.');
for(let i=0;i<kinds.length;i++){const [a,label,time,detail]=kinds[i],x=42+i*179;s+=rect(x,169,170,119,ivory)+await art(a,x+10,182,40)+txt(x+58,203,label,11,true)+txt(x+11,237,time,9,true)+wrap(x+11,253,detail,28,8.5,11);}
s+=txt(42,323,'THE 20-MINUTE FAMILY DINNER CHECK',11,true);
for(let i=0;i<planning.length;i++){const [a,title,detail]=planning[i],y=348+i*63;s+=await art(a,49,y,36)+txt(101,y+15,(i+1)+'. '+title,10,true)+wrap(101,y+33,detail,75,9,12)+rect(46,y+53,516,1,rule);}
s+=rect(42,680,528,65,accents[0])+txt(55,702,'MAKE THE REAL PLAN',9,true)+wrap(55,722,'Use our free Weekly Dinner Planner for actual meals, groceries and owners.',90,9);return s;}
async function p2(){let s=page(2,'02 / FAMILY FAVORITES','Our Go-To Family Dinners','Write ten to twelve repeatable dinners, not twelve new recipes.');
s+=rect(42,163,528,65,ivory)+txt(55,184,'HOW TO USE',9,true)+wrap(55,202,'Write dinners your family already eats. Keep two easy backups for busy nights.',93,9);
for(let i=0;i<3;i++){const label=['FULL NIGHTS','SHORT NIGHTS','ZERO NIGHTS'][i],y=260+i*137;s+=rect(42,y,528,24,accents[i===0?1:i===1?0:2])+txt(55,y+16,label,10,true);for(let j=0;j<4;j++){const ry=y+45+j*24;s+=txt(55,ry,String(j+1)+'.',9)+rect(78,ry+4,478,1,rule);}}
s+=rect(42,690,528,55,ivory)+txt(55,711,'START WITH FAMILIAR MEALS',9,true)+wrap(55,730,'Tacos, pasta, rice bowls, sandwiches, soup and leftovers.',90,9);return s;}
async function p3(){let s=page(3,'03 / SHARED OWNERSHIP','Dinner Is a Team Job','Start with one dinner and assign April Club’s four roles.');
for(let i=0;i<team.length;i++){const [a,title,who,detail]=team[i],x=42+(i%2)*269,y=164+Math.floor(i/2)*132;s+=rect(x,y,259,114,ivory)+rect(x,y,259,6,accents[2])+await art(a,x+11,y+34,37)+txt(x+57,y+37,title,9,true)+txt(x+57,y+53,who,8.2,true)+wrap(x+11,y+80,detail,45,8.5,11);}
s+=txt(42,444,'OUR DINNER TEAM',11,true)+txt(42,469,'Meal: ____________________________     Day: _______________',9.5);
s+=rect(42,487,528,25,accents[2])+txt(55,504,'ROLE',9,true)+txt(302,504,'PERSON',9,true);
for(let i=0;i<team.length;i++){const y=537+i*37;s+=txt(55,y,team[i][1],9,true)+rect(42,y+12,528,1,rule)+rect(285,y-19,1,33,rule);}
s+=rect(42,695,528,50,accents[2])+txt(55,713,'ASK AT A FAMILY MEETING',9,true)+wrap(55,730,familyPrompt,90,9.4);return s;}
async function p4(){let s=page(4,'04 / WHEN LIFE HAPPENS','When Dinner Plans Fall Apart','A simpler dinner still counts. Share the work.');
for(let i=0;i<issues.length;i++){const [a,title,fix]=issues[i],y=164+i*74;s+=await art(a,52,y+2,42)+txt(105,y+18,title,10.4,true)+wrap(105,y+39,fix,75,9.1,12)+rect(48,y+62,515,1,rule);}
s+=rect(42,632,528,113,ivory)+txt(55,656,'KITCHEN SAFETY',10,true)+wrap(55,678,'Adults handle heat, knives, heavy items, raw meat and allergies. Children practice safe jobs with supervision.',94,9.2,14);return s;}
await mkdir(dest,{recursive:true});for(const [i,fn] of [p1,p2,p3,p4].entries()){const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1424" viewBox="0 0 612 792">'+await fn()+'</svg>';const name=join(dest,'dinner-guide-page-'+(i+1)+'.webp');await sharp(Buffer.from(svg)).webp({quality:92}).toFile(name);const m=await sharp(name).metadata();if(m.width!==1100||m.height!==1424)throw Error('Bad preview');console.log('Rendered dinner guide preview',i+1);}
