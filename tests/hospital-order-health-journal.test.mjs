import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createBattle,actBattle,endTurn} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {openingControlWindow} from './opening-driver.mjs';
import {coordinatedHospitalBattery} from './coordinated-hospital-battery.mjs';
import {hospitalOrderHealthObservation} from './hospital-order-health-journal.mjs';

const actor=(battle,id)=>battle.units.find(unit=>unit.id===id);
const native=(battle,action)=>action.type==='endTurn'?endTurn(battle):actBattle(battle,action);
const rows=journal=>readFileSync(journal.journalPath,'utf8').trim().split('\n').map(line=>JSON.parse(line));

function scene(){
 const width=20,height=10,players=[
  {id:'medic',x:2,y:4,hp:100,maxHp:100,medical:90,marksmanship:80,weapon:1800,loaded:1,ammo:3,medkits:2,activeSlot:'primary',energy:100,morale:90,facing:0,overwatch:false},
  {id:'patient',x:3,y:4,hp:50,maxHp:100,bleeding:3,medical:0,weapon:0,blade:0,loaded:0,ammo:0,medkits:0,energy:100,morale:90,facing:0,overwatch:false},
  {id:'separated-patient',x:12,y:7,hp:80,maxHp:100,bleeding:2,medical:0,weapon:0,blade:0,loaded:0,ammo:0,medkits:0,energy:100,morale:90,facing:0,overwatch:false},
 ];
 const sector={id:'declared-hospital-observer',width,height,seed:45,hour:12,
  tiles:Array.from({length:width*height},(_,index)=>{const partition=index%width===10||index%width===15;return {x:index%width,y:Math.floor(index/width),type:partition?'stone':'grass',blocked:partition,blocksSight:partition,material:'stone',obstacleHeight:partition?10:0,cover:0};}),
  enemies:[{id:'separated-enemy',x:17,y:4,hp:100,maxHp:100,weapon:0,blade:0,loaded:0,ammo:0,medical:0,medkits:0,patrol:false,overwatch:false}],
 };
 const declaration=structuredClone({players,sector}),battle=createBattle(players,sector);
 assert.deepEqual({players,sector},declaration);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);return battle;
}

test('disabled hospital observation returns the exact existing options without callbacks or a sink',()=>{
 const options={controller:()=>null,sharedFallback:()=>null,admitBattle:state=>state,executeOrder:native};
 const observed=hospitalOrderHealthObservation(options,{roles:{physicianId:'medic'}});
 assert.equal(observed.options,options);assert.equal(observed.journal,undefined);
});

