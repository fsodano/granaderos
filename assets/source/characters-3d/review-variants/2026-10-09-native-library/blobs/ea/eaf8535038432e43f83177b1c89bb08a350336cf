import assert from 'node:assert/strict';
import {register} from 'node:module';
import test from 'node:test';
register('./tactical-render-loader.mjs',import.meta.url);
const {advanceSceneActors}=await import('../web/lib/three/scene-actors.ts');
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {admittedActors,presentActors}=await import('../web/lib/three/presentation.ts');
const {resolveContactTargetModel}=await import('../web/lib/three/contact-target-model.ts');
const {publishedActor}=await import('./published-actor-fixture.mjs');
const {createRendererSandboxBattle}=await import('../web/app/renderer-sandbox/fixtures.js');
const {presentedActBattle,actBattle}=await import('../game/tactical.js');
const {battleFrameDuration}=await import('../game/battle-playback.js');
const {TILE_METRES}=await import('../web/lib/three/projection.ts');
const {Vector3,Triangle}=await import('../web/node_modules/three/build/three.module.js');
const {capsuleSurfaceGap}=await import('./skinned-surface-contact-fixture.mjs');

function meshFaces(mesh){
 const p=mesh.geometry.attributes.position,index=mesh.geometry.index,vertices=Array.from({length:p.count},(_,i)=>mesh.localToWorld(mesh.isSkinnedMesh?mesh.getVertexPosition(i,new Vector3()):new Vector3().fromBufferAttribute(p,i))),out=[];
 for(let i=0;i<index.count;i+=3){const face=[0,1,2].map(slot=>vertices[index.getX(i+slot)]);if(new Triangle(...face).getArea()>1e-10)out.push(face);}return out;
}
function bodyFaces(runtime){runtime.root.updateMatrixWorld(true);const out=[];runtime.model.traverse(mesh=>{if(mesh.isSkinnedMesh&&mesh.visible)out.push(...meshFaces(mesh));});return out;}
function strikeGap(runtime,target){
 runtime.root.updateMatrixWorld(true);const item=runtime.model.getObjectByName('primary:1810'),hilt=runtime.action.getClip().name.endsWith('.hilt'),faces=[];item.traverse(mesh=>{if(mesh.isMesh&&mesh.visible&&(hilt?/Leather_Grip|Crossguard|Pommel/:/Curved_Blade/).test(mesh.name))faces.push(...meshFaces(mesh));});assert.ok(faces.length);const surface=bodyFaces(target);let minimum=Infinity;for(const face of faces)for(let i=0;i<3;i++){if(face[i].distanceToSquared(face[(i+1)%3])<1e-12)continue;minimum=Math.min(minimum,capsuleSurfaceGap(face[i],face[(i+1)%3],0,surface));if(minimum<=1e-8)return 0;}return minimum;
}
async function combat(posture='standing',appearance,contactOffset=0){
 const state=createRendererSandboxBattle('combat'),order={type:'melee',unitId:'sabre',targetId:'target-sabre'};
 if(appearance)state.units.find(u=>u.id==='sabre').spriteAppearance=appearance;state.units.find(u=>u.id==='target-sabre').stance=posture;state.units.find(u=>u.id==='target-sabre').y++;
 const result=presentedActBattle(state,order),durationMs=result.frames.map(battleFrameDuration),actionDurationMs=durationMs.reduce((a,b)=>a+b,0),entries=new Map(),trace=[],reads=[],revealed=new Set();let latest=[],currentNow=-200;
 const show=(state,frame,now)=>{
  const actor=state.units.find(u=>u.id==='sabre'),target=state.units.find(u=>u.id==='target-sabre'),direction=new Vector3(target.x-actor.x,0,target.y-actor.y).normalize();
  const positions=contactOffset?{'unit:target-sabre':{x:target.x-direction.x*contactOffset/TILE_METRES,y:target.y-direction.z*contactOffset/TILE_METRES,moving:false}}:{};
  return presentActors(state,admittedActors(state,state.units.filter(u=>u.side==='player'),revealed),positions,revealed,{selected:'sabre',mode:'melee',frame,now});
 };latest=show(state,undefined,-200);assert.equal(latest.length,13);assert.equal(latest.findIndex(v=>v.id==='sabre'),2);assert.equal(latest.findIndex(v=>v.id==='target-sabre'),9);
 for(const visual of latest){const asset=await publishedActor(visual.appearance,0),runtime=new ActorRuntime(asset,visual,undefined,target=>{const entry=entries.get(target.key),model=resolveContactTargetModel(target,latest,entry);reads.push({now:currentNow,target:target.key,accepted:Boolean(model),targetTicked:trace.some(event=>event[0]==='tick'&&event[1]===target.key)});return model;});const nativeTick=runtime.tick.bind(runtime),nativeUpdate=runtime.update.bind(runtime);runtime.tick=(...args)=>{trace.push(['tick',runtime.visual.key]);return nativeTick(...args);};runtime.update=(...args)=>{trace.push(['update',args[0].key]);return nativeUpdate(...args);};entries.set(visual.key,{runtime,visual,pending:false,error:false});}
 const run=(now,{refresh=true,active=()=>true,ambientPaused=false,reducedMotion=false}={})=>{if(refresh)latest=latest.map(visual=>({...visual}));const delta=(now-currentNow)/1000;currentNow=now;trace.length=0;const errors=[],activeActors=advanceSceneActors({visuals:latest,entry:key=>entries.get(key),active,delta,now,ambientPaused,reducedMotion,report:error=>errors.push(error)});assert.deepEqual(errors,[]);const ticks=trace.filter(event=>event[0]==='tick').map(event=>event[1]);assert.equal(new Set(ticks).size,ticks.length,'Each visible actor advances exactly once');assert.equal(ticks.length,activeActors);for(const visual of latest)assert.equal(entries.get(visual.key).visual,visual,'Every current identity is rebound before target resolution');return {ticks,activeActors};};
 run(-100);run(0);
 return {state,order,result,durationMs,actionDurationMs,entries,trace,reads,run,show,get latest(){return latest;},set latest(visuals){latest=visuals;},attacker:entries.get('unit:sabre').runtime,target:entries.get('unit:target-sabre').runtime,dispose(){for(const {runtime}of entries.values())runtime.dispose();}};
}
function frame(fixture,index,startedAt){return {...fixture.result.frames[index],index,sequenceId:'1:9',actionId:1,actionStartedAt:0,actionDurationMs:fixture.actionDurationMs,startedAt,durationMs:fixture.durationMs[index]};}

