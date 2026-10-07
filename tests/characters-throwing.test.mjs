import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3,Matrix4,Box3,Ray} from '../web/node_modules/three/build/three.module.js';
import {banks,manifest,sampleBank,readGlb,nativeScene} from './character-bank-fixture.mjs';
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
  assert.ok(at(paths.throwKnife,.58).knifeAxis.dot(ahead)>Math.cos(Math.PI/18),'The actual blade socket points within ten degrees of the target at release');
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


// Dense exported samples cover the intervals that sparse pose keys miss.
const throwFractions=Array.from(new Set([...Array.from({length:157},(_,i)=>i/156),.58-1/156,.58,.58+1/156])).sort((a,b)=>a-b);
for(const [gender,bank]of Object.entries(banks)){
 test(`${gender} exported throws keep a continuous native wrist and clear the head`,()=>{
  for(const spec of bank.specs.filter(clip=>['throw','throwKnife','bolas'].includes(clip.gesture))){
   const values=sampleBank(bank,spec.name,throwFractions,(point,scene)=>({arms:['l','r'].map(side=>{
    const hand=scene.getObjectByName('hand_'+side),wrist=point('hand_'+side),elbow=point('lowerarm_'+side),knuckles=point('middle_01_'+side);
    return {wrist,elbow,bend:wrist.clone().sub(elbow).angleTo(knuckles.clone().sub(wrist)),local:hand.quaternion.clone(),world:hand.getWorldQuaternion(new Quaternion()),headDistance:knuckles.distanceTo(point('head'))};
   })}));
   for(let side=0;side<2;side++){
    assert.ok(values[0].arms[side].wrist.distanceTo(values.at(-1).arms[side].wrist)<.0001,`${spec.name}: the hand returns to its starting guard`);
    assert.ok(values[0].arms[side].world.angleTo(values.at(-1).arms[side].world)<.001,`${spec.name}: the wrist recovers without a terminal turn`);
   }
   for(let i=0;i<values.length;i++)for(let side=0;side<2;side++){
    const arm=values[i].arms[side],label=`${spec.name} ${values[i].time.toFixed(3)}s ${side?'right':'left'}`;
    assert.ok(arm.bend<(spec.posture==='prone'&&side===0?Math.PI/2:Math.PI/3),`${label}: the hand cannot fold backwards over the forearm (${arm.bend*180/Math.PI} degrees)`);
    assert.ok(arm.headDistance>.14,`${label}: the grasp remains outside the head`);
    if(!i)continue;
    const before=values[i-1].arms[side],dt=values[i].time-values[i-1].time;
    assert.ok(arm.local.angleTo(before.local)/dt<14,`${label}: no wrist rotation discontinuity`);
    assert.ok(arm.world.angleTo(before.world)/dt<25,`${label}: no arm-frame flip hidden in a neutral wrist`);
    assert.ok(arm.wrist.distanceTo(before.wrist)/dt<5,`${label}: no positional IK snap`);
   }
  }
 });
 test(`${gender} knife release follows its actual blade direction and hand travel`,()=>{
  const values=sampleBank(bank,'stand.gesture.throwKnife',[.58-1/156,.58,.58+1/156],(point,scene)=>{
   const socket=scene.getObjectByName('socket_handRight_sabre');
   return {wrist:point('hand_r'),blade:socket.localToWorld(new Vector3(0,1,0)).sub(point(socket.name)).normalize()};
  });
  const velocity=values[2].wrist.clone().sub(values[0].wrist).normalize(),blade=values[1].blade;
  assert.ok(velocity.dot(ahead)>.85,'The release travels forward instead of sweeping sideways');
  assert.ok(blade.dot(velocity)>Math.cos(Math.PI/9),'The point leaves within 20 degrees of the actual hand trajectory');
 });
}

const equipment=readGlb(manifest.equipment.url),equipmentScene=nativeScene(equipment.json);
const heldPoints=Object.fromEntries(['1813','grenade','boleadoras'].map(id=>{
 const item=equipmentScene.getObjectByName(manifest.equipment.items[id].node),inverse=item.matrixWorld.clone().invert(),points=[];
 item.traverse(node=>{
  const definition=equipment.json.nodes.find(entry=>entry.name===node.name);if(definition?.mesh===undefined)return;
  const transform=new Matrix4().multiplyMatrices(inverse,node.matrixWorld);
  for(const primitive of equipment.json.meshes[definition.mesh].primitives){
   const positions=equipment.access(primitive.attributes.POSITION);
   for(let i=0;i<positions.length;i+=3)points.push(new Vector3().fromArray(positions,i).applyMatrix4(transform));
  }
 });
 assert.ok(points.length>20,`${id}: the held-object check uses exported geometry`);return [id,points];
}));

