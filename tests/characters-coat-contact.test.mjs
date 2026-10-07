import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Vector3} from '../web/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../web/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const {ActorRuntime}=await import(process.env.GRANADEROS_ACTOR_RUNTIME??'../web/lib/three/actor-runtime.ts');
const directory=process.env.GRANADEROS_CHARACTER_LIBRARY?pathToFileURL(resolve(process.env.GRANADEROS_CHARACTER_LIBRARY)+sep):new URL('../web/public/models/characters/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',directory))),cache=new Map();
function load(url){
 if(cache.has(url))return cache.get(url);
 assert.ok(url.startsWith('/models/characters/'));
 const bytes=readFileSync(new URL(url.slice('/models/characters/'.length),directory)),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length));
 // Use the actual exported hierarchy and animation; CPU tests need no images.
 delete doc.images;delete doc.textures;delete doc.samplers;doc.materials=(doc.materials??[]).map(({name})=>({name}));
 const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),binary=bytes.subarray(20+length),header=Buffer.from(bytes.subarray(0,20));
 header.writeUInt32LE(20+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);
 const buffer=Buffer.concat([header,padded,binary]);
 const loaded=new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.length),'');cache.set(url,loaded);return loaded;
}
async function source(id,lod){
 const appearance=manifest.appearances[id],bank=manifest.animationLibraries[appearance.gender];
 const [body,animation,equipment]=await Promise.all([load(appearance.lods[lod].url),load(bank.url),load(manifest.equipment.url)]);
 return {manifest,appearance,body,animation,equipment,clips:bank.clips,lod};
}
function visual(id,action,duration){return {key:`unit:${id}`,id,kind:'unit',appearance:id,skin:'light',side:'player',tacticalLevel:0,position:[0,0,0],yaw:0,posture:'standing',mounted:false,action,idleAction:'idle',equipment:'unarmed',items:[],garments:{headwear:null,outfit:null,legwear:null},selected:false,bodyHeights:{},cue:{id:action,action,startedAt:0,durationMs:duration*1000}};}
for(const id of ['granadero','royalist','surgeon'])for(const lod of [0,1,2])test(`${id} LOD ${lod} coat tails stay above the floor through a fall and recovery`,async()=>{
 const asset=await source(id,lod);
 for(const action of ['die','collapse','recover']){
  const spec=asset.clips.find(c=>c.name===`life.stand.${action}`),actor=new ActorRuntime(asset,visual(id,action,spec.duration));
  const mesh=actor.model.getObjectByName(`Human_outfit_LOD${lod}`),indices=[],positions=mesh.geometry.attributes.position;
  assert.ok(mesh.morphTargetDictionary.cloth_supine!==undefined,'The actual coat has a face-up contact shape');
  for(let index=0;index<positions.count;index++)if(positions.getY(index)<1.04&&positions.getY(index)>.66&&positions.getZ(index)<-.10)indices.push(index);
  assert.ok(indices.length>20,'Both exported rear coat panels are present');
  // Recovery starts in the settled ground pose. Prime the same cloth state
  // that the preceding unconscious/dead action supplies in ordinary playback.
  if(action==='recover'){
   actor.update({...visual(id,'unconscious',1),cue:undefined},-1000);
   for(let i=0;i<20;i++)actor.tick(.05,-1000+i*50);
   actor.update(visual(id,action,spec.duration),0);
  }
  let lowest=Infinity;
  const count=Math.ceil(spec.duration*60);
  for(let sample=0;sample<count;sample++){
   const time=spec.duration*sample/count;actor.tick(spec.duration/count,time*1000);actor.root.updateMatrixWorld(true);mesh.skeleton.update();
   for(const index of indices){const point=mesh.getVertexPosition(index,new Vector3()).applyMatrix4(mesh.matrixWorld);lowest=Math.min(lowest,point.y);}
   assert.ok(lowest>-.006,`${action} coat enters the floor by ${(-lowest*1000).toFixed(2)} mm at ${time.toFixed(3)} s`);
  }
  assert.ok(actor.root.position.length()<1e-8,'Garment clearance does not move the saved unit');actor.dispose();
 }
});
