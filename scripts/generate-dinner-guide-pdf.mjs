/** Family Dinner System: four letter pages using shared OMC PDF helpers. */
import {mkdir,writeFile} from 'node:fs/promises';
import {makeGuide} from './lib/omc-guide-pdf.mjs';
import {kinds,planning,mealCategories,team,issues,familyPrompt} from './lib/dinner-guide-content.mjs';
const {pdf,palette:c,text,paragraph,rect,rule,icon,newPage}=await makeGuide('Family Dinner System | Organized Mom Collective',{runningTitle:'FAMILY DINNER SYSTEM'});
const art=n=>'public/assets/icons/ofc/guides/dinner/'+n+'.png';
let p=newPage('01 / Weekly planning','Plan the Nights Before the Food','Check the calendar first, then choose dinners you already know.',c.blue,1);
for(let i=0;i<kinds.length;i++){const [img,title,time,desc]=kinds[i],x=42+i*179;rect(p,x,509,170,113,c.ivory);await icon(p,art(img),x+11,565,36);text(p,title,x+57,590,11,'bold');text(p,time,x+11,545,9,'bold');paragraph(p,desc,x+11,527,147,{size:8.7,leading:11});}
text(p,'THE 20-MINUTE FAMILY DINNER CHECK',42,480,11,'bold');
for(let i=0;i<planning.length;i++){const [img,title,desc]=planning[i],y=448-i*65;await icon(p,art(img),51,y-26,35);text(p,(i+1)+'. '+title,101,y,10,'bold');paragraph(p,desc,101,y-17,447,{size:9,leading:11.5});rule(p,45,y-42,517);}
rect(p,42,75,528,50,c.blue);text(p,'MAKE THE REAL PLAN',55,104,9,'bold');paragraph(p,'Use the free Weekly Dinner Planner for the actual days, groceries and dinner owners.',55,87,490,{size:9,leading:12});
p=newPage('02 / Family favorites','Our Go-To Family Dinners','Choose ten to twelve familiar meals you can repeat.',c.green,2);
rect(p,42,568,528,51,c.ivory);text(p,'HOW TO USE',55,599,9,'bold');paragraph(p,'Write dinners your family already eats. Keep two easy backups for late nights.',55,581,488,{size:9,leading:12});
for(const [title,accent,top] of [['FULL NIGHTS',c.green,530],['SHORT NIGHTS',c.blue,394],['ZERO NIGHTS',c.apricot,258]]){rect(p,42,top,528,24,accent);text(p,title,55,top+8,9.8,'bold');for(let i=0;i<4;i++){const y=top-25-i*29;text(p,String(i+1)+'.',55,y,9,'bold');rule(p,78,y-3,482);}}
rect(p,42,76,528,68,c.ivory);text(p,'IDEAS',55,123,9,'bold');paragraph(p,'Tacos, pasta, rice bowls, breakfast for dinner, sandwiches, soup, sheet-pan meals and leftovers.',55,106,487,{size:9.2,leading:12});
p=newPage('03 / Family ownership','Dinner Is a Team Job','The four April Club roles make the thinking and work visible.',c.apricot,3);
for(let i=0;i<team.length;i++){const [img,title,who,desc]=team[i],x=42+(i%2)*269,y=528-Math.floor(i/2)*129;rect(p,x,y,259,113,c.ivory);rect(p,x,y+107,259,6,c.apricot);await icon(p,art(img),x+11,y+59,38);text(p,title,x+57,y+86,9,'bold');text(p,who,x+57,y+71,8.5,'bold',c.muted);paragraph(p,desc,x+11,y+52,234,{size:8.5,leading:11});}
text(p,'OUR DINNER TEAM',42,378,10,'bold');text(p,'Meal: __________________________   Day: _______________',42,357,9.2);rect(p,42,324,528,23,c.apricot);text(p,'ROLE',55,331,8.8,'bold');text(p,'PERSON',298,331,8.8,'bold');for(let i=0;i<team.length;i++){const y=302-i*39;text(p,team[i][1],55,y,9,'bold');rule(p,42,y-12,528);rect(p,285,y-12,1,38,c.rule);}
rect(p,42,76,528,50,c.apricot);text(p,'ASK AT A FAMILY MEETING',55,105,9,'bold');paragraph(p,familyPrompt,55,88,486,{size:9.8,leading:12});
p=newPage('04 / Real life','When the Dinner Plan Falls Apart','Swap, simplify and keep the responsibility shared.',c.blush,4);
for(let i=0;i<issues.length;i++){const [img,title,fix]=issues[i],y=594-i*72;await icon(p,art(img),52,y-30,42);text(p,title,105,y,10.5,'bold');paragraph(p,fix,105,y-19,445,{size:9.1,leading:12});rule(p,48,y-50,517);}
rect(p,42,82,528,87,c.ivory);text(p,'KITCHEN SAFETY',55,148,9,'bold');paragraph(p,'Adults handle heat, sharp tools, heavy items, raw meat and food-allergy decisions. Children practice age-appropriate jobs with suitable supervision.',55,129,490,{size:9.1,leading:12});
await mkdir('public/downloads',{recursive:true});await writeFile('public/downloads/family-dinner-system.pdf',await pdf.save());if(pdf.getPageCount()!==4)throw Error('Expected 4 pages');console.log('Generated Family Dinner System PDF');