import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Vector3,Plane,Quaternion} from '../web/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../web/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {TILE_METRES}=await import('../web/lib/three/projection.ts');
import {ladderGeometry,sampleLadderClimb,referenceClimbFraction} from '../game/climb-geometry.js';
const publicRoot=new URL('../web/public/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('models/characters/manifest.json',publicRoot))),loaded=new Map();
function load(url){
 if(loaded.has(url))return loaded.get(url);
 // Keep published buffers, rig, and animation tracks. Browser image decoding
 // is not required for CPU contact checks on the actual skinned geometry.
 const bytes=readFileSync(new URL(`.${url}`,publicRoot)),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length));
 delete doc.images;delete doc.textures;delete doc.samplers;doc.materials=(doc.materials??[]).map(material=>({name:material.name}));
 const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),binary=bytes.subarray(20+length),header=Buffer.from(bytes.subarray(0,20));
 header.writeUInt32LE(20+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);
 const buffer=Buffer.concat([header,padded,binary]),promise=new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.length),'');loaded.set(url,promise);return promise;
}
async function asset(id,lod=1){
 const appearance=manifest.appearances[id],library=manifest.animationLibraries[appearance.gender];
 const [body,animation,equipment,horse]=await Promise.all([load(appearance.lods[lod].url),load(library.url),load(manifest.equipment.url),load(manifest.horse.lods[1].url)]);
 return {manifest,appearance,body,animation,equipment,horse,clips:library.clips,lod};
}
function visual(id,action,extra={}){
 const mounted=false;
 return {key:`unit:${id}`,id,kind:'unit',appearance:id,skin:'light',side:'player',tacticalLevel:0,position:[4,0,7],yaw:0,posture:'standing',mounted,action,idleAction:'idle',equipment:'unarmed',items:[],garments:{headwear:null,outfit:null,legwear:null},selected:false,bodyHeights:{},cue:{id:`${id}:${action}`,action,startedAt:0,fromPosture:mounted?'standing':'mounted'},...extra};
}
function point(actor,name){actor.root.updateMatrixWorld(true);return actor.root.worldToLocal(actor.model.getObjectByName(name).getWorldPosition(new Vector3()));}
function closeVector(actual,expected,tolerance,message){assert.ok(actual.distanceTo(new Vector3(...expected))<tolerance,`${message}: ${actual.toArray()} != ${expected}`);}

function palm(actor,side){return point(actor,'hand_'+side).lerp(point(actor,'middle_01_'+side),.72);}
function binding(source,spec){source.body.scene.updateMatrixWorld(true);return Object.fromEntries(['l','r'].map(side=>[side,source.body.scene.getObjectByName('foot_'+side).worldToLocal(new Vector3(...spec.climbSupport.feetBindRest[side]))]));}
function boot(actor,side,binding){actor.root.updateMatrixWorld(true);return actor.root.worldToLocal(actor.model.getObjectByName('foot_'+side).localToWorld(binding[side].clone()));}
function relative(plan,contact){return new Vector3(...contact.position).sub(new Vector3(0,plan.root.height,plan.root.forward));}
function shape(actor){const values=new Map();actor.model.traverse(node=>{if(node.isBone)values.set(node.name,{position:node.position.clone(),scale:node.scale.clone()});});return values;}
function nativeShape(actor,values){actor.model.traverse(node=>{if(node.isBone){if(node.name!=='Root')assert.ok(node.position.distanceTo(values.get(node.name).position)<.0001,node.name+' keeps its native joint offset');assert.ok(node.scale.distanceTo(values.get(node.name).scale)<.0001,node.name+' keeps its native scale');}});}
function supportSkin(actor){
 const result={feet:{l:[],r:[]},hands:{l:[],r:[]}};
 actor.model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const position=mesh.geometry.attributes.position,indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
  for(let index=0;index<position.count;index++)for(const side of ['l','r']){
   if(mesh.name.startsWith('Human_footwear_')&&Math.abs(position.getY(index)-.007)<.0001&&(position.getX(index)>0)===(side==='l'))result.feet[side].push({mesh,index});
   if(!mesh.name.startsWith('Exposed_Human_Skin'))continue;
   let handWeight=0;for(let j=0;j<4;j++){const bone=mesh.skeleton.bones[indices.getComponent(index,j)].name;if(/^(hand|thumb|index|middle|ring|pinky)_/.test(bone)&&bone.endsWith('_'+side))handWeight+=weights.getComponent(index,j);}
   if(handWeight>.7)result.hands[side].push({mesh,index});
  }
 });return result;
}
function lowestSurface(actor,vertices){
 const meshes=new Set(vertices.map(vertex=>vertex.mesh));for(const mesh of meshes)mesh.skeleton.update();
 return Math.min(...vertices.map(({mesh,index})=>actor.root.worldToLocal(mesh.getVertexPosition(index,new Vector3()).applyMatrix4(mesh.matrixWorld)).y));
}

