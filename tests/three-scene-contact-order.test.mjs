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
async function combat(posture='standing'){
 const state=createRendererSandboxBattle('combat'),order={type:'melee',unitId:'sabre',targetId:'target-sabre'};
 state.units.find(u=>u.id==='target-sabre').stance=posture;
 const result=presentedActBattle(state,order),durationMs=result.frames.map(battleFrameDuration),actionDurationMs=durationMs.reduce((a,b)=>a+b,0),entries=new Map(),trace=[],reads=[],revealed=new Set();let latest=[],currentNow=-200;
 const show=(state,frame,now)=>presentActors(state,admittedActors(state,state.units.filter(u=>u.side==='player'),revealed),{},revealed,{selected:'sabre',mode:'melee',frame,now});latest=show(state,undefined,-200);assert.equal(latest.length,13);assert.equal(latest.findIndex(v=>v.id==='sabre'),2);assert.equal(latest.findIndex(v=>v.id==='target-sabre'),9);
 for(const visual of latest){const asset=await publishedActor(visual.appearance,0),runtime=new ActorRuntime(asset,visual,undefined,target=>{const entry=entries.get(target.key),model=resolveContactTargetModel(target,latest,entry);reads.push({now:currentNow,target:target.key,accepted:Boolean(model),targetTicked:trace.some(event=>event[0]==='tick'&&event[1]===target.key)});return model;});const nativeTick=runtime.tick.bind(runtime),nativeUpdate=runtime.update.bind(runtime);runtime.tick=(...args)=>{trace.push(['tick',runtime.visual.key]);return nativeTick(...args);};runtime.update=(...args)=>{trace.push(['update',args[0].key]);return nativeUpdate(...args);};entries.set(visual.key,{runtime,visual,pending:false,error:false});}
 const run=(now,{refresh=true,active=()=>true,ambientPaused=false,reducedMotion=false}={})=>{if(refresh)latest=latest.map(visual=>({...visual}));const delta=(now-currentNow)/1000;currentNow=now;trace.length=0;const errors=[],activeActors=advanceSceneActors({visuals:latest,entry:key=>entries.get(key),active,delta,now,ambientPaused,reducedMotion,report:error=>errors.push(error)});assert.deepEqual(errors,[]);const ticks=trace.filter(event=>event[0]==='tick').map(event=>event[1]);assert.equal(new Set(ticks).size,ticks.length,'Each visible actor advances exactly once');assert.equal(ticks.length,activeActors);for(const visual of latest)assert.equal(entries.get(visual.key).visual,visual,'Every current identity is rebound before target resolution');return {ticks,activeActors};};
 run(-100);run(0);
 return {state,order,result,durationMs,actionDurationMs,entries,trace,reads,run,show,get latest(){return latest;},set latest(visuals){latest=visuals;},attacker:entries.get('unit:sabre').runtime,target:entries.get('unit:target-sabre').runtime,dispose(){for(const {runtime}of entries.values())runtime.dispose();}};
}
function frame(fixture,index,startedAt){return {...fixture.result.frames[index],index,sequenceId:'1:1',actionId:1,actionStartedAt:0,actionDurationMs:fixture.actionDurationMs,startedAt,durationMs:fixture.durationMs[index]};}

test('all thirteen ordinary combat actors rebind and tick their current target skin before fitting every refreshed phase',async()=>{
 for(const posture of ['standing','crouched']){
  const f=await combat(posture),before=JSON.stringify(f.result.state),expected=actBattle(f.state,f.order);let startedAt=0;
  for(let index=0;index<f.result.frames.length;index++){
   const shownFrame=frame(f,index,startedAt),state={...shownFrame.state,presentationVisibleIds:shownFrame.state.visibleIds};f.latest=f.show(state,shownFrame,startedAt);
   const duration=f.durationMs[index],times=duration?Array.from({length:Math.ceil(duration/(1000/60))+1},(_,i)=>Math.min(duration-.001,i*1000/60)):[0];
   for(const time of times){const {ticks,activeActors}=f.run(startedAt+time);assert.equal(activeActors,13);if(['prepare','contact'].includes(shownFrame.type)){assert.ok(f.attacker.meleeFit.plan,`${posture}/${shownFrame.type}/${time}: the first current array admits a physical plan`);assert.ok(ticks.indexOf('unit:target-sabre')<ticks.indexOf('unit:sabre'),'The current target native mixer advances before the contact actor');assert.ok(f.attacker.meleeFit.handReachError<1e-7);}}
   if(shownFrame.type==='contact'){assert.equal(f.target.visual.posture,posture);assert.ok(strikeGap(f.attacker,f.target)<=.001,'The actual current body triangles meet the exported blade at its held contact marker');}
   startedAt+=duration;
  }
  assert.ok(f.reads.length>0);assert.ok(f.reads.every(read=>read.accepted&&read.targetTicked),'Every admitted target read follows its current skin tick, including first prepare/contact arrays');assert.equal(JSON.stringify(f.result.state),before,'Scene order cannot mutate AP, hit, damage or saved cells');assert.deepEqual(f.result.state,expected,'There remains one finite paid result');f.dispose();
 }
});

