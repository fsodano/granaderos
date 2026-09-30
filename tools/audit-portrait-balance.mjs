import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {CHARACTER_PORTRAITS,SELECTABLE_CHARACTER_PORTRAITS,PORTRAIT_GENDERS,PORTRAIT_ROLES,PORTRAIT_SKIN_TONES,PORTRAITS_PER_COMBINATION,LEGACY_ONLY_PORTRAIT_IDS} from '../game/character-portraits.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(root,'web/package.json')),sharp=require('sharp');
const before=JSON.parse(await readFile(resolve(root,'assets/prompts/portrait-expansion/audit-before.json'),'utf8'));
const out=resolve(root,'assets/previews/portrait-balance');
const reports=[],hashes=new Set(),images=new Map();
assert.equal(SELECTABLE_CHARACTER_PORTRAITS.length,180);
for(const p of SELECTABLE_CHARACTER_PORTRAITS){
 const bytes=await readFile(resolve(root,`web/public${p.src}`));
 // Legacy portrait 103 keeps its full-size PNG in assets/web and a reduced game copy.
 // Every other portrait, including all additions, has byte-identical production copies.
 if(p.id==='103'){
  const metadata=await sharp(bytes).metadata();
  assert.equal(metadata.width,384);assert.equal(metadata.height,384);
 }else assert.ok(bytes.equals(await readFile(resolve(root,`assets/web/${p.src.split('/').at(-1)}`))),`Production copies differ: ${p.id}`);
 const sha256=createHash('sha256').update(bytes).digest('hex');
 assert.ok(!hashes.has(sha256),`Duplicate artwork: ${p.id}`);hashes.add(sha256);
 images.set(p.id,{bytes,sha256});
}
await mkdir(out,{recursive:true});
const textSvg=(text,width,height,size=18)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#ede1c3"/><text x="12" y="${height/2+size/3}" fill="#292819" font-size="${size}" font-family="Arial,sans-serif">${text}</text></svg>`);
for(const gender of PORTRAIT_GENDERS)for(const role of PORTRAIT_ROLES){
 const cell=224,gap=8,left=112,top=52,rowHeight=256,width=1280,height=top+3*rowHeight;
 const layers=[{input:textSvg(`${gender.name} · ${role.name} · 5 retratos por tono de piel`,width,top,22),left:0,top:0}];
 for(const [row,tone]of PORTRAIT_SKIN_TONES.entries()){
  const matches=SELECTABLE_CHARACTER_PORTRAITS.filter(p=>p.gender===gender.id&&p.role===role.id&&p.skinTone===tone.id);
  assert.equal(matches.length,PORTRAITS_PER_COMBINATION,`${gender.id}/${role.id}/${tone.id}`);
  reports.push({gender:gender.id,role:role.id,skinTone:tone.id,before:before.groups.find(g=>g.gender===gender.id&&g.role===role.id&&g.skinTone===tone.id).before,count:matches.length,portraits:matches.map(p=>({id:p.id,src:p.src,sha256:images.get(p.id).sha256}))});
  layers.push({input:textSvg(tone.name,left,cell,17),left:0,top:top+row*rowHeight});
  for(const [column,p]of matches.entries()){
   const x=left+column*(cell+gap),y=top+row*rowHeight;
   layers.push({input:await sharp(images.get(p.id).bytes).resize(cell,cell,{fit:'cover'}).toBuffer(),left:x,top:y});
   layers.push({input:textSvg(`${column+1}. ${p.name}`,cell,28,12),left:x,top:y+cell});
  }
 }
 await sharp({create:{width,height,channels:3,background:'#ede1c3'}}).composite(layers).webp({quality:88}).toFile(resolve(out,`${gender.id}-${role.id}.webp`));
}
const totals=key=>Object.fromEntries([...new Set(SELECTABLE_CHARACTER_PORTRAITS.map(p=>p[key]))].map(value=>[value,SELECTABLE_CHARACTER_PORTRAITS.filter(p=>p[key]===value).length]));
const report={targetPerCombination:5,combinations:reports.length,selectable:SELECTABLE_CHARACTER_PORTRAITS.length,uniqueArtwork:hashes.size,byGender:totals('gender'),byRole:totals('role'),bySkinTone:totals('skinTone'),totalSaveCompatible:CHARACTER_PORTRAITS.length,legacyOnlyIds:LEGACY_ONLY_PORTRAIT_IDS,legacySourceSizeExceptions:['103'],groups:reports};
await mkdir(resolve(root,'docs/evidence'),{recursive:true});
await writeFile(resolve(root,'docs/evidence/portrait-balance-2026-09-27.json'),JSON.stringify(report,null,2)+'\n');
console.log(`Verified ${reports.length} combinations × 5 = ${hashes.size} unique selectable portraits. Saved 12 review sheets.`);