function bootSkin(actor){const result={l:[],r:[]};actor.model.traverse(mesh=>{if(!mesh.isSkinnedMesh||!mesh.name.startsWith('Human_footwear_'))return;const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)result[p.getX(i)>0?'l':'r'].push({mesh,index:i});});return result;}

function clocks(actor){return [actor.action.time,actor.action.timeScale,actor.mixer.time];}
function snapshot(actor){const result=new Map();actor.model.traverse(n=>{if(n.isBone)result.set(n.name,{position:n.position.toArray(),scale:n.scale.toArray(),rotation:n.quaternion.toArray()});});return result;}
function sample(actor,appearance,action,g,spec,up){const f=action==='climbDown'?1-up:up,p=sampleLadderClimb(g,up,spec.climbSupport.feetRest),duration=Math.max(spec.duration,g.height/.65);actor.update(visual(appearance,action,{cue:undefined,position:[0,g.lower[1]+p.root.height,p.root.forward],motion:{moving:true,segmentFraction:f,climbGeometry:g}}),f*duration*1000);actor.tick(0,f*duration*1000);actor.root.updateMatrixWorld(true);return p;}
for(const appearance of ['granadero','woman-scout'])for(const lod of [0,1,2])for(const action of ['climbUp','climbDown'])test(`${appearance} LOD${lod} ${action}: reachable tall rung hands retain contact and native body`,async()=>{
 const source=await asset(appearance,lod),spec=source.clips.find(c=>c.name==='life.'+action);
 for(const height of [2,3,4.2,5.6]){
  const base=height===5.6?1.2:height===4.2?1.1:.4,g=ladderGeometry([0,base,0],[0,base+height,TILE_METRES],TILE_METRES),actor=new ActorRuntime(source,visual(appearance,action,{cue:undefined,position:[0,0,0],motion:{moving:true,segmentFraction:0,climbGeometry:g}})),native=new ActorRuntime(source,visual(appearance,action,{cue:undefined,position:[0,0,0],motion:{moving:true,segmentFraction:0,climbGeometry:g}}));native.climbFit.apply=()=>{};
  const full=bootSkin(actor),samples=new Set(Array.from({length:151},(_,i)=>i/150));
  // Real 240 Hz arrivals cover the old .65 m rejection interval and the
  // full-weight/fading edges; coarse samples cover the entire paid route.
  const duration=Math.max(spec.duration,height/.65);for(const [a,b]of [[.085,.115],[.635,.665],[.905,.985]])for(let up=a;up<=b;up+=1/(duration*240))samples.add(up);
  let contacts=0,roofChecks=0;
  for(const up of [...samples].sort((a,b)=>action==='climbDown'?b-a:a-b)){
   const plan=sample(actor,appearance,action,g,spec,up);sample(native,appearance,action,g,spec,up);assert.equal(actor.climbFit.rejectedFits,0,`${height}m ${up}: no reachable hand is rejected`);
   const n=snapshot(native),fitted=snapshot(actor);for(const [name,bone]of fitted){assert.deepEqual(bone.position,n.get(name).position,`${name}: native offsets`);assert.deepEqual(bone.scale,n.get(name).scale,`${name}: native dimensions`);if(!/^(thigh|calf|foot|upperarm|lowerarm|hand)_[lr]$/.test(name))assert.deepEqual(bone.rotation,n.get(name).rotation,`${name}: unrelated native rotation`);}
   assert.deepEqual(actor.root.position.toArray(),native.root.position.toArray());assert.deepEqual(actor.root.quaternion.toArray(),native.root.quaternion.toArray());assert.deepEqual(clocks(actor),clocks(native));
   for(const side of ['l','r']){const hand=plan.hands[side];if(hand.weight>.999){const target=new Vector3(hand.position[0],base+hand.position[1],hand.position[2]);assert.ok(actor.root.localToWorld(palm(actor,side)).distanceTo(target)<.025,`${height}m ${up}: moving and planted palm contact`);contacts++;}
    const foot=plan.feet[side];if(foot.planted&&foot.roofWeight>.999&&!(foot.restWeight>0)){assert.ok(full[side].length>100,'Complete weighted boot surface');assert.ok(lowestSurface(actor,full[side])+plan.root.height-height>-.004,`${height}m ${up}: complete roof boot clearance`);roofChecks++;}
   }
  }
  assert.ok(contacts>100);assert.ok(roofChecks>10);actor.dispose();native.dispose();
 }
});
for(const appearance of ['granadero','woman-scout'])test(`${appearance}: finite and unreachable targets retain native fallback`,async()=>{
 const source=await asset(appearance,0),spec=source.clips.find(c=>c.name==='life.climbUp'),g=ladderGeometry([0,.4,0],[0,6,TILE_METRES],TILE_METRES),actor=new ActorRuntime(source,visual(appearance,'climbUp',{cue:undefined,motion:{moving:true,segmentFraction:.65,climbGeometry:g}}));sample(actor,appearance,'climbUp',g,spec,.65);actor.climbFit.restore();const pose=snapshot(actor),position=actor.root.position.toArray(),clock=clocks(actor);
 for(const height of [NaN,Infinity,100000]){actor.climbFit.apply({...g,height},.65,spec);assert.equal(actor.climbFit.rejectedFits,Number.isFinite(height)?4:0);assert.deepEqual(snapshot(actor),pose);assert.deepEqual(actor.root.position.toArray(),position);assert.deepEqual(clocks(actor),clock);assert.ok(Number.isFinite(actor.climbFit.maximumAdjustment));actor.climbFit.restore();}
 assert.equal(actor.climbFit.adjustmentLimit,.65,'Original foot/fading-hand displacement limit');actor.dispose();
});

