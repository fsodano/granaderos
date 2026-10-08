import {register} from 'node:module';register('../tactical-render-loader.mjs',import.meta.url);
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Vector3,Plane} from '../../web/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../../web/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const {ActorRuntime}=await import('../../web/lib/three/actor-runtime.ts');
const {TILE_METRES}=await import('../../web/lib/three/projection.ts');
import {ladderGeometry,sampleLadderClimb,referenceClimbFraction} from '../../game/climb-geometry.js';
const publicRoot=new URL('../../web/public/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('models/characters/manifest.json',publicRoot))),loaded=new Map();
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
 const [body,animation,equipment,horse,garments]=await Promise.all([load(appearance.lods[lod].url),load(library.url),load(manifest.equipment.url),load(manifest.horse.lods[1].url),load(manifest.garments[appearance.gender].url)]);
 return {manifest,appearance,body,animation,equipment,horse,garments,clips:library.clips,lod};
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




function shown(n){for(;n;n=n.parent)if(!n.visible)return false;return true;}
function surface(actor){const lists={all:[],body:[],arms:[],boots:[],clothes:[],head:[]};actor.model.traverse(mesh=>{if(!mesh.isMesh||!shown(mesh))return;const p=mesh.geometry.attributes.position;for(let index=0;index<p.count;index++){const v={mesh,index};lists.all.push(v);if(/footwear/i.test(mesh.name))lists.boots.push(v);else if(/Exposed_Human_Skin/.test(mesh.name))lists.body.push(v);else lists.clothes.push(v);if(mesh.isSkinnedMesh){const si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;let arm=0,head=0;for(let j=0;j<4;j++){const name=mesh.skeleton.bones[si.getComponent(index,j)].name;if(/^(upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)_/.test(name))arm+=sw.getComponent(index,j);if(/^(head|neck)/.test(name))head+=sw.getComponent(index,j);}if(arm>.5)lists.arms.push(v);if(head>.5)lists.head.push(v);}}});return lists;}
function vertices(list){for(const mesh of new Set(list.map(v=>v.mesh)))if(mesh.isSkinnedMesh)mesh.skeleton.update();return list.map(({mesh,index})=>mesh.getVertexPosition(index,new Vector3()).applyMatrix4(mesh.matrixWorld));}
function sample(actor,id,action,g,spec,up,delta=0,extra={}){const f=action==='climbDown'?1-up:up,p=sampleLadderClimb(g,up,spec.climbSupport.feetRest),duration=Math.max(spec.duration,g.height/.65);actor.update(visual(id,action,{cue:undefined,position:[0,g.lower[1]+p.root.height,p.root.forward],motion:{moving:true,segmentFraction:f,climbGeometry:g},...extra}),duration*1000*f);actor.tick(delta,duration*1000*f);actor.root.updateMatrixWorld(true);return p;}
function snapshot(actor){const result={};actor.model.traverse(n=>{if(n.isBone)result[n.name]={p:n.position.toArray(),q:n.quaternion.toArray(),s:n.scale.toArray()};});return result;}
export {asset,visual,manifest,load,point,palm,binding,boot,relative,shape,nativeShape,supportSkin,lowestSurface,surface,vertices,sample,snapshot};
