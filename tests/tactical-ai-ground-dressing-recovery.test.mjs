import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,presentedEndTurn,actionCosts,canSee,planLoot,planReadyMainHand} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {chooseGroundDressingRecovery} from '../game/tactical-ai-medical-recovery.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {firstAidPlan} from '../game/first-aid.js';
import {inventoryUsage,handRecord} from '../game/tactical-inventory.js';
import {fillSparePockets} from './pocket-capacity-fixture.mjs';

const bundle=(patch={})=>({id:'finite-dressing',type:'item',item:'medkits',weight:.2,count:1,x:12,y:3,...patch});
const doctor=s=>s.units.find(u=>u.id==='medic');
const patient=s=>s.units.find(u=>u.id==='patient');
const restored=s=>validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
const pickup={type:'loot',unitId:'medic',groundId:'finite-dressing',count:1};
function field(medic={},casualty={},extra={}){
 const tiles=Array.from({length:128},(_,i)=>({x:i%16,y:Math.floor(i/16),type:i%16===8?'wall':'grass',blocked:i%16===8,blocksSight:i%16===8,cover:0}));
 const s=createBattle([{id:'p',x:1,y:1,facing:2,medkits:0,medical:0}],{width:16,height:8,seed:45,tiles,groundItems:[bundle()],enemies:[
  {id:'medic',name:'Médico',x:12,y:3,facing:2,medical:60,medkits:0,weapon:1800,weaponInstanceId:'owned-main',loaded:1,ammo:3,patrol:false,overwatch:false,...medic},
  {id:'patient',name:'Herido',x:13,y:3,hp:10,maxHp:100,bleeding:3,medical:0,medkits:0,patrol:false,overwatch:false,...casualty},
 ],...extra});s.units[0].ap=0;doctor(s).ap=medic.ap??41;patient(s).ap=0;return s;
}
const physical=u=>Object.fromEntries(['weapon','weaponInstanceId','loaded','reloadProgress','ammo','condition','jammed','offHand','inventory','x','y','stance'].map(k=>[k,u[k]]));

test('an actual enemy turn picks one dressing, prepares, stabilizes and restores its exact weapon through paid orders',()=>{
 const s=restored(field()),before=structuredClone(s),old=physical(doctor(s));
 assert.deepEqual(chooseEnemyAction(s,doctor(s)),pickup);assert.deepEqual(s,before);
 const n=endTurn(s);assert.equal(n.lastError,null);assert.equal(doctor(n).ap,0);assert.equal(doctor(n).medkits,0);assert.equal(doctor(n).activeSlot,'primary');assert.deepEqual(physical(doctor(n)),old);
 assert.equal(patient(n).hp,15);assert.equal(patient(n).bleeding,0);assert.equal(patient(n).bandaged,85);assert.equal(patient(n).unconscious,false);assert.equal(patient(n).ap,0);
 assert.deepEqual(n.groundItems,[{...s.groundItems[0],count:0}]);assert.equal(n.elapsedSeconds,6);assert.equal(n.turn,2);assert.deepEqual(s,before);assert.deepEqual(n,endTurn(restored(s)));assert.doesNotThrow(()=>restored(n));
 assert.ok(!n.log.some(line=>/Médico|Herido|venda|recoge/.test(line)),'unseen care and source stay outside the player journal');
});

test('the exact minimum reserves pickup, current slot preparation and one treatment, without free AP',()=>{
 for(const [activeSlot,minimum] of [['primary',37],['medical',33]]){
  const s=field({activeSlot,ap:minimum}),short=field({activeSlot,ap:minimum-1});
  assert.equal(actionCosts(s,doctor(s)).loot,8);assert.equal(chooseGroundDressingRecovery(short,doctor(short)),null);assert.deepEqual(chooseGroundDressingRecovery(s,doctor(s)),pickup);
  const n=endTurn(s);assert.equal(n.lastError,null);assert.equal(doctor(n).ap,0);assert.equal(doctor(n).activeSlot,'medical');assert.equal(doctor(n).medkits,0);assert.equal(n.groundItems[0].count,0);assert.equal(patient(n).hp,15);
 }
 const rapid=field({traits:['field_rescuer'],ap:32});assert.deepEqual(chooseGroundDressingRecovery(rapid,doctor(rapid)),pickup);doctor(rapid).ap--;assert.equal(chooseGroundDressingRecovery(rapid,doctor(rapid)),null);
});

