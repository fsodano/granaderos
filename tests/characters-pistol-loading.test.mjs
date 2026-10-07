import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from '../web/node_modules/three/build/three.module.js';
import {banks,manifest,readGlb,nativeScene,sampleBank} from './character-bank-fixture.mjs';
import {publishedActor} from './published-actor-fixture.mjs';
import {createPairedLoadingBattle} from '../web/app/renderer-sandbox/paired-loading-fixture.js';
import {actBattle,presentedActBattle} from '../game/tactical.js';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {admittedReloadWork}=await import('../web/lib/three/action-timing.ts');
const {presentActors}=await import('../web/lib/three/presentation.ts');
const {presentedFrameDuration}=await import('../web/lib/useEnemyPlayback.ts');
const equipmentData=readGlb(manifest.equipment.url),equipment=nativeScene(equipmentData.json),items=['1805','1806','1808'];
const postures={stand:'standing',crouch:'crouched',prone:'prone',mounted:'mounted'};
const near=(actual,expected,tolerance,message)=>assert.ok(Math.abs(actual-expected)<tolerance,`${message}: ${actual} != ${expected}`);

test('two-barrel loading targets agree with the actual exported metal barrel centres',()=>{
 const item=equipment.getObjectByName('item_1808'),points=[];equipment.updateMatrixWorld(true);
 item.traverse(node=>{
  const definition=equipmentData.json.nodes.find(entry=>entry.name===node.name);if(definition?.mesh===undefined)return;
  for(const primitive of equipmentData.json.meshes[definition.mesh].primitives){
   if(equipmentData.json.materials[primitive.material]?.name!=='Equipment_Blackened_Steel')continue;
   const positions=equipmentData.access(primitive.attributes.POSITION);for(let index=0;index<positions.length;index+=3)points.push(item.worldToLocal(node.localToWorld(new Vector3(...positions.slice(index,index+3)))));
  }
 });
 assert.ok(points.length);const front=Math.max(...points.map(point=>point.x)),rings=points.filter(point=>Math.abs(point.x-front)<.000001);
 for(const bank of Object.values(banks))for(const [barrel,name]of bank.specs.find(clip=>clip.name==='stand.reload.short-gun.1808').barrelClips.entries()){
  const contact=bank.specs.find(clip=>clip.name===name).loadingContact.muzzle,ring=rings.filter(point=>Math.sign(point.z)===Math.sign(contact[2]));assert.ok(ring.length>=14,'Both real barrel rings remain present');
  const centre=ring.reduce((sum,point)=>sum.add(point),new Vector3()).divideScalar(ring.length);
  near(centre.y,contact[1],.00001,`Barrel ${barrel} vertical centre`);near(centre.z,contact[2],.00001,`Barrel ${barrel} lateral centre`);assert.ok(contact[0]>centre.x&&contact[0]-centre.x<.006,'The muzzle contact is at the authored front marker, just outside its own barrel ring');
 }
});

