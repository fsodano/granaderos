import test from 'node:test';import assert from 'node:assert/strict';
import {actBattle,createBattle,supplyDropPreview} from '../game/tactical.js';
import {CHARACTER_SUPPLY_LABELS} from '../game/character-supplies.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {supplyCareField} from './supply-transfer-fixture.mjs';
import {saved,tactical,leave,visit} from './local-contract-fixture.mjs';
const unit=(p,id)=>p.battle.units.find(u=>u.id===String(id));
const physical=b=>({units:b.units,drops:b.droppedWeapons,ground:b.groundItems,seed:b.seed,elapsed:b.elapsedSeconds});
const prepared=(exploration=false)=>createBattle([{id:'sender',x:1,y:1,medkits:9},{id:'receiver',x:2,y:1,medkits:0}],{width:8,height:8,exploration,enemies:exploration?[]:[{id:'guard',x:7,y:7,patrol:false}]});
const drop=(b,a={})=>actBattle(b,{type:'dropSupply',unitId:'sender',item:'medkits',count:3,...a});

test('actual authored personal supplies stay in the visited sector and a different paid soldier recovers each exact bundle after saved return',()=>{
 let p=supplyCareField();const expected={};for(const item of Object.keys(CHARACTER_SUPPLY_LABELS)){const count=item==='medkits'?3:1;expected[item]=[unit(p,110)[item]-count,unit(p,111)[item]+count];p=tactical(p,{type:'dropSupply',unitId:'110',item,count});}
 const bundles=structuredClone(p.battle.groundItems.filter(g=>g.id.startsWith('supply-')));assert.equal(bundles.length,4);p=visit(saved({campaign:leave(saved(p))}).campaign);for(const g of bundles){assert.deepEqual(p.battle.groundItems.find(x=>x.id===g.id),g);p=tactical(p,{type:'loot',unitId:'111',groundId:g.id});assert.equal(p.battle.groundItems.find(x=>x.id===g.id).count,0);}
 for(const [item,values]of Object.entries(expected))assert.deepEqual([unit(p,110)[item],unit(p,111)[item]],values);const n=actBattle(p.battle,{type:'loot',unitId:'111',groundId:bundles[0].id});assert.ok(n.lastError);assert.deepEqual(physical(n),physical(p.battle));p=visit(saved({campaign:leave(saved(p))}).campaign);assert.ok(p.battle.groundItems.filter(g=>g.id.startsWith('supply-')).every(g=>g.count===0));for(const [item,values]of Object.entries(expected))assert.deepEqual([unit(p,110)[item],unit(p,111)[item]],values);assert.ok(saved(p));
});
test('each supported supply leaves the exact quantity for four AP and normal collection spends eight AP once',()=>{
 for(const item of Object.keys(CHARACTER_SUPPLY_LABELS)){let b=prepared();b.units[0][item]=9;const ap=b.units[0].ap,gun=b.units[0].weapon,loaded=b.units[0].loaded;b=drop(b,{item,count:3});assert.equal(b.lastError,null);assert.equal(b.units[0][item],6);assert.equal(b.units[0].ap,ap-4);assert.equal(b.groundItems[0].type,item);assert.equal(b.groundItems[0].count,3);b=actBattle(b,{type:'loot',unitId:'sender',groundId:b.groundItems[0].id});assert.equal(b.lastError,null);assert.equal(b.units[0][item],9);assert.equal(b.units[0].ap,ap-12);assert.equal(b.groundItems[0].count,0);assert.equal(b.units[0].weapon,gun);assert.equal(b.units[0].loaded,loaded);assert.ok(validateBattleSnapshot(b));}
});
test('exploration leaves a complete bundle in one second and distinct field records retain an existing colliding identifier',()=>{
 let b=prepared(true);b.units[0].ap=0;b.groundItems.push({id:`supply-sender-${b.turn}-1`,type:'rations',x:1,y:1,count:2});const original=structuredClone(b.groundItems[0]),seconds=b.elapsedSeconds;b=drop(b,{count:9});assert.equal(b.lastError,null);assert.equal(b.units[0].medkits,0);assert.equal(b.units[0].ap,0);assert.equal(b.elapsedSeconds,seconds+1);assert.deepEqual(b.groundItems[0],{...original,knownToPlayer:true});assert.notEqual(b.groundItems[1].id,original.id);assert.equal(b.groundItems[1].count,9);assert.ok(validateBattleSnapshot(b));
});
test('invalid quantities, sources, field limits or action budgets leave the source and ground unchanged',()=>{
 for(const [change,action]of [[()=>{},{count:0}],[()=>{},{count:-1}],[()=>{},{count:1.5}],[()=>{},{count:NaN}],[()=>{},{count:undefined}],[()=>{},{count:'2'}],[()=>{},{count:10}],[()=>{},{item:'ammo'}],[()=>{},{item:'__proto__'}],[()=>{},{slot:'primary'}],[()=>{},{inventoryKey:'spare'}],[b=>b.units[0].ap=3,{}],[b=>b.groundItems=Array.from({length:2000},(_,i)=>({id:`old${i}`,type:'rations',x:1,y:1,count:0})),{}],[b=>b.units[0].rations=100001,{item:'rations',count:100001}],[()=>{},{unitId:'guard'}]]){const b=prepared();change(b);const before=structuredClone(b),a={item:'medkits',count:3,...action};if(!a.slot&&!a.inventoryKey)assert.ok(supplyDropPreview(b,b.units.find(u=>u.id===(a.unitId||'sender')),a.item,a.count).reason);assert.deepEqual(b,before);const n=drop(b,action);assert.ok(n.lastError);assert.deepEqual(physical(n),physical(b));}
});
test('collection cannot overflow the supported personal supply bounds or take an entangled bundle',()=>{
 for(const item of Object.keys(CHARACTER_SUPPLY_LABELS)){const b=prepared(),limit=item==='medkits'?1000000:100000;b.units[0][item]=limit-1;b.groundItems=[{id:'bundle',type:item,x:1,y:1,count:2}];const n=actBattle(b,{type:'loot',unitId:'sender',groundId:'bundle'});assert.ok(n.lastError);assert.deepEqual(physical(n),physical(b));b.units[0][item]=limit-2;const accepted=actBattle(b,{type:'loot',unitId:'sender',groundId:'bundle'});assert.match(accepted.lastError,/bolsillo|cantidad|sobrecargado/);assert.deepEqual(physical(accepted),physical(b));}
 const b=prepared();b.groundItems=[{id:'held',type:'boleadoras',x:1,y:1,count:1,heldBy:'receiver'}];const n=actBattle(b,{type:'loot',unitId:'sender',groundId:'held'});assert.ok(n.lastError);assert.deepEqual(physical(n),physical(b));
});
