import assert from 'node:assert/strict';
import {register} from 'node:module';
import test from 'node:test';
register('./tactical-render-loader.mjs',import.meta.url);
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {presentActors}=await import('../web/lib/three/presentation.ts');
const {TILE_METRES}=await import('../web/lib/three/projection.ts');
const {publishedActor}=await import('./published-actor-fixture.mjs');
const {createRendererSandboxBattle}=await import('../web/app/renderer-sandbox/fixtures.js');
const {presentedActBattle,actBattle}=await import('../game/tactical.js');
const {selectActorClipVariant}=await import('../game/actor-action-contract.js');
const {Vector3,Triangle,Matrix4}=await import('../web/node_modules/three/build/three.module.js');
const {capsuleSurfaceGap}=await import('./skinned-surface-contact-fixture.mjs');

async function pair(appearance='granadero',diagonal=false,posture='standing',lod=0){
 const state=createRendererSandboxBattle('combat'),unit=state.units.find(unit=>unit.id==='sabre'),target=state.units.find(unit=>unit.id==='target-sabre');
 unit.spriteAppearance=appearance;target.y+=diagonal?1:0;target.stance=posture;
 const result=presentedActBattle(state,{type:'melee',unitId:unit.id,targetId:target.id}),contact=result.frames.find(frame=>frame.type==='contact');
 assert.ok(contact,`The rules admit the real strike: ${result.state.lastError}`);
 const frame={...contact,sequenceId:'native-contact-review',actionId:1,index:1,startedAt:420,durationMs:650,actionStartedAt:0,actionDurationMs:1970};
 // Build the complete admitted pair; presentActors supplies target identity
 // and disclosed floor support before any runtime object is constructed.
 const admitted=frame.state.units.filter(actor=>['sabre','target-sabre'].includes(actor.id)).map(actor=>({key:`unit:${actor.id}`,kind:'unit',actor})),actors=presentActors(frame.state,admitted,{},new Set(),{frame,now:420}),attacker=actors.find(actor=>actor.id==='sabre'),defender=actors.find(actor=>actor.id==='target-sabre');
 assert.ok(attacker.cue.contactTarget);assert.ok(attacker.cue.contactSupport.floors.length);
 const [asset,other]=await Promise.all([publishedActor(appearance,lod),publishedActor(defender.appearance,lod)]),body=new ActorRuntime(other,defender);body.tick(.1,1070);body.root.updateMatrixWorld(true);
 return {attacker,defender,asset,body,frame,result};
}
function faces(root){
 const faces=[];root.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!mesh.visible)return;
  const position=mesh.geometry.attributes.position,index=mesh.geometry.index,vertices=Array.from({length:position.count},(_,index)=>mesh.localToWorld(mesh.getVertexPosition(index,new Vector3())));
  for(let offset=0;offset<index.count;offset+=3){const face=[vertices[index.getX(offset)],vertices[index.getX(offset+1)],vertices[index.getX(offset+2)]];if(new Triangle(...face).getArea()>1e-10)faces.push(face);}
 });return faces;
}
function contactGap(runtime,surface){
 const weapon=runtime.model.getObjectByName('primary:1810');assert.ok(weapon);
 if(runtime.action.getClip().name.endsWith('.hilt'))return capsuleSurfaceGap(weapon.localToWorld(new Vector3(0,-.052,0)),weapon.localToWorld(new Vector3(0,.074,0)),.017,surface);
 let gap=Infinity;const point=t=>weapon.localToWorld(new Vector3(-.060*t*t*.45,.078+.76*t,0));
 for(let index=0;index<24;index++)gap=Math.min(gap,capsuleSurfaceGap(point(index/24),point((index+1)/24),.006,surface));return gap;
}
function nativeBones(asset){const bones=new Map();asset.body.scene.traverse(node=>{if(node.isBone)bones.set(node.name,{position:node.position.clone(),scale:node.scale.clone()});});return bones;}
function assertNative(runtime,bones,position){
 assert.deepEqual(runtime.root.position.toArray(),position,'The saved actor cell is the fixed wrapper transform');
 runtime.model.traverse(node=>{const native=bones.get(node.name);if(!native)return;if(node.name!=='Root')assert.ok(node.position.distanceTo(native.position)<1e-6,`${node.name} keeps its native joint offset through GLTF float precision`);assert.ok(node.scale.distanceTo(native.scale)<1e-6,`${node.name} keeps its native scale through GLTF float precision`);});
}
function lowestSole(runtime){
 const footwear=runtime.model.getObjectByName(runtime.asset.appearance.parts.footwear.replace('{lod}',String(runtime.asset.lod))),position=footwear.geometry.attributes.position;
 let minimum=Infinity;for(let index=0;index<position.count;index++)minimum=Math.min(minimum,footwear.localToWorld(footwear.getVertexPosition(index,new Vector3())).y);return minimum;
}