for(const [gender,bank]of Object.entries(banks))for(const posture of Object.keys(postures))test(`${gender} ${posture} pistol loading fits each real muzzle and native palm`,()=>{
 for(const id of items)for(const barrel of id==='1808'?[0,1]:[0]){
  const base=`${posture}.reload.short-gun`,binding=manifest.equipment.items[id].clipOverrides[base],main=bank.specs.find(clip=>clip.name===binding),name=main.barrelClips?.[barrel]??binding,spec=bank.specs.find(clip=>clip.name===name);
  assert.equal(name,`${base}.${id}${barrel?'.barrel1':''}`);assert.equal(spec.loadingContact.method,'native palm and item muzzle');assert.equal(spec.duration,4.8);assert.deepEqual(spec.markers,{contact:2.16,ready:4.416});
  const phases=[0,.36,.46,.50,.58,.66,.70,.79,.83,1],values=sampleBank(bank,name,phases,(point,scene)=>{
   const right=scene.getObjectByName('socket_handRight_pistol'),left=scene.getObjectByName('socket_handLeft_tool');
   if(!right.getObjectByName(`item_${id}`))right.add(equipment.getObjectByName(`item_${id}`).clone(true));scene.updateMatrixWorld(true);
   const palm=left.getWorldPosition(new Vector3()),muzzle=right.localToWorld(new Vector3(...spec.loadingContact.muzzle)),axis=new Vector3(1,0,0).transformDirection(right.matrixWorld),rod=new Vector3(0,1,0).transformDirection(left.matrixWorld),delta=palm.clone().sub(muzzle),axial=delta.dot(axis);
   near(muzzle.distanceTo(point(manifest.equipment.items[id].muzzle)),id==='1808'?.011:0,.000001,'Bore uses its actual lateral offset from the central marker');
   const breech=right.localToWorld(new Vector3(.025,.055,spec.loadingContact.muzzle[2])),line=muzzle.clone().sub(breech),head=point('head'),fraction=Math.max(0,Math.min(1,head.clone().sub(breech).dot(line)/line.lengthSq()));
   return {palm,muzzle,clearance:delta.addScaledVector(axis,-axial).length(),alignment:rod.dot(axis),headClearance:head.distanceTo(breech.clone().addScaledVector(line,fraction)),feet:['foot_l','foot_r'].map(point),support:right.getObjectByName(`item_${id}`).worldToLocal(right.getWorldPosition(new Vector3()))};
  });
  for(const value of values.filter(value=>[.36,.46].includes(value.fraction)))assert.ok(value.palm.distanceTo(value.muzzle)<.002,`${name}: loading palm reaches its own muzzle within 2 mm`);
  for(const value of values.filter(value=>value.fraction>=.46&&value.fraction<=.83)){
   assert.ok(value.clearance<.006,`${name}: the rod remains inside the measured muzzle clearance`);assert.ok(value.alignment<-.9999,`${name}: the rod points into the actual barrel`);
   assert.ok(value.headClearance>.14,`${name}: the barrel stays ahead of the face`);
  }
  for(const value of values){assert.ok(value.support.length()<.0001,'The gun stays inside its native supporting palm');for(const [index,foot]of value.feet.entries())assert.ok(foot.distanceTo(values[0].feet[index])<.0001,'Pistol loading retains planted support');}
  const cue=spec.propCues[0];assert.equal(cue.item,'ramrod');assert.equal(cue.socket,'socket_handLeft_tool');assert.equal(cue.start,2.208);assert.equal(cue.end,4.128);near(cue.scale*.75,spec.loadingContact.ramrodLength,.0000001,'Rod length follows the item barrel');assert.ok(cue.scale>0&&cue.scale<.4);
 }
});

for(const appearance of ['granadero','woman-scout'])test(`${appearance} published paired loading uses a short ramrod in each native working hand`,async()=>{
 const asset=await publishedActor(appearance);
 for(const [prefix,posture]of Object.entries(postures))for(const id of items){
  const visual={key:'unit:loader',id:'loader',kind:'unit',appearance,skin:'light',side:'player',position:[0,0,0],yaw:0,tacticalLevel:0,posture,mounted:posture==='mounted',action:'reload',idleAction:'idle',equipment:'short-gun',items:[{id,reference:'primary',socket:'handRight'},{id,reference:'offhand',socket:'handLeft'}],garments:{},selected:false,bodyHeights:{},cue:{id:`${prefix}:${id}`,action:'reload',startedAt:0,durationMs:9600,work:[{from:0,to:1,hand:'primary'},{from:0,to:1,hand:'offhand'}]}},before=structuredClone(visual),runtime=new ActorRuntime(asset,visual),spec=asset.clips.find(clip=>clip.name===`${prefix}.reload.short-gun.${id}`);
  for(const [reference,hand,working,offset]of [['primary','handRight','handLeft',0],['offhand','handLeft','handRight',4800]]){
   const now=offset+4800*.58;runtime.update(visual,now);runtime.tick(.1,now);runtime.tick(.1,now);runtime.root.updateMatrixWorld(true);
   const gun=runtime.model.getObjectByName(`${reference}:${id}`),socket=runtime.model.getObjectByName(`socket_${working}_tool`),rod=socket.getObjectByName('item_ramrod');assert.equal(gun.parent.name,asset.appearance.sockets[`${hand}_pistol`].node);assert.ok(rod,'The actual working hand carries the ramrod');
   const bore=new Vector3(...spec.loadingContact.muzzle);if(hand==='handLeft')bore.z*=-1;
   const muzzle=gun.localToWorld(bore),palm=rod.getWorldPosition(new Vector3()),barrel=new Vector3(1,0,0).transformDirection(gun.matrixWorld),axis=new Vector3(0,1,0).transformDirection(rod.matrixWorld),relative=palm.clone().sub(muzzle),axial=relative.dot(barrel);
   assert.ok(relative.addScaledVector(barrel,-axial).length()<.006,'The native mirrored palm keeps the rod inside the muzzle');assert.ok(axis.dot(barrel)<-.9999,'The mirrored tool frame points into the barrel');near(rod.localToWorld(new Vector3(0,.75,0)).distanceTo(palm),spec.loadingContact.ramrodLength,.00001,'Published ramrod has the measured short barrel length');assert.ok(rod.scale.x>0&&rod.scale.y>0&&rod.scale.z>0);
   const other=runtime.model.getObjectByName(`${reference==='primary'?'offhand':'primary'}:${id}`);assert.equal(other.parent.name,asset.appearance.sockets.hipRight.node,'The other owned pistol frees the working hand');
  }
  runtime.tick(.1,9601);assert.equal(runtime.model.getObjectByName('item_ramrod'),undefined,'The timed ramrod leaves after paid loading');assert.deepEqual(visual,before);runtime.dispose();
 }
});

