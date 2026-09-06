// Contact sheet for checking the current paid roster and its portrait mapping.
import {createRequire} from 'node:module';
import {CIVIC_RECRUITS} from '../game/recruitment.js';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../web/package.json',import.meta.url));
const sharp=require('sharp');
const root=new URL('../',import.meta.url),tiles=[];
for(let i=0;i<CIVIC_RECRUITS.length;i++){
 const op=CIVIC_RECRUITS[i],x=(i%8)*150,y=Math.floor(i/8)*176;
 const source=new URL(`web/public/art/portrait-${op.id}.${[103,104].includes(op.id)?'png':'webp'}`,root);
 tiles.push({input:await sharp(fileURLToPath(source)).resize(142,142).toBuffer(),left:x+4,top:y+4});
 const label=op.nickname.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 tiles.push({input:Buffer.from(`<svg width="150" height="26"><text x="75" y="18" text-anchor="middle" fill="#eedbb5" font-family="Georgia" font-size="13">${label}</text></svg>`),left:x,top:y+147});
}
await sharp({create:{width:1200,height:Math.ceil(CIVIC_RECRUITS.length/8)*176,channels:3,background:'#172b29'}}).composite(tiles).webp({quality:88}).toFile(fileURLToPath(new URL('assets/previews/mercenary-roster-48.webp',root)));
