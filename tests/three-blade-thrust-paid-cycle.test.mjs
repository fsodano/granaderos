import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {register} from 'node:module';
import test from 'node:test';
register('./tactical-render-loader.mjs',import.meta.url);
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {advanceSceneActors}=await import('../web/lib/three/scene-actors.ts');
const {presentActors}=await import('../web/lib/three/presentation.ts');
const {resolveContactTargetModel}=await import('../web/lib/three/contact-target-model.ts');
const {publishedActor}=await import('./published-actor-fixture.mjs');
const {createRendererSandboxBattle}=await import('../web/app/renderer-sandbox/fixtures.js');
const {presentedActBattle,actBattle}=await import('../game/tactical.js');
const {battleFrameDuration}=await import('../game/battle-playback.js');
const {selectActorClipVariant}=await import('../game/actor-action-contract.js');
const {Vector3,Matrix4}=await import('../web/node_modules/three/build/three.module.js');
const report=[];

function wrist(runtime){
 const point=name=>runtime.model.getObjectByName(name).getWorldPosition(new Vector3());
 const hand=point('hand_r');
 return {point:hand,bend:point('middle_01_r').sub(hand).angleTo(hand.clone().sub(point('lowerarm_r')))*180/Math.PI};
}
function grip(runtime,item){return new Matrix4().copy(runtime.model.getObjectByName('hand_r').matrixWorld).invert().multiply(runtime.model.getObjectByName(`primary:${item}`).matrixWorld);}

