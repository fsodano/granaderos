import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,equipmentPlacementPreview,carriedWeight} from '../game/tactical.js';
import {inventoryUsage,equipmentFingerprint} from '../game/tactical-inventory.js';
import {handLayout} from '../game/hand-layout.js';import {validateBattleSnapshot} from '../game/validate-battle.js';
const field=(unit={},options={})=>createBattle([{id:'p',x:2,y:2,weapon:1805,condition:81,loaded:1,ammo:8,blade:0,medkits:1,...unit}],{width:20,height:8,seed:127,tiles:Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',cover:0,blocked:false})),enemies:[{id:'e',x:3,y:2,patrol:false,overwatch:false}],...options});
const pocket=(b,item)=>inventoryUsage(b.units[0]).slots.find(s=>s.entry?.item===item).id;
const action=(b,sourceId,destinationId)=>({type:'moveEquipment',unitId:'p',sourceId,destinationId,expectedSource:equipmentFingerprint(b.units[0],sourceId),expectedDestination:equipmentFingerprint(b.units[0],destinationId)});
const move=(b,from,to)=>{const a=action(b,from,to),preview=equipmentPlacementPreview(b,b.units[0],a);assert.equal(preview.valid,true,preview.reason);const n=actBattle(b,a);assert.equal(n.lastError,null,n.lastError);assert.equal(n.units[0].ap,b.units[0].ap-(b.mode==='exploration'?0:preview.pa));assert.equal(carriedWeight(n.units[0]),carriedWeight(b.units[0]));assert.doesNotThrow(()=>validateBattleSnapshot(n));return n;};
const reject=(b,a)=>{const before=structuredClone(b);assert.equal(equipmentPlacementPreview(b,b.units[0],a).valid,false);const n=actBattle(b,a);assert.ok(n.lastError);assert.deepEqual(n.units,before.units);assert.equal(n.seed,before.seed);assert.equal(n.elapsedSeconds,before.elapsedSeconds);};
test('drag one dressing to each hand and back into the selected pocket without creating supplies',()=>{
 let b=field({medkits:3});b=move(b,pocket(b,'medkits'),'hand:left');assert.equal(handLayout(b.units[0]).left,'medkits');assert.equal(inventoryUsage(b.units[0]).items.find(i=>i.item==='medkits').count,2);
 b=move(b,'hand:left','hand:right');assert.equal(handLayout(b.units[0]).right,'medkits');assert.equal(handLayout(b.units[0]).left,null);b=move(b,'hand:right','large-4');assert.equal(handLayout(b.units[0]).right,null);assert.equal(pocket(b,'medkits'),'large-4');assert.equal(b.units[0].medkits,3);
});
test('stowing a loaded pistol preserves the blade in the other hand and exact gun contents',()=>{
 let b=field({blade:1813,weaponInstanceId:'pistol-1'});b=move(b,'hand:right','large-4');assert.equal(handLayout(b.units[0]).left,'blade');assert.equal(handLayout(b.units[0]).right,null);const gun=inventoryUsage(b.units[0]).slots.find(s=>s.id==='large-4').entry;assert.equal(gun.weapon,1805);assert.equal(gun.condition,81);assert.equal(gun.loaded,1);b=move(b,'large-4','hand:right');assert.equal(b.units[0].weapon,1805);assert.equal(b.units[0].condition,81);assert.equal(b.units[0].loaded,1);assert.equal(handLayout(b.units[0]).left,'blade');
});
test('hand and occupied pocket exchange a pistol and dressing in a single paid order',()=>{
 let b=field();const destination=pocket(b,'medkits');b=move(b,'hand:right',destination);assert.equal(handLayout(b.units[0]).right,'medkits');assert.equal(inventoryUsage(b.units[0]).slots.find(s=>s.id===destination).entry.weapon,1805);assert.equal(b.units[0].ap,96);
});
test('dragging tools preserves identity, and pocket-only rearrangement remains free',()=>{
 let b=field({inventory:{key:{kind:'tool',toolKey:'key',keyId:'gate',instanceId:'key1',count:1,weight:.2,condition:57}}});b=move(b,pocket(b,'inventory:key'),'hand:left');b=move(b,'hand:left','large-4');assert.equal(b.units[0].inventory.key.instanceId,'key1');assert.equal(b.units[0].inventory.key.condition,57);const ap=b.units[0].ap;b=move(b,'large-4','large-3');assert.equal(b.units[0].ap,ap);assert.equal(pocket(b,'inventory:key'),'large-3');
});
test('blocked hands, empty sources, insufficient AP and changed contents reject atomically',()=>{
 let b=field({weapon:1800});reject(b,action(b,pocket(b,'medkits'),'hand:left'));reject(b,action(b,'large-4','hand:right'));
 b=field();b.units[0].ap=3;reject(b,action(b,pocket(b,'medkits'),'hand:left'));
 b=field();const stale=action(b,'hand:right','large-4');b.units[0].loaded=0;reject(b,stale);
 b=field();const changed=action(b,pocket(b,'medkits'),'hand:right');b.units[0].condition=50;reject(b,changed);
});
test('exploration hand moves spend time but no AP',()=>{let b=field({}, {exploration:true,enemies:[]});const elapsed=b.elapsedSeconds;b=move(b,pocket(b,'medkits'),'hand:left');assert.ok(b.elapsedSeconds>elapsed);assert.equal(b.units[0].ap,100);});
test('long guns reject small pockets and full pockets reject stows without losing equipment',()=>{
 let b=field({weapon:1800,medkits:0});reject(b,action(b,'hand:right','small-8'));
 b=field({weapon:0,activeSlot:'medical',medkits:1,ammo:240,priming:0,flints:0,rations:0,boleadoras:0,torches:0});assert.equal(inventoryUsage(b.units[0]).free,0);reject(b,action(b,'hand:right','small-8'));
});
test('a stored fitted gun retains its bayonet, unfinished reload and identity across snapshot load',()=>{
 let b=field({weapon:1800,loaded:0,reloadProgress:.5,weaponInstanceId:'rifle-1',weaponFittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',condition:73,instanceId:'bayonet'}}});b=move(b,'hand:right','large-4');b=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));b=move(b,'large-4','hand:right');assert.equal(b.units[0].loaded,0);assert.equal(b.units[0].weaponInstanceId,'rifle-1');assert.equal(b.units[0].reloadProgress,.5);assert.equal(b.units[0].weaponFittings.bayonet.condition,73);assert.equal(b.units[0].weaponFittings.bayonet.instanceId,'bayonet');
});
