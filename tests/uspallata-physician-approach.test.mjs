import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,getReachable,actionCosts,stanceCost,medicalUsePreview,teamCanSee} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {sameSurface,spacePoint} from '../game/tactical-space.js';
import {criticalFirstAidNeeded} from '../game/first-aid.js';
import {medicalPatientAvailable} from '../game/medical-patient.js';
import {createdUspallataBattery} from './created-uspallata-battery.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';

const unit=(b,id)=>b.units.find(u=>u.id===id),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
// Every body, wound, kit and obstacle is declared before the Native factory.
// These portable controls do not use an earned or captured battle.
function arena({doctor={},patient={},blocked=false,hidden=false,near=false}={}){
 const width=24,height=18,players=[
  {id:'doctor',x:2,y:8,medical:95,medkits:3,activeSlot:'medical',stance:'prone',movementMode:'prone',marksmanship:90,...doctor},
  {id:'patient',x:near?3:7,y:8,hp:10,maxHp:100,bleeding:1,marksmanship:91,...patient},
  {id:'heavy-1',x:12,y:12,marksmanship:0},{id:'heavy-2',x:12,y:13,marksmanship:1},{id:'heavy-3',x:13,y:12,marksmanship:2},
  {id:'small-1',x:18,y:12,marksmanship:3},{id:'screen-1',x:14,y:15,marksmanship:92},{id:'screen-2',x:17,y:15,marksmanship:93},
 ].map(raw=>({name:raw.id,hp:100,maxHp:100,weapon:1800,blade:1813,loaded:1,ammo:11,medical:0,medkits:0,energy:100,fatigue:0,morale:90,stance:'crouched',strength:100,dexterity:90,experienceLevel:4,facing:2,...raw}));
 const options={id:'declared-uspallata-physician',width,height,hour:12,seed:45,
  tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:Math.floor(i/width)===16?'wall':'grass',blocked:Math.floor(i/width)===16||blocked&&i%width===5,blocksSight:Math.floor(i/width)===16,cover:0})),
  enemies:[{id:'remote',x:hidden?23:22,y:17,name:hidden?'Other unseen hostile':'Unseen hostile',hp:500,maxHp:500,weapon:0,blade:0,loaded:0,ammo:0,patrol:false,overwatch:false}],
  artillery:[{id:'heavy',type:'field8',side:'player',x:13,y:13,loaded:true,ammo:2},{id:'small',type:'swivel',side:'player',x:18,y:13,loaded:true,ammo:2}],
 };
 const declaration=structuredClone({players,options}),battle=createBattle(players,options);
 assert.deepEqual({players,options},declaration);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);
 return battle;
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
function spendHands(start,count=8){
 const orders=Array.from({length:count},(_,i)=>({type:'weapon',unitId:'doctor',slot:i%2?'medical':'primary'})),battle=replay(start,orders);
 assert.equal(unit(battle,'doctor').ap,unit(start,'doctor').ap-count*actionCosts(start,unit(start,'doctor')).weapon);return {battle,orders};
}
// The exact former physician leaf, with its unchanged adjacent Native chooser.
function formerOrder(b,u){
 const normal=tucumanCombatOrder(b,u);if(normal?.type==='useItem'||normal?.slot==='medical'||u.knockedDown||u.entangled)return normal;
 const patients=b.units.filter(p=>p.side===u.side&&p.id!==u.id&&medicalPatientAvailable(p)&&(p.bleeding>0||criticalFirstAidNeeded(p))).sort((a,c)=>a.hp-c.hp||String(a.id).localeCompare(String(c.id)));
 for(const patient of patients){
  const points=getReachable(b,u).filter(p=>p.cost>0&&p.cost<=Math.min(16,u.ap-actionCosts(b,u).weapon-actionCosts(b,u).heal)&&sameSurface(p,u)&&p.path.every(step=>sameSurface(step,u))&&distance(p,patient)<distance(u,patient));
  points.sort((a,c)=>distance(a,patient)-distance(c,patient)||a.cost-c.cost||a.y-c.y||a.x-c.x);if(points[0])return {type:'move',unitId:u.id,...spacePoint(points[0])};
 }
 return u.stance!=='prone'&&u.ap>=stanceCost(u,'prone')?{type:'stance',unitId:u.id,stance:'prone'}:null;
}