function gap(a,b){let minimum=Infinity;for(const face of a)for(let i=0;i<3;i++){const start=face[i],end=face[(i+1)%3];if(start.distanceToSquared(end)<1e-12)continue;minimum=Math.min(minimum,capsuleSurfaceGap(start,end,0,b));if(minimum<=1e-8)return minimum;}return minimum;}
function strikingFaces(runtime){const item=runtime.model.getObjectByName('primary:1810'),hilt=runtime.action.getClip().name.endsWith('.hilt'),result=[];item.traverse(mesh=>{if(!mesh.isMesh||!mesh.visible||!(hilt?/Leather_Grip|Crossguard/:/Curved_Blade/).test(mesh.name))return;const p=mesh.geometry.attributes.position,index=mesh.geometry.index;for(let i=0;i<index.count;i+=3){const face=[0,1,2].map(offset=>mesh.localToWorld(new Vector3().fromBufferAttribute(p,index.getX(i+offset))));if(new Triangle(...face).getArea()>1e-10)result.push(face);}});assert.ok(result.length);return result;}
function soleCenter(runtime,side){const mesh=runtime.model.getObjectByName(runtime.asset.appearance.parts.footwear.replace('{lod}',String(runtime.asset.lod))),sole=runtime.meleeFit.soles.get(side),center=new Vector3();for(const index of sole.outline)center.add(mesh.localToWorld(mesh.getVertexPosition(index,new Vector3())));return center.divideScalar(sole.outline.length);}
function weaponFaces(runtime,weapon){const item=runtime.model.getObjectByName('primary:1810'),faces=[];item.traverse(mesh=>{if(!mesh.isMesh||!mesh.visible||!/Leather_Grip/.test(mesh.name))return;const p=mesh.geometry.attributes.position,index=mesh.geometry.index;for(let i=0;i<index.count;i+=3)faces.push([0,1,2].map(offset=>mesh.localToWorld(new Vector3().fromBufferAttribute(p,index.getX(i+offset)))));});return faces;}
function palmFaces(runtime){return faces(runtime.model,(mesh,index)=>{if(mesh.material.name!=='Skin')return false;if(index===undefined)return true;let weight=0;for(let slot=0;slot<4;slot++)if(mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getComponent(index,slot)].name==='hand_r')weight+=mesh.geometry.attributes.skinWeight.getComponent(index,slot);return weight>.5;});}
function assertFreeGuard(runtime,source){
 runtime.model.getObjectByName('upperarm_l').traverse(node=>{if(!node.isBone)return;const native=source.model.getObjectByName(node.name);assert.ok(node.quaternion.toArray().every((value,index)=>Math.abs(value-native.quaternion.toArray()[index])<1e-8),`${node.name} keeps the free native guard`);assert.ok(node.position.distanceTo(native.position)<1e-8);});
 const current=runtime.model.getObjectByName('spine_03').worldToLocal(runtime.model.getObjectByName('hand_l').getWorldPosition(new Vector3())),native=source.model.getObjectByName('spine_03').worldToLocal(source.model.getObjectByName('hand_l').getWorldPosition(new Vector3()));assert.ok(current.distanceTo(native)<1e-8,'The free guard keeps its native position relative to the chest');
}
function gripMatrix(runtime,weapon){const item=runtime.model.getObjectByName('primary:1810');return new Matrix4().copy(runtime.model.getObjectByName('hand_r').matrixWorld).invert().multiply(item.matrixWorld);}
function assertGrip(runtime,source,weapon){const current=gripMatrix(runtime,weapon).elements,native=gripMatrix(source,weapon).elements;assert.ok(current.every((value,index)=>Math.abs(value-native[index])<1e-8),'The same owned gun keeps its native wrist grip');}
function assertStrikingReach(runtime,source,label){
 const plan=runtime.meleeFit.plan;if(!plan)return;
 // Recover the intended wrist from the independently rendered source pose,
 // not from the solver's clamped endpoint or its reported reach counter.
 const time=runtime.action.time,contact=runtime.clipSpec.markers.contact,end=runtime.action.getClip().duration,smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);},weight=time<=contact?smooth(time/contact):1-smooth((time-contact)/((plan.handRecovery??end*.9)-contact));
 const nativeShoulder=source.model.getObjectByName('upperarm_r').getWorldPosition(new Vector3()),nativeElbow=source.model.getObjectByName('lowerarm_r').getWorldPosition(new Vector3()),nativeWrist=source.model.getObjectByName('hand_r').getWorldPosition(new Vector3()),length=nativeShoulder.distanceTo(nativeElbow)+nativeElbow.distanceTo(nativeWrist),desired=nativeWrist.add(plan.hand.clone().applyQuaternion(runtime.root.quaternion).multiplyScalar(weight)),shoulder=runtime.model.getObjectByName('upperarm_r').getWorldPosition(new Vector3()),wrist=runtime.model.getObjectByName('hand_r').getWorldPosition(new Vector3());
 assert.ok(Math.max(0,shoulder.distanceTo(desired)-(length-.001))<1e-7,`${label} intended wrist stays within original measured arm reach`);
 assert.ok(wrist.distanceTo(desired)<1e-6,`${label} actual native wrist reaches its intended path without a hidden clamp`);
}


