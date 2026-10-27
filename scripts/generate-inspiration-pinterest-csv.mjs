#!/usr/bin/env node
/** Build an official Pinterest bulk-import CSV from a reviewed image-first gallery manifest. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [input, output] = process.argv.slice(2);
if (!input || !output) { console.error('Usage: node scripts/generate-inspiration-pinterest-csv.mjs <manifest.json> <output.csv>'); process.exit(2); }
const m=JSON.parse(readFileSync(resolve(input),'utf8'));
const fields=['Title','Media URL','Pinterest board','Thumbnail','Description','Link','Publish date','Keywords'];
const q=v=>{ const s=String(v??''); return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; };
const ids=new Set(), images=new Set();
const list=m.pins.map((p,i)=>{
  if(!p.id||ids.has(p.id))throw Error('Missing/duplicate pin ID at row '+(i+1));
  ids.add(p.id);
  if(!p.image||images.has(p.image))throw Error('Missing/duplicate image at row '+(i+1));
  images.add(p.image);
  const media=new URL(p.image,'https://www.organizedmomcollective.com').href;
  if (!/^https:\/\//.test(media)||!/\.(jpe?g|png|webp)$/i.test(new URL(media).pathname)) throw Error('Invalid media URL: '+media);
  const link=p.link;
  if(!/^https:\/\//.test(link))throw Error('Invalid link at row '+(i+1));
  if(!p.title||p.title.length>100||!p.board||!p.description||p.description.length>500)throw Error('Invalid title/board/description at row '+(i+1));
  return [p.title,media,p.board,'',p.description,link,p.publish_date||'',p.keywords||''];
});
if (list.length<1||list.length>200) throw Error('Bulk CSV must have 1–200 pins');
writeFileSync(resolve(output),[fields,...list].map(a=>a.map(q).join(',')).join('\r\n')+'\r\n','utf8');
console.log('Wrote '+list.length+' validated Pins to '+output+'. Blank dates publish immediately upon import.');
