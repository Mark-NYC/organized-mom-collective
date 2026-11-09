/** Editorial category covers for the guide directory; never shown as a raw PDF screenshot. */
import sharp from 'sharp';
import {mkdir,readFile} from 'node:fs/promises';
import {miniGuides} from './lib/kids-chores-mini-guides.mjs';
await mkdir('public/images/guides',{recursive:true});
const esc=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
for(const g of miniGuides){
 const art='data:image/png;base64,'+(await readFile('public/assets/icons/ofc/guides/responsibility/'+g.sections[0].icon+'.png')).toString('base64');
 const big=g.slug.includes('without')?['The Responsibility','Handoff']:['Chores for',g.short];
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="850" height="1100" viewBox="0 0 850 1100"><rect width="850" height="1100" fill="#FBF7F1"/><rect x="70" y="80" width="710" height="10" fill="${g.accent}"/><text x="75" y="142" fill="#545454" font-family="Arial,sans-serif" font-size="23" font-weight="700" letter-spacing="3">ORGANIZED MOM COLLECTIVE</text><text x="75" y="275" fill="#545454" font-family="Georgia,serif" font-size="69">${esc(big[0])}</text><text x="75" y="357" fill="#545454" font-family="Georgia,serif" font-size="69">${esc(big[1])}</text><rect x="75" y="440" width="700" height="465" fill="${g.accent}" opacity=".43"/><image href="${art}" x="234" y="500" width="380" height="335" preserveAspectRatio="xMidYMid meet"/><text x="75" y="973" fill="#545454" font-family="Arial,sans-serif" font-size="26" font-weight="600">FREE ONE-PAGE PRINTABLE</text><text x="75" y="1020" fill="#545454" font-family="Arial,sans-serif" font-size="21">Small habits. Shared responsibility.</text></svg>`;
 await sharp(Buffer.from(svg)).webp({quality:93}).toFile('public/images/guides/'+g.slug+'-cover.webp');
 console.log('Rendered directory cover',g.slug);
}