test('all forty native sabre pairings reach actual skin or clothing with fixed cells and supported soles',async()=>{
 for(const appearance of ['granadero','woman-scout'])for(const diagonal of [false,true])for(const posture of ['standing','crouched']){
  const fixture=await pair(appearance,diagonal,posture),surface=faces(fixture.body.model),seen=new Set(),before=JSON.stringify(fixture.frame.state),bones=nativeBones(fixture.asset);
  for(let index=0;index<12;index++){
   const chosen=selectActorClipVariant('stand.slash.blade',`strike:${index}`);if(seen.has(chosen))continue;
   const visual={...fixture.attacker,cue:{...fixture.attacker.cue,id:`strike:${index}`}},runtime=new ActorRuntime(fixture.asset,visual,undefined,()=>({model:fixture.body.model,root:fixture.body.root})),source=new ActorRuntime(fixture.asset,visual);runtime.tick(.1,1070);source.tick(.1,1070);runtime.root.updateMatrixWorld(true);source.root.updateMatrixWorld(true);
   const clip=runtime.action.getClip().name;assert.equal(clip,chosen);seen.add(clip);
   const label=`${appearance}/${diagonal?'diagonal':'cardinal'}/${posture}/${clip}`;
   assert.equal(runtime.meleeFit.rejectedFits,0,label);assert.ok(contactGap(runtime,surface)<=.01,`${label}: the actual target surface meets the striking part`);
   assert.ok(gap(strikingFaces(runtime),surface)<=.001,`${label}: actual exported striking triangles meet the admitted body`);assert.ok(runtime.meleeFit.plan.body.length()<=Math.hypot(runtime.meleeFit.walkingStep,.38)+1e-7);
   assertNative(runtime,bones,visual.position);assertFreeGuard(runtime,source);assertGrip(runtime,source,1810);assertStrikingReach(runtime,source,label);assert.ok(gap(palmFaces(runtime),weaponFaces(runtime,1810))<=.001,`${label}: actual right palm meets the owned grip`);assert.ok(lowestSole(runtime)-visual.position[1]<=.008,label);
   const heldBody=runtime.model.getObjectByName('Root').position.clone(),heldHand=runtime.model.getObjectByName('hand_r').getWorldPosition(new Vector3());
   for(let tick=0;tick<12;tick++){
    runtime.tick(0,1070);runtime.root.updateMatrixWorld(true);
    assert.ok(runtime.model.getObjectByName('Root').position.distanceTo(heldBody)<1e-8,`${label}: held contact cannot accumulate its body correction`);
    assert.ok(runtime.model.getObjectByName('hand_r').getWorldPosition(new Vector3()).distanceTo(heldHand)<1e-8,`${label}: held contact cannot accumulate its arm correction`);
   }
   // Check 241 independent samples of the complete native body cycle, including both support
   // transfers and the return to the original guard. These are real sole
   // vertices, rather than an ankle pivot or a clamped leg-end distance.
   let previous;const maximumSpeed=runtime.meleeFit.walkingFootSpeed;
   for(let frame=0;frame<=240;frame++){
    const cue={...visual.cue,phase:undefined,phaseStartedAt:0,startedAt:0,durationMs:1000};delete cue.phaseDurationMs;
    const now=frame*1000/240,shown={...visual,cue};runtime.update(shown,now);source.update(shown,now);runtime.tick(0,now);source.tick(0,now);runtime.root.updateMatrixWorld(true);source.root.updateMatrixWorld(true);
    assertNative(runtime,bones,visual.position);assertFreeGuard(runtime,source);assertGrip(runtime,source,1810);assertStrikingReach(runtime,source,`${label}/${frame}`);assert.ok(runtime.meleeFit.handReachError<1e-7,`${label}/${frame}: the native striking arm is never clamped`);assert.ok(runtime.meleeFit.footReachError<.001,`${label}: neither planted foot is clamped`);
    const centers=['l','r'].map(side=>soleCenter(runtime,side));if(previous)for(let side=0;side<2;side++)assert.ok(centers[side].distanceTo(previous[side])*240<=maximumSpeed+1e-5,`${label}/${frame}: full3D actual sole speed cannot exceed its native walking gait`);previous=centers;
    const sole=lowestSole(runtime)-visual.position[1];assert.ok(sole>=-.001&&sole<=.008,`${label}: one complete exported sole supports each sample (${sole})`);
   }
   runtime.dispose();source.dispose();
  }
  assert.equal(seen.size,5,'The same five paid stable variants are exercised');assert.equal(JSON.stringify(fixture.frame.state),before,'AP, health, miss results and saved cells are unchanged');fixture.body.dispose();
 }
});

