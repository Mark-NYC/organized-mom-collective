import fs from 'node:fs/promises';
import sharp from 'sharp';
import data from '../src/data/family-printables.json' with {type:'json'};
await fs.mkdir('.family-printable-icons',{recursive:true});
for(const name of new Set(Object.values(data).flatMap(resource=>resource.rows.map(row=>row.icon)))){
  await sharp('assets/icons/ofc/updatedicons/svg/'+name+'.svg').resize(240,240).png().toFile('.family-printable-icons/'+name+'.png');
}