for(const appearance of ['granadero','woman-scout'])for(const action of ['climbUp','climbDown'])test(`${appearance} ${action}: invalid climb inputs keep native mixer and all bone matrices finite`,async()=>{
 const source=await asset(appearance),spec=source.clips.find(c=>c.name==='life.'+action),base=ladderGeometry([0,.4,0],[0,6,TILE_METRES],TILE_METRES),actor=new ActorRuntime(source,visual(appearance,action,{cue:undefined,position:[4,.4,7],motion:{moving:true,segmentFraction:.65,climbGeometry:base}}));
 for(const [key,value]of [['height',NaN],['span',Infinity],['edgeSpan',NaN],['ladderSpan',Infinity],['steps',NaN],['baseSpan',NaN],['fraction',NaN],['fraction',Infinity]]){const fraction=key==='fraction'?value:.65,g=key==='fraction'?base:{...base,[key]:value};actor.update(visual(appearance,action,{cue:undefined,position:[4,.4,7],motion:{moving:true,segmentFraction:fraction,climbGeometry:g}}),100);actor.tick(0,100);actor.root.updateMatrixWorld(true);assert.equal(actor.action.time,actor.action.getClip().duration*(key==='fraction'?(action==='climbDown'?1:0):.65));assert.ok(clocks(actor).every(Number.isFinite));actor.model.traverse(node=>{if(node.isBone)assert.ok(node.matrixWorld.elements.every(Number.isFinite),node.name+' retains a finite complete world matrix');});assert.deepEqual(actor.root.position.toArray(),[4,.4,7]);}
 actor.dispose();
});
