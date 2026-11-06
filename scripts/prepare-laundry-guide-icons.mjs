/** Original hand-drawn laundry line artwork, shared by the guide, PDF and page previews.
 * Transparent backgrounds, intentionally irregular strokes and rounded joins.
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const output=join(process.cwd(),'public/assets/icons/ofc/guides/laundry');
const drawings={
 hamper:`<path d="M27 40 Q48 35 74 41 L69 91 Q51 98 33 90 Z"/><path d="M23 36 Q49 27 77 36 L77 43 Q50 49 24 43 Z"/><path d="M39 56 L42 78 M52 54 L52 83 M65 56 L61 78"/><path d="M36 30 Q48 21 63 29"/>`,
 sort:`<path d="M15 39 Q26 26 40 35 L49 45 L56 36 Q69 27 81 41 L87 80 Q53 88 13 80 Z"/><path d="M48 47 L48 79 M27 54 L34 59 M70 54 L64 61"/><path d="M26 26 Q29 17 41 21 M64 24 Q76 19 79 30"/>`,
 washer:`<path d="M21 15 Q48 12 79 17 L80 88 Q49 92 20 87 Z"/><circle cx="50" cy="57" r="25"/><path d="M34 57 Q43 45 50 54 T67 53 M30 63 Q48 72 69 61"/><circle cx="31" cy="28" r="3"/><path d="M45 29 L68 29"/>`,
 fold:`<path d="M17 28 L35 18 Q49 12 65 21 L84 32 L73 47 L64 40 L64 82 Q45 86 28 81 L28 40 L19 48 Z"/><path d="M29 52 Q47 57 64 51 M29 67 Q45 70 64 64"/><path d="M42 19 Q47 26 52 19"/>`,
 drawer:`<path d="M16 29 Q50 25 85 30 L82 85 Q48 89 18 84 Z"/><path d="M19 47 Q48 51 83 46 M18 65 Q49 70 83 65"/><path d="M43 38 Q50 41 57 38 M44 57 Q50 60 57 57 M44 76 Q50 78 57 76"/><path d="M29 25 L29 20 M70 25 L70 20"/>`,
 towel:`<path d="M27 25 Q48 21 72 25 L72 82 Q49 86 26 82 Z"/><path d="M28 43 Q49 48 72 42 M29 54 Q48 58 71 54"/><path d="M35 64 L35 76 M45 63 L45 76 M55 64 L55 76 M65 64 L65 76"/>`,
 clock:`<circle cx="50" cy="51" r="34"/><path d="M50 28 L50 52 L67 60"/><path d="M49 12 L49 6 M87 50 L94 50 M50 87 L50 94 M12 51 L6 51"/><path d="M31 22 L25 17 M73 78 L79 84"/>`,
 hands:`<path d="M15 60 Q22 48 29 57 L39 70 Q45 75 51 70 L66 52 Q73 46 79 54 Q83 60 76 68 L58 86 Q47 95 36 85 Z"/><path d="M18 61 L9 72 M79 56 L89 67"/><path d="M38 47 Q31 34 38 27 Q44 23 50 30 Q54 17 62 25 Q70 33 60 43 L49 56 Z"/>`,
 check:`<path d="M18 53 L39 73 L81 28"/><path d="M24 29 Q33 18 47 17 M68 21 Q79 25 84 38 M81 70 Q69 87 45 87 M26 80 Q17 71 16 61"/>`,
 shelf:`<path d="M18 30 L83 29 L84 84 L17 84 Z"/><path d="M19 57 L83 57 M39 31 L39 55 M60 32 L60 55 M49 59 L49 84"/><path d="M24 43 Q31 38 37 43 M64 72 Q72 68 79 73"/>`
};
await mkdir(output,{recursive:true});
for(const [name,body] of Object.entries(drawings)){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 100 100"><g fill="none" stroke="#545454" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
 await sharp(Buffer.from(svg)).png().toFile(join(output,name+'.png'));
 console.log('Prepared original transparent laundry drawing '+name);
}