for(const appearance of ['granadero','woman-scout']){
 const equipment='blade';
 test(`${appearance} paid ${equipment} thrust retains its native wrist through all phases and LODs`,async()=>{
  for(const diagonal of [false,true])for(const posture of ['standing','crouched'])for(const lod of [0,1,2]){
   const state=createRendererSandboxBattle('combat'),id='sabre',targetId=`target-${id}`,unit=state.units.find(u=>u.id===id),target=state.units.find(u=>u.id===targetId);
   unit.spriteAppearance=appearance;target.x=unit.x+1;target.y=unit.y+(diagonal?1:0);target.stance=posture;
   const order={type:'melee',unitId:id,targetId},result=presentedActBattle(state,order),expected=actBattle(state,order),before=JSON.stringify(result.state);
   assert.ok(result.frames.some(frame=>frame.type==='contact'),result.state.lastError);
   const durations=result.frames.map(battleFrameDuration),actionDurationMs=durations.reduce((a,b)=>a+b,0),semantic=`stand.slash.${equipment}`;
   let sequenceId;for(let i=0;i<100;i++)if(selectActorClipVariant(semantic,`1:${i}:1:unit:${id}`)===`${semantic}.thrust`){sequenceId=`1:${i}`;break;}assert.ok(sequenceId);
   const entries=new Map();let latest=[],previous,startedAt=0,lastNow=-100;
   const makeVisuals=(shown,frame,now)=>presentActors(shown,shown.units.filter(u=>[id,targetId].includes(u.id)).map(actor=>({key:`unit:${actor.id}`,kind:'unit',actor})),{},new Set(),{selected:id,mode:'melee',frame,now});
   latest=makeVisuals(state,undefined,-100);
   for(const visual of latest){const asset=await publishedActor(visual.appearance,lod),runtime=new ActorRuntime(asset,visual,undefined,contact=>resolveContactTargetModel(contact,latest,entries.get(contact.key)));entries.set(visual.key,{runtime,visual,pending:false,error:false});}
   const attacker=entries.get(`unit:${id}`).runtime,native=new ActorRuntime(attacker.asset,attacker.visual),rootPosition=attacker.root.position.toArray(),row={appearance,equipment,diagonal,posture,lod,actionDurationMs,samples:0,maxWristBendDegrees:0,maxWristSpeedMetresPerSecond:0,maxPhaseEdgeWristJumpMetres:0,maxReachErrorMetres:0};
   try{
    for(let index=0;index<result.frames.length;index++){
     const frame={...result.frames[index],index,sequenceId,actionId:1,actionStartedAt:0,actionDurationMs,startedAt,durationMs:durations[index]},shown={...frame.state,presentationVisibleIds:frame.state.visibleIds},stop=startedAt+durations[index];
     // Include each real phase edge and one uninterrupted 240 Hz RAF clock.
     const times=new Set([startedAt]);for(let now=Math.ceil(startedAt/(1000/240))*(1000/240);now<stop-.000001;now+=1000/240)times.add(now);if(durations[index])times.add(stop-.001);
     for(const now of [...times].sort((a,b)=>a-b)){
      latest=makeVisuals(shown,frame,now);const errors=[];advanceSceneActors({visuals:latest,entry:key=>entries.get(key),active:()=>true,delta:(now-lastNow)/1000,now,report:error=>errors.push(error)});assert.deepEqual(errors,[]);lastNow=now;
      native.update(attacker.visual,now);native.tick(0,now);native.root.updateMatrixWorld(true);attacker.root.updateMatrixWorld(true);
      const striking=attacker.visual.cue?.action==='strike';
      assert.equal(attacker.action.getClip().name,striking?`${semantic}.thrust`:`stand.idle.${equipment}`,'One ordinary cue keeps its variant until gameplay returns to its native idle');
      assert.deepEqual(attacker.root.position.toArray(),rootPosition,'Saved cells retain the wrapper position');
      attacker.model.traverse(node=>{if(!node.isBone)return;const source=native.model.getObjectByName(node.name);assert.ok(node.scale.distanceTo(source.scale)<1e-8);if(node.name!=='Root')assert.ok(node.position.distanceTo(source.position)<1e-8,`${node.name}: native joint offsets`);});
      const a=grip(attacker,unit.weapon).elements,b=grip(native,unit.weapon).elements;assert.ok(a.every((value,i)=>Math.abs(value-b[i])<1e-8),'The owned weapon retains its native hand/socket transform');
      const pose=wrist(attacker);row.samples++;if(striking)row.maxWristBendDegrees=Math.max(row.maxWristBendDegrees,pose.bend);
      if(previous&&now>previous.now){const dt=(now-previous.now)/1000,distance=pose.point.distanceTo(previous.point);if(dt>.001)row.maxWristSpeedMetresPerSecond=Math.max(row.maxWristSpeedMetresPerSecond,distance/dt);else if(frame.type!==previous.phase&&distance>row.maxPhaseEdgeWristJumpMetres){row.maxPhaseEdgeWristJumpMetres=distance;row.maxPhaseEdge={from:previous.phase,to:frame.type,now,clipTime:attacker.action.time,root:attacker.root.position.toArray(),yaw:attacker.root.rotation.y};}}previous={now,point:pose.point,phase:frame.type};
      if(['prepare','contact'].includes(frame.type)){assert.ok(attacker.meleeFit.plan,`${equipment}/${posture}/${lod}: a supported physical plan is admitted`);row.maxReachErrorMetres=Math.max(row.maxReachErrorMetres,attacker.meleeFit.handReachError);assert.ok(attacker.meleeFit.handReachError<1e-7);}
     }
     startedAt=stop;
    }
    assert.ok(row.maxWristBendDegrees<45,`${JSON.stringify(row)}: physical wrist stays within the measured bound`);assert.ok(row.maxWristSpeedMetresPerSecond<8,`${JSON.stringify(row)}: no hand snap on the paid RAF grid`);assert.ok(row.maxPhaseEdgeWristJumpMetres<.001,`${JSON.stringify(row)}: no discontinuity at the exact phase edge`);
    assert.equal(JSON.stringify(result.state),before);assert.deepEqual(result.state,expected,'Presentation retains the single paid AP/damage/item/cell result');report.push(row);
   }finally{native.dispose();for(const {runtime}of entries.values())runtime.dispose();}
  }
 });
}
test.after(()=>{if(process.env.GRANADEROS_WRIST_RECEIPT)writeFileSync(process.env.GRANADEROS_WRIST_RECEIPT,JSON.stringify(report,null,2)+'\n');});
