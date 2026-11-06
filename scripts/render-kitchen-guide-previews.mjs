/**
 * Render the generated kitchen PDF into the actual four WebP page previews.
 * Uses Poppler's pdftoppm, which must be installed wherever this site is built.
 * No fake mockups: the hero and gallery always match the downloadable PDF.
 */
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
const root=process.cwd();
const pdf=resolve(root,'public/downloads/family-kitchen-reset.pdf');
const output=resolve(root,'public/images/guides');
const temporary=await mkdtemp(join(tmpdir(),'omc-kitchen-preview-'));
try {
  execFileSync('pdftoppm',['-f','1','-l','4','-r','140','-png',pdf,join(temporary,'page')],{stdio:'pipe'});
  const pages=(await readdir(temporary)).filter(f=>/^page-[1-4]\.png$/.test(f)).sort((a,b)=>a.localeCompare(b));
  if(pages.length!==4)throw new Error('Expected exactly four rendered pages, found '+pages.length);
  await mkdir(output,{recursive:true});
  for(let i=0;i<pages.length;i++){
    const dest=join(output,'kitchen-guide-page-'+(i+1)+'.webp');
    await sharp(join(temporary,pages[i])).resize({width:1100}).webp({quality:87,effort:5}).toFile(dest);
    console.log('Rendered real kitchen PDF preview page '+(i+1));
  }
} catch(error) {
  throw new Error('Kitchen PDF preview generation requires Poppler pdftoppm: '+error.message);
} finally {await rm(temporary,{recursive:true,force:true});}