test('a real owned supply drop is recovered by an autonomous medic without issuing another dressing',()=>{
 let s=field({medkits:1,ap:45});for(const u of s.units)u.side=u.side==='enemy'?'player':'enemy';s.groundItems=[];
 s=actBattle(s,{type:'drop',unitId:'medic',item:'medkits',count:1});assert.equal(s.lastError,null);assert.equal(doctor(s).medkits,0);assert.equal(s.groundItems[0].item,'medkits');assert.equal(s.groundItems[0].count,1);
 const id=s.groundItems[0].id,record=structuredClone(s.groundItems[0]);for(const u of s.units)u.side=u.side==='enemy'?'player':'enemy';s=restored(s);
 assert.deepEqual(chooseEnemyAction(s,doctor(s)),{...pickup,groundId:id});const n=endTurn(s);assert.equal(n.lastError,null);assert.deepEqual(n.groundItems,[{...record,count:0}]);assert.equal(doctor(n).medkits,0);assert.equal(patient(n).hp,15);assert.equal(doctor(n).loaded,1);assert.equal(doctor(n).ap,0);
});

test('both existing dressing schemas retain source remainders and one-piece pickup',()=>{
 for(const ground of [bundle({count:3}),{id:'finite-dressing',type:'medkits',count:3,x:12,y:3}]){
  const s=field({}, {},{groundItems:[ground]}),before=structuredClone(s);assert.doesNotThrow(()=>restored(s));assert.deepEqual(chooseGroundDressingRecovery(s,doctor(s)),pickup);
  const n=endTurn(s);assert.equal(n.groundItems[0].count,2);assert.deepEqual({...n.groundItems[0],count:ground.count},ground);assert.equal(doctor(n).medkits,0);assert.equal(patient(n).hp,15);assert.deepEqual(s,before);
 }
 const wrong=field({}, {},{groundItems:[bundle({item:'medicalkit'})]});assert.equal(chooseGroundDressingRecovery(wrong,doctor(wrong)),null,'no new or inferred supply alias');
});

test('visible recorder stages show the separate finite pickup, preparation, treatment and restoration',()=>{
 const s=field();Object.assign(s.units[0],{x:9,y:3,facing:2});assert.equal(canSee(s,doctor(s),s.units[0]),false);
 const before=structuredClone(s),r=presentedEndTurn(s);assert.deepEqual(r.state,endTurn(s));assert.deepEqual(s,before);
 assert.deepEqual(r.frames.map(f=>[f.type,f.action]),[['prepare','loot'],['result','loot'],['prepare','weapon'],['result','weapon'],['prepare','heal'],['result','heal'],['prepare','weapon'],['result','weapon']]);
 const states=r.frames.map(f=>({ap:doctor(f.state).ap,kits:doctor(f.state).medkits,count:f.state.groundItems[0].count,hp:patient(f.state).hp,bleeding:patient(f.state).bleeding,slot:doctor(f.state).activeSlot}));
 assert.deepEqual(states.map(s=>s.ap),[41,33,33,29,29,4,4,0]);assert.deepEqual(states.map(s=>s.kits),[0,1,1,1,1,0,0,0]);assert.deepEqual(states.map(s=>s.count),[1,0,0,0,0,0,0,0]);assert.deepEqual(states.map(s=>s.hp),[10,10,10,10,10,15,15,15]);
 assert.ok(r.frames.every(f=>f.unitId==='medic'));assert.equal(r.state.elapsedSeconds,6);assert.equal(r.state.frames,undefined);assert.equal(r.state.presentationVisibleIds,undefined);
});

test('the same legal public pickup and care prefixes retain exact finite resources across JSON checkpoints',()=>{
 let s=field({ap:37});for(const u of s.units)u.side=u.side==='enemy'?'player':'enemy';s=restored(s);
 for(const action of [pickup,{type:'weapon',unitId:'medic',slot:'medical'},{type:'useItem',unitId:'medic',targetId:'patient'}]){const before=structuredClone(s),n=actBattle(s,action);assert.equal(n.lastError,null);assert.deepEqual(n,actBattle(restored(s),action));assert.deepEqual(s,before);s=n;}
 assert.equal(s.groundItems[0].count,0);assert.equal(doctor(s).medkits,0);assert.equal(patient(s).hp,15);assert.equal(patient(s).bleeding,0);assert.equal(doctor(s).loaded,1);assert.doesNotThrow(()=>restored(s));
});

test('self-care uses the current wound and leaves healthy adjacent allies untouched',()=>{
 const s=field({hp:50,bleeding:2},{hp:100,bleeding:0}),n=endTurn(s);assert.equal(n.lastError,null);assert.equal(doctor(n).hp,50);assert.equal(doctor(n).bleeding,0);assert.equal(doctor(n).bandaged,50);assert.equal(patient(n).hp,100);assert.equal(n.groundItems[0].count,0);assert.equal(doctor(n).medkits,0);assert.deepEqual(n,endTurn(restored(s)));
});

