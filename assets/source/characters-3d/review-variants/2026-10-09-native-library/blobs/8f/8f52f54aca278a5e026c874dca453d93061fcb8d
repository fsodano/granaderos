import test from 'node:test';
import assert from 'node:assert/strict';
import {banks,sampleBank} from './character-bank-fixture.mjs';

const joints=['upperarm_l','upperarm_r','lowerarm_l','lowerarm_r','hand_l','hand_r'];
for(const [gender,bank]of Object.entries(banks)){
 test(`${gender} native firearm loading has continuous free-hand and return arcs`,()=>{
  const clips=bank.specs.filter(clip=>clip.equipment==='long-gun'&&['reload','unload'].includes(clip.gesture)||clip.equipment==='short-gun'&&clip.gesture==='reload');
  assert.equal(clips.length,76,'All item, barrel, and posture variants are checked');
  for(const spec of clips){
   const count=Math.ceil(spec.duration*120),frames=sampleBank(bank,spec.name,Array.from({length:count+1},(_,i)=>i/count),(point,scene)=>({
    rotations:joints.map(name=>scene.getObjectByName(name).quaternion.clone()),
    points:['lowerarm_l','lowerarm_r','hand_l','hand_r'].map(point),
   }));
   for(let i=1;i<frames.length;i++){
    const a=frames[i-1],b=frames[i],dt=b.time-a.time;
    for(let j=0;j<joints.length;j++){
     const speed=a.rotations[j].angleTo(b.rotations[j])*180/Math.PI/dt;
     assert.ok(speed<1000,`${spec.name} ${b.time.toFixed(3)}s: ${joints[j]} has no elbow-plane reversal (${speed.toFixed(1)} deg/s)`);
    }
    for(let j=0;j<a.points.length;j++){
     const speed=a.points[j].distanceTo(b.points[j])/dt;
     assert.ok(speed<4,`${spec.name} ${b.time.toFixed(3)}s: the loading arm has no position jump (${speed.toFixed(2)} m/s)`);
    }
   }
  }
 });
 test(`${gender} rifle loading uses a closed native fore-end wrap`,()=>{
  for(const spec of bank.specs.filter(clip=>clip.equipment==='long-gun'&&['reload','unload'].includes(clip.gesture))){
   sampleBank(bank,spec.name,[spec.gesture==='reload'?.58:.45],point=>{
    const long=point('middle_01_r').sub(point('hand_r')).normalize();
    for(const finger of ['index','middle','ring','pinky']){
     const proximal=point(`${finger}_02_r`).sub(point(`${finger}_01_r`)).normalize(),middle=point(`${finger}_03_r`).sub(point(`${finger}_02_r`)).normalize();
     const knuckle=long.angleTo(proximal)*180/Math.PI,flex=proximal.angleTo(middle)*180/Math.PI;
     assert.ok(knuckle>45&&knuckle<95,`${spec.name}: ${finger} closes at its native knuckle (${knuckle.toFixed(1)}°)`);
     assert.ok(flex>65&&flex<120,`${spec.name}: ${finger} wraps the stock instead of forming an open hook (${flex.toFixed(1)}°)`);
    }
    return {};
   });
  }
 });
 test(`${gender} crouched rifle carry keeps a stable supporting elbow`,()=>{
  for(const gesture of ['idle','walk','strafeLeft','strafeRight']){
   const name=`crouch.${gesture}.long-gun`,spec=bank.specs.find(clip=>clip.name===name),count=Math.ceil(spec.duration*120);
   const frames=sampleBank(bank,name,Array.from({length:count+1},(_,i)=>i/count),(point,scene)=>({rotations:joints.map(name=>scene.getObjectByName(name).quaternion.clone())}));
   for(let i=1;i<frames.length;i++)for(let j=0;j<joints.length;j++){
    const speed=frames[i].rotations[j].angleTo(frames[i-1].rotations[j])*180/Math.PI/(frames[i].time-frames[i-1].time);
    assert.ok(speed<1000,`${name}: ${joints[j]} keeps the same elbow branch (${speed.toFixed(1)} deg/s)`);
   }
  }
 });
}