test('a quoted upright prefix reaches finite aid where the same paid prone window stalls',()=>{
 const declared=arena(),prelude=spendHands(declared),start=prelude.battle,before=structuredClone(start),helper=createdUspallataBattery(start);assert.equal(helper.roles.physicianId,'doctor');
 let old=start;const oldOrders=[];
 for(let i=0;i<8;i++){const action=formerOrder(old,unit(old,'doctor'));if(!action)break;oldOrders.push(action);old=replay(old,[action]);}
 assert.equal(oldOrders.length,2);assert.ok(oldOrders.every(a=>a.type==='move'&&!a.movement));assert.equal(unit(old,'doctor').medkits,3);assert.ok(unit(old,'patient').hp<15);assert.equal(formerOrder(old,unit(old,'doctor')),null);
 let battle=start;const orders=[];
 for(let i=0;i<8;i++){
  const doctor=unit(battle,'doctor'),action=helper.controller(battle,doctor);assert.ok(action,'actual quoted progress must continue to aid');
  if(action.type==='move'){
   const paid=action.movement?stanceCost(doctor,'standing'):0,projected=action.movement?{...doctor,stance:'standing',movementMode:action.movement,ap:doctor.ap-paid}:doctor;
   const quote=getReachable(battle,projected).find(p=>p.x===action.x&&p.y===action.y);assert.ok(quote&&quote.cost>0);assert.ok(paid+quote.cost<=16);assert.ok(paid+quote.cost+actionCosts(battle,doctor).weapon+actionCosts(battle,doctor).heal<=doctor.ap);
   const after=replay(battle,[action]);assert.equal(unit(after,'doctor').ap,doctor.ap-paid-quote.cost);assert.ok(unit(after,'doctor').energy<doctor.energy);battle=after;
  }else{
   assert.deepEqual(action,{type:'useItem',unitId:'doctor',targetId:'patient'});const quote=medicalUsePreview(battle,doctor,unit(battle,'patient'));assert.equal(quote.allowed,true);
   battle=replay(battle,[action]);assert.equal(unit(battle,'doctor').medkits,doctor.medkits-quote.treatment.dressingsUsed);assert.equal(unit(battle,'doctor').ap,doctor.ap-quote.cost);orders.push(action);break;
  }
  orders.push(action);
 }
 assert.equal(orders[0].movement,'walk');assert.equal(orders.filter(a=>a.type==='move').length,3);assert.equal(orders.filter(a=>a.type==='useItem').length,1);
 assert.equal(unit(battle,'patient').hp,15);assert.equal(unit(battle,'patient').bleeding,0);assert.deepEqual(battle.artillery,start.artillery);assert.equal(battle.turn,start.turn);assert.equal(battle.elapsedSeconds,start.elapsedSeconds);
 assert.deepEqual(replay(declared,[...prelude.orders,...orders]),battle);assert.deepEqual(start,before);
});

test('actual adjacent finite aid remains ahead of any posture or approach',()=>{
 const start=arena({near:true}),before=structuredClone(start),helper=createdUspallataBattery(start),doctor=unit(start,'doctor'),quote=medicalUsePreview(start,doctor,unit(start,'patient'));assert.equal(quote.allowed,true);
 const action=helper.controller(start,doctor);assert.deepEqual(action,{type:'useItem',unitId:'doctor',targetId:'patient'});const end=replay(start,[action]);assert.equal(unit(end,'doctor').stance,'prone');assert.equal(unit(end,'doctor').ap,doctor.ap-quote.cost);assert.equal(unit(end,'doctor').medkits,doctor.medkits-quote.treatment.dressingsUsed);assert.deepEqual(end.artillery,start.artillery);assert.deepEqual(start,before);
});

test('one real dressing cannot fund a second critical stroke or a new posture',()=>{
 const start=arena({near:true,doctor:{medkits:1},patient:{hp:1,bleeding:10}}),before=structuredClone(start),helper=createdUspallataBattery(start),doctor=unit(start,'doctor'),quote=medicalUsePreview(start,doctor,unit(start,'patient'));assert.equal(quote.allowed,true);assert.equal(quote.treatment.partial,true);
 const action=helper.controller(start,doctor);assert.deepEqual(action,{type:'useItem',unitId:'doctor',targetId:'patient'});const end=replay(start,[action]);assert.equal(unit(end,'doctor').medkits,0);assert.ok(unit(end,'patient').hp>1&&unit(end,'patient').hp<15);assert.equal(helper.controller(end,unit(end,'doctor')),null);assert.equal(unit(end,'doctor').stance,'prone');assert.deepEqual(end.artillery,start.artillery);assert.deepEqual(start,before);
});

test('a blocked aid route does not justify an upright preparation',()=>{
 const start=arena({blocked:true}),before=structuredClone(start),doctor=unit(start,'doctor'),action=createdUspallataBattery(start).controller(start,doctor);assert.equal(formerOrder(start,doctor)?.type,'move');assert.equal(action,null);assert.equal(doctor.stance,'prone');assert.notEqual(action?.movement,'walk');if(action)replay(start,[action]);assert.deepEqual(start,before);
});

test('an unaffordable aid window cannot borrow posture or approach AP',()=>{
 const declared=arena(),prelude=spendHands(declared,18),start=prelude.battle,before=structuredClone(start),doctor=unit(start,'doctor');assert.equal(doctor.ap,28);
 assert.equal(createdUspallataBattery(start).controller(start,doctor),null);assert.equal(formerOrder(start,doctor),null);assert.deepEqual(start,before);assert.deepEqual(replay(declared,prelude.orders),start);
});

test('healthy idle and unavailable patients retain the former physician posture decisions',()=>{
 for(const patient of [{hp:100,bleeding:0},{hp:40,bleeding:2,routed:true},{hp:0,bleeding:0},{hp:40,bleeding:2,captured:true}]){
  const start=arena({patient,doctor:{stance:'standing',movementMode:'walk'}}),before=structuredClone(start),doctor=unit(start,'doctor'),action=createdUspallataBattery(start).controller(start,doctor);assert.deepEqual(action,formerOrder(start,doctor));assert.deepEqual(action,{type:'stance',unitId:'doctor',stance:'prone'});replay(start,[action]);assert.deepEqual(start,before);
 }
});

test('unseen opposing details cannot select the medical approach or alter its public quote',()=>{
 const start=arena(),other=arena({hidden:true}),before=structuredClone(start),otherBefore=structuredClone(other);assert.equal(teamCanSee(start,'player',unit(start,'remote')),false);assert.equal(teamCanSee(other,'player',unit(other,'remote')),false);
 const action=createdUspallataBattery(start).controller(start,unit(start,'doctor'));assert.equal(action.movement,'walk');assert.deepEqual(createdUspallataBattery(other).controller(other,unit(other,'doctor')),action);replay(start,[action]);replay(other,[action]);assert.deepEqual(start,before);assert.deepEqual(other,otherBefore);
});