test('a paid zero-advance forehand turns during preparation and remains finite through its complete native recovery',async()=>{
 for(const posture of ['standing','crouched']){
  // The fitted rifle guard changes the target arm surface. An 11 cm
  // in-cell presentation offset keeps this an actual zero-advance case.
  // Paid cells and every physical contact/support limit remain unchanged.
  const f=await combat(posture,undefined,posture==='standing'?.11:0),before=JSON.stringify(f.result.state),expected=actBattle(f.state,f.order);let startedAt=0;
  for(let index=0;index<f.result.frames.length;index++){
   const shownFrame=frame(f,index,startedAt),state={...shownFrame.state,presentationVisibleIds:shownFrame.state.visibleIds};f.latest=f.show(state,shownFrame,startedAt);
   const duration=f.durationMs[index],times=duration?Array.from({length:Math.ceil(duration/(1000/60))+1},(_,i)=>Math.min(duration-.001,i*1000/60)):[0];if(shownFrame.type==='impact')times.push((.9-f.attacker.clipSpec.markers.contact)/(f.attacker.action.getClip().duration-f.attacker.clipSpec.markers.contact)*duration);times.sort((a,b)=>a-b);
   for(const time of times){const {ticks,activeActors}=f.run(startedAt+time);assert.equal(activeActors,13);f.attacker.model.traverse(node=>{assert.ok([...node.position.toArray(),...node.quaternion.toArray(),...node.scale.toArray()].every(Number.isFinite),'A zero-distance lead transfer cannot poison any native transform');});if(['prepare','contact'].includes(shownFrame.type)){assert.ok(f.attacker.meleeFit.plan,`${posture}/${shownFrame.type}/${time}: the first current array admits a physical plan`);assert.ok(ticks.indexOf('unit:target-sabre')<ticks.indexOf('unit:sabre'),'The current target native mixer advances before the contact actor');assert.ok(f.attacker.meleeFit.handReachError<1e-7);if(posture==='standing')assert.equal(f.attacker.meleeFit.bodyAdvance,0,'The actual surface is reachable with a supported turn and zero artificial forward shuffle');}}
   if(shownFrame.type==='contact'){assert.equal(f.target.visual.posture,posture);assert.ok(strikeGap(f.attacker,f.target)<=.004,'Current idle breathing retains the measured baseline surface tolerance at the held marker');}
   startedAt+=duration;
  }
  assert.ok(f.reads.length>0);assert.ok(f.reads.every(read=>read.accepted&&read.targetTicked),'Every admitted target read follows its current skin tick, including first prepare/contact arrays');assert.equal(JSON.stringify(f.result.state),before,'Scene order cannot mutate AP, hit, damage or saved cells');assert.deepEqual(f.result.state,expected,'There remains one finite paid result');f.dispose();
 }
});

