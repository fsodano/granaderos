import assert from 'node:assert/strict';
import {Vector3} from '../apps/web/node_modules/three/build/three.module.js';

const interpolants=new WeakMap();
export function nativeRigOffsets(model){
 const offsets=new Map();model.traverse(bone=>{if(bone.isBone)offsets.set(bone.name,{position:bone.position.clone(),scale:bone.scale.clone()});});return offsets;
}

// Standing rest adds one chest translation channel: a 4 mm rise and 6 mm
// expansion. Check that exact mixed channel instead of exempting the chest
// from rig checks. All other non-root offsets and every scale stay native.
export function assertNativeRigOffsets(runtime,native,label='',tolerance=1e-6){
 const chestName=runtime.asset.manifest.bones.chest,chest=runtime.model.getObjectByName(chestName),rest=runtime.asset.body.scene.getObjectByName(chestName).position,expected=new Vector3();let weight=0;
 const samplePosition=(track,time)=>{if(!track)return rest.clone();let sample=interpolants.get(track);if(!sample){sample=track.createInterpolant();interpolants.set(track,sample);}return new Vector3().fromArray(sample.evaluate(time));};
 for(const action of runtime.mixer._actions){
  if(!action.enabled||!action.isScheduled()||action.getEffectiveWeight()<=0)continue;
  const clip=action.getClip(),track=clip.tracks.find(track=>track.name===chestName+'.position');if(!track)continue;
  const source=runtime.asset.animation.animations.find(source=>source.name===clip.name);assert.ok(source,label+' known native clip '+clip.name);
  const position=samplePosition(track,action.time),original=samplePosition(source.tracks.find(track=>track.name===chestName+'.position'),action.time),worldDelta=chest.parent.localToWorld(position.clone()).sub(chest.parent.localToWorld(original.clone()));
  if(clip.name.startsWith('stand.idle.'))assert.ok(worldDelta.length()<=Math.hypot(.004,.006)+1e-6,label+' bounded standing chest breath');
  else assert.ok(position.distanceTo(original)<tolerance,label+' paid/non-idle chest offset stays native');
  const contribution=action.getEffectiveWeight();expected.addScaledVector(position,contribution);weight+=contribution;
 }
 if(weight>1)expected.divideScalar(weight);else expected.addScaledVector(rest,1-weight);
 runtime.model.traverse(bone=>{
  if(!bone.isBone)return;const original=native.get(bone.name);assert.ok(original,label+' known native bone '+bone.name);
  if(bone.name!=='Root')assert.ok(bone.position.distanceTo(bone.name===chestName?expected:original.position)<tolerance,label+' '+bone.name+' native offset or exact mixed breath');
  assert.ok(bone.scale.distanceTo(original.scale)<tolerance,label+' '+bone.name+' native scale');
  assert.ok(bone.matrixWorld.elements.every(Number.isFinite),label+' '+bone.name+' finite world matrix');
 });
}
