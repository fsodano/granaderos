import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3,Matrix4} from '../web/node_modules/three/build/three.module.js';
import {banks,sampleBank} from './character-bank-fixture.mjs';

const attacks=['stand.slash.blade.thrust'];
const ahead=new Vector3(0,0,1);
function readPose(point,scene){
 const wrist=point('hand_r'),long=point('middle_01_r').sub(wrist).normalize(),across=point('index_01_r').sub(point('pinky_01_r'));
 const normal=across.cross(long).normalize(),socket=scene.getObjectByName('socket_handRight_sabre');
 return {wrist,bend:long.angleTo(wrist.clone().sub(point('lowerarm_r'))),normal,
  blade:socket.localToWorld(new Vector3(0,1,0)).sub(point(socket.name)).normalize(),
  hand:scene.getObjectByName('hand_r').getWorldQuaternion(new Quaternion()),
  joints:['upperarm_r','lowerarm_r','hand_r'].map(name=>scene.getObjectByName(name).quaternion.clone())};
}
for(const [gender,bank]of Object.entries(banks)){
 test(`${gender} standing blade thrusts keep a continuous native wrist`,()=>{
  for(const name of attacks){
   const spec=bank.specs.find(clip=>clip.name===name),count=Math.ceil(spec.duration*120);
   const frames=sampleBank(bank,name,Array.from({length:count+1},(_,i)=>i/count),readPose);
   assert.ok(frames[0].wrist.distanceTo(frames.at(-1).wrist)<.0001,`${name}: guard recovers without a hand jump`);
   for(let i=0;i<frames.length;i++){
    const f=frames[i];assert.ok(f.bend<36*Math.PI/180,`${name} ${f.time.toFixed(3)}s: physical wrist bend ${f.bend*180/Math.PI} degrees`);
    if(!i)continue;
    const before=frames[i-1],dt=f.time-before.time;
    // Reject a jump larger than 6.7 cm on the native 120 Hz review grid.
    assert.ok(f.wrist.distanceTo(before.wrist)/dt<8,`${name}: no position snap`);
    assert.ok(f.hand.angleTo(before.hand)/dt<25,`${name}: no world hand reversal`);
    for(let j=0;j<3;j++)assert.ok(f.joints[j].angleTo(before.joints[j])/dt<40,`${name}: no upper-arm, elbow or wrist discontinuity`);
   }
  }
 });
 test(`${gender} the actual standing blade points forward at thrust contact`,()=>{
  for(const equipment of ['blade']){
   const name=`stand.slash.${equipment}.thrust`,spec=bank.specs.find(clip=>clip.name===name),pose=sampleBank(bank,name,[spec.markers.contact/spec.duration],readPose)[0];
   assert.ok(pose.blade.dot(ahead)>Math.cos(Math.PI/12),`${name}: the actual held blade points within 15 degrees of the thrust`);

  }
 });
 test(`${gender} actual closed fingers remain in contact with the blade grip`,()=>{
  const skin=bank.body.json.skins[0],names=skin.joints.map(i=>bank.body.json.nodes[i].name),inverse=bank.body.access(skin.inverseBindMatrices),binds=names.map((_,i)=>new Matrix4().fromArray(inverse,i*16));
  const fingers=Object.fromEntries(['index','middle','ring','pinky','thumb'].map(name=>[name,[]]));
  for(const node of bank.body.json.nodes){
   if(node.mesh===undefined||node.skin===undefined||!node.name.includes('skin'))continue;
   for(const primitive of bank.body.json.meshes[node.mesh].primitives){
    const positions=bank.body.access(primitive.attributes.POSITION),joints=bank.body.access(primitive.attributes.JOINTS_0),weights=bank.body.access(primitive.attributes.WEIGHTS_0);
    for(let i=0;i<positions.length/3;i++){
     const j=joints.slice(i*4,i*4+4),w=weights.slice(i*4,i*4+4);
     for(const finger of Object.keys(fingers))if(w.reduce((sum,value,k)=>sum+(names[j[k]].startsWith(finger+'_')&&names[j[k]].endsWith('_r')?value:0),0)>.8)fingers[finger].push({p:new Vector3().fromArray(positions,i*3),j,w});
    }
   }
  }
  for(const values of Object.values(fingers))assert.ok(values.length>10,'The contact check uses the actual native finger mesh');
  for(const name of attacks){
   const spec=bank.specs.find(clip=>clip.name===name);
   sampleBank(bank,name,[spec.markers.contact/spec.duration],(point,scene)=>{
    const matrices=names.map((bone,i)=>new Matrix4().multiplyMatrices(scene.getObjectByName(bone).matrixWorld,binds[i])),inverseGrip=scene.getObjectByName('socket_handRight_sabre').matrixWorld.clone().invert();
    for(const [finger,vertices]of Object.entries(fingers)){
     let nearest=Infinity;
     for(const vertex of vertices){const p=new Vector3();for(let k=0;k<4;k++)if(vertex.w[k])p.addScaledVector(vertex.p.clone().applyMatrix4(matrices[vertex.j[k]]),vertex.w[k]);p.applyMatrix4(inverseGrip);const radial=Math.hypot(p.x,p.z),axial=Math.max(0,Math.abs(p.y)-.05);nearest=Math.min(nearest,Math.hypot(radial-.013,axial));}
     assert.ok(nearest<.018,`${name}: ${finger} contacts the actual cylindrical handle (${nearest.toFixed(4)} m)`);
    }
    return {};
   });
  }
 });
}
