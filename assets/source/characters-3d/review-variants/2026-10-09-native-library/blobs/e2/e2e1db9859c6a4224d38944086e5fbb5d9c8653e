import test from 'node:test';
import assert from 'node:assert/strict';
import {Matrix4,Quaternion,Vector3} from '../web/node_modules/three/build/three.module.js';
import {banks,nativeScene,sampleBank} from './character-bank-fixture.mjs';

for(const [gender,bank] of Object.entries(banks)){
 const selected=bank.specs.filter(s=>s.equipment==='lance'&&s.gesture!=='thrust');
 const rest=nativeScene(bank.body.json),point=name=>rest.getObjectByName(name).getWorldPosition(new Vector3());
 const restHands=Object.fromEntries(['l','r'].map(side=>[side,rest.getObjectByName('hand_'+side).quaternion.clone()]));
 const wrist=point('hand_l'),long=point('middle_01_l').sub(wrist).normalize();
 const normal=point('index_01_l').sub(point('pinky_01_l')).cross(long).normalize().negate();
 const knuckles=['index','middle','ring','pinky'].reduce((p,f)=>p.add(point(f+'_01_l')),new Vector3()).multiplyScalar(.25);
 const support=rest.getObjectByName('hand_l').worldToLocal(wrist.lerp(knuckles,.74).addScaledVector(normal,.014));
 test(`${gender} lance carries and braces keep bounded wrists and continuous native arms`,()=>{
  assert.equal(selected.length,17);
  for(const spec of selected){
   const sides=spec.gesture==='brace'?['r','l']:['r'],count=Math.ceil(spec.duration*120);
   const frames=sampleBank(bank,spec.name,Array.from({length:count+1},(_,i)=>i/count),(point,scene,time)=>{
    const poses=[];
    for(const side of sides){
     const fore=point('hand_'+side).sub(point('lowerarm_'+side)).normalize(),long=point('middle_01_'+side).sub(point('hand_'+side)).normalize();
     assert.ok(fore.angleTo(long)<Math.PI/4,`${spec.name} ${time}s: ${side} wrist bends less than 45 degrees`);
     const delta=restHands[side].clone().invert().multiply(scene.getObjectByName('hand_'+side).quaternion);
     let twist=2*Math.atan2(delta.y,delta.w);twist=((twist+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
     assert.ok(Math.abs(twist)<5*Math.PI/180,`${spec.name}: pronation stays in the forearm`);
     for(const part of ['upperarm','lowerarm','hand'])poses.push({p:point(`${part}_${side}`),q:scene.getObjectByName(`${part}_${side}`).quaternion.clone()});
    }
    if(spec.gesture==='brace')assert.ok(point('lowerarm_r').y<point('upperarm_r').y-.075,`${spec.name}: the rear elbow stays below the shoulder`);
    return {poses};
   });
   for(let i=1;i<frames.length;i++)for(let j=0;j<frames[i].poses.length;j++){
    const a=frames[i-1],b=frames[i],dt=b.time-a.time;
    assert.ok(b.poses[j].p.distanceTo(a.poses[j].p)/dt<3,`${spec.name}: no arm-position snap`);
    assert.ok(b.poses[j].q.angleTo(a.poses[j].q)/dt<6,`${spec.name}: no elbow-plane or wrist reversal`);
   }
   if(spec.loop)for(let j=0;j<frames[0].poses.length;j++)assert.ok(frames[0].poses[j].p.distanceTo(frames.at(-1).poses[j].p)<.02,`${spec.name}: the native loop closes within the retained stride tolerance`);
  }
 });
 test(`${gender} lance braces hold the actual shaft and all carries clear the floor`,()=>{
  for(const spec of selected){
   const count=Math.ceil(spec.duration*120);
   sampleBank(bank,spec.name,Array.from({length:count+1},(_,i)=>i/count),(point,scene)=>{
    const socket=scene.getObjectByName('socket_handRight_sabre'),grip=new Quaternion(...(spec.gripOffsets?.[0]?.keys?.[0]?.rotationQuaternion??[0,0,0,1]));
    const shift=new Vector3(...(spec.gripOffsets?.[0]?.keys?.[0]?.position??[0,0,0]));
    const heldPoint=v=>socket.localToWorld(v.applyQuaternion(grip).add(shift));
    // The exported lance uses this socket's Y axis, from -0.8 to 2.05 m.
    for(const height of [-.8,2.05]){
     const endpoint=heldPoint(new Vector3(0,height,0));
     const radial=Math.max(...[new Vector3(.017,0,0),new Vector3(-.017,0,0),new Vector3(0,0,.017),new Vector3(0,0,-.017)].map(v=>Math.abs(heldPoint(v).y-heldPoint(new Vector3()).y)));
     assert.ok(endpoint.y-radial>.002,`${spec.name}: the held shaft stays above the floor`);
    }
    if(spec.gesture==='brace'){
     const palm=socket.worldToLocal(scene.getObjectByName('hand_l').localToWorld(support.clone())).sub(shift).applyQuaternion(grip.clone().invert());
     assert.ok(Math.hypot(palm.x+.010,palm.z+.012)<.004,`${spec.name}: the front palm remains at its fitted shaft frame`);
     assert.ok(palm.y>.15&&palm.y<.5,`${spec.name}: the front hand is separated from the rear grip`);
    }
    return {};
   });
  }
 });
}

for(const [gender,bank] of Object.entries(banks))test(`${gender} brace fingers fit the exported shaft without folded skin passing through it`,()=>{
 const skin=bank.body.json.skins[0],names=skin.joints.map(i=>bank.body.json.nodes[i].name),inverse=bank.body.access(skin.inverseBindMatrices),binds=names.map((_,i)=>new Matrix4().fromArray(inverse,i*16));
 const groups=Object.fromEntries(['l','r'].flatMap(side=>['index','middle','ring','pinky','thumb'].map(f=>[f+'_'+side,[]])));
 for(const node of bank.body.json.nodes){
  if(node.mesh===undefined||node.skin===undefined||!node.name.includes('skin'))continue;
  for(const primitive of bank.body.json.meshes[node.mesh].primitives){
   const positions=bank.body.access(primitive.attributes.POSITION),joints=bank.body.access(primitive.attributes.JOINTS_0),weights=bank.body.access(primitive.attributes.WEIGHTS_0);
   for(let i=0;i<positions.length/3;i++){
    const j=joints.slice(i*4,i*4+4),w=weights.slice(i*4,i*4+4);
    for(const [label,vertices] of Object.entries(groups)){
     const [finger,side]=label.split('_');
     if(w.reduce((sum,value,k)=>sum+(names[j[k]].startsWith(finger+'_')&&names[j[k]].endsWith('_'+side)?value:0),0)>.8)vertices.push({p:new Vector3().fromArray(positions,i*3),j,w});
    }
   }
  }
 }
 for(const vertices of Object.values(groups))assert.ok(vertices.length>=8,'native finger skin vertices are present');
 for(const spec of bank.specs.filter(s=>s.equipment==='lance'&&s.gesture==='brace'))sampleBank(bank,spec.name,[0,.5,1],(point,scene)=>{
  const key=spec.gripOffsets[0].keys[0],item=new Matrix4().compose(new Vector3(...key.position),new Quaternion(...key.rotationQuaternion),new Vector3(1,1,1));
  const inverseGrip=scene.getObjectByName('socket_handRight_sabre').matrixWorld.clone().multiply(item).invert(),matrices=names.map((bone,i)=>new Matrix4().multiplyMatrices(scene.getObjectByName(bone).matrixWorld,binds[i]));
  for(const [label,vertices] of Object.entries(groups)){
   let nearest=Infinity,deepest=0;
   for(const vertex of vertices){
    const p=new Vector3();for(let k=0;k<4;k++)if(vertex.w[k])p.addScaledVector(vertex.p.clone().applyMatrix4(matrices[vertex.j[k]]),vertex.w[k]);p.applyMatrix4(inverseGrip);
    const radius=.017-(p.y+.8)/2.65*.007,distance=Math.hypot(p.x,p.z)-radius;nearest=Math.min(nearest,Math.abs(distance));deepest=Math.max(deepest,-distance);
   }
   assert.ok(nearest<.002,`${spec.name} ${label}: real finger skin contacts the shaft within 2 mm`);
   assert.ok(deepest<.001,`${spec.name} ${label}: no skin penetrates the shaft by 1 mm`);
  }
  return {};
 });
});