test('partial critical work consumes one dressing and retains the actual incomplete patient, without a healing promise',()=>{
 const s=field({medical:1,dexterity:1,experienceLevel:1,ap:37},{hp:5,bleeding:1});Object.assign(s.units[0],{x:9,y:3,facing:2});
 const picked=planLoot(s,doctor(s),pickup).receiver,prepared=planReadyMainHand(picked,'medkits'),plan=firstAidPlan(prepared,patient(s),{budgetAP:25});assert.equal(plan.valid,true);assert.equal(plan.partial,true);
 const r=presentedEndTurn(s),healed=r.frames.find(f=>f.type==='result'&&f.action==='heal');assert.ok(healed);assert.equal(patient(healed.state).hp,plan.hpAfter);assert.equal(patient(healed.state).bleeding,plan.bleedingAfter);assert.equal(patient(healed.state).bandaged,plan.bandagedAfter);assert.equal(doctor(r.state).medkits,0);assert.equal(r.state.groundItems[0].count,0);assert.deepEqual(r.state,endTurn(restored(s)));assert.doesNotThrow(()=>restored(r.state));
});

test('no present need, no aptitude, an owned dressing or current incapacity leaves ground supplies alone',()=>{
 for(const patch of [{medical:0},{medkits:1},{ap:36},{hp:0},{unconscious:true},{routed:true},{surrendered:true},{fled:true},{departure:{edge:'E'}},{knockedDown:true},{entangled:true}]){const s=field(),u=doctor(s);Object.assign(u,patch);const before=structuredClone(s);assert.equal(chooseGroundDressingRecovery(s,u),null,JSON.stringify(patch));assert.deepEqual(s,before);}
 for(const patch of [{hp:100,bleeding:0},{hp:15,bleeding:0},{hp:0},{routed:true},{surrendered:true},{fled:true},{departure:{edge:'E'}},{side:'player'},{x:14},{tacticalLevel:1}]){const s=field();Object.assign(patient(s),patch);const before=structuredClone(s);assert.equal(chooseGroundDressingRecovery(s,doctor(s)),null,JSON.stringify(patch));assert.deepEqual(s,before);}
});

test('source visibility, exact supply type, obstacles, floor, quantity and custody all retain the ordinary pickup boundary',()=>{
 for(const patch of [{count:0},{count:1.5},{heldBy:'patient'},{containerId:'chest'},{type:'money',item:undefined},{item:'rations'},{x:14},{tacticalLevel:1}]){const s=field();Object.assign(s.groundItems[0],patch);const before=structuredClone(s);assert.equal(chooseGroundDressingRecovery(s,doctor(s)),null,JSON.stringify(patch));assert.deepEqual(s,before);}
 const blocked=field({}, {},{groundItems:[bundle({y:4})]});Object.assign(blocked.tiles.find(t=>t.x===12&&t.y===4),{type:'wall',blocked:true,blocksSight:true});assert.equal(chooseGroundDressingRecovery(blocked,doctor(blocked)),null);
 const hidden=field();patient(hidden).x=7;assert.equal(canSee(hidden,doctor(hidden),patient(hidden)),false);assert.equal(chooseGroundDressingRecovery(hidden,doctor(hidden)),null);
 const privateState=field();privateState.units[0].x=2;privateState.units[0].y=6;Object.assign(privateState.units[0],{ammo:999,condition:0,hp:30,bleeding:9,inventory:{secret:{count:1,weight:1}}});assert.equal(canSee(privateState,doctor(privateState),privateState.units[0]),false);assert.deepEqual(chooseGroundDressingRecovery(privateState,doctor(privateState)),pickup);
});

test('current pockets must fit both the finite pickup and the medical-slot weapon displacement',()=>{
 const full=field();fillSparePockets(doctor(full));assert.equal(inventoryUsage(doctor(full)).overloaded,false);assert.throws(()=>planLoot(full,doctor(full),pickup));assert.equal(chooseGroundDressingRecovery(full,doctor(full)),null);
 const prepareFull=field();fillSparePockets(doctor(prepareFull));const key=Object.keys(doctor(prepareFull).inventory).find(k=>k.startsWith('fixture-small'));delete doctor(prepareFull).inventory[key];const receiver=planLoot(prepareFull,doctor(prepareFull),pickup).receiver;assert.equal(receiver.medkits,1);assert.throws(()=>planReadyMainHand(receiver,'medkits'));assert.equal(chooseGroundDressingRecovery(prepareFull,doctor(prepareFull)),null);
});

