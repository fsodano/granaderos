import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,medicalUsePreview,itemUsePreview,getReachable,hasLineOfSight} from '../game/tactical.js';
import {targetPreview} from '../game/ja2-hud.js';
import {autoBandageBattle,autoBandageStatus} from '../game/auto-bandage.js';
import {refreshMilitaryCondition} from '../game/actor-condition.js';
import {medicalPatientAvailable} from '../game/medical-patient.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {preparedCare,DOCTOR,PATIENT} from './medical-care-fixture.mjs';
import {visit,sync,saved} from './local-contract-fixture.mjs';

// Declared wounds isolate clinical eligibility. They are not an earned battle
// or campaign-ending fixture; all care below uses ordinary public orders.
const field=(doc={},wounded={},map={})=>createBattle([
 {id:'doctor',name:'Sanitario',x:1,y:1,medical:60,dexterity:75,experienceLevel:4,medkits:3,activeSlot:'medical',...doc},
 {id:'patient',name:'Herido',x:2,y:1,maxHp:100,hp:1,bleeding:10,bandaged:0,energy:75,routed:true,...wounded},
],{width:8,height:8,exploration:true,enemies:[],...map});
const patient=b=>b.units.find(u=>u.id==='patient');
const doctor=b=>b.units.find(u=>u.id==='doctor');
const aid=b=>actBattle(b,{type:'useItem',unitId:'doctor',targetId:'patient'});
const restore=b=>validateBattleSnapshot(JSON.parse(JSON.stringify(b)));
const replay=(b,steps)=>steps.reduce((state,action)=>{const n=actBattle(state,action);assert.equal(n.lastError,null);return n;},b);

test('manual critical care preserves panic and physical state, pays real AP and kits, and resumes from an admitted save',()=>{
 const s=field({}, {},{exploration:false,enemies:[{id:'enemy',x:7,y:7,patrol:false,overwatch:false}]}),before=structuredClone(s);
 doctor(s).ap=100;before.units[0].ap=100;
 assert.equal(medicalUsePreview(s,doctor(s),patient(s)).allowed,true);
 const first=aid(s);assert.equal(first.lastError,null);assert.equal(patient(first).hp,9);assert.equal(patient(first).bleeding,2);
 assert.equal(doctor(first).ap,75);assert.equal(doctor(first).medkits,2);assert.equal(patient(first).routed,true);
 const second=aid(first);assert.equal(second.lastError,null);assert.deepEqual(second,aid(restore(first)));
 assert.equal(patient(second).hp,15);assert.equal(patient(second).bleeding,0);assert.equal(patient(second).routed,true);assert.equal(patient(second).unconscious,false);
 assert.equal(doctor(second).ap,50);assert.equal(doctor(second).medkits,1);assert.equal(patient(second).ap,0);
 for(const key of ['energy','fatigue','stance','movementMode','x','y'])assert.equal(patient(second)[key],patient(s)[key],key);
 assert.equal(medicalUsePreview(second,doctor(second),patient(second)).allowed,false,'waking does not remove conscious panic');
 assert.deepEqual(s,before);assert.doesNotThrow(()=>restore(second));
});

test('effective unconsciousness permits an exhausted patient but never grants breath, posture, AP or command',()=>{
 const s=field({}, {hp:14,bleeding:0,bandaged:86,energy:0,stance:'prone',fatigue:40}),n=aid(s);
 assert.equal(n.lastError,null);assert.equal(patient(n).hp,15);assert.equal(patient(n).unconscious,true);assert.equal(patient(n).routed,true);
 for(const key of ['energy','fatigue','stance','movementMode','ap','maxAP'])assert.equal(patient(n)[key],patient(s)[key],key);
 assert.equal(medicalPatientAvailable(patient(n)),true);assert.doesNotThrow(()=>restore(n));
});

test('conscious panic, departure, surrender and custody remain hard refusals, including a stale unconscious flag',()=>{
 for(const patch of [{hp:40},{hp:40,unconscious:true},{surrendered:true},{captured:true},{captive:true},{detention:{freed:false}},{fled:true},{departure:{edge:'E'}},{hp:0}]){
  const s=field();Object.assign(patient(s),patch);const before=structuredClone(s),n=aid(s);
  assert.equal(medicalUsePreview(s,doctor(s),patient(s)).allowed,false,JSON.stringify(patch));assert.ok(n.lastError);
  assert.deepEqual(n.units,s.units);assert.equal(n.elapsedSeconds,s.elapsedSeconds);assert.deepEqual(s,before);
 }
 for(const patch of [{routed:true},{hp:10},{energy:0}]){const s=field(patch),n=aid(s);assert.ok(n.lastError);assert.deepEqual(n.units,s.units);}
});

test('medical previews explain a conscious routed ally refusal without spending care or movement',()=>{
 for(const staleFlag of [false,true]){
  const s=field({}, {hp:28,bleeding:4});patient(s).unconscious=staleFlag;
  const before=structuredClone(s),medical=medicalUsePreview(s,doctor(s),patient(s)),item=itemUsePreview(s,doctor(s),patient(s)),hud=targetPreview(s,doctor(s),patient(s),{mode:'useItem'});
  assert.equal(medical.allowed,false);assert.match(medical.reason,/en pánico.*rechaza la atención.*consciente/);
  assert.equal(item.valid,false);assert.equal(item.reason,medical.reason);assert.equal(item.movePa,0);
  assert.equal(hud.valid,false);assert.equal(hud.reason,medical.reason);
  const refused=aid(s);assert.equal(refused.lastError,medical.reason);
  assert.deepEqual(refused.units,s.units);assert.equal(refused.elapsedSeconds,s.elapsedSeconds);assert.equal(refused.seed,s.seed);assert.deepEqual(s,before);
 }
});

