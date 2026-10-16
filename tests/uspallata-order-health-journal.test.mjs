import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createBattle,actBattle,endTurn} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {openingControlWindow} from './opening-driver.mjs';
import {createUspallataOrderHealthJournal} from './uspallata-order-health-journal.mjs';

const unit=(battle,id)=>battle.units.find(actor=>actor.id===id);
const native=(battle,action)=>action.type==='endTurn'?endTurn(battle):actBattle(battle,action);
const rows=journal=>readFileSync(journal.journalPath,'utf8').trim().split('\n').map(line=>JSON.parse(line));

// All wounds, finite stores and the separating wall precede the factory.
// Later health, hands, AP, ammunition and clock changes are actual orders.
function scene(){
 const squad=[
  {id:'medic',name:'Sanitaria',x:2,y:4,facing:0,hp:100,maxHp:100,medical:90,marksmanship:80,strength:90,weapon:1800,loaded:1,ammo:3,medkits:2,activeSlot:'primary',energy:100,fatigue:0,morale:80},
  {id:'patient',name:'Paciente',x:3,y:4,facing:0,hp:50,maxHp:100,bleeding:3,medical:0,weapon:1800,loaded:0,ammo:0,medkits:0,energy:100,fatigue:0,morale:80},
  {id:'sentry',name:'Centinela herida',x:2,y:7,facing:0,hp:80,maxHp:100,bleeding:2,medical:0,weapon:1800,loaded:0,ammo:0,medkits:0,energy:100,fatigue:0,morale:80},
 ];
 const options={id:'fresh-uspallata-journal-component',width:20,height:10,seed:45,hour:12,
  tiles:Array.from({length:200},(_,i)=>({x:i%20,y:Math.floor(i/20),type:i%20===10?'wall':'grass',blocked:i%20===10,blocksSight:i%20===10,cover:0})),
  enemies:[{id:'separated',name:'Adversario separado',x:17,y:4,facing:2,hp:100,maxHp:100,weapon:0,blade:0,loaded:0,ammo:0,medkits:0,medical:0,patrol:false,overwatch:false}],
 };
 const declaration=structuredClone({squad,options}),battle=createBattle(squad,options);
 assert.deepEqual({squad,options},declaration);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);return battle;
}
const careThenFire=(battle,actor)=>{
 if(actor.id!=='medic')return null;
 if(unit(battle,'patient').bleeding>0)return actor.activeSlot==='medical'?{type:'useItem',unitId:actor.id,targetId:'patient'}:{type:'weapon',unitId:actor.id,slot:'medical'};
 if(actor.activeSlot!=='primary')return {type:'weapon',unitId:actor.id,slot:'primary'};
 return actor.loaded?{type:'firePoint',unitId:actor.id,x:2,y:1,aim:0,hitLocation:'torso'}:null;
};

