/** One-page preview, using the canonical jobs, OMC palette and real hand-drawn assets. */
import sharp from 'sharp';
import {mkdir,readFile} from 'node:fs/promises';
import {categories} from './lib/chores-8-9-content.mjs';
const ink='#545454',ivory='#FBF7F1',line='#D8D1CB',acc=['#CDDDE1','#D4DFC4','#F1D8A8'];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const box=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
const tx=(x,y,s,z=10,b=false,serif=false)=>`<text x="${x}" y="${y}" fill="${ink}" font-family="${serif?'Georgia,serif':'Arial,sans-serif'}" font-size="${z}" font-weight="${b?700:400}">${esc(s)}</text>`;
const cache={};async function icon(name,x,y,size){if(!cache[name])cache[name]='data:image/png;base64,'+(await readFile('public/assets/icons/ofc/guides/responsibility/'+name+'.png')).toString('base64');return `<image x="${x}" y="${y}" width="${size}" height="${size}" href="${cache[name]}"/>`;}
let s=box(0,0,612,792,'white')+tx(42,36,'ORGANIZED MOM COLLECTIVE',8.5,true)+box(42,43,528,6,acc[0])+tx(42,93,'Chores for 8–9-Year-Olds',26,true,true)+tx(42,114,'Real jobs they can learn to own. Pick one daily job and one family contribution.',9.8);
for(let k=0;k<categories.length;k++){const c=categories[k],x=42+k*179,y=146;s+=box(x,y,170,280,ivory)+box(x,y,170,5,acc[k])+await icon(c.icon,x+10,y+18,40)+tx(x+10,y+77,['MY EVERYDAY THINGS','SHARED SPACES','OUR FAMILY TEAM'][k],8.7,true);c.jobs.forEach((j,i)=>{const yy=y+105+i*28;s+=`<rect x="${x+11}" y="${yy-7}" width="8" height="8" fill="white" stroke="${line}"/>`;const words=j.split(' '),rows=[''];for(const word of words){const q=rows.length-1;if((rows[q]+' '+word).length>28&&rows[q])rows.push(word);else rows[q]+=(rows[q]?' ':'')+word}rows.forEach((z,n)=>s+=tx(x+25,yy+n*10,z,8.1))});}
s+=box(42,437,528,25,'#E8D2D6')+tx(55,454,'THIS WEEK: CHOOSE JUST TWO JOBS',9.2,true)+tx(47,487,'Name: ____________________________________     Week of: ___________________',9)+tx(48,518,'MY JOB',8.5,true);
['M','T','W','T','F','S','S'].forEach((d,i)=>s+=tx(296+i*37,518,d,9,true));
for(let r=0;r<2;r++){const y=556+r*63;s+=tx(47,y,r===0?'1. Daily job:':'2. Family job:',9,true)+box(117,y+4,160,1,line)+tx(47,y+24,'When: ____________________',8.5);for(let d=0;d<7;d++)s+=`<rect x="${295+d*37}" y="${y-12}" width="15" height="15" fill="white" stroke="${line}"/>`;s+=box(42,y+36,528,1,line)}
s+=box(42,684,528,45,ivory)+tx(55,703,'START SMALL',8.8,true)+tx(55,719,'Show the job, agree on done, attach a cue, and review together next week.',8.8)+box(42,747,528,1,line)+tx(42,765,'SMALL HABITS. SHARED RESPONSIBILITY.',7.8,true)+tx(421,765,'organizedmomcollective.com',7.8);
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1424" viewBox="0 0 612 792">${s}</svg>`;
await mkdir('public/images/guides',{recursive:true});
await sharp(Buffer.from(svg)).webp({quality:92}).toFile('public/images/guides/chores-8-9-page-1.webp');
console.log('Rendered single-page preview');
