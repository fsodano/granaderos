import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Vector3,Plane} from '../web/node_modules/three/build/three.module.js';
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

test('shared ladder ends outside the measured roof edge and retains every saved endpoint',()=>{
 for(const [height,dx,dz]of [[2,TILE_METRES,0],[3,TILE_METRES,TILE_METRES],[4.2,0,TILE_METRES],[3,0,0]]){
  const g=ladderGeometry([0,.4,0],[dx,height+.4,dz],TILE_METRES);
  assert.deepEqual(g.upper,[dx,height+.4,dz]);assert.equal(g.top[1],height+.4);
  assert.ok(g.ladderSpan<=g.edgeSpan);assert.equal(g.steps,Math.max(2,Math.ceil(Math.hypot(g.ladderSpan-g.baseSpan,height)/.29)));
  if(dx===0&&dz===0){assert.equal(g.baseSpan,-.45);assert.deepEqual(g.base,[0,.4,-.45]);assert.deepEqual(g.top,[0,height+.4,-.45]);assert.ok(g.hatch.maxForward<-.123);assert.ok(g.hatch.minAcross<-.55&&g.hatch.maxAcross>.55);}else assert.equal(g.hatch,undefined);
  const start=sampleLadderClimb(g,0),end=sampleLadderClimb(g,1);
  assert.deepEqual(start.root,{height:0,forward:0});assert.deepEqual(end.root,{height,forward:g.span});
  for(const t of [.08,.12,.70,.76,.82,.84,.85,.86,.91,.96]){
   const a=sampleLadderClimb(g,t-1e-7),b=sampleLadderClimb(g,t+1e-7);
   assert.ok(Math.hypot(a.root.height-b.root.height,a.root.forward-b.root.forward)<.001,'The physical root has no phase seam');
  }
  for(let i=13;i<75;i++){
   const p=sampleLadderClimb(g,i/100),supported=Object.values(p.feet).filter(c=>c.planted).length+Object.values(p.hands).filter(c=>c.planted&&c.weight>.999).length;
   assert.ok(supported>=3,'The rung cycle retains three supports');
   const f=referenceClimbFraction(g,i/100,ladderGeometry([0,0,0],[0,3,TILE_METRES],TILE_METRES));assert.ok(f>=.12&&f<=.76);
  }
 }
});

for(const appearance of ['granadero','woman-scout'])test(`${appearance} stored native climbs reach actual rungs and roof supports without runtime fitting`,async()=>{
 const source=await asset(appearance);
 for(const action of ['climbUp','climbDown']){
  const spec=source.clips.find(clip=>clip.name==='life.'+action),g=ladderGeometry([0,0,0],[0,3,TILE_METRES],TILE_METRES),actor=new ActorRuntime(source,visual(appearance,action,{cue:undefined,motion:{moving:true,segmentFraction:0,climbGeometry:g}})),contacts=binding(source,spec);let checks=0,largest=0;
  assert.equal(spec.source.type,'native-ladder-contact-authoring');assert.equal(spec.sampleRate,60);
  for(let i=1;i<200;i++){
   const f=i/200,up=action==='climbDown'?1-f:f,plan=sampleLadderClimb(g,up,spec.climbSupport.feetRest);actor.update(visual(appearance,action,{cue:undefined,motion:{moving:true,segmentFraction:f,climbGeometry:g}}),spec.duration*1000*f);actor.tick(0,spec.duration*1000*f);actor.root.updateMatrixWorld(true);
   for(const side of ['l','r'])for(const [contact,actual]of [[plan.feet[side],boot(actor,side,contacts)],[plan.hands[side],palm(actor,side)]])if(contact.planted&&(contact.weight===undefined||contact.weight>.999)){
    const gap=actual.distanceTo(relative(plan,contact));largest=Math.max(largest,gap);checks++;assert.ok(gap<.025,`${action} ${side} at ${up}: stored contact gap ${(gap*1000).toFixed(2)} mm`);
   }
  }
  assert.ok(checks>500);assert.equal(actor.climbFit.maximumAdjustment,0,'The reference used no runtime contact fit');
  actor.dispose();
 }
});

