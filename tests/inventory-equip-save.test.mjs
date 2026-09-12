import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle} from '../game/tactical.js';
import {inventoryUsage} from '../game/tactical-inventory.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const field=()=>createBattle([{id:'p',x:1,y:1,weapon:1800,blade:1810}],{width:20,height:8,tiles:Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:18,y:6}],seed:45});

test('a swap cannot overfill the backpack with the displaced long gun',()=>{
 const s=field();Object.assign(s.units[0],{ammo:20,inventory:{...Object.fromEntries(Array.from({length:4},(_,i)=>[`long-${i}`,{weapon:1800,count:1,weight:4,loaded:0}])),pistol:{count:1,weight:1.3,weapon:1805,loaded:1,condition:58}}});
 assert.equal(inventoryUsage(s.units[0]).used,12);
 const n=actBattle(s,{type:'equipLoot',unitId:'p',inventoryKey:'pistol'});assert.ok(n.lastError);assert.deepEqual(n.units,s.units);assert.equal(n.elapsedSeconds,s.elapsedSeconds);
});
test('an equipped recovered blade keeps its condition through a later drop and pickup',()=>{
 let s=field();s.units[0].inventory.sabre={count:1,weight:1.3,weapon:1809,condition:37,loaded:0};
 s=actBattle(s,{type:'equipLoot',unitId:'p',inventoryKey:'sabre',slot:'blade'});assert.equal(s.lastError,null);assert.equal(s.units[0].bladeCondition,37);
 s=actBattle(s,{type:'drop',unitId:'p',item:'blade'});assert.equal(s.lastError,null);assert.equal(s.units[0].activeSlot,'unarmed');assert.equal(s.groundItems[0].condition,37);
 s=actBattle(s,{type:'loot',unitId:'p',groundId:s.groundItems[0].id});assert.equal(s.lastError,null);assert.equal(Object.values(s.units[0].inventory).find(r=>r.weapon===1809).condition,37);
 assert.doesNotThrow(()=>validateBattleSnapshot(s));
});
test('ground equipment and its exact identity round-trip; malformed payloads do not',()=>{
 let s=field();Object.assign(s.units[0],{weaponInstanceId:'musket-1',condition:41,jammed:true});
 s=actBattle(s,{type:'drop',unitId:'p',item:'primary'});assert.equal(s.lastError,null);assert.equal(s.groundItems[0].loaded,1);assert.equal(s.groundItems[0].jammed,true);assert.equal(s.groundItems[0].instanceId,'musket-1');
 const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(s)));assert.deepEqual(restored.groundItems,s.groundItems);
 for(const change of [g=>g.loaded=2,g=>g.count=-1,g=>g.item='ammo',g=>g.jammed='yes']){const bad=structuredClone(s);change(bad.groundItems[0]);assert.throws(()=>validateBattleSnapshot(bad));}
 const duplicate=structuredClone(s);duplicate.units[0].inventory.copy={count:1,weight:4,weapon:1800,loaded:1,condition:41,instanceId:'musket-1'};assert.throws(()=>validateBattleSnapshot(duplicate));
 const picked=actBattle(restored,{type:'loot',unitId:'p',groundId:s.groundItems[0].id});assert.equal(picked.lastError,null);assert.doesNotThrow(()=>validateBattleSnapshot(picked));
});
