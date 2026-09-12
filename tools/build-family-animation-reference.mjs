import fs from 'node:fs/promises';
import sharp from '../web/node_modules/sharp/lib/index.js';
import {packIllustratedSources} from './pack-illustrated-sprites.mjs';
const [name]=process.argv.slice(2),dir='assets/source/illustrated-sprites/family-actions';
const m=JSON.parse(await fs.readFile(`${dir}/${name}.registration.json`));
const packed=JSON.parse(await fs.readFile(`assets/previews/illustrated-sprites/family-actions/${name}/manifest.json`)).atlases[name];
const width=Math.max(...packed.records.map(r=>r.bounds[2]-r.bounds[0])),height=Math.max(...packed.records.map(r=>r.bounds[3]-r.bounds[1]));
const factor=Math.min(270/width,240/height);
for(const s of m.sheets){s.cell=320;s.logicalCell=320;s.anchor=[160,275];for(const slot of s.slots){const r=packed.records.find(r=>r.direction===slot.direction&&r.frame===slot.frame);slot.anchor=[(r.sourceBounds[0]+r.sourceBounds[2])/2,r.sourceBounds[3]];slot.scale*=factor;}}
const path=`${dir}/${name}-reference.registration.json`;await fs.writeFile(path,JSON.stringify(m,null,2));
await packIllustratedSources({manifestPath:path,destination:'assets/previews/illustrated-sprites/family-reference'});
for(const [half,top] of [['north',0],['south',1280]])await sharp(`assets/previews/illustrated-sprites/family-reference/${name}.png`).extract({left:0,top,width:1280,height:1280}).flatten({background:'#ff00ff'}).png().toFile(`${dir}/${name}-${half}-reference.png`);
console.log(name,'reference pair');
