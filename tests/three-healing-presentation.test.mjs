import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createReachReviewBattle} from '../web/app/renderer-sandbox/reach-fixture.js';
import {presentedActBattle,actBattle} from '../game/tactical.js';
const {presentActors}=await import('../web/lib/three/presentation.ts');
const {admittedHealingIntervals}=await import('../web/lib/three/action-timing.ts');
const {presentedFrameDuration}=await import('../web/lib/useEnemyPlayback.ts');
const {sampleAnimationTime,animationPhaseRange}=await import('../web/lib/three/animation-clock.ts');
const actorEntries=state=>state.units.filter(u=>['reach-healer-male','reach-patient-male','reach-healer-female','reach-patient-female'].includes(u.id)).map(actor=>({key:'unit:'+actor.id,kind:'unit',actor}));
const views=(state,frame,entries=actorEntries(state))=>presentActors(state,entries,{},new Set(),{frame,now:0});
const timed=(frame,type='prepare')=>({...frame,type,sequenceId:'care',actionId:1,startedAt:type==='prepare'?0:350,durationMs:type==='prepare'?350:1050,actionStartedAt:0,actionDurationMs:1400});

test('paid ally care admits the current patient and plays one continuous native interval',()=>{
 for(const posture of ['standing','prone'])for(const anatomy of ['male','female']){
  const state=createReachReviewBattle(posture),id='reach-healer-'+anatomy,patientId='reach-patient-'+anatomy,order={type:'heal',unitId:id,targetId:patientId},saved=JSON.stringify(state),result=presentedActBattle(state,order);assert.equal(result.state.lastError,null);assert.deepEqual(result.state,actBattle(state,order));assert.equal(JSON.stringify(state),saved);
  const original=JSON.stringify(result.frames),frames=admittedHealingIntervals(result.frames);assert.equal(JSON.stringify(result.frames),original);assert.equal(frames.length,2);assert.ok(frames.every(f=>f.healInterval));assert.ok(frames.every(f=>f.targetPoint.kind==='unit'));assert.ok(frames.every(f=>f.careSelf===undefined));
  let start=0,prior=0;for(const [index,f] of frames.entries()){
   const span=presentedFrameDuration(f,state),frame={...timed(f,f.type),startedAt:start,durationMs:span},shown=views(f.state,frame).find(v=>v.id===id);assert.equal(shown.cue.care.mode,'patient');assert.equal(shown.cue.care.target.key,'unit:'+patientId);assert.equal(shown.cue.care.target.posture,posture);assert.ok(shown.cue.care.support.floors.length);assert.equal(shown.cue.healInterval,true);
   for(let i=0;i<=60;i++){const clock=sampleAnimationTime({clip:{duration:1.4,loop:false},action:'heal',cue:shown.cue,now:start+span*i/60});assert.ok(clock.time>=prior-1e-12,'No body repeat at the result boundary');prior=clock.time;if(i===60)assert.equal(clock.complete,index===1);}
   start+=span;
  }assert.ok(Math.abs(start-1400)<1e-8);assert.ok(Math.abs(prior-1.4)<1e-12);assert.equal(result.state.units.find(u=>u.id===id).medkits,state.units.find(u=>u.id===id).medkits-1);assert.ok(result.state.units.find(u=>u.id===id).ap<state.units.find(u=>u.id===id).ap);
 }
});

test('self care has an explicit mode and never resolves another patient body',()=>{
 for(const explicit of [false,true]){const state=createReachReviewBattle('prone'),doctor=state.units.find(u=>u.id==='reach-healer-male');doctor.hp=60;doctor.bleeding=10;const result=presentedActBattle(state,{type:'heal',unitId:doctor.id,...(explicit?{targetId:doctor.id}:{})});assert.equal(result.state.lastError,null);const frames=admittedHealingIntervals(result.frames);assert.ok(frames.every(f=>f.careSelf===true));for(const f of frames){const cue=views(f.state,timed(f,f.type)).find(v=>v.id===doctor.id).cue;assert.deepEqual(cue.care,{mode:'self'});}}
});

