import assert from 'node:assert/strict';
import {register} from 'node:module';
import test from 'node:test';
register('./tactical-render-loader.mjs',import.meta.url);
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {presentActors}=await import('../web/lib/three/presentation.ts');
const {TILE_METRES}=await import('../web/lib/three/projection.ts');
const {publishedActor}=await import('./published-actor-fixture.mjs');
const {createRendererSandboxBattle}=await import('../web/app/renderer-sandbox/fixtures.js');
const {presentedActBattle}=await import('../game/tactical.js');
const {selectActorClipVariant}=await import('../game/actor-action-contract.js');
const {Vector3,Triangle}=await import('../web/node_modules/three/build/three.module.js');
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

test('all forty native sabre pairings reach actual skin or clothing with fixed cells and supported soles',async()=>{
 for(const appearance of ['granadero','woman-scout'])for(const diagonal of [false,true])for(const posture of ['standing','crouched']){
  const fixture=await pair(appearance,diagonal,posture),surface=faces(fixture.body.model),seen=new Set(),before=JSON.stringify(fixture.frame.state),bones=nativeBones(fixture.asset);
  for(let index=0;index<12;index++){
   const chosen=selectActorClipVariant('stand.slash.blade',`strike:${index}`);if(seen.has(chosen))continue;
   const visual={...fixture.attacker,cue:{...fixture.attacker.cue,id:`strike:${index}`}},runtime=new ActorRuntime(fixture.asset,visual,undefined,()=>({model:fixture.body.model,root:fixture.body.root}));runtime.tick(.1,1070);runtime.root.updateMatrixWorld(true);
   const clip=runtime.action.getClip().name;assert.equal(clip,chosen);seen.add(clip);
   const label=`${appearance}/${diagonal?'diagonal':'cardinal'}/${posture}/${clip}`;
   assert.equal(runtime.meleeFit.rejectedFits,0,label);assert.ok(contactGap(runtime,surface)<=.01,`${label}: the actual target surface meets the striking part`);
   assertNative(runtime,bones,visual.position);assert.ok(lowestSole(runtime)-visual.position[1]<=.008,label);
   const heldBody=runtime.model.getObjectByName('Root').position.clone(),heldHand=runtime.model.getObjectByName('hand_r').getWorldPosition(new Vector3());
   for(let tick=0;tick<12;tick++){
    runtime.tick(0,1070);runtime.root.updateMatrixWorld(true);
    assert.ok(runtime.model.getObjectByName('Root').position.distanceTo(heldBody)<1e-8,`${label}: held contact cannot accumulate its body correction`);
    assert.ok(runtime.model.getObjectByName('hand_r').getWorldPosition(new Vector3()).distanceTo(heldHand)<1e-8,`${label}: held contact cannot accumulate its arm correction`);
   }
   // Check the complete native 30 Hz body cycle, including both support
   // transfers and the return to the original guard. These are real sole
   // vertices, rather than an ankle pivot or a clamped leg-end distance.
   for(let frame=0;frame<30;frame++){
    const cue={...visual.cue,phase:undefined,phaseStartedAt:0,startedAt:0,durationMs:1000};delete cue.phaseDurationMs;
    runtime.update({...visual,cue},frame*1000/30);runtime.tick(0,frame*1000/30);runtime.root.updateMatrixWorld(true);
    assertNative(runtime,bones,visual.position);assert.ok(runtime.meleeFit.footReachError<.001,`${label}: neither planted foot is clamped`);
    const sole=lowestSole(runtime)-visual.position[1];assert.ok(sole>=-.001&&sole<=.008,`${label}: one complete exported sole supports each sample (${sole})`);
   }
   runtime.dispose();
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
