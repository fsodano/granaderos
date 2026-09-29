import test from 'node:test';import assert from 'node:assert/strict';
import {actBattle,createBattle,carriedWeight,weaponFor} from '../game/tactical.js';
import {weaponRecord} from '../game/weapon-definition.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {enterSector} from '../game/world.js';
import {cartridgePrice} from '../game/campaign-rules.js';
import {order,saved} from './local-contract-fixture.mjs';
import {secondaryLootField,secondaryOrder} from './secondary-loot-fixture.mjs';
const actor=p=>p.battle.units.find(u=>u.id==='110');
const stored=b=>b.units.reduce((sum,u)=>sum+(u.weapon&&!u.weaponDropped?1:0)+(u.blade?1:0)+Object.values(u.inventory).reduce((n,r)=>n+(r.weapon?r.count:0),0),0)+b.droppedWeapons.filter(d=>!d.taken).length;

const rounds=b=>b.units.reduce((sum,u)=>sum+(u.ammo||0)+(u.loaded||0)+Object.values(u.inventory).reduce((n,r)=>n+(r.count||0)*(r.loaded||0),0),0)+b.droppedWeapons.filter(d=>!d.taken).reduce((sum,d)=>sum+(d.loaded||0),0);

test('dropping an actual issued loaded primary preserves the selected secondary and returns the same gun after campaign reentry',()=>{
 let p=secondaryLootField(),u=actor(p),record=weaponRecord(u),count=stored(p.battle),weight=carriedWeight(u),charges=rounds(p.battle),ap=u.ap,ammo=u.ammo;
 p=secondaryOrder(p,{type:'drop',slot:'primary'});u=actor(p);assert.equal(u.weaponDropped,true);assert.equal(u.loaded,0);assert.equal(u.ammo,ammo);assert.equal(u.activeSlot,'blade');assert.equal(u.ap,ap-4);assert.ok(Math.abs(carriedWeight(u)-(weight-record.weight-record.loaded*.04))<1e-9);assert.deepEqual(weaponRecord(p.battle.droppedWeapons[0]),record);assert.equal(stored(p.battle),count);assert.equal(rounds(p.battle),charges);p={...saved(p),target:p.target};
 const treasury=p.campaign.resources.treasury;let c=order(p.campaign,{type:'battleResult',battleId:p.campaign.pendingBattle.id,outcome:'retreat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});assert.equal(c.resources.treasury,treasury+ammo*cartridgePrice(c));c=order(saved({campaign:c}).campaign,{type:'attack',sector:'buenos_aires'});assert.equal(c.pendingBattle.issuedCartridges,0);p={campaign:c,battle:enterSector(c.pendingBattle,c.sectorStates.buenos_aires)};assert.equal(actor(p).weapon,0);assert.equal(actor(p).ammo,0);assert.equal(p.battle.droppedWeapons[0].loaded,record.loaded);
 // Campaign settlement refunds loose rounds; the ground weapon retains its loaded charge.
 const returnedWeight=weight-ammo*.04,returnedCharges=charges-ammo;
 p=secondaryOrder(p,{type:'loot',dropIndex:0});const key=Object.keys(actor(p).inventory).find(k=>k.includes('drop0'));assert.deepEqual(actor(p).inventory[key],record);assert.ok(Math.abs(carriedWeight(actor(p))-returnedWeight)<1e-9);assert.equal(rounds(p.battle),returnedCharges);p=secondaryOrder(p,{type:'equipLoot',inventoryKey:key});assert.equal(actor(p).weapon,record.weapon);assert.equal(actor(p).loaded,record.loaded);assert.equal(actor(p).weaponDropped,false);assert.equal(stored(p.battle),count);assert.equal(rounds(p.battle),returnedCharges);assert.ok(Math.abs(carriedWeight(actor(p))-returnedWeight)<1e-9);assert.ok(saved(p));
});
test('a selected authored secondary leaves an empty hand and keeps its independent definition and wear on the field',()=>{
 let p=secondaryLootField();actor(p).bladeCondition=37;actor(p).braced=true;p={...saved(p),target:p.target};const record=weaponRecord(actor(p),'blade'),gun=weaponRecord(actor(p)),count=stored(p.battle);
 p=secondaryOrder(p,{type:'drop',slot:'blade'});assert.equal(actor(p).blade,0);assert.equal(actor(p).bladeMetadata,undefined);assert.equal(actor(p).bladeCondition,undefined);assert.equal(actor(p).activeSlot,'unarmed');assert.equal(actor(p).braced,false);assert.equal(weaponFor(actor(p)).id,0);assert.deepEqual(weaponRecord(actor(p)),gun);assert.deepEqual(weaponRecord(p.battle.droppedWeapons[0]),record);assert.equal(stored(p.battle),count);assert.ok(saved(p));
 p=secondaryOrder(p,{type:'loot',dropIndex:0});const key=Object.keys(actor(p).inventory).find(k=>k.includes('drop0'));p=secondaryOrder(p,{type:'equipLoot',inventoryKey:key,slot:'blade'});assert.equal(actor(p).bladeCondition,37);assert.deepEqual(weaponRecord(actor(p),'blade'),record);assert.equal(stored(p.battle),count);
});
test('declared unfinished work, jam and wear follow a dropped primary through full save, pickup and equip',()=>{
 let p=secondaryLootField();Object.assign(actor(p),{activeSlot:'primary',loaded:0,reloadProgress:.4,condition:37,jammed:true,weaponReady:true});p={...saved(p),target:p.target};const record=weaponRecord(actor(p));p=secondaryOrder(p,{type:'drop',slot:'primary'});assert.equal(actor(p).activeSlot,'unarmed');assert.equal(actor(p).weaponReady,undefined);assert.equal(actor(p).reloadProgress,undefined);p={...saved(p),target:p.target};assert.deepEqual(weaponRecord(p.battle.droppedWeapons[0]),record);
 p=secondaryOrder(p,{type:'loot',dropIndex:0});p=secondaryOrder(p,{type:'equipLoot',inventoryKey:Object.keys(actor(p).inventory).find(k=>k.includes('drop0'))});assert.deepEqual(weaponRecord(actor(p)),record);assert.ok(saved(p));
});
test('a legacy secondary has actual carried weight that moves once to the ground in one exploration second',()=>{
 let b=createBattle([{id:'p',weapon:0,blade:1809,activeSlot:'blade',ammo:0,loaded:0}],{width:8,height:8,enemies:[],exploration:true});b.units[0].ap=0;const weight=carriedWeight(b.units[0]),start=b.elapsedSeconds;assert.equal(weight,1.3);
 b=actBattle(b,{type:'drop',unitId:'p',slot:'blade'});assert.equal(b.lastError,null);assert.equal(b.units[0].ap,0);assert.equal(b.elapsedSeconds,start+1);assert.equal(carriedWeight(b.units[0]),0);assert.equal(b.droppedWeapons[0].weight,weight);assert.equal(b.units[0].activeSlot,'unarmed');assert.ok(validateBattleSnapshot(b));
});
test('unavailable or ambiguous held sources, missing AP and repeated orders preserve custody',()=>{
 const fixture=()=>createBattle([{id:'p',x:1,y:1,weapon:1800,blade:1809,inventory:{spare:{count:1,weight:4,weapon:1800,loaded:0}}}],{width:8,height:8,enemies:[{id:'e',x:7,y:7,patrol:false}]});
 for(const [change,action]of [[()=>{},{slot:'unarmed'}],[()=>{},{slot:'unknown'}],[()=>{},{slot:'primary',inventoryKey:'spare'}],[b=>b.units[0].blade=0,{slot:'blade'}],[b=>{b.units[0].weaponDropped=true;b.units[0].loaded=0;},{slot:'primary'}],[b=>b.units[0].ap=3,{slot:'primary'}],[()=>{},{unitId:'e',slot:'primary'}]]){const b=fixture();change(b);const n=actBattle(b,{type:'drop',unitId:'p',...action});assert.ok(n.lastError);assert.deepEqual(n.units,b.units);assert.deepEqual(n.droppedWeapons,b.droppedWeapons);}
 for(const slot of ['primary','blade']){const b=actBattle(fixture(),{type:'drop',unitId:'p',slot}),n=actBattle(b,{type:'drop',unitId:'p',slot});assert.equal(b.lastError,null);assert.ok(n.lastError);assert.deepEqual(n.units,b.units);assert.deepEqual(n.droppedWeapons,b.droppedWeapons);}
});
