// Merge the complete family library into the existing staging manifest.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from '../web/node_modules/sharp/lib/index.js';
import {SPRITE_APPEARANCES} from '../game/sprite-appearances.js';
import {FAMILY_SPRITE_SEQUENCES} from '../game/sprite-family-sequences.js';
const root='assets/previews/illustrated-sprites',destination=`${root}/packed`;
const manifest=JSON.parse(await fs.readFile(`${destination}/manifest.json`));
const additions=[];
for(const appearance of Object.keys(SPRITE_APPEARANCES))for(const sequence of [...FAMILY_SPRITE_SEQUENCES,'dead-idle']){
 const name=`${appearance}-${sequence}`,directory=`${root}/family-actions/${name}`;
 let entry;
 try{entry=JSON.parse(await fs.readFile(`${directory}/manifest.json`)).atlases[name];}catch(e){if(e.code!=='ENOENT')throw e;if(!manifest.atlases[name])throw Error(`Missing ${name}`);continue;}
 const bytes=await fs.readFile(`${directory}/${entry.file}`),metadata=await sharp(bytes).metadata();
 if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error(`Checksum ${name}`);
 if(metadata.width!==entry.size[0]||metadata.height!==entry.size[1])throw Error(`Dimensions ${name}`);
 for(const direction of manifest.directions)for(let frame=0;frame<entry.framesPerDirection;frame++)if(entry.records.filter(r=>r.direction===direction&&r.frame===frame).length!==1)throw Error(`Slot ${name}:${direction}:${frame}`);
 additions.push({entry,name,bytes});
}
for(const {entry,name,bytes} of additions){await fs.writeFile(`${destination}/${entry.file}`,bytes);manifest.atlases[name]=entry;}
await fs.writeFile(`${destination}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
console.log(`Staged ${additions.length} family atlases after checksum, dimensions and slot checks.`);
