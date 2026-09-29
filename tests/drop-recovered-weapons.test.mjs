import test from 'node:test';import assert from 'node:assert/strict';
import {actBattle,createBattle,carriedWeight} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {contentWeaponOf,weaponRecord} from '../game/weapon-definition.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {order,saved} from './local-contract-fixture.mjs';
import {secondaryLootField,secondaryOrder} from './secondary-loot-fixture.mjs';
const actor=p=>p.battle.units.find(u=>u.id==='110');
const take=(p,item='blade')=>secondaryOrder(p,{type:'loot',targetId:p.target,item});
const count=b=>b.units.reduce((n,u)=>n+Object.values(u.inventory).reduce((m,r)=>m+(r.weapon?r.count:0),0),0)+b.droppedWeapons.filter(d=>!d.taken).length;

test('a recovered authored blade can be left at the soldiers feet, saved, revisited and equipped without replacing its source',()=>{
 let p=take(secondaryLootField()),key=Object.keys(actor(p).inventory).find(k=>k.startsWith('blade:')),record=structuredClone(actor(p).inventory[key]),weight=carriedWeight(actor(p)),ap=actor(p).ap;
 p=secondaryOrder(p,{type:'drop',inventoryKey:key});assert.equal(actor(p).ap,ap-4);assert.equal(actor(p).inventory[key],undefined);assert.equal(carriedWeight(actor(p)),weight-record.weight);
 const drop=p.battle.droppedWeapons.at(-1);assert.deepEqual({x:drop.x,y:drop.y},{x:actor(p).x,y:actor(p).y});assert.deepEqual(weaponRecord(drop),record);assert.equal(p.battle.units.find(u=>u.id===p.target).blade,0);assert.equal(drop.taken,undefined);
 const repeat=actBattle(p.battle,{type:'drop',unitId:'110',inventoryKey:key});assert.ok(repeat.lastError);assert.deepEqual(repeat.units,p.battle.units);assert.deepEqual(repeat.droppedWeapons,p.battle.droppedWeapons);p={...saved(p),target:p.target};
 let s=order(p.campaign,{type:'battleResult',battleId:p.campaign.pendingBattle.id,outcome:'retreat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});s=order(saved({campaign:s}).campaign,{type:'attack',sector:'buenos_aires'});p={campaign:s,battle:enterSector(s.pendingBattle,s.sectorStates.buenos_aires),target:p.target};assert.equal(p.battle.droppedWeapons.length,1);assert.equal(p.battle.droppedWeapons[0].taken,undefined);
 p=secondaryOrder(p,{type:'loot',dropIndex:0});assert.equal(p.battle.droppedWeapons[0].taken,true);key=Object.keys(actor(p).inventory).find(k=>contentWeaponOf(actor(p).inventory[k])?.id==='blade-1809');assert.deepEqual(actor(p).inventory[key],record);p=secondaryOrder(p,{type:'equipLoot',inventoryKey:key,slot:'blade'});assert.equal(contentWeaponOf(actor(p),'blade').id,'blade-1809');assert.equal(p.battle.units.find(u=>u.id===p.target).blade,0);assert.ok(saved(p));
});

test('drop and collection retain an actual recovered firearm with declared wear, jam and unfinished loading through full saves',()=>{
 let p=take(secondaryLootField(),'weapon'),key=Object.keys(actor(p).inventory).find(k=>k.startsWith('weapon:'));
 // Prepared mechanism boundary on an actually recovered, pinned gun. No new
 // shots or unearned field work are claimed by these declared values.
 Object.assign(actor(p).inventory[key],{loaded:0,reloadProgress:.4,condition:37,jammed:true});p={...saved(p),target:p.target};const record=structuredClone(actor(p).inventory[key]);
 p=secondaryOrder(p,{type:'drop',inventoryKey:key});p={...saved(p),target:p.target};assert.deepEqual(weaponRecord(p.battle.droppedWeapons[0]),record);p=secondaryOrder(p,{type:'loot',dropIndex:0});key=Object.keys(actor(p).inventory).find(k=>k.includes('drop0'));assert.deepEqual(actor(p).inventory[key],record);p=secondaryOrder(p,{type:'equipLoot',inventoryKey:key});assert.equal(actor(p).condition,37);assert.equal(actor(p).jammed,true);assert.equal(actor(p).reloadProgress,.4);assert.equal(actor(p).loaded,0);assert.ok(saved(p));
});

test('one drop extracts one stored piece, preserves its weight and loaded rounds, and exploration advances once',()=>{
 let b=createBattle([{id:110,x:1,y:1,inventory:{pair:{count:2,weight:2.3,weapon:1808,loaded:1,condition:57,jammed:false}}}],{width:8,height:8,enemies:[],exploration:true});const elapsed=b.elapsedSeconds,pieces=count(b);
 b=actBattle(b,{type:'drop',unitId:'110',inventoryKey:'pair'});assert.equal(b.lastError,null);assert.equal(b.elapsedSeconds,elapsed+1);assert.equal(b.units[0].inventory.pair.count,1);assert.equal(b.droppedWeapons[0].weight,2.3);assert.equal(count(b),pieces);
 b=actBattle(b,{type:'loot',unitId:'110',dropIndex:0});assert.equal(b.lastError,null);const recovered=Object.values(b.units[0].inventory).filter(r=>r.weapon===1808);assert.equal(recovered.length,2);assert.ok(recovered.every(r=>r.loaded===1&&r.weight===2.3&&r.condition===57));assert.equal(count(b),pieces);assert.ok(validateBattleSnapshot(b));
});

test('dropping rejects an unavailable item, malformed mechanism, full field collection, enemy control or insufficient AP without changing custody',()=>{
 const fixture=()=>createBattle([{id:110,x:1,y:1,inventory:{gear:{count:1,weight:4,weapon:1800,loaded:1,condition:63,jammed:false}}}],{width:8,height:8,enemies:[{id:'enemy',x:7,y:7,patrol:false}]});
 for(const [change,action]of [
  [()=>{},{inventoryKey:'absent'}],
  [b=>b.units[0].inventory.gear.weapon=1820,{}],
  [b=>b.units[0].inventory.gear.count=0,{}],
  [b=>b.units[0].inventory.gear.weight=-1,{}],
  [b=>b.units[0].inventory.gear.loaded=2,{}],
  [b=>b.units[0].ap=3,{}],
  [b=>b.droppedWeapons=Array.from({length:2000},()=>({weapon:1800,weight:4,count:1,loaded:0,condition:100,jammed:false,x:1,y:1,taken:true})),{}],
  [()=>{},{unitId:'enemy'}],
 ]){const b=fixture();change(b);const n=actBattle(b,{type:'drop',unitId:'110',inventoryKey:'gear',...action});assert.ok(n.lastError);assert.deepEqual(n.units,b.units);assert.deepEqual(n.droppedWeapons,b.droppedWeapons);}
});

test('saved dropped weapons reject false quantities and weights while older omitted fields remain compatible',()=>{
 let p=take(secondaryLootField());const key=Object.keys(actor(p).inventory).find(k=>k.startsWith('blade:'));p=secondaryOrder(p,{type:'drop',inventoryKey:key});const wire=JSON.parse(encodeSave(p.campaign,p.battle));
 for(const change of [d=>d.count=2,d=>d.weight=-1,d=>d.weight=10001]){const bad=structuredClone(wire);change(bad.battle.droppedWeapons[0]);assert.throws(()=>decodeSave(JSON.stringify(bad)));}
 const legacy=structuredClone(p.battle);delete legacy.droppedWeapons[0].contentWeapon;delete legacy.droppedWeapons[0].weight;delete legacy.droppedWeapons[0].count;assert.ok(validateBattleSnapshot(legacy));
});


test('collecting the same local drop index in a later field retains the weapon carried from the previous field',()=>{
 // Each field numbers ground entries locally; the carried inventory crosses
 // sector boundaries. This prepared collision models that legitimate overlap.
 const previous={count:1,weight:2.3,weapon:1808,loaded:1,condition:57,jammed:false},current={count:1,weight:4,weapon:1808,loaded:0,condition:23,jammed:true};
 let b=createBattle([{id:110,x:1,y:1,inventory:{'weapon:1808:drop0':previous}}],{width:8,height:8,enemies:[],exploration:true});b.droppedWeapons.push({...current,x:1,y:1});const pieces=count(b);
 b=actBattle(b,{type:'loot',unitId:'110',dropIndex:0});assert.equal(b.lastError,null);assert.deepEqual(b.units[0].inventory['weapon:1808:drop0'],previous);assert.deepEqual(b.units[0].inventory['weapon:1808:drop0:1'],current);assert.equal(count(b),pieces);assert.equal(b.droppedWeapons[0].taken,true);assert.ok(validateBattleSnapshot(b));
});