test('unconscious routing does not bypass team, floor, distance, sight or paid medical work',()=>{
 for(const patch of [{side:'enemy'},{tacticalLevel:1},{x:5}]){
  const s=field();Object.assign(patient(s),patch);
  if(patch.side==='enemy')patient(s).patrolOrigin={x:patient(s).x,y:patient(s).y};
  const n=actBattle(s,{type:'heal',unitId:'doctor',targetId:'patient'});
  assert.equal(medicalUsePreview(s,doctor(s),patient(s)).allowed,false);assert.ok(n.lastError);assert.deepEqual(n.units,s.units);
 }
 const blocked=field();Object.assign(blocked.tiles.find(t=>t.x===2&&t.y===1),{type:'wall',blocked:true,blocksSight:true});
 assert.equal(hasLineOfSight(blocked,doctor(blocked),patient(blocked)),false);assert.ok(aid(blocked).lastError);assert.deepEqual(aid(blocked).units,blocked.units);
 for(const patch of [{medical:0},{medkits:0},{ap:24}]){
  const s=field(patch,{}, {exploration:false,enemies:[{id:'enemy',x:7,y:7,patrol:false}]});Object.assign(doctor(s),patch);
  const n=aid(s);assert.ok(n.lastError);assert.deepEqual(n.units,s.units);assert.equal(n.elapsedSeconds,s.elapsedSeconds);
 }
});

test('auto-bandage executes the same finite strokes, preserves routing and reports actual complete wound work',()=>{
 const s=field(),before=structuredClone(s),r=autoBandageBattle(s);
 assert.equal(autoBandageStatus(s).available,true);assert.deepEqual(r.battle,replay(s,r.steps));assert.deepEqual(s,before);
 assert.equal(r.steps.filter(a=>a.type==='useItem').length,2);assert.equal(doctor(r.battle).medkits,1);
 assert.equal(patient(r.battle).hp,15);assert.equal(patient(r.battle).bleeding,0);assert.equal(patient(r.battle).routed,true);
 assert.deepEqual(r.treatedIds,['patient']);assert.deepEqual(r.untreated,[]);assert.equal(r.stoppedReason,null);assert.ok(r.elapsedSeconds>0);
});

test('a weak stroke can wake a routed patient with bleeding, and auto-bandage stops without a false treated receipt',()=>{
 const s=field({medical:1,dexterity:1,experienceLevel:1},{hp:14,bleeding:10}),r=autoBandageBattle(s);
 assert.deepEqual(r.battle,replay(s,r.steps));assert.equal(r.steps.length,1);assert.equal(doctor(r.battle).medkits,2);
 assert.equal(patient(r.battle).hp,15);assert.equal(patient(r.battle).bleeding,4);assert.equal(patient(r.battle).unconscious,false);assert.equal(patient(r.battle).routed,true);
 assert.deepEqual(r.treatedIds,[]);assert.equal(r.untreated.length,1);assert.equal(r.untreated[0].id,'patient');assert.match(r.stoppedReason,/disponible/);
 assert.equal(autoBandageStatus(r.battle).available,false);assert.doesNotMatch(autoBandageStatus(r.battle).reason,/Todas las heridas/);
 const denied=aid(restore(r.battle));assert.ok(denied.lastError);assert.deepEqual(denied.units,r.battle.units);assert.equal(denied.elapsedSeconds,r.battle.elapsedSeconds);
});

test('an official paired campaign save retains the real first stroke and exact second-stroke continuation',()=>{
 let p=visit(preparedCare({doctorMedical:60})),d=p.battle.units.find(u=>u.id===String(DOCTOR)),t=p.battle.units.find(u=>u.id===String(PATIENT));
 const spot=getReachable(p.battle,d).find(point=>Math.hypot(point.x-t.x,point.y-t.y)<=1.5&&hasLineOfSight(p.battle,point,t));assert.ok(spot);
 for(const action of [...(spot.cost?[{type:'move',unitId:d.id,x:spot.x,y:spot.y}]:[]),{type:'weapon',unitId:d.id,slot:'medical'}]){
  const n=actBattle(p.battle,action);assert.equal(n.lastError,null);p=sync({campaign:p.campaign,battle:n});
 }
 t=p.battle.units.find(u=>u.id===String(PATIENT));Object.assign(t,{hp:1,bleeding:10,bandaged:0,routed:true});refreshMilitaryCondition(t);
 // Only the explicitly declared input wound is installed here. Saved progress
 // and each finite treatment thereafter come from the public action boundary.
 p=saved(sync(p));const action={type:'useItem',unitId:String(DOCTOR),targetId:String(PATIENT)},before=structuredClone(p);
 const first=actBattle(p.battle,action);assert.equal(first.lastError,null);p=sync({campaign:p.campaign,battle:first});
 const restored=saved(p);assert.equal(restored.battle.units.find(u=>u.id===String(PATIENT)).routed,true);
 const second=actBattle(p.battle,action);assert.equal(second.lastError,null);assert.deepEqual(second,actBattle(restored.battle,action));
 const done=saved(sync({campaign:p.campaign,battle:second})),result=done.battle.units.find(u=>u.id===String(PATIENT));
 assert.equal(result.hp,15);assert.equal(result.bleeding,0);assert.equal(result.routed,true);assert.equal(result.ap,0);
 assert.equal(done.battle.units.find(u=>u.id===String(DOCTOR)).medkits,before.battle.units.find(u=>u.id===String(DOCTOR)).medkits-2);
 assert.ok(done.campaign.secondOfHour>before.campaign.secondOfHour);assert.deepEqual(before.battle.units.find(u=>u.id===String(PATIENT)).hp,1);
});