test('stable source identities and live demand prevent over-pickup by a second medic',()=>{
 const s=field({}, {},{groundItems:[bundle({id:'z-bundle',count:2}),bundle({id:'a-bundle',count:2})]});assert.equal(chooseGroundDressingRecovery(s,doctor(s)).groundId,'a-bundle');s.groundItems.reverse();assert.equal(chooseGroundDressingRecovery(s,doctor(s)).groundId,'a-bundle');
 const two=field();two.units.splice(2,0,{...structuredClone(doctor(two)),id:'medic-2',weaponInstanceId:'owned-second',x:12,y:4});const n=endTurn(two);assert.equal(n.lastError,null);assert.equal(n.groundItems[0].count,0);assert.equal(patient(n).hp,15);assert.equal(doctor(n).ap,0);assert.equal(n.units.find(u=>u.id==='medic-2').medkits,0);assert.equal(n.units.find(u=>u.id==='medic-2').ap,41);assert.equal(n.units.find(u=>u.id==='medic-2').loaded,1);assert.deepEqual(n,endTurn(restored(two)));
});

test('existing owned aid, getting up and freeing entanglement retain their earlier priorities',()=>{
 const supplied=field({medkits:1});assert.equal(chooseEnemyAction(supplied,doctor(supplied)).type,'weapon');assert.equal(chooseEnemyAction(supplied,doctor(supplied)).slot,'medical');
 const knocked=field({knockedDown:true});assert.equal(chooseEnemyAction(knocked,doctor(knocked)).type,'stance');
 const bound=field({entangled:true});assert.equal(chooseEnemyAction(bound,doctor(bound)).type,'free');
 const noNeed=field({marksmanship:100}, {hp:100,bleeding:0,y:4});Object.assign(noNeed.units[0],{x:15,y:3,loaded:0});noNeed.tiles.forEach(t=>Object.assign(t,{type:'grass',blocked:false,blocksSight:false}));assert.equal(chooseEnemyAction(noNeed,doctor(noNeed)).type,'fire');
});

test('only autonomous control acts on the recovery choice; the public boundary still rejects enemy pickup commands',()=>{
 const s=field(),before=structuredClone(s),denied=actBattle(s,pickup);assert.ok(denied.lastError);assert.deepEqual(denied.units,s.units);assert.deepEqual(denied.groundItems,s.groundItems);assert.deepEqual(s,before);
 for(const militia of [false,true]){const friendly=field();for(const u of friendly.units)u.side=u.side==='enemy'?'player':'enemy';doctor(friendly).militia=militia;const n=endTurn(friendly);assert.equal(n.lastError,null);assert.equal(n.groundItems[0].count,militia?0:1);assert.equal(patient(n).bleeding,militia?0:3);assert.equal(doctor(n).medkits,0);assert.equal(doctor(n).loaded,1);assert.deepEqual(n,endTurn(restored(friendly)));}
});

test('real care inside an enemy reaction survives a saved nested interruption without a second pickup or refreshed AP',()=>{
 const s=field({x:6,ap:51,weapon:1805,overwatch:true,experienceLevel:5,marksmanship:100},{x:6,y:4},{groundItems:[bundle({x:6})]});s.tiles.forEach(t=>Object.assign(t,{type:'grass',blocked:false,blocksSight:false}));Object.assign(s.units[0],{x:12,y:3,facing:6,ap:24,agility:30,experienceLevel:1,loaded:0});s.units.push({...structuredClone(s.units[0]),id:'observer',x:12,y:5,facing:2,ap:20,loaded:1,agility:100,experienceLevel:10});
 const old=handRecord(doctor(s),'primary'),paused=actBattle(s,{type:'move',unitId:'p',x:11,y:3});assert.equal(paused.lastError,null);assert.equal(paused.phase,'interrupt');assert.equal(paused.interrupt.returnTo,'reaction');assert.ok(paused.interrupt.unitIds.includes('observer'));assert.equal(paused.groundItems[0].count,0);assert.equal(doctor(paused).medkits,0);assert.equal(patient(paused).hp,15);assert.equal(patient(paused).bleeding,0);assert.equal(doctor(paused).loaded,old.loaded-1);
 const n=endTurn(restored(paused));assert.deepEqual(n,endTurn(paused));assert.equal(n.phase,'player');assert.equal(n.turn,1);assert.equal(n.elapsedSeconds,6);assert.equal(n.groundItems[0].count,0);assert.equal(doctor(n).medkits,0);assert.equal(doctor(n).loaded,doctor(paused).loaded);assert.equal(doctor(n).ap,doctor(paused).ap);assert.equal(patient(n).hp,15);assert.equal(patient(n).bleeding,0);assert.doesNotThrow(()=>restored(n));
});
