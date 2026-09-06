import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spriteLayout,SPRITE_DIRECTIONS,SPRITE_FRAMES,SPRITE_FPS} from '../game/sprite-layouts.js';
import {ILLUSTRATED_SPRITE_ATLASES} from '../game/illustrated-sprite-atlases.js';
export const TERRAIN_MATERIALS=['dry-grass','dirt','cobble','green-grass','mud','floor','plaster','roof','wood'];
export const SCENERY_OBJECTS=['tree','poplar','shrub','rocks','barrels','hay'];
export async function verifyIllustratedSpriteAssets(directory,requireAsset=()=>{}){
 const path='illustrated/manifest.json';requireAsset(`/art/${path}`,'illustrated sprite metadata');
 const manifest=JSON.parse(await readFile(resolve(directory,'art',path),'utf8'));
 if(manifest.version!==1||manifest.style!=='illustrated-pixel-art'||manifest.directions?.join()!==SPRITE_DIRECTIONS.join())throw Error('Invalid illustrated sprite manifest.');
 const names=Object.keys(manifest.atlases??{}).sort();
 if(names.join()!==Object.keys(ILLUSTRATED_SPRITE_ATLASES).sort().join())throw Error('Illustrated sprite runtime index differs from published atlases.');
 for(const name of names){
  const entry=manifest.atlases[name],runtime=ILLUSTRATED_SPRITE_ATLASES[name];
  const minimum=spriteLayout(name.includes('-mounted-')?'cavalry-idle':name).cell;
  // Authored muzzle flashes may need more transparent padding than the old
  // atlas. Validate its density and origin, not the old fixed rectangle.
  const {cell,logicalCell,anchor}=entry;
  const validCell=Number.isInteger(logicalCell)&&logicalCell>=minimum&&logicalCell<=128&&cell===logicalCell*3;
  const validAnchor=anchor?.length===2&&anchor.every(value=>Number.isInteger(value)&&value>0&&value<cell);
  const still=name.endsWith('-idle'),frames=entry.framesPerDirection,width=cell*(still?8:frames),height=cell*(still?1:8);
  if(!/^[a-z-]+$/.test(name)||entry.file!==`${name}.png`||!validCell||!validAnchor||!Number.isInteger(frames)||(still?frames!==1||entry.fps!==0:frames<2||!Number.isFinite(entry.fps)||entry.fps<=0)||entry.size?.join()!==[width,height].join()||!/^[a-f0-9]{64}$/.test(entry.sha256??'')||entry.records?.length!==8*frames)throw Error(`Invalid illustrated sprite layout: ${name}`);
  for(const key of ['file','cell','anchor','logicalCell','framesPerDirection','fps','size'])if(JSON.stringify(entry[key])!==JSON.stringify(runtime[key]))throw Error(`Illustrated sprite runtime index mismatch: ${name} ${key}`);
  const seen=new Set();
  for(const frame of entry.records){
   const key=`${frame.direction}:${frame.frame}`,b=frame.bounds;
   if(!SPRITE_DIRECTIONS.includes(frame.direction)||!Number.isInteger(frame.frame)||frame.frame<0||frame.frame>=frames||seen.has(key)||b?.length!==4||!b.every(Number.isInteger)||b[0]<=0||b[1]<=0||b[2]>=cell||b[3]>=cell||b[0]>=b[2]||b[1]>=b[3]||!/^[a-f0-9]{64}$/.test(frame.sha256??''))throw Error(`Invalid illustrated sprite frame: ${name} ${key}`);
   seen.add(key);
  }
  requireAsset(`/art/illustrated/${entry.file}`,'illustrated sprite atlas');
  const bytes=await readFile(resolve(directory,'art','illustrated',entry.file));
  if(bytes.length<32||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.readUInt32BE(16)!==width||bytes.readUInt32BE(20)!==height)throw Error(`Invalid illustrated sprite dimensions: ${name}`);
  if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error(`Illustrated sprite checksum mismatch: ${name}`);
 }
}
export async function verifyTacticalAssets(directory,requireAsset=()=>{}){
 const png=async(name,width,height,sha)=>{
  requireAsset(`/art/${name}`,'tactical atlas contract');
  const bytes=await readFile(resolve(directory,'art',name));
  if(bytes.length<32||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.readUInt32BE(16)!==width||bytes.readUInt32BE(20)!==height)throw Error(`Invalid tactical atlas dimensions: ${name}`);
  if(sha&&createHash('sha256').update(bytes).digest('hex')!==sha)throw Error(`Tactical atlas checksum mismatch: ${name}`);
 };
 // Native sprites remain explicit migration fallbacks until every illustrated
 // sequence is authored. Validate their full set while they are still selected.
 const pixelPath='pixel/manifest.json';requireAsset(`/art/${pixelPath}`,'native pixel sprites');
 const pixels=JSON.parse(await readFile(resolve(directory,'art',pixelPath),'utf8'));
 if(pixels.version!==1||pixels.style!=='native-resolution-isometric-pixel-art'||pixels.directions?.join()!==SPRITE_DIRECTIONS.join()||pixels.fps!==SPRITE_FPS||pixels.frames_per_direction!==SPRITE_FRAMES)throw Error('Invalid native pixel sprite manifest.');
 const expected=[];
 for(const faction of ['granadero','royalist']){
  for(const action of ['idle','walk','run','fire','reload','strike'])expected.push(`${faction}-${action}`);
  for(const stance of ['crouch'])for(const action of ['idle','walk'])expected.push(`${faction}-${stance}-${action}`);
 }
 for(const family of ['granadero','royalist','civilian']){
  expected.push(`${family}-dead-idle`,`${family}-unconscious-breathe`);
  if(family!=='civilian'){
   for(const action of ['idle','walk','fire','reload'])expected.push(`${family}-prone-armed-${action}`);
   for(const action of ['idle','walk'])expected.push(`${family}-prone-unarmed-${action}`);
  }
 }
 for(const family of ['civilian','cavalry'])for(const action of ['idle','walk'])expected.push(`${family}-${action}`);
 if(Object.keys(pixels.atlases??{}).sort().join()!==expected.sort().join())throw Error('Incomplete native pixel sprite families.');
 for(const name of expected){
  const entry=pixels.atlases[name],{cell,anchor}=spriteLayout(name),idle=name.endsWith('-idle'),rows=idle?1:8;
  if(entry.fps!==(name.includes('-unconscious-')?2:10)||entry.cell!==cell||entry.anchor?.join()!==anchor.join()||entry.size?.join()!==[cell*8,cell*rows].join()||entry.file!==`${name}-atlas.png`||!/^[a-f0-9]{64}$/.test(entry.sha256??'')||entry.frames?.length!==(idle?8:64))throw Error(`Invalid native pixel sprite layout: ${name}`);
  const seen=new Set();
  for(const frame of entry.frames){
   const dir=SPRITE_DIRECTIONS.indexOf(frame.direction),key=`${dir}:${frame.frame}`,phase=frame.frame,b=frame.bounds;
   if(dir<0||!Number.isInteger(phase)||phase<0||phase>=(idle?1:8)||seen.has(key)||frame.rect?.join()!==[(idle?dir:phase)*cell,idle?0:dir*cell,cell,cell].join()||b?.length!==4||!b.every(Number.isInteger)||b[0]<=0||b[1]<=0||b[2]>=cell||b[3]>=cell||b[0]>=b[2]||b[1]>=b[3]||!/^[a-f0-9]{64}$/.test(frame.source_sha256??''))throw Error(`Invalid native pixel sprite frame: ${name} ${key}`);
   seen.add(key);
  }
  await png(`pixel/${entry.file}`,cell*8,cell*rows,entry.sha256);
 }
 await verifyIllustratedSpriteAssets(directory,requireAsset);
 for(const faction of ['granadero','royalist']){
  await png(`${faction}-idle-atlas.png`,1536,192);await png(`${faction}-walk-atlas.png`,1536,1536);
  for(const stance of ['crouch','prone'])for(const action of ['idle','walk'])await png(`${faction}-${stance}-${action}-atlas.png`,1536,action==='idle'?192:1536);
 }
 for(const action of ['idle','walk'])await png(`cavalry-${action}-atlas.png`,2048,action==='idle'?256:2048);
 requireAsset('/art/civilian-animation.json','civilian metadata');
 const civilian=JSON.parse(await readFile(resolve(directory,'art/civilian-animation.json'),'utf8'));
 if(civilian.frame_size?.join()!=='192,192'||civilian.direction_rows?.join()!=='n,ne,e,se,s,sw,w,nw'||civilian.frames_per_direction!==8||civilian.fps!==10||!Array.isArray(civilian.anchor)||civilian.anchor.length!==2||!civilian.anchor.every(Number.isFinite)||Math.abs(civilian.anchor[0]-.5)>.000001||Math.abs(civilian.anchor[1]-.8830497935)>.000001)throw Error('Invalid civilian animation layout or ground anchor.');
 for(const action of ['idle','walk']){
  const entry=civilian.atlases?.[action];
  if(entry?.file!==`civilian-${action}-atlas.png`||entry.frames?.length!==(action==='idle'?8:64)||!/^[a-f0-9]{64}$/.test(entry.sha256??''))throw Error('Incomplete civilian animation.');
  const seen=new Set();for(const frame of entry.frames){const key=`${frame.direction}:${frame.frame}`;if(!civilian.direction_rows.includes(frame.direction)||!Number.isInteger(frame.frame)||frame.frame<0||frame.frame>(action==='idle'?0:7)||seen.has(key)||frame.bounds?.length!==4||!frame.bounds.every(Number.isFinite)||frame.bounds[0]<=0||frame.bounds[1]<=0||frame.bounds[2]>=192||frame.bounds[3]>=192||frame.bounds[0]>=frame.bounds[2]||frame.bounds[1]>=frame.bounds[3])throw Error(`Invalid civilian frame: ${action} ${key}`);seen.add(key);}
  await png(entry.file,1536,action==='idle'?192:1536,entry.sha256);
 }
 requireAsset('/art/combat-animation.json','combat metadata');const combat=JSON.parse(await readFile(resolve(directory,'art/combat-animation.json'),'utf8'));
 if(!Array.isArray(combat.anchor)||combat.anchor.length!==2||!combat.anchor.every(Number.isFinite)||combat.frame_size?.join()!=='192,192'||combat.frames_per_direction!==8||combat.direction_rows?.join()!=='n,ne,e,se,s,sw,w,nw'||Math.abs(combat.anchor?.[0]-.5)>.000001||Math.abs(combat.anchor?.[1]-.8830497935)>.000001)throw Error('Invalid combat animation layout or ground anchor.');
 for(const faction of ['granadero','royalist'])for(const action of ['run','fire','reload','strike']){
  const name=`${faction}-${action}`,entry=combat.actions?.[name];
  if(!/^[a-f0-9]{64}$/.test(entry?.sha256??'')||entry?.file!==`${name}-atlas.png`||entry.frames?.length!==64||entry.world_scale!==(action==='run'?1:3.5/2.6))throw Error(`Incomplete combat animation: ${name}`);
  const seen=new Set();for(const frame of entry.frames){const key=`${frame.direction}:${frame.frame}`;if(!combat.direction_rows.includes(frame.direction)||!Number.isInteger(frame.frame)||frame.frame<0||frame.frame>7||seen.has(key)||frame.bounds?.length!==4||!frame.bounds.every(Number.isFinite)||frame.bounds[0]>=frame.bounds[2]||frame.bounds[1]>=frame.bounds[3]||frame.bounds[0]<=0||frame.bounds[1]<=0||frame.bounds[2]>=192||frame.bounds[3]>=192)throw Error(`Invalid combat frame: ${name} ${key}`);seen.add(key);}
  await png(entry.file,1536,1536,entry.sha256);
 }
 for(const name of [...TERRAIN_MATERIALS.map(n=>`terrain-${n}-v1.webp`),...SCENERY_OBJECTS.map(n=>`scenery-${n}-v1.webp`)]){
  requireAsset(`/art/${name}`,'terrain and scenery');const bytes=await readFile(resolve(directory,'art',name));if(bytes.length<32||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw Error(`Invalid terrain/scenery WebP: ${name}`);
 }
}