test('unavailable, undisclosed, unsupported and blocked-corner fits retain the original finite strike',async()=>{
 const fixture=await pair('woman-scout',true),base={...fixture.attacker,cue:{...fixture.attacker.cue,id:'strike:4'}},source=new ActorRuntime(fixture.asset,base);source.tick(.1,1070);
 const rootPose=source.model.getObjectByName('Root').position.clone(),handPose=source.model.getObjectByName('hand_r').getWorldPosition(new Vector3());
 const floor=visual=>({minX:visual.position[0]-TILE_METRES/2,maxX:visual.position[0]+TILE_METRES/2,minZ:visual.position[2]-TILE_METRES/2,maxZ:visual.position[2]+TILE_METRES/2,height:visual.position[1]});
 for(const [name,cue,resolve]of [
  ['missing loaded model',base.cue,()=>undefined],
  ['no target disclosure',{...base.cue,contactTarget:undefined},()=>assert.fail('An absent target cannot be read')],
  ['prone target family',{...base.cue,contactTarget:{...base.cue.contactTarget,posture:'prone'}},()=>assert.fail('An unsupported target family cannot be read')],
  ['mounted target family',{...base.cue,contactTarget:{...base.cue.contactTarget,mounted:true}},()=>assert.fail('An unsupported target family cannot be read')],
  ['no disclosed support',{...base.cue,contactSupport:undefined},()=>({model:fixture.body.model,root:fixture.body.root})],
  ['different support height',{...base.cue,contactSupport:{floors:[{minX:-100,maxX:100,minZ:-100,maxZ:100,height:3}]}},()=>({model:fixture.body.model,root:fixture.body.root})],
  ['two blocked side cells',{...base.cue,contactSupport:{floors:[floor(fixture.attacker),floor(fixture.defender)]}},()=>({model:fixture.body.model,root:fixture.body.root})],
 ]){
  const runtime=new ActorRuntime(fixture.asset,{...base,cue},undefined,resolve);runtime.tick(.1,1070);
  assert.ok(runtime.model.getObjectByName('Root').position.distanceTo(rootPose)<1e-8,name);assert.ok(runtime.model.getObjectByName('hand_r').getWorldPosition(new Vector3()).distanceTo(handPose)<1e-8,name);assert.equal(runtime.action.getClip().name,source.action.getClip().name,name);runtime.dispose();
 }
 source.dispose();fixture.body.dispose();
});

