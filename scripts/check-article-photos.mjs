/**
 * Editorial lifestyle photo gate.
 * New articles (2026-10-19 onward) must not borrow lifestyle source photos
 * from another article. Older articles are reported for gradual cleanup.
 * Real product photos and instructional images can be reused.
 *
 * Usage: npm run check:article-photos
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const sourceDir = new URL('../src/content/articles/', import.meta.url);
const imagesFile = new URL('../src/data/images.ts', import.meta.url);
const registry = readFileSync(imagesFile, 'utf8');
const errors = [];
const older = [];
const bySource = new Map();
const isProduct = (name, src) => /design\/etsy-listing\//.test(src) || /calendar.*(mockup|product)/i.test(src);
const registryEntries = new Map();
for (const m of registry.matchAll(/^  '([^']+)': \{ widths: \[([^\]]+)\], width: (\d+), height: (\d+), source: '([^'\n]*(?:\\'[^'\n]*)*)' \},?$/gm)) {
  registryEntries.set(m[1], {widths:m[2].split(',').map(x=>Number(x.trim())), source:m[5].replace(/\\'/g,"'")});
}
const all = readdirSync(sourceDir).filter(f=>f.endsWith('.mdx'));
for (const file of all) {
  const content = readFileSync(join(new URL('.',sourceDir).pathname,file), 'utf8');
  const published = content.match(/^published:\s*(\d{4}-\d{2}-\d{2})/m)?.[1] || '';
  const hero = content.match(/^hero:\s*\n(?:[ \t]+[^\n]*\n)*?[ \t]+image:\s*([^\n]+)/m)?.[1]?.trim().replace(/^['"]|['"]$/g,'');
  const refs = [...(hero ? [hero] : []), ...[...content.matchAll(/<Figure\b[^>]*\bimage="([^"]+)"/g)].map(m=>m[1])];
  for (const name of refs) {
    const info=registryEntries.get(name);
    if (!info) {errors.push(file+': unregistered photo '+name);continue;}
    const id=info.source.match(/Kaboompics\s+(\d+)/i)?.[1];
    const key=id?'kaboompics:'+id:(info.source.match(/design\/photography\/[^ ;'"]+/)?.[0] || name);
    if (isProduct(name,info.source) || /mockup|infographic|chart|screenshot/i.test(info.source)) continue;
    if (published >= '2026-10-19') {
      for (const w of info.widths) {
        const path=join(new URL('../public/images/resources/',import.meta.url).pathname, name+'-'+w+'.webp');
        if (!existsSync(path)) errors.push(file+': image file missing '+name+'-'+w+'.webp');
      }
    }
    if (!bySource.has(key)) bySource.set(key,[]);
    bySource.get(key).push({file,published,name});
  }
}
for (const [id, entries] of bySource) {
  if (new Set(entries.map(e=>e.file)).size < 2) continue;
  const msg=id+' used in multiple articles: '+entries.map(e=>e.file+' ('+e.name+')').join(', ');
  if (entries.some(e=>e.published >= '2026-10-19')) errors.push(msg);
  else older.push(msg);
}
for(const m of older) console.warn('Legacy photo reuse: '+m);
for(const m of errors) console.error('PHOTO ERROR: '+m);
if(errors.length) process.exit(1);
console.log('Article photography: no new source duplicates, '+older.length+' legacy duplicates to migrate.');