for(const appearance of ['granadero','woman-scout'])test(`${appearance} height, diagonal and vertical ladder fits preserve native anatomy and contact timing`,async()=>{
 const source=await asset(appearance);
 for(const [height,dx,dz,yaw]of [[2,0,TILE_METRES,0],[4.2,TILE_METRES,0,Math.PI/2],[3,TILE_METRES,TILE_METRES,Math.PI/4],[3,0,0,0]])for(const action of ['climbUp','climbDown']){
  const g=ladderGeometry([0,0,0],[dx,height,dz],TILE_METRES),spec=source.clips.find(clip=>clip.name==='life.'+action),contacts=binding(source,spec),actor=new ActorRuntime(source,visual(appearance,action,{yaw,cue:undefined,motion:{moving:true,segmentFraction:0,climbGeometry:g}}));
  actor.tick(0,0);const offsets=shape(actor);let largestFit=0;
  for(let i=1;i<100;i++){
   const f=i/100,up=action==='climbDown'?1-f:f,plan=sampleLadderClimb(g,up,spec.climbSupport.feetRest);
   actor.update(visual(appearance,action,{yaw,cue:undefined,motion:{moving:true,segmentFraction:f,climbGeometry:g}}),spec.duration*1000*f);actor.tick(0,spec.duration*1000*f);actor.root.updateMatrixWorld(true);nativeShape(actor,offsets);
   assert.equal(actor.climbFit.rejectedFits,0,'All tested authored contact differences stay in the measured fit range');largestFit=Math.max(largestFit,actor.climbFit.maximumAdjustment);
   for(const side of ['l','r'])for(const [contact,actual]of [[plan.feet[side],boot(actor,side,contacts)],[plan.hands[side],palm(actor,side)]])if(contact.planted&&(contact.weight===undefined||contact.weight>.999))assert.ok(actual.distanceTo(relative(plan,contact))<.025,`${height} m ${action} ${side} at ${up}: contact gap ${(actual.distanceTo(relative(plan,contact))*1000).toFixed(2)} mm`);
   closeVector(actor.root.position,[4,0,7],1e-8,'Contact fitting leaves the gameplay position intact');
  }
  assert.ok(largestFit<=.65);actor.dispose();
 }
});

for(const appearance of ['granadero','woman-scout'])test(`${appearance} actual high-detail palms and sole rings stay on the supported roof`,async()=>{
 const source=await asset(appearance,0);
 for(const span of [TILE_METRES,0])for(const action of ['climbUp','climbDown']){
  const g=ladderGeometry([0,0,0],[0,3,span],TILE_METRES),spec=source.clips.find(clip=>clip.name==='life.'+action),actor=new ActorRuntime(source,visual(appearance,action,{cue:undefined,motion:{moving:true,segmentFraction:0,climbGeometry:g}})),skin=supportSkin(actor);
  for(const up of [.82,.84,.86,.88,.90,.91,.94,.96]){
   const f=action==='climbDown'?1-up:up,plan=sampleLadderClimb(g,up,spec.climbSupport.feetRest);actor.update(visual(appearance,action,{cue:undefined,motion:{moving:true,segmentFraction:f,climbGeometry:g}}),spec.duration*1000*f);actor.tick(0,spec.duration*1000*f);actor.root.updateMatrixWorld(true);
   for(const side of ['l','r'])for(const [group,contact]of [['feet',plan.feet[side]],['hands',plan.hands[side]]])if(contact.planted&&contact.roofWeight>.999&&(contact.weight===undefined||contact.weight>.999)&&!(contact.restWeight>0)){
    assert.ok(skin[group][side].length>30,'The check samples real published surface vertices');
    const height=lowestSurface(actor,skin[group][side])+plan.root.height-g.height;
    assert.ok(height>-.004,`${span===0?'vertical':'inclined'} ${action} ${side} ${group} at ${up}: actual roof penetration ${(-height*1000).toFixed(2)} mm`);
   }
  }
  actor.dispose();
 }
});

test('held vertical rung and roof fractions cannot accumulate runtime limb adjustments',async()=>{
 const appearance='woman-scout',source=await asset(appearance),spec=source.clips.find(clip=>clip.name==='life.climbUp'),g=ladderGeometry([0,0,0],[0,3,0],TILE_METRES),actor=new ActorRuntime(source,visual(appearance,'climbUp',{cue:undefined,motion:{moving:true,segmentFraction:0,climbGeometry:g}}));
 for(const fraction of [.22,.48,.72,.84,.90]){
  actor.update(visual(appearance,'climbUp',{cue:undefined,motion:{moving:true,segmentFraction:fraction,climbGeometry:g}}),0);actor.tick(0,0);actor.root.updateMatrixWorld(true);
  const pose=new Map();actor.model.traverse(node=>{if(node.isBone)pose.set(node.name,node.quaternion.clone());});
  for(let repeat=0;repeat<20;repeat++){actor.tick(0,0);actor.root.updateMatrixWorld(true);actor.model.traverse(node=>{if(node.isBone){const expected=pose.get(node.name).toArray();assert.ok(node.quaternion.toArray().every((value,index)=>Math.abs(value-expected[index])<1e-9),`${node.name} keeps the same native fit at held ${fraction}`);}});}
 }
 actor.dispose();
});
