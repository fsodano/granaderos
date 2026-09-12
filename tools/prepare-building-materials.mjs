// Package approved generated material art at native game texture density.
import sharp from '../web/node_modules/sharp/lib/index.js';
import {mkdir} from 'node:fs/promises';
import {BUILDING_TYPES} from '../game/building-types.js';
const source='assets/source/building-materials',out='web/public/art/buildings';
await mkdir(out,{recursive:true});
for(const material of ['plaster','clay','brick','timber','thatch'])await sharp(`${source}/${material}-v1.png`).resize(256,256).webp({quality:94}).toFile(`${out}/${material}-v1.webp`);
for(const [name,style] of Object.entries(BUILDING_TYPES)){
 await sharp(`${source}/plaster-v1.png`).resize(256,256).tint(style.wall).modulate({saturation:.75,brightness:.94}).webp({quality:94}).toFile(`${out}/plaster-${name}-v1.webp`);
}
await sharp(`${source}/plaster-v1.png`).resize(256,256).tint('#8c8773').modulate({brightness:.72,saturation:.4}).webp({quality:94}).toFile(`${out}/terrace-v1.webp`);
await sharp(`${source}/cart-v1.png`).resize(256,171).webp({quality:95,alphaQuality:100}).toFile(`${out}/cart-v1.webp`);
console.log('Building materials packaged.');
