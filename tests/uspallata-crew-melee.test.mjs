import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,actionCosts,meleePreview,artilleryContact,artilleryCrewPlan,artilleryCosts,medicalUsePreview,getReachable,lookPreview,stanceCost} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {COMBAT_ROUND_SECONDS} from '../game/time.js';
import {defaultContentPackage} from '../game/content-package.js';
import {weaponMetadata} from '../game/weapon-definition.js';
import {createdUspallataBattery} from './created-uspallata-battery.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';

const unit=(b,id)=>b.units.find(u=>u.id===id),piece=b=>b.artillery.find(g=>g.id==='heavy');
function arena({medical=false,charged=false,rifle=false,physicianThreat=false,offContact=false}={}){
 const blade=weaponMetadata(defaultContentPackage().weapons.find(w=>w.id==='blade-1813'));
 const players=[
  {id:'c1',x:offContact?2:5,y:4,marksmanship:0,weapon:rifle?1800:1802,ammo:rifle?0:1,strength:100,dexterity:100,...(medical?{activeSlot:'medical',medical:80,medkits:1}:{}),loaded:1},
  {id:'c2',x:4,y:5,marksmanship:1},{id:'c3',x:4,y:4,marksmanship:2},{id:'small-crew',x:10,y:4,marksmanship:3},
  {id:'doctor',x:1,y:1,marksmanship:90,medical:95,medkits:3,loaded:0},
  {id:'screen1',x:6,y:4,marksmanship:91,...(medical?{hp:6,maxHp:100,bleeding:5,bandaged:80}:{})},
  {id:'screen2',x:9,y:8,marksmanship:92},{id:'screen3',x:10,y:8,marksmanship:93},
 ].map(raw=>({weapon:1800,blade:1813,bladeMetadata:structuredClone(blade),loaded:0,ammo:0,medical:0,medkits:0,stance:'crouched',hp:100,maxHp:100,morale:90,energy:100,fatigue:0,facing:charged||rifle?4:0,...raw}));
 return createBattle(players,{id:'declared-mountain-close-crew',width:16,height:14,hour:12,seed:45,
  tiles:Array.from({length:224},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'contact',x:physicianThreat?1:offContact?2:5,y:physicianThreat?2:charged||rifle?10:3,hp:500,maxHp:500,weapon:0,blade:0,loaded:0,ammo:0,agility:0,dexterity:0,patrol:false,overwatch:false,facing:0}],
  artillery:[{id:'heavy',type:'field8',side:'player',x:5,y:5,loaded:charged,ammo:charged?2:0},{id:'small',type:'swivel',side:'player',x:10,y:5,loaded:false,ammo:0}],
 });
}
function replay(start,orders){
 let direct=structuredClone(start),shown=structuredClone(start),stored=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  direct=actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));
  shown=presentedActBattle(shown,JSON.parse(JSON.stringify(action))).state;assert.deepEqual(shown,direct);
  stored=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(stored,JSON.parse(JSON.stringify(action))))));assert.deepEqual(stored,direct);
 }
 return direct;
}
function paidWindow(start,{short=false}={}){
 let battle=start;const orders=[];
 for(let i=0;i<(short?11:10);i++){
  const actor=unit(battle,'c1'),action={type:'look',unitId:actor.id,x:actor.x,y:i%2?0:battle.height-1},quote=lookPreview(battle,actor,action);assert.equal(quote.valid,true);assert.equal(quote.pa,8);
  const after=replay(battle,[action]);assert.equal(unit(after,actor.id).ap,actor.ap-quote.pa);battle=after;orders.push(action);
 }
 for(const stance of ['standing','crouched']){const actor=unit(battle,'c1'),cost=stanceCost(actor,stance),action={type:'stance',unitId:actor.id,stance};const after=replay(battle,[action]);assert.equal(unit(after,actor.id).ap,actor.ap-cost);battle=after;orders.push(action);}
 assert.deepEqual(replay(start,orders),battle);return {battle,orders};
}
function fixed(start,after){
 assert.deepEqual(after.artillery,start.artillery);
 for(const actor of start.units.filter(u=>u.side==='player')){
  const actual=unit(after,actor.id);for(const key of ['x','y','tacticalLevel','hp','maxHp','bleeding','medkits','loaded','ammo','inventory','weapon','blade'])assert.deepEqual(actual[key],actor[key],`${actor.id}: ${key}`);
 }
}

test('a real close battery crew blade switch continues into paid Native melee instead of immediately restoring primary',()=>{
 const declared=arena(),prelude=paidWindow(declared),start=prelude.battle,before=structuredClone(start),helper=createdUspallataBattery(start),actor=unit(start,'c1');assert.ok(helper.roles.crews.find(c=>c.gunId==='heavy').ids.includes(actor.id));assert.equal(artilleryContact(start,actor,piece(start)),true);
 assert.ok(actor.ap<actionCosts(start,actor,unit(start,'contact')).fire);assert.equal(meleePreview(start,{...actor,activeSlot:'blade',ap:actor.ap-actionCosts(start,actor).weapon},unit(start,'contact')).valid,true);
 const first=helper.controller(start,actor);assert.deepEqual(first,{type:'weapon',unitId:actor.id,slot:'blade'});
 const switched=replay(start,[first]),ready=unit(switched,actor.id),switchCost=actionCosts(start,actor).weapon;assert.equal(ready.ap,actor.ap-switchCost);fixed(start,switched);
 const quote=meleePreview(switched,ready,unit(switched,'contact'));assert.equal(quote.valid,true);assert.deepEqual(quote.path,[]);
 const strike=helper.controller(switched,ready);assert.deepEqual(strike,{type:'melee',unitId:actor.id,targetId:'contact'});
 const after=replay(start,[first,strike]);assert.equal(unit(after,actor.id).activeSlot,'blade');assert.equal(unit(after,actor.id).ap,ready.ap-quote.pa);assert.ok(unit(after,'contact').hp<unit(start,'contact').hp);assert.equal(after.elapsedSeconds,declared.elapsedSeconds+COMBAT_ROUND_SECONDS);assert.deepEqual(replay(declared,[...prelude.orders,first,strike]),after);fixed(start,after);assert.equal(artilleryContact(after,unit(after,actor.id),piece(after)),true);assert.deepEqual(start,before);
});