test('observed real care, finite fire and endTurn preserve the exact Native result, tape and input',()=>{
 const directory=mkdtempSync(join(tmpdir(),'granaderos-uspallata-journal-'));
 try{
  const start=scene(),before=structuredClone(start),calls=[];let lastNative;
  const journal=createUspallataOrderHealthJournal({directory,executeNative:(current,action)=>{calls.push({current,action});lastNative=native(current,action);return lastNative;}});
  const direct=openingControlWindow(scene(),{controller:careThenFire}),observed=openingControlWindow(start,{controller:careThenFire,executeOrder:journal.executeOrder});
  assert.deepEqual(observed,direct);assert.equal(observed.battle,lastNative);assert.deepEqual(start,before);
  assert.deepEqual(observed.orders.map(action=>action.type),['weapon','useItem','weapon','firePoint']);assert.equal(calls.length,observed.orders.length);
  const issued=observed.orders.map(action=>structuredClone(action));assert.deepEqual(calls.map(row=>row.action),issued);
  assert.equal(unit(observed.battle,'medic').medkits,1);assert.equal(unit(observed.battle,'patient').bleeding,0);
  assert.equal(unit(observed.battle,'medic').loaded,0);assert.equal(unit(observed.battle,'medic').ammo,3);
  const input=observed.battle,inputBefore=structuredClone(input),action={type:'endTurn'},expected=endTurn(direct.battle),firstAfter=journal.executeOrder(input,action);
  assert.equal(firstAfter,lastNative);assert.equal(calls.length,issued.length+1);assert.equal(calls.at(-1).current,input);assert.equal(calls.at(-1).action,action);
  assert.deepEqual(firstAfter,expected);assert.deepEqual(input,inputBefore);
  // The first finish can share the round already paid by an actor order.
  // The next actual endTurn begins and completes a new Native interval.
  const nextInput=firstAfter,nextBefore=structuredClone(nextInput),nextAction={type:'endTurn'},nextExpected=endTurn(expected),after=journal.executeOrder(nextInput,nextAction);
  assert.equal(after,lastNative);assert.equal(calls.length,issued.length+2);assert.equal(calls.at(-1).current,nextInput);assert.equal(calls.at(-1).action,nextAction);
  assert.deepEqual(after,nextExpected);assert.deepEqual(nextInput,nextBefore);assert.ok(after.elapsedSeconds>nextInput.elapsedSeconds);
  assert.ok(unit(after,'sentry').hp<unit(nextInput,'sentry').hp,'The observed next round includes a real wound-clock loss.');
  const tape=[...observed.orders,action,nextAction];journal.finish({battle:after,actions:observed.actions,orders:tape});
  const record=rows(journal),orders=record.filter(row=>row.kind==='order');assert.equal(orders.length,calls.length);assert.deepEqual(orders.map(row=>row.action),tape);
  assert.ok(orders.every(row=>row.accepted));assert.deepEqual(orders.at(-1).returnedLog,after.log);assert.deepEqual(record.at(-1).orderTape,tape);
  assert.equal(orders.find(row=>row.action.type==='useItem').after.units.find(actor=>actor.id==='medic').medkits,1);
  assert.equal(orders.at(-1).after.units.find(actor=>actor.id==='sentry').hp,unit(after,'sentry').hp);
  assert.equal(after.frames,undefined);assert.equal(after.healthJournal,undefined);
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('earlier actual care remains in the journal after later paid orders clip the saved log',()=>{
 const directory=mkdtempSync(join(tmpdir(),'granaderos-uspallata-journal-clipping-'));
 try{
  const journal=createUspallataOrderHealthJournal({directory}),ordinary=openingControlWindow(scene(),{controller:careThenFire});
  const observed=openingControlWindow(scene(),{controller:careThenFire,executeOrder:journal.executeOrder});assert.deepEqual(observed,ordinary);
  let direct=ordinary.battle,current=observed.battle;const before=structuredClone(current),careLine=current.log.find(line=>line.includes('Sanitaria venda a Paciente'));assert.ok(careLine);
  for(let round=0;round<12&&current.log.includes(careLine);round++){
   const turn={type:'endTurn'};direct=endTurn(direct);current=journal.executeOrder(current,turn);assert.equal(current.lastError,null);assert.deepEqual(current,direct);
   for(let n=0;n<12;n++){
    const action={type:'weapon',unitId:'medic',slot:n%2?'primary':'medical'};direct=actBattle(direct,action);current=journal.executeOrder(current,action);
    assert.equal(current.lastError,null,JSON.stringify(action));assert.deepEqual(current,direct);
   }
  }
  assert.equal(current.log.length,80);assert.ok(!current.log.includes(careLine));assert.ok(rows(journal).some(row=>row.returnedLog?.includes(careLine)));
  assert.equal(unit(current,'medic').medkits,1);assert.equal(unit(current,'medic').loaded,0);assert.equal(unit(current,'medic').ammo,3);assert.deepEqual(observed.battle,before);
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('a fresh Native refusal and an unchanged thrown error keep their actual identity',()=>{
 const directory=mkdtempSync(join(tmpdir(),'granaderos-uspallata-journal-errors-'));
 try{
  const start=scene(),before=structuredClone(start),action={type:'weapon',unitId:'absent',slot:'medical'};let called=0,actual;
  const journal=createUspallataOrderHealthJournal({directory,executeNative:(current,issued)=>{called++;actual=native(current,issued);return actual;}});
  const refused=journal.executeOrder(start,action);assert.equal(refused,actual);assert.equal(called,1);assert.ok(refused.lastError);assert.deepEqual(refused,native(scene(),action));assert.deepEqual(start,before);
  const row=rows(journal).find(entry=>entry.kind==='order');assert.equal(row.accepted,false);assert.equal(row.after.lastError,refused.lastError);
  const sentinel=new Error('Independent observer delegate refusal'),fresh=scene(),unchanged=structuredClone(fresh);let throws=0;
  const throwing=createUspallataOrderHealthJournal({directory,executeNative:()=>{throws++;throw sentinel;}});
  assert.throws(()=>throwing.executeOrder(fresh,{type:'endTurn'}),error=>error===sentinel);assert.equal(throws,1);assert.deepEqual(fresh,unchanged);
  assert.equal(rows(throwing).find(entry=>entry.kind==='order').outcome,'threw');
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('a diagnostic filesystem refusal cannot change an actual Native result',()=>{
 const directory=mkdtempSync(join(tmpdir(),'granaderos-uspallata-journal-io-'));
 try{
  const blocked=join(directory,'ordinary-file');writeFileSync(blocked,'not a directory\n');const start=scene(),before=structuredClone(start),action={type:'weapon',unitId:'medic',slot:'medical'};let called=0,actual;
  const journal=createUspallataOrderHealthJournal({directory:blocked,executeNative:(current,issued)=>{called++;actual=native(current,issued);return actual;}});
  const result=journal.executeOrder(start,action);assert.equal(result,actual);assert.equal(called,1);assert.equal(result.lastError,null);assert.deepEqual(result,native(scene(),action));assert.deepEqual(start,before);assert.equal(journal.journalPath,null);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
