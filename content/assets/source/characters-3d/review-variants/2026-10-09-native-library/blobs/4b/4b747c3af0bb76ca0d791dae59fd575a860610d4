import test from 'node:test';
import assert from 'node:assert/strict';
import {Matrix4,Vector3} from '../web/node_modules/three/build/three.module.js';
import {banks,sampleBank} from './character-bank-fixture.mjs';

const joints=['upperarm_l','upperarm_r','lowerarm_l','lowerarm_r','hand_l','hand_r'];
function measure(bank,name){
 const spec=bank.specs.find(clip=>clip.name===name),count=Math.ceil(spec.duration*120);
 const frames=sampleBank(bank,name,Array.from({length:count+1},(_,i)=>i/count),(point,scene)=>({
  joints:joints.map(name=>scene.getObjectByName(name).quaternion.clone()),
  wrist:point('middle_01_r').sub(point('hand_r')).angleTo(point('hand_r').sub(point('lowerarm_r')))*180/Math.PI,
  wrists:['l','r'].map(side=>point('middle_01_'+side).sub(point('hand_'+side)).angleTo(point('hand_'+side).sub(point('lowerarm_'+side)))*180/Math.PI),
  hands:['l','r'].map(side=>point('hand_'+side)),
 }));
 let turn=0,speed=0;
 for(let i=1;i<frames.length;i++){
  const dt=frames[i].time-frames[i-1].time;
  for(let j=0;j<joints.length;j++)turn=Math.max(turn,frames[i].joints[j].angleTo(frames[i-1].joints[j])*180/Math.PI/dt);
  for(let j=0;j<2;j++)speed=Math.max(speed,frames[i].hands[j].distanceTo(frames[i-1].hands[j])/dt);
 }
 return{frames,turn,speed};
}
for(const [gender,bank]of Object.entries(banks)){
 test(`${gender} crouched blade arcs retain a bounded wrist and continuous elbow`,()=>{
  for(const item of ['blade','knife']){
   const name=`crouch.slash.${item}`,result=measure(bank,name);
   assert.ok(Math.max(...result.frames.map(frame=>frame.wrist))<36,`${name}: wrist follows the forearm`);
   assert.ok(result.turn<1000,`${name}: no elbow-plane reversal (${result.turn.toFixed(1)} deg/s)`);
   assert.ok(result.speed<5,`${name}: no hand jump (${result.speed.toFixed(2)} m/s)`);
   assert.ok(result.frames[0].hands[0].distanceTo(result.frames.at(-1).hands[0])<.001,'Free hand returns to its guard');
  }
 });
 test(`${gender} ordinary task reaches have no wrist flips`,()=>{
  for(const posture of ['stand','crouch','prone','mounted'])for(const gesture of ['equip','ration','offer','signal','grab','door','tool','fitting']){
   const name=`${posture}.gesture.${gesture}`,result=measure(bank,name);
   assert.ok(result.turn<500,`${name}: task motion remains continuous (${result.turn.toFixed(1)} deg/s)`);
   assert.ok(result.speed<3.5,`${name}: hands follow an organic reach arc`);
  }
 });
 test(`${gender} firearm maintenance reaches retain continuous native joint arcs`,()=>{
  for(const posture of ['stand','crouch','prone','mounted'])for(const item of ['long-gun','short-gun'])for(const gesture of item==='short-gun'?['reprime','repair','unload']:['reprime','repair']){
   const name=`${posture}.${gesture}.${item}`,result=measure(bank,name);
   assert.ok(Math.max(...result.frames.flatMap(frame=>frame.wrists))<25,`${name}: both palms follow their forearms during inspection`);
   assert.ok(result.turn<650,`${name}: no elbow or wrist flip (${result.turn.toFixed(1)} deg/s)`);
   assert.ok(result.speed<4,`${name}: no hand jump (${result.speed.toFixed(2)} m/s)`);
  }
 });
 test(`${gender} prone task palms and fingers stay above the floor`,()=>{
  const skin=bank.body.json.skins[0],names=skin.joints.map(i=>bank.body.json.nodes[i].name),inverse=bank.body.access(skin.inverseBindMatrices),vertices=[];
  for(const node of bank.body.json.nodes){
   if(node.skin===undefined||node.mesh===undefined||!node.name.includes('skin'))continue;
   for(const primitive of bank.body.json.meshes[node.mesh].primitives){
    const p=bank.body.access(primitive.attributes.POSITION),j=bank.body.access(primitive.attributes.JOINTS_0),w=bank.body.access(primitive.attributes.WEIGHTS_0);
    for(let i=0;i<p.length/3;i++){
     const joints=j.slice(i*4,i*4+4),weights=w.slice(i*4,i*4+4);
     if(weights.reduce((sum,value,k)=>sum+(/^(hand_|thumb_|index_|middle_|ring_|pinky_)/.test(names[joints[k]])?value:0),0)>.8)vertices.push({point:new Vector3().fromArray(p,i*3),joints,weights});
    }
   }
  }
  assert.ok(vertices.length>100,'The floor check uses the exported hand surfaces');
  const namesToCheck=[
   ...['equip','ration','offer','signal','grab','door','tool','fitting','breach'].map(gesture=>`prone.gesture.${gesture}`),
   ...['long-gun','short-gun'].flatMap(item=>['reprime','repair'].map(gesture=>`prone.${gesture}.${item}`)),
   'prone.unload.short-gun',
  ];
  for(const name of namesToCheck){
   const spec=bank.specs.find(clip=>clip.name===name),count=Math.ceil(spec.duration*120);
   sampleBank(bank,name,Array.from({length:count+1},(_,i)=>i/count),(point,scene,time)=>{
    const matrices=names.map((name,i)=>new Matrix4().multiplyMatrices(scene.getObjectByName(name).matrixWorld,new Matrix4().fromArray(inverse,i*16)));
    let low=Infinity;
    for(const vertex of vertices){const p=new Vector3();for(let k=0;k<4;k++)if(vertex.weights[k])p.addScaledVector(vertex.point.clone().applyMatrix4(matrices[vertex.joints[k]]),vertex.weights[k]);low=Math.min(low,p.y);}
    assert.ok(low>-.002,`${name} ${time.toFixed(3)}s: actual hand surface is ${low.toFixed(4)} m above floor`);
    return {};
   });
  }
 });
}
