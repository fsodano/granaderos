import {register}from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {Vector3}from '../web/node_modules/three/build/three.module.js';import {publishedActor}from './published-actor-fixture.mjs';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
// The native support solver fits the complete weighted boot to this plane.
// A prone toe/shaft can be lower than the sole ring, so check its full surface.
const supportHeight=.006,proneContactTolerance=.001;
function visual(appearance,posture='crouched'){return{key:'unit:grounding',id:'grounding',kind:'unit',appearance,skin:'light',side:'player',position:[0,0,0],yaw:0,tacticalLevel:0,posture,mounted:false,action:'idle',idleAction:'idle',equipment:'unarmed',items:[],garments:{},selected:false,bodyHeights:{}};}
for(const appearance of ['granadero','woman-scout'])test(`${appearance} stored crouched soles and full boots retain supported native steps`,async()=>{
 const source=await publishedActor(appearance,0),actor=new ActorRuntime(source,visual(appearance)),mesh=actor.model.getObjectByName('Human_footwear_LOD0'),position=mesh.geometry.attributes.position;
 const sole={l:[],r:[]},all={l:[],r:[]};for(let index=0;index<position.count;index++){const side=position.getX(index)>0?'l':'r';all[side].push(index);if(Math.abs(position.getY(index)-.007)<.0002)sole[side].push(index);}
 for(const side of ['l','r'])assert.ok(sole[side].length>=48,'The check uses the actual published lower sole ring');
 const native=new Map();actor.model.traverse(node=>{if(node.isBone)native.set(node.name,{position:node.position.clone(),scale:node.scale.clone()});});
 const clips=source.animation.animations.filter(clip=>/^crouch\.(idle|walk)\./.test(clip.name));assert.equal(clips.length,12);
 for(const clip of clips){
  actor.mixer.stopAllAction();const action=actor.mixer.clipAction(clip).play();let highest=0;const frames=Math.ceil(clip.duration*120);
  for(let frame=0;frame<=frames;frame++){
   action.time=clip.duration*frame/frames;actor.mixer.update(0);actor.root.updateMatrixWorld(true);mesh.skeleton.update();
   let supportingSole=Infinity;
   for(const side of ['l','r']){
    let fullLow=Infinity,soleLow=Infinity;
    for(const index of all[side]){const height=mesh.getVertexPosition(index,new Vector3()).applyMatrix4(mesh.matrixWorld).y;fullLow=Math.min(fullLow,height);}
    for(const index of sole[side]){const height=mesh.getVertexPosition(index,new Vector3()).applyMatrix4(mesh.matrixWorld).y;soleLow=Math.min(soleLow,height);}
    assert.ok(fullLow>-.001,`${clip.name} ${side} at ${(clip.duration*frame/frames).toFixed(4)} s: complete boot enters floor by ${(-fullLow*1000).toFixed(2)} mm`);
    assert.ok(soleLow>-.001,`${clip.name} ${side}: stored sole support stays within 1 mm`);highest=Math.max(highest,soleLow);
    supportingSole=Math.min(supportingSole,soleLow);
    if(clip.name.includes('.idle.'))assert.ok(Math.abs(soleLow-supportHeight)<.0001,'Idle soles rest on the authored 6 mm contact plane');
   }
   assert.ok(supportingSole<supportHeight+.002,`${clip.name} at ${(clip.duration*frame/frames).toFixed(4)} s: at least one actual sole supports the crouched step (${(supportingSole*1000).toFixed(2)} mm)`);
   actor.model.traverse(node=>{if(node.isBone){const shape=native.get(node.name);if(node.name!=='Root')assert.ok(node.position.distanceTo(shape.position)<.00001,node.name+' keeps its native joint offset');assert.ok(node.scale.distanceTo(shape.scale)<.00001,node.name+' keeps its native scale');}});
  }
  if(clip.name.includes('.walk.'))assert.ok(highest>.07,'The recorded swinging foot keeps its raised arc');
 }
 actor.dispose();
});

for(const appearance of ['granadero','woman-scout'])test(`${appearance} stored prone idle and crawl keep complete native boots above the floor`,async()=>{
 const source=await publishedActor(appearance,0),actor=new ActorRuntime(source,visual(appearance,'prone')),mesh=actor.model.getObjectByName('Human_footwear_LOD0'),position=mesh.geometry.attributes.position,indices={l:[],r:[]};
 for(let index=0;index<position.count;index++)indices[position.getX(index)>0?'l':'r'].push(index);
 for(const side of ['l','r'])assert.ok(indices[side].length>200,'The complete sole, toe cap and fitted boot surface are checked');
 const clips=source.animation.animations.filter(clip=>/^prone\.(idle|crawl)\./.test(clip.name));assert.equal(clips.length,12);
 for(const clip of clips){
  actor.mixer.stopAllAction();const action=actor.mixer.clipAction(clip).play(),frames=Math.ceil(clip.duration*120);
  for(let frame=0;frame<=frames;frame++){
   action.time=clip.duration*frame/frames;actor.mixer.update(0);actor.root.updateMatrixWorld(true);mesh.skeleton.update();
   for(const side of ['l','r']){
    let lowest=Infinity;for(const index of indices[side])lowest=Math.min(lowest,mesh.getVertexPosition(index,new Vector3()).applyMatrix4(mesh.matrixWorld).y);
    assert.ok(lowest>.001,`${clip.name} ${side} at ${(clip.duration*frame/frames).toFixed(4)} s: actual full boot height ${(lowest*1000).toFixed(2)} mm`);
    assert.ok(Math.abs(lowest-supportHeight)<proneContactTolerance,`${clip.name} ${side}: the complete toe or shaft stays within 1 mm of the authored 6 mm support plane (${(lowest*1000).toFixed(2)} mm)`);
   }
  }
 }
 actor.dispose();
});