test('absent, unreadable, ambiguous, mismatched and unperformed care targets supply no body cue',()=>{
 const state=createReachReviewBattle('prone'),id='reach-healer-male',result=presentedActBattle(state,{type:'heal',unitId:id,targetId:'reach-patient-male'}),f=timed(admittedHealingIntervals(result.frames)[0]),entries=actorEntries(f.state),source=entries.find(e=>e.actor.id===id),patient=entries.find(e=>e.actor.id==='reach-patient-male');
 for(const [name,admitted,change]of [['absent',[source],{}],['ambiguous',[source,patient,patient],{}],['no point',entries,{targetPoint:undefined}],['wrong cell',entries,{targetPoint:{...f.targetPoint,x:f.targetPoint.x+1}}],['wrong kind',entries,{targetPoint:{...f.targetPoint,kind:'hidden'}}],['nonfinite',entries,{targetPoint:{...f.targetPoint,x:NaN}}],['unperformed',entries,{performed:false}],['unpaired',entries,{healInterval:undefined}]])assert.equal(views(f.state,{...f,...change},admitted).find(v=>v.id===id)?.cue?.care,undefined,name);
 const moved={...patient,actor:{...patient.actor,facing:5,stance:'crouched',movementMode:'crouch'}},current=views(f.state,f,[source,moved]).find(v=>v.id===id).cue.care.target;assert.equal(current.posture,'crouched');assert.notEqual(current.yaw,views(f.state,f,entries).find(v=>v.id===id).cue.care.target.yaw,'Patient pose is refreshed from current admission');
 const changed={...patient,actor:{...patient.actor,tacticalLevel:1}};assert.equal(views(f.state,f,[source,changed]).find(v=>v.id===id).cue.care,undefined,'Different surface cannot retain old target coordinates');
});

test('failed/unobserved intervals and direct gestures retain ordinary timing and clock behavior',()=>{
 const state=createReachReviewBattle(),result=presentedActBattle(state,{type:'heal',unitId:'reach-healer-male',targetId:'reach-patient-male'}),[prepare,end]=result.frames;
 for(const frames of [[prepare],[{...prepare,unitId:null},end],[prepare,{...end,performed:false}],[prepare,{...end,action:'free'}],[prepare,{...end,unitId:'other'}]]){const next=admittedHealingIntervals(frames);assert.ok(next.every(f=>!f.healInterval));assert.equal(presentedFrameDuration(next[0],state),300);}
 const clip={duration:1.4,loop:false},plain={action:'heal',startedAt:0,durationMs:700};assert.deepEqual(animationPhaseRange(clip,'heal','prepare'),[0,1.4]);assert.deepEqual(animationPhaseRange(clip,'heal',''),[0,1.4]);assert.deepEqual(sampleAnimationTime({clip,action:'heal',cue:plain,now:350}),sampleAnimationTime({clip,action:'heal',cue:{...plain,healInterval:true},now:350}));assert.equal(sampleAnimationTime({clip,action:'heal',now:0}).rate,1);
});

test('NPC patient identity is distinct and an unobserved civilian supplies no private care target',async()=>{
 const {captureBattlePresentation}=await import('../game/battle-presentation.js'),state=createReachReviewBattle('prone'),doctor=state.units.find(u=>u.id==='reach-healer-male'),old=state.units.find(u=>u.id==='reach-patient-male');state.npcs=[{...old,id:doctor.id,side:'civilian',civilianWoundVersion:1}];state.units=state.units.filter(u=>u.id!==old.id);const order={type:'heal',unitId:doctor.id,targetId:doctor.id,targetKind:'npc'},result=presentedActBattle(state,order);assert.equal(result.state.lastError,null);for(const f of admittedHealingIntervals(result.frames)){assert.equal(f.careSelf,undefined);assert.equal(f.targetPoint.kind,'npc');const entries=[{key:'unit:'+doctor.id,kind:'unit',actor:f.state.units.find(u=>u.id===doctor.id)},{key:'npc:'+doctor.id,kind:'npc',actor:f.state.npcs[0]}],care=views(f.state,timed(f,f.type),entries).find(v=>v.kind==='unit').cue.care;assert.equal(care.mode,'patient');assert.equal(care.target.key,'npc:'+doctor.id);}
 const hidden=captureBattlePresentation(state,()=>actBattle(state,order),(_s,actor)=>actor.side!=='civilian');for(const f of admittedHealingIntervals(hidden.frames)){assert.equal(f.targetPoint,undefined);assert.equal(f.careSelf,undefined);assert.equal(views(f.state,timed(f,f.type),[{key:'unit:'+doctor.id,kind:'unit',actor:f.state.units.find(u=>u.id===doctor.id)}]).find(v=>v.id===doctor.id).cue.care,undefined);}
});