function headContactProbe(bank){
 const skin=bank.body.json.skins[0],names=skin.joints.map(i=>bank.body.json.nodes[i].name),inverse=bank.body.access(skin.inverseBindMatrices),head=names.indexOf('head');
 const inverseBinds=names.map((_,i)=>new Matrix4().fromArray(inverse,i*16)),headLocal=inverseBinds[head],triangles=[],hands=[];
 for(const node of bank.body.json.nodes){
  if(node.mesh===undefined||node.skin===undefined||!node.name.includes('skin'))continue;
  for(const primitive of bank.body.json.meshes[node.mesh].primitives){
   const positions=bank.body.access(primitive.attributes.POSITION),joints=bank.body.access(primitive.attributes.JOINTS_0),weights=bank.body.access(primitive.attributes.WEIGHTS_0),vertices=[];
   for(let i=0;i<positions.length/3;i++){
    const p=new Vector3().fromArray(positions,i*3),j=joints.slice(i*4,i*4+4),w=weights.slice(i*4,i*4+4);
    const headWeight=w.reduce((sum,value,k)=>sum+(j[k]===head?value:0),0);
    vertices.push(headWeight>.99?p.clone().applyMatrix4(headLocal):undefined);
    if(w.reduce((sum,value,k)=>sum+(/^(hand_|thumb_|index_|middle_|ring_|pinky_)/.test(names[j[k]])?value:0),0)>.8)hands.push({p,j,w});
   }
   const indices=primitive.indices===undefined?vertices.map((_,i)=>i):bank.body.access(primitive.indices);
   for(let i=0;i<indices.length;i+=3){const triangle=indices.slice(i,i+3).map(index=>vertices[index]);if(triangle.every(Boolean))triangles.push(triangle);}
  }
 }
 assert.ok(triangles.length>100&&hands.length>100,'The contact check uses exported head and hand surfaces');
 const bounds=new Box3().setFromPoints(triangles.flat()),ray=new Ray(new Vector3(),new Vector3(1,.137,.081).normalize()),hit=new Vector3();
 // Bin triangles in the plane normal to the ray. This retains the same exact
 // surface intersections without testing every head triangle for every finger.
 const u=new Vector3().crossVectors(ray.direction,new Vector3(0,1,0)).normalize(),v=new Vector3().crossVectors(ray.direction,u).normalize(),axes=[u,v];
 const ranges=axes.map(axis=>{const values=triangles.flat().map(point=>point.dot(axis));return [Math.min(...values),Math.max(...values)];});
 const bin=(value,axis)=>Math.max(0,Math.min(15,Math.floor((value-ranges[axis][0])/(ranges[axis][1]-ranges[axis][0])*16))),buckets=Array.from({length:256},()=>[]);
 for(const triangle of triangles){const spans=axes.map((axis,i)=>{const values=triangle.map(point=>point.dot(axis));return [bin(Math.min(...values),i),bin(Math.max(...values),i)];});for(let x=spans[0][0];x<=spans[0][1];x++)for(let y=spans[1][0];y<=spans[1][1];y++)buckets[x*16+y].push(triangle);}
 const inside=point=>{
  if(!bounds.containsPoint(point))return false;
  ray.origin.copy(point);const hits=[];
  for(const triangle of buckets[bin(point.dot(u),0)*16+bin(point.dot(v),1)])if(ray.intersectTriangle(...triangle,false,hit))hits.push(point.distanceTo(hit));
  hits.sort((a,b)=>a-b);const distinct=hits.filter((distance,i)=>distance>.002&&(!i||distance-hits[i-1]>.00001));
  return distinct.length%2===1;
 };
 return (scene,heldItem)=>{
  const matrices=names.map((name,i)=>new Matrix4().multiplyMatrices(scene.getObjectByName(name).matrixWorld,inverseBinds[i])),headInverse=scene.getObjectByName('head').matrixWorld.clone().invert();
  let minimum=Infinity,contact=false;
  for(const vertex of hands){const point=new Vector3();for(let k=0;k<4;k++)if(vertex.w[k])point.addScaledVector(vertex.p.clone().applyMatrix4(matrices[vertex.j[k]]),vertex.w[k]);minimum=Math.min(minimum,point.y);point.applyMatrix4(headInverse);if(inside(point))contact=true;}
  if(heldItem){const socket=scene.getObjectByName(heldItem==='1813'?'socket_handRight_sabre':'socket_handRight_tool');for(const vertex of heldPoints[heldItem]){const point=socket.localToWorld(vertex.clone());minimum=Math.min(minimum,point.y);if(inside(point.applyMatrix4(headInverse)))contact=true;}}
  return {contact,minimum};
 };
}
for(const [gender,bank]of Object.entries(banks))test(`${gender} actual throwing hands and held items clear the head and floor`,()=>{
 const penetrates=headContactProbe(bank);
 for(const spec of bank.specs.filter(clip=>['throw','throwKnife','bolas'].includes(clip.gesture)))sampleBank(bank,spec.name,throwFractions,(point,scene,time)=>{
  const surface=penetrates(scene,time<spec.markers.release?({throw:'grenade',throwKnife:'1813',bolas:'boleadoras'})[spec.gesture]:undefined);
  assert.equal(surface.contact,false,`${spec.name} ${time.toFixed(3)}s: a hand or held object entered the head`);
  if(spec.posture==='prone')assert.ok(surface.minimum>-.002,`${spec.name} ${time.toFixed(3)}s: the actual hands and held object clear the floor (${surface.minimum.toFixed(4)} m)`);
  return {};
 });
});

for(const [gender,bank]of Object.entries(banks))test(`${gender} grenade and bolas releases retain forward travel through the marker`,()=>{
 for(const spec of bank.specs.filter(clip=>['throw','bolas'].includes(clip.gesture))){
  const values=sampleBank(bank,spec.name,[.58-1/156,.58,.58+1/156],point=>({grip:point('socket_handRight_tool')}));
  const velocity=values[2].grip.clone().sub(values[0].grip).multiplyScalar(60);
  assert.ok(velocity.z>1,`${spec.name}: the held object is still moving forward at release (${velocity.z} m/s)`);
  assert.ok(velocity.clone().normalize().dot(ahead)>.70,`${spec.name}: the release does not point mainly down or sideways`);
 }
});
