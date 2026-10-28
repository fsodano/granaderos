import test from 'node:test';
import assert from 'node:assert/strict';
import {banks,nativeScene,sampleBank} from './character-bank-fixture.mjs';

for(const [gender,bank]of Object.entries(banks))test(`${gender} pistol fingers keep native hinges through carry, fire, loading and impact`,()=>{
 const rest=nativeScene(bank.body.json),clips=bank.specs.filter(spec=>spec.equipment==='short-gun');
 assert.equal(clips.length,57,'Every pistol posture, item and barrel variant is checked');
 for(const spec of clips)sampleBank(bank,spec.name,[0,.05,.20,.42,.58,.85,.96,1],(point,scene)=>{
  for(const finger of ['index','middle','ring','pinky'])for(const joint of [1,2,3]){
   const name=`${finger}_0${joint}_r`,q=rest.getObjectByName(name).quaternion.clone().invert().multiply(scene.getObjectByName(name).quaternion).normalize();
   let twist=2*Math.atan2(q.y,q.w);twist=Math.atan2(Math.sin(twist),Math.cos(twist))*180/Math.PI;
   const swing=2*Math.acos(Math.min(1,Math.hypot(q.w,q.y)))*180/Math.PI;
   assert.ok(Math.abs(twist)<(joint===1?30:15),`${spec.name}: ${name} has no axial skin fold (${twist.toFixed(1)}°)`);
   assert.ok(swing<({1:90,2:120,3:80}[joint]),`${spec.name}: ${name} stays inside its flexion limit (${swing.toFixed(1)}°)`);
  }
  return {};
 });
});
