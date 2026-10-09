import test from 'node:test';
import assert from 'node:assert/strict';
import {Matrix4,Quaternion,Triangle,Vector3} from '../web/node_modules/three/build/three.module.js';
import {banks,nativeScene,readGlb,sampleBank} from './character-bank-fixture.mjs';

const equipment=readGlb('/models/characters/equipment.glb'),equipmentScene=nativeScene(equipment.json);
const shaftNode=equipment.json.nodes.find(node=>node.name==='Lance_Shaft');
const shaftMatrix=equipmentScene.getObjectByName('item_1812').matrixWorld.clone().invert().multiply(equipmentScene.getObjectByName('Lance_Shaft').matrixWorld),shaft=[];
for(const primitive of equipment.json.meshes[shaftNode.mesh].primitives){
 const positions=equipment.access(primitive.attributes.POSITION),indices=equipment.access(primitive.indices);
 const point=i=>new Vector3().fromArray(positions,i*3).applyMatrix4(shaftMatrix);
 for(let i=0;i<indices.length;i+=3)shaft.push(new Triangle(point(indices[i]),point(indices[i+1]),point(indices[i+2])));
}
assert.ok(shaft.length>=24,'Contact uses the actual exported lance shaft facets');

for(const [gender,bank] of Object.entries(banks)){
 const selected=bank.specs.filter(spec=>spec.equipment==='lance'&&spec.gesture==='thrust');
 const restHand=nativeScene(bank.body.json).getObjectByName('hand_r').quaternion.clone();
 const skin=bank.body.json.skins[0],names=skin.joints.map(i=>bank.body.json.nodes[i].name),inverse=bank.body.access(skin.inverseBindMatrices),binds=names.map((_,i)=>new Matrix4().fromArray(inverse,i*16));
 const groups=Object.fromEntries(['palm','index','middle','ring','pinky','thumb'].map(name=>[name,[]]));
 for(const node of bank.body.json.nodes){
  if(node.mesh===undefined||node.skin===undefined||!node.name.includes('skin'))continue;
  for(const primitive of bank.body.json.meshes[node.mesh].primitives){
   const p=bank.body.access(primitive.attributes.POSITION),j=bank.body.access(primitive.attributes.JOINTS_0),w=bank.body.access(primitive.attributes.WEIGHTS_0);
   for(let i=0;i<p.length/3;i++){
    const ids=j.slice(i*4,i*4+4),weights=w.slice(i*4,i*4+4),influence=predicate=>weights.reduce((sum,value,k)=>sum+(predicate(names[ids[k]])?value:0),0);
    let group=influence(name=>name==='hand_r'||/^(index|middle|ring|pinky|thumb)_\d+_r$/.test(name))>.95?'palm':null;
    for(const finger of ['index','middle','ring','pinky','thumb'])if(influence(name=>name.startsWith(finger+'_')&&name.endsWith('_r'))>.8)group=finger;
    if(group)groups[group].push({p:new Vector3().fromArray(p,i*3),j:ids,w:weights});
   }
  }
 }
 test(`${gender} lance thrusts keep native wrists and the closed hand on the actual shaft`,()=>{
  assert.deepEqual(selected.map(spec=>spec.name).sort(),['crouch.thrust.lance','mounted.thrust.lance','stand.thrust.lance']);
  for(const vertices of Object.values(groups))assert.ok(vertices.length>=8,'Actual native palm and finger skin are present');
  for(const spec of selected){
   assert.equal(spec.duration,1.2);assert.equal(spec.markers.contact,.58);assert.equal(spec.markers.recover,1);
   const key=spec.gripOffsets?.[0]?.keys?.[0]??{position:[0,0,0],rotationQuaternion:[0,0,0,1]};
   const grip=new Matrix4().compose(new Vector3(...key.position),new Quaternion(...key.rotationQuaternion),new Vector3(1,1,1));
   let previous;
   sampleBank(bank,spec.name,Array.from({length:145},(_,i)=>i/144),(point,scene,time)=>{
    const wrist=point('hand_r'),fore=wrist.clone().sub(point('lowerarm_r')),palm=point('middle_01_r').sub(wrist);
    assert.ok(fore.angleTo(palm)<Math.PI/4,`${spec.name} ${time}: wrist bend stays below 45 degrees`);
    const handDelta=restHand.clone().invert().multiply(scene.getObjectByName('hand_r').quaternion);
    let twist=2*Math.atan2(handDelta.y,handDelta.w);twist=((twist+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
    assert.ok(Math.abs(twist)<5*Math.PI/180,`${spec.name}: pronation stays in the forearm, not a wrist-only twist`);
    const joints=['upperarm_r','lowerarm_r','hand_r'].map(name=>({p:point(name),q:scene.getObjectByName(name).quaternion.clone()}));
    if(previous)for(let i=0;i<joints.length;i++){
     assert.ok(joints[i].p.distanceTo(previous.joints[i].p)/(time-previous.time)<3,`${spec.name}: no native arm position jump`);
     assert.ok(joints[i].q.angleTo(previous.joints[i].q)/(time-previous.time)<9,`${spec.name}: no elbow-plane reversal`);
    }
    previous={time,joints};
    const inverseGrip=scene.getObjectByName('socket_handRight_sabre').matrixWorld.clone().multiply(grip).invert();
    const matrices=names.map((name,i)=>new Matrix4().multiplyMatrices(scene.getObjectByName(name).matrixWorld,binds[i])),nearest=new Vector3();
    for(const [group,vertices] of Object.entries(groups)){
     let gap=Infinity,depth=0;
     for(const vertex of vertices){
      const p=new Vector3();for(let k=0;k<4;k++)if(vertex.w[k])p.addScaledVector(vertex.p.clone().applyMatrix4(matrices[vertex.j[k]]),vertex.w[k]);p.applyMatrix4(inverseGrip);
      for(const triangle of shaft){triangle.closestPointToPoint(p,nearest);gap=Math.min(gap,p.distanceTo(nearest));}
      // The circumscribed taper is a conservative penetration bound around
      // the actual twelve-sided wood, not a substitute for facet contact.
      const radius=.017-(p.y+.8)/2.65*.007;depth=Math.max(depth,radius-Math.hypot(p.x,p.z));
     }
     assert.ok(gap<(group==='palm'?.001:.002),`${spec.name} ${time} ${group}: actual skin holds the exported shaft`);
     assert.ok(depth<.001,`${spec.name} ${time} ${group}: skin does not pass through the wood`);
    }
    return {};
   });
  }
 });
}
