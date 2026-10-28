import test from 'node:test';import assert from 'node:assert/strict';
import {AnimationMixer,LoopOnce,Vector3} from '../web/node_modules/three/build/three.module.js';
import {clone} from '../web/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import {publishedActor} from './published-actor-fixture.mjs';
const names=['stand.gesture.heal','stand.gesture.pickup','stand.gesture.free'];
for(const appearance of ['granadero','woman-scout'])for(const lod of [0,1,2])test(`${appearance} LOD${lod} whole weighted boots support every native reach gesture`,async()=>{
 const asset=await publishedActor(appearance,lod),model=clone(asset.body.scene),mixer=new AnimationMixer(model),mesh=model.getObjectByName('Human_footwear_LOD'+lod),position=mesh.geometry.attributes.position,indices={l:[],r:[]},soles={l:[],r:[]};
 for(let i=0;i<position.count;i++){const side=position.getX(i)>0?'l':'r';indices[side].push(i);if(Math.abs(position.getY(i)-.007)<.0003)soles[side].push(i);}
 for(const side of ['l','r']){assert.ok(indices[side].length>200,'Every complete weighted boot is checked');assert.equal(new Set(soles[side].map(i=>[position.getX(i),position.getY(i),position.getZ(i)].join(','))).size,48,'The actual complete sole perimeter is checked; UV seams may duplicate vertices');}
 const native=new Map();model.traverse(b=>{if(b.isBone)native.set(b.name,{position:b.position.clone(),scale:b.scale.clone()});});
 for(const name of names){
  const clip=asset.animation.animations.find(c=>c.name===name),meta=asset.clips.find(c=>c.name===name);assert.ok(clip);assert.equal(meta.duration,1.4);assert.deepEqual(meta.markers,{});assert.equal(meta.timingAuthority,'simulation');assert.equal(meta.nativeBootSupport.surface,'complete-native-boots-all-lods');
  mixer.stopAllAction();const action=mixer.clipAction(clip).reset().setLoop(LoopOnce,1).play();action.clampWhenFinished=true;let initial,last;
  const steps=Math.ceil(clip.duration*240);
  for(let frame=0;frame<=steps;frame++){
   action.time=clip.duration*frame/steps;mixer.update(0);model.updateMatrixWorld(true);mesh.skeleton.update();const sample={};
   for(const side of ['l','r']){
    const full=indices[side].map(i=>mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld)),outline=soles[side].map(i=>mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld)),low=Math.min(...full.map(p=>p.y)),soleLow=Math.min(...outline.map(p=>p.y)),soleTop=Math.max(...outline.map(p=>p.y));
    assert.ok(low>.0015&&low<.0025,`${name} ${side} full boot support at ${frame}/${steps}: ${low}`);assert.ok(Math.abs(soleLow-.002)<.0005,'Support uses the real sole without hiding the boot shaft');assert.ok(soleTop<.010,'The full sole retains a small measured forefoot roll');
    const joints=['thigh','calf','foot'].map(role=>model.getObjectByName(role+'_'+side).getWorldPosition(new Vector3())),reserve=joints[0].distanceTo(joints[1])+joints[1].distanceTo(joints[2])-joints[0].distanceTo(joints[2]);assert.ok(reserve>.0015,'A supported leg keeps a positive native straight-leg reserve');
    sample[side]={outline,foot:joints[2]};
    if(initial){assert.ok(joints[2].distanceTo(initial[side].foot)<.0001,'Interpolation keeps the actual foot head within 0.1 mm of its fixed world footprint');for(let i=0;i<outline.length;i++)assert.ok(outline[i].distanceTo(initial[side].outline[i])<.0001,'Every planted sole vertex keeps the same footprint within 0.1 mm');}
   }
   model.traverse(b=>{if(!b.isBone)return;const rest=native.get(b.name);if(b.name!=='Root')assert.ok(b.position.distanceTo(rest.position)<.00001,b.name+' keeps its native joint offset');assert.ok(b.scale.distanceTo(rest.scale)<.00001,b.name+' keeps its native scale');});
   initial??=sample;last=sample;
  }
  for(const side of ['l','r'])for(let i=0;i<initial[side].outline.length;i++)assert.ok(initial[side].outline[i].distanceTo(last[side].outline[i])<.00002,'The complete sole returns continuously to the same source footprint');
 }
});