test('a replacement LOD is fitted anew, then cached recovery reads no hidden target and completes once',async()=>{
 const fixture=await pair('granadero',true),visual={...fixture.attacker,cue:{...fixture.attacker.cue,id:'strike:4'}},other=await publishedActor(fixture.defender.appearance,1),replacement=new ActorRuntime(other,fixture.defender);replacement.tick(.1,1070);replacement.root.updateMatrixWorld(true);
 let current=fixture.body,reads=0,completed=0;const runtime=new ActorRuntime(fixture.asset,visual,()=>completed++,()=>{reads++;return {model:current.model,root:current.root};});runtime.tick(.1,1070);const firstPlan=runtime.meleeFit.plan;
 current=replacement;runtime.tick(0,1070);runtime.root.updateMatrixWorld(true);assert.notEqual(runtime.meleeFit.plan,firstPlan);assert.equal(runtime.meleeFit.plan.target,replacement.model);assert.ok(contactGap(runtime,faces(replacement.model))<=.01);
 const admittedReads=reads;current.root.visible=false;
 const cue={...visual.cue,phase:'impact',phaseStartedAt:1070,phaseDurationMs:900,contactTarget:undefined,contactSupport:undefined};runtime.update({...visual,cue},1070);runtime.tick(0,1470);assert.equal(reads,admittedReads,'Recovery reads only the already admitted own-body plan');
 runtime.tick(0,1970);runtime.tick(0,2100);assert.equal(completed,1,'The finite strike emits one completion');assert.equal(runtime.visual.action,runtime.visual.idleAction);runtime.dispose();fixture.body.dispose();replacement.dispose();
});

