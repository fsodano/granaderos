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
async function source(id){
 const appearance=manifest.appearances[id],bank=manifest.animationLibraries[appearance.gender];
 const [body,animation,equipment,horse]=await Promise.all([load(appearance.lods[1].url),load(bank.url),load(manifest.equipment.url),load(manifest.horse.lods[1].url)]);
 return {manifest,appearance,body,animation,equipment,horse,clips:bank.clips,lod:1};
}
function point(actor,name){actor.root.updateMatrixWorld(true);return actor.root.worldToLocal(actor.model.getObjectByName(name).getWorldPosition(new Vector3()));}
for(const id of ['granadero','woman-scout'])for(const action of ['mount','dismount'])test(`${id} completes ${action} without a seat-placement jump`,async()=>{
 const asset=await source(id),spec=asset.clips.find(clip=>clip.name===`life.${action}`),end=spec.duration*1000;
 const visual={key:`unit:${id}`,id,kind:'unit',appearance:id,skin:'light',side:'player',tacticalLevel:0,position:[4,0,7],yaw:.7,posture:'standing',mounted:action==='mount',action,idleAction:'idle',equipment:'unarmed',items:[],garments:{headwear:null,outfit:null,legwear:null},selected:false,bodyHeights:{},cue:{id:action,action,startedAt:0,durationMs:end,fromPosture:action==='mount'?'standing':'mounted'}};
 const completed=[],actor=new ActorRuntime(asset,visual,(...event)=>completed.push(event));
 const names=['pelvis','foot_l','foot_r','hand_l','hand_r'];
 actor.tick(0,end-.001);const before=Object.fromEntries(names.map(name=>[name,point(actor,name)]));
 actor.tick(0,end);const after=Object.fromEntries(names.map(name=>[name,point(actor,name)]));
 for(const name of names)assert.ok(before[name].distanceTo(after[name])<.001,`${name} jumps ${(before[name].distanceTo(after[name])*100).toFixed(2)} cm at completion`);
 let previous=after.pelvis;
 for(let frame=1;frame<=24;frame++){
  actor.tick(1/120,end+frame*1000/120);const current=point(actor,'pelvis');
  assert.ok(previous.distanceTo(current)<.02,`The pelvis jumps ${(previous.distanceTo(current)*100).toFixed(2)} cm during the pose blend`);previous=current;
 }
 assert.deepEqual(completed,[[visual.key,action]],'The paid cue completes once');
 assert.ok(actor.root.position.distanceTo(new Vector3(...visual.position))<1e-8,'The saved gameplay position does not change');
 if(action==='dismount')assert.ok(actor.model.position.length()<1e-8,'The rider returns to ordinary ground placement');
 actor.dispose();
});