test('actual hospital admission, care, null boundaries and wound-clock results preserve every existing delegate and state',()=>{
 const directory=mkdtempSync(join(tmpdir(),'granaderos-hospital-observer-'));
 try{
  const start=scene(),before=structuredClone(start),policy=coordinatedHospitalBattery(start,{coordinatePhysicianHold:true});
  let admissions=0,callbacks=0,lastNative;const calls=[];
  const options={admitBattle:initial=>{admissions++;return initial;},controller:(current,unit)=>{callbacks++;return policy.controller(current,unit);},
   executeOrder:(current,action)=>{calls.push({current,action});lastNative=native(current,action);return lastNative;}};
  const observed=hospitalOrderHealthObservation(options,{directory,battleId:start.battleId,roles:policy.roles});
  const admitted=observed.options.admitBattle(start);assert.equal(admitted,start);assert.equal(admissions,1);
  const directStart=scene(),ordinary=openingControlWindow(directStart,{controller:coordinatedHospitalBattery(directStart,{coordinatePhysicianHold:true}).controller});
  const result=openingControlWindow(admitted,observed.options);assert.deepEqual(result,ordinary);assert.equal(result.battle,lastNative);
  assert.equal(calls.length,result.orders.length);assert.deepEqual(calls.map(call=>call.action),result.orders);assert.ok(callbacks>=calls.length);
  assert.ok(result.orders.some(action=>action.type==='useItem'&&action.targetId==='patient'));
  assert.equal(actor(result.battle,'patient').bleeding,0);assert.ok(actor(result.battle,'medic').medkits<actor(start,'medic').medkits);
  let current=result.battle,expected=ordinary.battle;
  for(let turn=0;turn<2;turn++){
   const input=current,action={type:'endTurn'};expected=endTurn(expected);current=observed.options.executeOrder(input,action);
   assert.equal(current,lastNative);assert.equal(calls.at(-1).current,input);assert.equal(calls.at(-1).action,action);assert.deepEqual(current,expected);
  }
  assert.ok(actor(current,'separated-patient').hp<actor(result.battle,'separated-patient').hp,'The retained order boundary includes real Native wound-clock damage.');
  const tape=[...result.orders,{type:'endTurn'},{type:'endTurn'}];observed.journal.finish({battle:current,actions:result.actions,orders:tape});
  const record=rows(observed.journal),initials=record.filter(row=>row.kind==='initial'),orders=record.filter(row=>row.kind==='order'),held=record.filter(row=>row.kind==='null-decision');
  assert.equal(initials.length,1);assert.deepEqual(initials[0].battle,start);assert.deepEqual(initials[0].roles,policy.roles);
  assert.deepEqual(orders.map(row=>row.action),tape);assert.equal(orders.length,calls.length);assert.ok(orders.every(row=>row.accepted));
  assert.ok(held.length>0);assert.ok(held.every(row=>row.source==='controller'));assert.deepEqual(held[0].roles,policy.roles);
  assert.deepEqual(orders.at(-1).returnedLog,current.log);assert.equal(orders.at(-1).after.units.find(unit=>unit.id==='separated-patient').hp,actor(current,'separated-patient').hp);
  assert.deepEqual(record.at(-1).orderTape,tape);assert.deepEqual(start,before);assert.equal(current.healthJournal,undefined);
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('repeated held callbacks are deduplicated and the diagnostic row cap cannot issue an order',()=>{
 const directory=mkdtempSync(join(tmpdir(),'granaderos-hospital-observer-cap-'));
 try{
  const start=scene(),before=structuredClone(start);let callbacks=0,fallbacks=0,orders=0;
  const observed=hospitalOrderHealthObservation({controller:()=>{callbacks++;return null;},sharedFallback:()=>{fallbacks++;return undefined;},executeOrder:()=>{orders++;throw Error('A held actor cannot issue a Native order.');}},
   {directory,battleId:start.battleId,roles:{physicianId:'medic',crews:[]},nullDecisionLimit:2});
  observed.options.admitBattle(start);
  for(let repeat=0;repeat<3;repeat++)assert.equal(observed.options.controller(start,actor(start,'medic')),null);
  for(let repeat=0;repeat<2;repeat++)assert.equal(observed.options.sharedFallback(start,actor(start,'medic')),undefined);
  assert.equal(observed.options.controller(start,actor(start,'patient')),null);assert.equal(observed.options.controller(start,actor(start,'separated-patient')),null);
  observed.journal.finish({battle:start,actions:0,orders:[]});
  const record=rows(observed.journal),held=record.filter(row=>row.kind==='null-decision');assert.equal(callbacks,5);assert.equal(fallbacks,2);assert.equal(orders,0);assert.equal(held.length,2);
  assert.equal(held[1].source,'sharedFallback');assert.equal(held[1].returnedKind,'undefined');
  assert.equal(record.filter(row=>row.kind==='null-decision-limit').length,1);assert.equal(record.at(-1).nullDecisionAttempts,7);assert.equal(record.at(-1).nullDecisionLimitReached,true);assert.deepEqual(start,before);
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('a fresh Native refusal and a delegate throw retain their exact result and error identities',()=>{
 const directory=mkdtempSync(join(tmpdir(),'granaderos-hospital-observer-refusal-'));
 try{
  const start=scene(),before=structuredClone(start),action={type:'weapon',unitId:'absent',slot:'medical'};let calls=0,actual;
  const observed=hospitalOrderHealthObservation({executeOrder:(current,issued)=>{calls++;actual=native(current,issued);return actual;}},{directory});
  const refused=observed.options.executeOrder(start,action);assert.equal(refused,actual);assert.equal(calls,1);assert.ok(refused.lastError);assert.deepEqual(start,before);
  // The refused output is terminal. Only retained plain JSON rows are read.
  assert.equal(rows(observed.journal).find(row=>row.kind==='order').accepted,false);
  const fresh=scene(),unchanged=structuredClone(fresh),sentinel=new Error('Independent hospital delegate refusal');let throws=0;
  const throwing=hospitalOrderHealthObservation({executeOrder:()=>{throws++;throw sentinel;}},{directory});
  assert.throws(()=>throwing.options.executeOrder(fresh,{type:'endTurn'}),error=>error===sentinel);assert.equal(throws,1);assert.deepEqual(fresh,unchanged);
  assert.equal(rows(throwing.journal).find(row=>row.kind==='order').outcome,'threw');
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('a filesystem diagnostic failure cannot replace the actual admission or Native result',()=>{
 const directory=mkdtempSync(join(tmpdir(),'granaderos-hospital-observer-io-'));
 try{
  const blocked=join(directory,'ordinary-file');writeFileSync(blocked,'not a directory\n');const start=scene(),before=structuredClone(start),action={type:'weapon',unitId:'medic',slot:'medical'};
  let admissions=0,calls=0,actual;
  const observed=hospitalOrderHealthObservation({admitBattle:current=>{admissions++;return current;},executeOrder:(current,issued)=>{calls++;actual=native(current,issued);return actual;}},{directory:blocked});
  assert.equal(observed.options.admitBattle(start),start);assert.equal(admissions,1);
  const result=observed.options.executeOrder(start,action);assert.equal(result,actual);assert.equal(calls,1);assert.equal(result.lastError,null);assert.equal(observed.journal.journalPath,null);assert.deepEqual(start,before);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
