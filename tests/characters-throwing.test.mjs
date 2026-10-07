import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3} from '../web/node_modules/three/build/three.module.js';
import {banks,manifest,sampleBank} from './character-bank-fixture.mjs';
const phases=[0,.12,.26,.30,.40,.43,.46,.58,.63,.70,.73,.77,.91,1],at=(values,fraction)=>values.find(value=>value.fraction===fraction);
const angle=(a,b)=>a.angleTo(b),ahead=new Vector3(0,0,1);
function bodySamples(bank,name){
 return sampleBank(bank,name,phases,(point,scene)=>{
  const chest=scene.getObjectByName('spine_03'),hand=scene.getObjectByName('hand_r'),socket=scene.getObjectByName('socket_handRight_sabre'),tool=scene.getObjectByName('socket_handRight_tool');
  return {root:point('Root'),pelvis:scene.getObjectByName('pelvis').getWorldQuaternion(new Quaternion()),chest:chest.getWorldQuaternion(new Quaternion()),left:chest.worldToLocal(point('hand_l')),right:point('hand_r').sub(point('upperarm_r')),finger:hand.worldToLocal(point('middle_03_r')),foot:point('foot_l'),ball:point('ball_r'),knifeAxis:socket.localToWorld(new Vector3(0,1,0)).sub(socket.getWorldPosition(new Vector3())).normalize(),cordAxis:tool.localToWorld(new Vector3(0,-1,0)).sub(tool.getWorldPosition(new Vector3())).normalize(),hand:hand.getWorldPosition(new Vector3()),shoulder:point('upperarm_r')};
 });
}
for(const [gender,bank]of Object.entries(banks)){
 test(`${gender} standing throws drive the native torso and free arm above stable support`,()=>{
  const paths={};
  for(const gesture of ['throw','throwKnife','bolas']){
   const name=`stand.gesture.${gesture}`,spec=bank.specs.find(clip=>clip.name===name),values=bodySamples(bank,name),start=at(values,0),release=at(values,.58),end=at(values,1);
   assert.equal(spec.markers.release,.754);assert.equal(spec.duration,1.3);assert.deepEqual(spec.freeHands,['handRight','handLeft']);
   assert.deepEqual(spec.handProps,[{hand:'handRight',categories:gesture==='throwKnife'?['knife']:['supply'],untilMarker:'release'}]);
   assert.ok(release.root.z-start.root.z>.06,`${name}: weight advances towards the target`);
   assert.ok(angle(start.pelvis,release.pelvis)>.10,`${name}: pelvis drives the release`);assert.ok(angle(start.chest,release.chest)>.30,`${name}: torso contributes beyond an arm-only throw`);
   assert.ok(at(values,.26).left.distanceTo(at(values,.63).left)>.12,`${name}: the free arm balances independently of the torso`);
   const planted=at(values,.30).foot;
   for(const phase of [.40,.43,.46,.58,.63,.70,.73,.77]){
    assert.ok(at(values,phase).foot.distanceTo(planted)<.003,`${name}: lead foot remains planted through release (${at(values,phase).foot.distanceTo(planted).toFixed(4)} m)`);
    assert.ok(at(values,phase).ball.distanceTo(start.ball)<.003,`${name}: rear toe supports the heel turn`);
   }
   assert.ok(start.root.distanceTo(end.root)<.0001,'The body returns to its guard position');assert.ok(start.foot.distanceTo(end.foot)<.0001,'The step recovers without a root snap');
   assert.ok(angle(start.chest,end.chest)<.0001&&start.left.distanceTo(end.left)<.0001,'The torso and free arm recover continuously');
   assert.ok(start.finger.distanceTo(end.finger)<.0001,'The throwing hand regains its grip at the recovery boundary');assert.ok(start.finger.distanceTo(release.finger)>.015,'The fingers open at release');
   paths[gesture]=values;
  }
  assert.ok(at(paths.throw,.26).right.distanceTo(at(paths.throwKnife,.26).right)>.12,'Overarm grenade preparation differs from a compact knife throw');
  assert.ok(at(paths.bolas,.12).right.distanceTo(at(paths.bolas,.46).right)>.25,'The bolas working hand follows its wind-up orbit');
  assert.ok(at(paths.throwKnife,.58).knifeAxis.dot(ahead)>.999,'The actual blade socket points towards the target at release');
  for(const phase of [.12,.26,.43,.46,.58]){
   const value=at(paths.bolas,phase),radial=value.hand.clone().sub(value.shoulder).normalize();
   assert.ok(value.cordAxis.dot(radial)>.92,`Bolas cords extend away from the working shoulder at ${phase}, instead of hanging through the body`);
  }
 });
 test(`${gender} other throwing postures preserve native support and release metadata`,()=>{
  for(const posture of ['crouch','prone','mounted'])for(const gesture of ['throw','bolas']){
   const name=`${posture}.gesture.${gesture}`,spec=bank.specs.find(clip=>clip.name===name),values=bodySamples(bank,name),start=at(values,0),release=at(values,.58);
   assert.deepEqual(spec.freeHands,['handRight','handLeft']);assert.equal(spec.handProps[0].untilMarker,'release');
   assert.ok(release.right.distanceTo(start.right)>.2,`${name}: hand reaches through its throwing arc`);
   if(posture==='crouch'){
    assert.ok(release.foot.distanceTo(start.foot)<.003&&release.ball.distanceTo(start.ball)<.003,'Crouched throwing keeps both feet in support');
    assert.ok(release.root.z-start.root.z>.03,'Crouched throwing retains a restrained body drive');
   }else assert.ok(release.root.distanceTo(start.root)<.0001,`${name}: seat or ground support keeps the root stable`);
  }
 });
}
test('native throwing clips retain a separate release for every supported gameplay binding',()=>{
 for(const bank of Object.values(banks))for(const clip of bank.specs.filter(clip=>['throw','throwKnife','bolas'].includes(clip.gesture)))assert.deepEqual(clip.markers,{release:.754});
 for(const id of ['grenade','torches','boleadoras'])assert.equal(manifest.equipment.items[id].category,'supply');
 assert.equal(manifest.equipment.items['1813'].category,'knife');
});
