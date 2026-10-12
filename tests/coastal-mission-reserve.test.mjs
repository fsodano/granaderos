import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {localSanLorenzoOrder} from './local-san-lorenzo-driver.mjs';
import {coastalMissionOrder,inspectCoastalRemains} from './fresh-coastal-fixture.mjs';

const field=units=>createBattle(units,{width:24,height:16,seed:8,props:[],enemies:[{id:'defender',x:22,y:12,hp:100,weapon:1800,loaded:1,ammo:9}],tiles:Array.from({length:24*16},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0,blocksSight:false}))});
const commander={id:'57',name:'Comandante aliado',x:1,y:1,hp:88,maxHp:88,missionAlly:true,weapon:1808,blade:1809,loaded:2,ammo:0,medical:50,medkits:0};

test('a living mission reserve holds instead of riding ahead of its actual infantry',()=>{
 const battle=field([commander,{id:'line',x:15,y:8,hp:85,weapon:1802,loaded:1,ammo:9}]),before=structuredClone(battle),unit=battle.units.find(u=>u.id==='57');
 assert.equal(localSanLorenzoOrder(battle,unit).type,'move','the former local controller rallies the isolated commander into the advance');
 assert.equal(coastalMissionOrder(battle,unit),null);
 assert.deepEqual(battle,before,'holding gives no health, medicine, time or position change');
});

test('the reserve policy retains ordinary adjacent aid, finite dressing use and saved wounds',()=>{
 const battle=field([{...commander,x:6,y:5,hp:33,bleeding:4},{id:'doctor',x:6,y:6,hp:80,weapon:1800,loaded:1,ammo:9,medical:80,medkits:1}]),before=structuredClone(battle);
 let current=battle;
 for(let step=0;step<2;step++){
  const action=coastalMissionOrder(current,current.units.find(u=>u.id==='doctor'));assert.equal(action.type,step?'heal':'weapon');
  if(step)assert.equal(action.targetId,'57');
  current=actBattle(current,action);assert.equal(current.lastError,null);
 }
 const patient=current.units.find(u=>u.id==='57'),doctor=current.units.find(u=>u.id==='doctor');
 assert.equal(patient.hp,33);assert.equal(patient.bleeding,0);assert.equal(doctor.medkits,0);assert.ok(doctor.ap<before.units.find(u=>u.id==='doctor').ap);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(current))).units,current.units);assert.deepEqual(battle,before);
});

test('a mission ally with no conscious infantry retains the ordinary combat controller',()=>{
 const battle=field([commander,{id:'fallen-line',x:15,y:8,hp:0,weapon:1802,loaded:0,ammo:0}]),before=structuredClone(battle),unit=battle.units.find(u=>u.id==='57');
 const expected=localSanLorenzoOrder(battle,unit);assert.ok(expected);assert.deepEqual(coastalMissionOrder(battle,unit),expected);assert.deepEqual(battle,before);
});

test('ordinary friendly-body inspection discovers finite tools without moving their custody or restoring a death',()=>{
 const battle=createBattle([{id:'survivor',x:1,y:2,hp:85,weapon:1800,loaded:1,ammo:9,medkits:1},{id:'fallen',x:7,y:2,hp:0,weapon:1800,loaded:0,ammo:0,inventory:{toolkit:{item:'inventory:toolkit',kind:'repair-kit',name:'Herramientas',count:1,weight:2,repairPoints:91,instanceId:'fallen-kit'}}}],{width:12,height:7,seed:8,exploration:true,enemies:[],props:[],tiles:Array.from({length:84},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,blocksSight:false,cover:0}))});
 const before=structuredClone(battle),result=inspectCoastalRemains(battle),body=result.battle.units.find(u=>u.id==='fallen'),carrier=result.battle.units.find(u=>u.id==='survivor');
 assert.ok(result.orders.length>0);assert.equal(body.knownToPlayer,true);assert.equal(body.hp,0);assert.deepEqual(body.inventory,before.units.find(u=>u.id==='fallen').inventory);assert.deepEqual(carrier.inventory,before.units.find(u=>u.id==='survivor').inventory);assert.equal(carrier.hp,85);assert.equal(carrier.medkits,1);assert.ok(result.battle.elapsedSeconds>before.elapsedSeconds);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(result.battle))).units,result.battle.units);assert.deepEqual(battle,before);assert.deepEqual(inspectCoastalRemains(result.battle).orders,[]);
});