test('native contact and actual sole support use the same elevated world height',async()=>{
 const fixture=await pair('woman-scout',true),height=3,defender={...fixture.defender,position:[fixture.defender.position[0],height,fixture.defender.position[2]]},body=new ActorRuntime(fixture.body.asset,defender);body.tick(.1,1070);body.root.updateMatrixWorld(true);
 const visual={...fixture.attacker,position:[fixture.attacker.position[0],height,fixture.attacker.position[2]],cue:{...fixture.attacker.cue,id:'strike:4',contactTarget:{...fixture.attacker.cue.contactTarget,position:[...defender.position]},contactSupport:{floors:fixture.attacker.cue.contactSupport.floors.map(floor=>({...floor,height}))}}},runtime=new ActorRuntime(fixture.asset,visual,undefined,()=>({model:body.model,root:body.root}));runtime.tick(.1,1070);runtime.root.updateMatrixWorld(true);
 assert.equal(runtime.meleeFit.rejectedFits,0);assert.ok(contactGap(runtime,faces(body.model))<=.01);assert.deepEqual(runtime.root.position.toArray(),visual.position);
 const sole=lowestSole(runtime)-height;assert.ok(sole>=-.001&&sole<=.008,`The actual skinning palette and sole use height ${height} (${sole})`);
 runtime.dispose();body.dispose();fixture.body.dispose();
});


test('a missing native walking reference and a paid empty-cell swing retain the exact finite source pose',async()=>{
 const fixture=await pair(),visual={...fixture.attacker,cue:{...fixture.attacker.cue,id:'strike:4'}},asset={...fixture.asset,clips:fixture.asset.clips.filter(clip=>clip.name!=='stand.walk.blade'),animation:{...fixture.asset.animation,animations:fixture.asset.animation.animations.filter(clip=>clip.name!=='stand.walk.blade')}},native=new ActorRuntime(asset,visual),unsupported=new ActorRuntime(asset,visual,undefined,()=>assert.fail('A missing native gait cannot fit or inspect a target model'));native.tick(.1,1070);unsupported.tick(.1,1070);native.root.updateMatrixWorld(true);unsupported.root.updateMatrixWorld(true);
 assert.equal(unsupported.meleeFit.plan,undefined);assert.ok(unsupported.model.getObjectByName('Root').position.distanceTo(native.model.getObjectByName('Root').position)<1e-8);assert.ok(unsupported.model.getObjectByName('hand_r').getWorldPosition(new Vector3()).distanceTo(native.model.getObjectByName('hand_r').getWorldPosition(new Vector3()))<1e-8);assertFreeGuard(unsupported,native);assertGrip(unsupported,native,1810);unsupported.dispose();native.dispose();
 const state=createRendererSandboxBattle('combat'),order={type:'meleePoint',unitId:'sabre',x:8,y:7},result=presentedActBattle(state,order);assert.equal(result.state.lastError,null);assert.deepEqual(result.state,actBattle(state,order));assert.ok(result.frames.every(frame=>frame.impacts.length===0));
 const contact=result.frames.find(frame=>frame.type==='contact'),frame={...contact,sequenceId:'sabre-point-review',actionId:1,index:1,startedAt:420,durationMs:650,actionStartedAt:0,actionDurationMs:1970};assert.ok(contact);const admitted=frame.state.units.filter(actor=>['sabre','target-sabre'].includes(actor.id)).map(actor=>({key:`unit:${actor.id}`,kind:'unit',actor})),shown=presentActors(frame.state,admitted,{},new Set(),{frame,now:420}).find(actor=>actor.id==='sabre');assert.equal(shown.cue.contactTarget,undefined);
 const source=new ActorRuntime(fixture.asset,shown),runtime=new ActorRuntime(fixture.asset,shown,undefined,()=>assert.fail('An empty paid swing cannot inspect actor geometry'));source.tick(.1,1070);runtime.tick(.1,1070);source.root.updateMatrixWorld(true);runtime.root.updateMatrixWorld(true);assert.equal(runtime.meleeFit.plan,undefined);assert.ok(runtime.model.getObjectByName('Root').position.distanceTo(source.model.getObjectByName('Root').position)<1e-8);assert.ok(runtime.model.getObjectByName('hand_r').getWorldPosition(new Vector3()).distanceTo(source.model.getObjectByName('hand_r').getWorldPosition(new Vector3()))<1e-8);assertFreeGuard(runtime,source);assertGrip(runtime,source,1810);source.dispose();runtime.dispose();fixture.body.dispose();
});