test('a prospective blade switch cannot borrow the AP needed for its following close strike',()=>{
 const declared=arena(),prelude=paidWindow(declared,{short:true}),start=prelude.battle,before=structuredClone(start),actor=unit(start,'c1'),hand=actionCosts(start,actor).weapon;
 const quote=meleePreview(start,{...actor,activeSlot:'blade',ap:actor.ap-hand},unit(start,'contact'));assert.equal(quote.valid,false);assert.ok(actor.ap<hand+quote.pa);
 const action=createdUspallataBattery(start).controller(start,actor);assert.notEqual(action?.slot,'blade');assert.notEqual(action?.type,'melee');assert.deepEqual(start,before);
});

test('actual adjacent finite aid keeps priority over a crew melee opportunity',()=>{
 const start=arena({medical:true}),before=structuredClone(start),actor=unit(start,'c1'),patient=unit(start,'screen1'),quote=medicalUsePreview(start,actor,patient);assert.equal(quote.allowed,true);
 const action=createdUspallataBattery(start).controller(start,actor);assert.deepEqual(action,{type:'useItem',unitId:actor.id,targetId:patient.id});const after=replay(start,[action]);assert.equal(unit(after,actor.id).medkits,actor.medkits-quote.treatment.dressingsUsed);assert.equal(unit(after,actor.id).ap,actor.ap-quote.cost);assert.equal(unit(after,patient.id).hp,quote.treatment.hpAfter);assert.equal(unit(after,patient.id).bleeding,quote.treatment.bleedingAfter);assert.deepEqual(after.artillery,start.artillery);assert.deepEqual(start,before);
});

test('a payable finite cannon order and an ordinary rifle shot keep priority over the close-defense leaf',()=>{
 const start=arena({charged:true}),before=structuredClone(start),helper=createdUspallataBattery(start),actor=unit(start,'c1'),action=helper.controller(start,actor);assert.equal(action?.type,'artillery');assert.equal(action.artilleryId,'heavy');const cost=artilleryCosts(start,actor,piece(start)).fire,plan=artilleryCrewPlan(start,actor,piece(start),cost);assert.equal(plan.reason,null);
 const after=replay(start,[action]);assert.equal(Number(piece(after).loaded)+piece(after).ammo,Number(piece(start).loaded)+piece(start).ammo-1);for(const id of plan.crew)assert.equal(unit(after,id).ap,unit(start,id).ap-cost);assert.deepEqual(start,before);
 const rifle=arena({rifle:true}),rifleBefore=structuredClone(rifle),shooter=unit(rifle,'c1'),ordinary=tucumanCombatOrder(rifle,shooter);assert.equal(ordinary?.type,'fire');assert.deepEqual(createdUspallataBattery(rifle).controller(rifle,shooter),ordinary);const shot=replay(rifle,[ordinary]);assert.equal(unit(shot,shooter.id).loaded,shooter.loaded-1);assert.deepEqual(shot.artillery,rifle.artillery);assert.deepEqual(rifle,rifleBefore);
});

test('the actual supplied physician retains the medical role beside a close hostile',()=>{
 const start=arena({physicianThreat:true}),before=structuredClone(start),helper=createdUspallataBattery(start),doctor=unit(start,'doctor');assert.equal(helper.roles.physicianId,doctor.id);
 const action=helper.controller(start,doctor);assert.notEqual(action?.type,'melee');assert.notEqual(action?.slot,'blade');if(action){const after=replay(start,[action]);assert.equal(unit(after,doctor.id).medkits,doctor.medkits);assert.deepEqual(after.artillery,start.artillery);}assert.deepEqual(start,before);
});

test('a crew member outside contact rejoins its real piece rather than following a nearby melee target',()=>{
 const start=arena({offContact:true}),before=structuredClone(start),actor=unit(start,'c1');assert.equal(artilleryContact(start,actor,piece(start)),false);
 const action=createdUspallataBattery(start).controller(start,actor);assert.equal(action?.type,'move');const quote=getReachable(start,actor).find(p=>p.x===action.x&&p.y===action.y&&(p.tacticalLevel??0)===(action.tacticalLevel??0));assert.ok(quote&&quote.cost>0&&quote.cost<=20);
 const after=replay(start,[action]);assert.equal(unit(after,actor.id).ap,actor.ap-quote.cost);assert.ok(Math.hypot(unit(after,actor.id).x-piece(after).x,unit(after,actor.id).y-piece(after).y)<Math.hypot(actor.x-piece(start).x,actor.y-piece(start).y));assert.deepEqual(after.artillery,start.artillery);assert.deepEqual(start,before);
});