test('pending, failed, replaced, absent and out-of-frustum targets retain exact finite native fallback',async()=>{
 const f=await combat(),prepare=frame(f,0,0),base=f.show({...prepare.state,presentationVisibleIds:prepare.state.visibleIds},prepare,0),targetKey='unit:target-sabre',attackerVisual=base.find(visual=>visual.id==='sabre'),entry=f.entries.get(targetKey),original=entry.runtime,native=new ActorRuntime(f.attacker.asset,f.latest.find(visual=>visual.id==='sabre'));native.tick(.1,-100);native.tick(.1,0);
 for(const [name,change,active]of [
  ['pending',()=>entry.pending=true,()=>true],
  ['failed',()=>entry.error=true,()=>true],
  ['replacement appearance not loaded',()=>entry.runtime={...original,asset:{...original.asset,appearance:{...original.asset.appearance,id:'woman-scout'}},update:original.update.bind(original),tick:original.tick.bind(original)},()=>true],
  ['absent',()=>f.entries.delete(targetKey),()=>true],
  ['out of frustum',()=>{},visual=>visual.key!==targetKey],
 ]){
  entry.runtime=original;entry.pending=false;entry.error=false;f.entries.set(targetKey,entry);entry.visual=base.find(visual=>visual.key===targetKey);original.root.visible=true;change();f.latest=base.map(visual=>({...visual}));const actor=f.attacker;actor.meleeFit.plan=undefined;actor.meleeFit.attemptedKey='';const errors=[];advanceSceneActors({visuals:f.latest,entry:key=>f.entries.get(key),active,delta:0,now:210,report:error=>errors.push(error)});assert.deepEqual(errors,[]);assert.equal(actor.meleeFit.plan,undefined,name);
  native.update(actor.visual,210);native.tick(0,210);native.root.updateMatrixWorld(true);actor.root.updateMatrixWorld(true);assert.ok(actor.model.getObjectByName('Root').position.distanceTo(native.model.getObjectByName('Root').position)<1e-8,name);assert.ok(actor.model.getObjectByName('hand_r').getWorldPosition(new Vector3()).distanceTo(native.model.getObjectByName('hand_r').getWorldPosition(new Vector3()))<1e-8,name);
 }
 entry.runtime=original;entry.pending=false;entry.error=false;f.entries.set(targetKey,entry);native.dispose();f.dispose();
});


test('the paid diagonal phase handoff preserves a continuous native body path for both anatomies',async()=>{
 for(const appearance of ['granadero','woman-scout']){
  const f=await combat('crouched',appearance),before=JSON.stringify(f.result.state);let startedAt=0,previous,maxSpeed=0,edgeSpeed=0,preparePlan;
  for(let index=0;index<f.result.frames.length;index++){
   const shownFrame={...frame(f,index,startedAt),sequenceId:'1:3'},state={...shownFrame.state,presentationVisibleIds:shownFrame.state.visibleIds};f.latest=f.show(state,shownFrame,startedAt);
   const duration=f.durationMs[index],stop=startedAt+duration;
   // Keep one uninterrupted RAF grid, so this check includes the real 420 ms phase boundary.
   const times=duration?Array.from({length:Math.ceil(duration/(1000/240))+1},(_,i)=>Math.ceil((startedAt-.000001)/(1000/240))*(1000/240)+i*(1000/240)).filter(now=>now>=startedAt-.000001&&now<stop-.000001):[startedAt];
   for(const now of times){
    f.run(now);const root=f.attacker.model.getObjectByName('Root').getWorldPosition(new Vector3());assert.ok(root.toArray().every(Number.isFinite));
    if(previous&&now>previous.now){const speed=root.distanceTo(previous.root)/((now-previous.now)/1000);maxSpeed=Math.max(maxSpeed,speed);if(previous.phase==='prepare'&&shownFrame.type==='contact')edgeSpeed=speed;}
    if(shownFrame.type==='prepare')preparePlan=f.attacker.meleeFit.plan;
    if(shownFrame.type==='contact'){assert.ok(f.attacker.meleeFit.plan,'The current admitted target retains a supported contact plan');assert.ok(f.attacker.meleeFit.handReachError<1e-7);}
    previous={now,root,phase:shownFrame.type};
   }
   startedAt=stop;
  }
  assert.ok(preparePlan,'The first current array admits a physical preparation');assert.ok(edgeSpeed>0&&edgeSpeed<2,`${appearance}: the body cannot jump to a different lunge at the phase boundary (${edgeSpeed} m/s)`);assert.ok(maxSpeed<2,`${appearance}: the complete paid body path is bounded (${maxSpeed} m/s)`);assert.equal(JSON.stringify(f.result.state),before);assert.deepEqual(f.result.state,actBattle(f.state,f.order));f.dispose();
 }
});
