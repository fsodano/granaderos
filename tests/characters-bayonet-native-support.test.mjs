import test from 'node:test';import assert from 'node:assert/strict';
import {AnimationMixer,LoopOnce,Vector3}from '../web/node_modules/three/build/three.module.js';
import {clone}from '../web/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import {publishedActor}from './published-actor-fixture.mjs';

for(const appearance of ['granadero','woman-scout'])for(const lod of [0,1,2])test(`${appearance} LOD${lod} fixed-bayonet thrust keep complete native boot support`,async()=>{
 const asset=await publishedActor(appearance,lod),model=clone(asset.body.scene),mixer=new AnimationMixer(model),mesh=model.getObjectByName(asset.appearance.parts.footwear.replace('{lod}',String(lod)));
 const rest=asset.body.scene.getObjectByName(mesh.name),position=mesh.geometry.attributes.position,indices={l:[],r:[]},soles={l:[],r:[]};rest.updateMatrixWorld(true);
 const native=new Map();model.traverse(bone=>{if(bone.isBone)native.set(bone.name,{position:bone.position.clone(),scale:bone.scale.clone()});});
 for(let index=0;index<position.count;index++)indices[position.getX(index)>0?'l':'r'].push(index);
 for(const side of ['l','r']){
  assert.ok(indices[side].length>200,'The complete native boot is checked');const points=indices[side].map(index=>rest.getVertexPosition(index,new Vector3()).applyMatrix4(rest.matrixWorld)),low=Math.min(...points.map(point=>point.y));
  soles[side]=indices[side].filter((_,index)=>points[index].y<=low+.003);assert.ok(soles[side].length>=40,'The actual lower sole outline is checked');
 }
 for(const name of ['stand.bayonet.long-gun']){
  const clip=asset.animation.animations.find(clip=>clip.name===name),meta=asset.clips.find(clip=>clip.name===name);assert.ok(clip);assert.equal(clip.duration,name.includes('.idle.')?2:1);assert.equal(meta.playbackRate,1.25);if(name.includes('.bayonet.'))assert.equal(meta.markers.contact,.42);
  mixer.stopAllAction();const action=mixer.clipAction(clip).reset().setLoop(LoopOnce,1).play();action.clampWhenFinished=true;let rightLift=0,previous;
  const times=[...new Set([...Array.from({length:241},(_,i)=>i/240),meta.markers.contact])].sort((a,b)=>a-b);let previousTime;
  for(const time of times){
   const frame=time*240;action.time=time;mixer.update(0);model.updateMatrixWorld(true);mesh.skeleton.update();const positions={};
   for(const side of ['l','r']){
    const points=indices[side].map(index=>mesh.getVertexPosition(index,new Vector3()).applyMatrix4(mesh.matrixWorld)),outline=soles[side].map(index=>mesh.getVertexPosition(index,new Vector3()).applyMatrix4(mesh.matrixWorld)),low=Math.min(...points.map(point=>point.y)),top=Math.max(...outline.map(point=>point.y));positions[side]=outline;
    assert.ok(low>.0015,`${name} ${side} full boot enters floor at ${frame}/240: ${low}`);
    assert.ok(top-low<.007,`${name} ${side} full sole exceeds a bounded forefoot roll at ${frame}/240: ${top-low}`);
    if(name.includes('.idle.')||side==='l'||frame===0||frame===clip.duration*240)assert.ok(Math.abs(low-.002)<.00025,`${name} ${side} support at ${frame}/240: ${low}`);
    if(name.includes('.idle.')||frame===0||frame===clip.duration*240)assert.ok(top<.00225,'Both complete guard soles are level at the source endpoints');
    if(side==='r')rightLift=Math.max(rightLift,low-.002);
    if(previous)for(let index=0;index<outline.length;index++)assert.ok(outline[index].distanceTo(previous[side][index])/(time-previousTime)*meta.playbackRate<2,`${name} ${side} foot path exceeds 2 m/s`);
   }
   model.traverse(bone=>{if(!bone.isBone)return;const source=native.get(bone.name);if(bone.name!=='Root')assert.ok(bone.position.distanceTo(source.position)<.00001,bone.name+' keeps its native joint offset');assert.ok(bone.scale.distanceTo(source.scale)<.00001,bone.name+' keeps its native scale');});previous=positions;previousTime=time;
  }
  if(name.includes('.bayonet.'))assert.ok(rightLift>.034&&rightLift<.036,'The native right-foot lift is retained');
 }
});
