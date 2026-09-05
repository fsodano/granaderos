import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
export const TERRAIN_MATERIALS=['dry-grass','dirt','cobble','green-grass','mud','floor','plaster','roof','wood'];
export const SCENERY_OBJECTS=['tree','poplar','shrub','rocks'];
export async function verifyTacticalAssets(directory,requireAsset=()=>{}){
 const png=async(name,width,height,sha)=>{
  requireAsset(`/art/${name}`,'tactical atlas contract');
  const bytes=await readFile(resolve(directory,'art',name));
  if(bytes.length<32||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.readUInt32BE(16)!==width||bytes.readUInt32BE(20)!==height)throw Error(`Invalid tactical atlas dimensions: ${name}`);
  if(sha&&createHash('sha256').update(bytes).digest('hex')!==sha)throw Error(`Tactical atlas checksum mismatch: ${name}`);
 };
 for(const faction of ['granadero','royalist']){
  await png(`${faction}-idle-atlas.png`,1536,192);await png(`${faction}-walk-atlas.png`,1536,1536);
  for(const stance of ['crouch','prone'])for(const action of ['idle','walk'])await png(`${faction}-${stance}-${action}-atlas.png`,1536,action==='idle'?192:1536);
 }
 for(const action of ['idle','walk'])await png(`cavalry-${action}-atlas.png`,2048,action==='idle'?256:2048);
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
