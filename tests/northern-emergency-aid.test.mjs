import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle} from '../game/tactical.js';
import {autoBandageBattle,autoBandageStatus} from '../game/auto-bandage.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {northernEmergencyAid} from './northern-emergency-aid.mjs';

const unit=(b,id)=>b.units.find(actor=>actor.id===id);
// Fresh portable public geometry, wounds and stock declared before createBattle.
// No failed campaign, captured battle, hand assignment or altered clock is used.
function arena({critical=true,adjacent=false,running=false,kits=3,danger=false,adjacentWound=false,blocked=false}={}){
 return createBattle([
  {id:'medic',name:'Médico',x:3,y:9,weapon:1800,blade:1813,loaded:1,ammo:5,medical:91,medkits:kits,dexterity:90,experienceLevel:4,energy:100,morale:90,stance:'standing',movementMode:running?'run':'walk'},
  {id:'patient',name:'Herido',x:adjacent?4:5,y:adjacent?9:5,weapon:0,blade:0,loaded:0,ammo:0,medical:0,medkits:0,hp:critical?7:60,maxHp:84,bleeding:critical?4:1,energy:76,morale:90},
  ...(adjacentWound?[{id:'near-patient',name:'Herido próximo',x:4,y:9,weapon:0,blade:0,loaded:0,ammo:0,medical:0,medkits:0,hp:60,maxHp:84,bleeding:1}]:[]),
 ],{id:'declared-critical-aid-approach',width:20,height:15,hour:12,seed:45,exploration:true,enemies:danger?[{id:'danger',name:'Contacto',x:7,y:9,weapon:1800,loaded:1,ammo:5,patrol:false}]:[],tiles:Array.from({length:20*15},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:blocked&&Math.floor(i/20)===7,cover:0}))});
}
function replay(start,orders){
 let direct=structuredClone(start),shown=structuredClone(start),saved=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  direct=actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));
  shown=presentedActBattle(shown,action).state;assert.deepEqual(shown,direct);
  saved=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(saved,JSON.parse(JSON.stringify(action))))));assert.deepEqual(saved,direct);
 }
 return direct;
}

test('a real run preparation rescues a critical patient before the same public walking approach loses him',()=>{
 const start=arena(),before=structuredClone(start),walking=autoBandageBattle(start);
 assert.equal(unit(walking.battle,'patient').hp,0);assert.match(walking.untreated[0].reason,/Murió/);assert.ok(walking.steps.some(action=>action.type==='move'));assert.equal(unit(walking.battle,'medic').medkits,3);
 const result=northernEmergencyAid(start,{physicianId:'medic',urgentIds:['patient']});assert.deepEqual(result.steps[0],{type:'movement',unitId:'medic',movement:'run'});
 assert.equal(result.stoppedReason,null);assert.deepEqual(result.untreated,[]);assert.ok(result.steps.some(action=>action.type==='move'));assert.ok(result.steps.some(action=>action.type==='useItem'&&action.targetId==='patient'));
 const end=replay(start,result.steps),patient=unit(end,'patient'),medic=unit(end,'medic');assert.deepEqual(end,result.battle);
 assert.equal(patient.hp,15);assert.equal(patient.bleeding,0);assert.ok(patient.hp<patient.maxHp);assert.equal(medic.medkits,1);assert.ok(end.elapsedSeconds>0);assert.equal(result.elapsedSeconds,end.elapsedSeconds-start.elapsedSeconds);assert.ok(medic.energy<unit(start,'medic').energy);
 for(const actor of start.units){const after=unit(end,actor.id);assert.equal(after.ap,actor.ap);assert.deepEqual(unitAmmunitionByType(after),unitAmmunitionByType(actor));for(const key of ['inventory','weapon','blade','condition'])assert.deepEqual(after[key],actor[key]);}
 assert.deepEqual(end.tiles,start.tiles);assert.deepEqual(start,before);
});

test('adjacent critical aid and noncritical finite care retain the complete ordinary Native order sequence',()=>{
 for(const options of [{adjacent:true},{critical:false},{running:true}]){
  const start=arena(options),before=structuredClone(start),ordinary=autoBandageBattle(start),result=northernEmergencyAid(start,{physicianId:'medic',urgentIds:['patient']});
  assert.deepEqual(result,ordinary);assert.deepEqual(replay(start,result.steps),result.battle);assert.deepEqual(start,before);
 }
});

test('an unsupplied nominated physician gets no automatic dressing, recovery or movement preparation',()=>{
 const start=arena({kits:0}),before=structuredClone(start),ordinary=autoBandageBattle(start),result=northernEmergencyAid(start,{physicianId:'medic',urgentIds:['patient']});
 assert.deepEqual(result,ordinary);assert.deepEqual(result.steps,[]);assert.equal(unit(result.battle,'patient').hp,7);assert.equal(unit(result.battle,'medic').medkits,0);assert.equal(result.elapsedSeconds,0);assert.deepEqual(start,before);
});

test('actual Native danger admission preserves the entire ordinary no-order refusal without an extra bleeding tick',()=>{
 const start=arena({danger:true}),before=structuredClone(start);assert.equal(autoBandageStatus(start).available,false);
 const ordinary=autoBandageBattle(start),result=northernEmergencyAid(start,{physicianId:'medic',urgentIds:['patient']});
 assert.deepEqual(result,ordinary);assert.deepEqual(result.steps,[]);assert.equal(result.elapsedSeconds,0);assert.deepEqual(start,before);
});

test('an immediately treatable noncritical adjacent patient preserves ordinary aid before any run preparation',()=>{
 const start=arena({adjacentWound:true}),before=structuredClone(start),ordinary=autoBandageBattle(start),result=northernEmergencyAid(start,{physicianId:'medic',urgentIds:['patient']});
 assert.deepEqual(result,ordinary);assert.equal(result.steps.some(action=>action.type==='movement'),false);assert.deepEqual(replay(start,result.steps),result.battle);assert.deepEqual(start,before);
});

test('a genuinely blocked public rescue route preserves the ordinary no-route result and spends no preparation tick',()=>{
 const start=arena({blocked:true}),before=structuredClone(start);assert.equal(autoBandageStatus(start).available,true);
 const ordinary=autoBandageBattle(start),result=northernEmergencyAid(start,{physicianId:'medic',urgentIds:['patient']});
 assert.deepEqual(result,ordinary);assert.deepEqual(result.steps,[]);assert.equal(result.elapsedSeconds,0);assert.deepEqual(start,before);
});