test('a target posture change is evaluated by its native mixer before the first new contact fit',async()=>{
 const f=await combat(),prepare=frame(f,0,0);f.latest=f.show({...prepare.state,presentationVisibleIds:prepare.state.visibleIds},prepare,0);f.run(0);const standing=f.target.model.getObjectByName('head').getWorldPosition(new Vector3());
 const contactIndex=f.result.frames.findIndex(item=>item.type==='contact'),contact=frame(f,contactIndex,420),state=structuredClone(contact.state);state.units.find(unit=>unit.id==='target-sabre').stance='crouched';state.presentationVisibleIds=state.visibleIds;f.latest=f.show(state,contact,420);const beforeReads=f.reads.length;f.run(420);
 assert.equal(f.target.visual.posture,'crouched');assert.ok(f.target.model.getObjectByName('head').getWorldPosition(new Vector3()).distanceTo(standing)>.1,'Native target posture skin changes before the first attacker fit');assert.ok(f.reads.slice(beforeReads).every(read=>read.accepted&&read.targetTicked));assert.ok(f.attacker.meleeFit.plan);f.run(1070-.001);assert.ok(strikeGap(f.attacker,f.target)<=.001);f.dispose();
});

test('a completed same-appearance LOD replacement supplies only its newly ticked native model',async()=>{
 const f=await combat(),prepare=frame(f,0,0);f.latest=f.show({...prepare.state,presentationVisibleIds:prepare.state.visibleIds},prepare,0);f.run(0);const previous=f.attacker.meleeFit.plan,targetEntry=f.entries.get('unit:target-sabre'),old=targetEntry.runtime,visual=f.latest.find(visual=>visual.id==='target-sabre'),asset=await publishedActor(visual.appearance,1),replacement=new ActorRuntime(asset,visual),tick=replacement.tick.bind(replacement);replacement.tick=(...args)=>{f.trace.push(['tick',visual.key]);return tick(...args);};targetEntry.runtime=replacement;targetEntry.pending=false;
 f.run(100);assert.ok(f.attacker.meleeFit.plan);assert.notEqual(f.attacker.meleeFit.plan,previous);assert.equal(f.attacker.meleeFit.plan.target,replacement.model,'The cached old body cannot satisfy current model identity');assert.ok(f.reads.at(-1).accepted&&f.reads.at(-1).targetTicked);old.dispose();f.dispose();
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

test('frame ordering keeps visibility, pause, reduced motion and isolated errors with one tick per ready actor',()=>{
 const target={key:'target',action:'idle'},attacker={key:'attacker',action:'slash',cue:{contactTarget:{key:'target'}}},offscreen={key:'offscreen',action:'idle'},broken={key:'broken',action:'idle'},visuals=[attacker,offscreen,broken,target],entries=new Map(),trace=[],errors=[];
 for(const visual of visuals)entries.set(visual.key,{visual:{...visual},runtime:{root:{visible:true},update(v){trace.push(['update',v.key]);if(v.key==='broken')throw Error('native update failure');},tick(delta,now,reduced){trace.push(['tick',visual.key,delta,now,reduced]);}}});
 const active=visual=>visual.key!=='offscreen',count=advanceSceneActors({visuals,entry:key=>entries.get(key),active,delta:.05,now:500,ambientPaused:true,reducedMotion:true,report:error=>errors.push(error)});
 assert.equal(count,2);assert.equal(entries.get('offscreen').runtime.root.visible,false);assert.equal(entries.get('broken').error,true);assert.equal(errors.length,1);assert.deepEqual(trace.filter(event=>event[0]==='tick'),[['tick','target',0,500,true],['tick','attacker',.05,500,true]]);assert.ok(trace.findIndex(event=>event[0]==='update'&&event[1]==='target')<trace.findIndex(event=>event[0]==='tick'));
});