test('one real two-pistol order uses all four physical bores in admitted charge order',async()=>{
 const state=createPairedLoadingBattle();state.mode='exploration';state.units=state.units.filter(unit=>unit.side==='player');
 const source=state.units.find(unit=>unit.id==='paired-loader');source.weapon=1808;source.offHand.weapon=1808;const before=structuredClone(state),order={type:'reload',unitId:source.id},recorded=presentedActBattle(state,order),frames=admittedReloadWork(recorded.frames),delays=frames.map(frame=>presentedFrameDuration(frame,state));
 assert.equal(recorded.state.lastError,null);assert.deepEqual(recorded.state,actBattle(before,order));const frame=frames[1],actor=frame.state.units.find(unit=>unit.id===source.id),shown=presentActors(frame.state,[{kind:'unit',key:`unit:${source.id}`,actor}],{},new Set(),{frame:{...frame,sequenceId:'four-bores',actionId:1,startedAt:delays[0],durationMs:delays[1],actionStartedAt:0,actionDurationMs:delays.reduce((sum,value)=>sum+value,0)},now:delays[0]})[0];
 assert.deepEqual(shown.cue.work.map(work=>[work.hand,work.barrel]),[['primary',0],['primary',1],['offhand',0],['offhand',1]]);
 const asset=await publishedActor('granadero'),runtime=new ActorRuntime(asset,shown);
 for(const [index,work]of shown.cue.work.entries()){
  const now=4800*(index+.36);runtime.update(shown,now);runtime.tick(.1,now);runtime.tick(.1,now);runtime.root.updateMatrixWorld(true);
  const hand=work.hand==='primary'?'handRight':'handLeft',working=hand==='handRight'?'handLeft':'handRight',gun=runtime.model.getObjectByName(`${work.hand}:1808`),name=`stand.reload.short-gun.1808${work.barrel?'.barrel1':''}`,spec=asset.clips.find(clip=>clip.name===name),local=new Vector3(...spec.loadingContact.muzzle);if(hand==='handLeft')local.z*=-1;
  const muzzle=gun.localToWorld(local.clone()),palm=runtime.model.getObjectByName(`socket_${working}_tool`).getWorldPosition(new Vector3());assert.ok(palm.distanceTo(muzzle)<.002,'Each native charge reaches the owned bore selected by real loading work');assert.equal(gun.parent.name,asset.appearance.sockets[`${hand}_pistol`].node);
  const other=local.clone();other.z*=-1;assert.ok(palm.distanceTo(gun.localToWorld(other))>.018,'The loading hand cannot repeat the other barrel');
 }
 runtime.tick(.1,19201);assert.equal(runtime.model.getObjectByName('item_ramrod'),undefined);assert.deepEqual(state,before);runtime.dispose();
});
