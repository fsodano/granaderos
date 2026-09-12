import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,carriedWeight,inventoryMapPreview} from '../game/tactical.js';
import {equipmentFingerprint,inventoryUsage,itemQuantity} from '../game/tactical-inventory.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const field=(extra={},sector={})=>createBattle([{id:'p',x:2,y:2,weapon:1805,loaded:1,condition:61,blade:0,medkits:3,...extra}],{width:10,height:8,exploration:true,enemies:[],tiles:Array.from({length:80},(_,i)=>({x:i%10,y:Math.floor(i/10),type:'grass',blocked:false,cover:0})),...sector});
const pickup=(b,sourceId,count=1)=>actBattle(b,{type:'pickupEquipment',unitId:'p',sourceId,count,expectedSource:equipmentFingerprint(b.units[0],sourceId)});
const place=(b,destinationId,count)=>actBattle(b,{type:'placeEquipment',unitId:'p',destinationId,count,expectedSource:equipmentFingerprint(b.units[0],'cursor'),expectedDestination:equipmentFingerprint(b.units[0],destinationId)});
const pocket=(u,item)=>inventoryUsage(u).slots.find(slot=>slot.entry?.item===item).id;

test('cursor pickup and repeated occupied-hand exchanges preserve weight, loaded gun and both clocks',()=>{
 for(const exploration of [true,false]){
  const initial=field({},exploration?{}:{exploration:false,enemies:[{id:'e',x:8,y:7,patrol:false}]}),before=structuredClone(initial),u=initial.units[0];
  let b=pickup(initial,pocket(u,'medkits'));
  assert.equal(b.lastError,null);assert.equal(b.units[0].medkits,2);assert.equal(b.units[0].equipmentCursor.stack.count,1);
  b=place(b,'hand:right');assert.equal(b.lastError,null);assert.equal(b.units[0].activeSlot,'medical');assert.equal(b.units[0].equipmentCursor.stack.weapon,1805);assert.equal(b.units[0].equipmentCursor.stack.loaded,1);assert.equal(b.units[0].equipmentCursor.stack.condition,61);
  b=place(b,'large-4');assert.equal(b.lastError,null);assert.equal(b.units[0].equipmentCursor,undefined);assert.equal(b.units[0].medkits,3);
  assert.ok(Math.abs(carriedWeight(b.units[0])-carriedWeight(u))<1e-8);assert.equal(b.units[0].ap,u.ap);assert.equal(b.elapsedSeconds,initial.elapsedSeconds);assert.equal(b.roundTimeCharged,initial.roundTimeCharged);assert.deepEqual(initial,before);validateBattleSnapshot(b);
 }
});

test('a stale drag destination cannot overwrite changed equipment or start cursor custody',()=>{
 const b=field(),u=b.units[0],from=pocket(u,'medkits'),action={type:'dragEquipment',unitId:'p',sourceId:from,destinationId:'hand:right',count:1,expectedSource:equipmentFingerprint(u,from),expectedDestination:equipmentFingerprint(u,'hand:right')};
 const changed=structuredClone(b);changed.units[0].loaded=0;
 const next=actBattle(changed,action);assert.match(next.lastError,/destino/);assert.equal(next.units[0].equipmentCursor,undefined);assert.deepEqual(next.units,changed.units);
});

test('a cursor stack can be dropped in parts with no duplicate source inventory',()=>{
 let b=field(),u=b.units[0];b=pickup(b,pocket(u,'medkits'),3);u=b.units[0];
 const action={type:'inventoryMap',unitId:u.id,sourceId:'cursor',expectedSource:equipmentFingerprint(u,'cursor'),count:2,intent:'ground',x:u.x,y:u.y};
 assert.equal(inventoryMapPreview(b,u,action).valid,true);
 b=actBattle(b,action);assert.equal(b.lastError,null);assert.equal(b.units[0].medkits,0);assert.equal(itemQuantity(b.units[0],'cursor'),1);assert.equal(b.groundItems.at(-1).count,2);
 b=place(b,'hand:right');assert.equal(b.lastError,null);assert.equal(b.units[0].medkits,1);assert.equal(b.units[0].equipmentCursor.stack.weapon,1805);validateBattleSnapshot(b);
});

test('only the selected available owner can start a new item cursor',()=>{
 let b=field();b.units.push({...structuredClone(b.units[0]),id:'q',x:3});b=pickup(b,'hand:right');
 const q=b.units[1],blocked=actBattle(b,{type:'pickupEquipment',unitId:'q',sourceId:'hand:right',expectedSource:equipmentFingerprint(q,'hand:right')});assert.match(blocked.lastError,/otro combatiente/);assert.deepEqual(blocked.units,b.units);
});

test('ending a turn resolves cursor custody before the enemy phase',()=>{
 const initial=field({}, {exploration:false,enemies:[{id:'e',x:9,y:7,patrol:false,weapon:1800,loaded:0,ammo:0,ap:0}]}),b=pickup(initial,'hand:right');
 assert.ok(b.units[0].equipmentCursor);const next=endTurn(b);assert.equal(next.lastError,null);assert.equal(next.units[0].equipmentCursor,undefined);assert.equal(next.units[0].weapon,1805);assert.equal(next.units[0].loaded,1);validateBattleSnapshot(next);
});

test('a body cursor retained at the ground limit remains visible in the actual loot picker and recoverable',async()=>{
 const {nearbyLootOptions}=await import('../game/ja2-hud.js');
 let b=field();b=pickup(b,'hand:right');const body={...b.units[0],id:'body',hp:0,unconscious:true};
 b.units=[{...field().units[0],x:3,y:2},body];b.groundItems=Array.from({length:2000},(_,i)=>({id:`full-${i}`,type:'item',item:'flints',count:1,weight:.05,x:9,y:7}));
 const option=nearbyLootOptions(b,b.units[0]).find(item=>item.action.item==='cursor');assert.ok(option);assert.equal(option.loaded,1);assert.equal(option.count,1);
 const n=actBattle(b,{...option.action,unitId:'p',count:1});assert.equal(n.lastError,null);assert.equal(n.units[1].equipmentCursor,undefined);assert.ok(Object.values(n.units[0].inventory).some(item=>item.weapon===1805&&item.loaded===1));
});
