import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle} from '../game/tactical.js';
import {inventoryUsage,applyItemQuantity,extractItemQuantity,planPocketMove,pocketFingerprint} from '../game/tactical-inventory.js';
import {validatePocketOrder} from '../game/inventory-pockets.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
const pack=()=>({id:'p',inventory:{},ammo:0,priming:0,flints:0,rations:0,medkits:0,torches:0,boleadoras:0});
const rifle=id=>({item:'weapon',weapon:1800,count:1,weight:4,loaded:0,condition:63,jammed:true,reloadProgress:.4,instanceId:id,fittings:{bayonet:{weapon:1811,instanceId:`bayonet-${id}`,fittingPattern:'india_socket',condition:72}}});
const field=()=>createBattle([{...pack(),x:2,y:2}],{width:32,height:8,exploration:true,tiles:Array.from({length:256},(_,i)=>({x:i%32,y:Math.floor(i/32),type:'grass',blocked:false,cover:0})),enemies:[]});
const move=(b,sourceId,destinationId)=>{const layout=inventoryUsage(b.units[0]);return actBattle(b,{type:'movePocket',unitId:'p',sourceId,destinationId,expectedSource:pocketFingerprint(layout.slots.find(p=>p.id===sourceId)),expectedDestination:pocketFingerprint(layout.slots.find(p=>p.id===destinationId))});};

test('every soldier has four large and eight small pockets with physical bulk limits',()=>{
 let u=pack();for(let i=0;i<4;i++)u=applyItemQuantity(u,rifle(`rifle-${i}`));
 u=applyItemQuantity(u,{item:'ammo',count:160});const usage=inventoryUsage(u);
 assert.equal(usage.used,12);assert.equal(usage.free,0);assert.equal(usage.overloaded,false);
 assert.equal(usage.slots.filter(p=>p.size==='large'&&p.entry.kind==='weapon').length,4);
 assert.ok(usage.slots.filter(p=>p.size==='small').every(p=>p.entry.item==='ammo'&&p.entry.count===20));
 const before=structuredClone(u);assert.throws(()=>applyItemQuantity(u,rifle('fifth')));assert.deepEqual(u,before);
 const empty=pack();for(const id of ['p',123,1000])assert.deepEqual(inventoryUsage({...empty,id}).slots,inventoryUsage(empty).slots);
});
test('a fifth large item is rejected even when small pockets remain empty',()=>{
 let u=pack();for(let i=0;i<4;i++)u=applyItemQuantity(u,rifle(`g-${i}`));
 assert.equal(inventoryUsage(u).free,8);assert.throws(()=>applyItemQuantity(u,rifle('g-5')));
 u=applyItemQuantity(u,{item:'weapon',weapon:1805,count:1,weight:1.3,loaded:1,condition:81});assert.equal(inventoryUsage(u).slots.find(p=>p.entry?.item.includes('1805')).size,'small');
});
test('rearranging and swapping pockets preserve exact weapon contents and consume no AP',()=>{
 let b=field();b.units[0]=applyItemQuantity(b.units[0],rifle('fitted'));b.units[0]=applyItemQuantity(b.units[0],{item:'ammo',count:25});
 const before=structuredClone(b.units[0]),layout=inventoryUsage(before),gun=layout.slots.find(p=>p.entry?.kind==='weapon'),ammo=layout.slots.find(p=>p.entry?.item==='ammo');
 b=move(b,gun.id,'large-4');assert.equal(b.lastError,null);assert.deepEqual(b.units[0].inventory,before.inventory);assert.equal(b.units[0].ammo,25);assert.equal(b.units[0].ap,before.ap);
 const relocated=inventoryUsage(b.units[0]).slots.find(p=>p.id==='large-4');assert.equal(relocated.entry.item,gun.entry.item);
 b=move(b,ammo.id,'large-2');assert.equal(b.lastError,null);b=move(b,'large-2','large-4');assert.equal(b.lastError,null);
 assert.equal(inventoryUsage(b.units[0]).slots.find(p=>p.id==='large-2').entry.item,gun.entry.item);
 assert.deepEqual(b.units[0].inventory,before.inventory);assert.doesNotThrow(()=>validateBattleSnapshot(b));
});
test('large-to-small moves and stale contents reject atomically',()=>{
 let b=field();b.units[0]=applyItemQuantity(b.units[0],rifle('g'));const before=structuredClone(b),layout=inventoryUsage(b.units[0]),gun=layout.slots.find(p=>p.entry);
 const no=move(b,gun.id,'small-1');assert.ok(no.lastError);assert.deepEqual(no.units,before.units);assert.equal(no.elapsedSeconds,before.elapsedSeconds);
 b.units[0]=applyItemQuantity(b.units[0],{item:'ammo',count:20});const changed=actBattle(b,{type:'movePocket',unitId:'p',sourceId:gun.id,destinationId:'small-1',expectedSource:pocketFingerprint(gun),expectedDestination:'null'});
 assert.ok(changed.lastError);assert.deepEqual(changed.units,b.units);
});
test('stale placement hints cannot create or hide items after supplies are spent or received',()=>{
 let u=applyItemQuantity(pack(),{item:'ammo',count:25});u=planPocketMove(u,'small-1','large-4');
 u=extractItemQuantity(u,'ammo',25).unit;assert.ok(inventoryUsage(u).slots.every(p=>!p.entry));
 u=applyItemQuantity(u,rifle('new'));assert.equal(inventoryUsage(u).slots.filter(p=>p.entry).length,1);assert.equal(inventoryUsage(u).overflow.length,0);
 u=applyItemQuantity(u,{item:'ammo',count:7});assert.equal(inventoryUsage(u).slots.filter(p=>p.entry?.item==='ammo').reduce((n,p)=>n+p.entry.count,0),7);
});
test('oversized legacy stacks are bounded and remain recoverable without losing quantities',()=>{
 const u={...pack(),ammo:1000000},layout=inventoryUsage(u);assert.equal(layout.slots.length,12);assert.equal(layout.slots.reduce((n,p)=>n+(p.entry?.count??0),0)+layout.overflow.reduce((n,e)=>n+e.count,0),1000000);assert.equal(layout.overloaded,true);
 const reduced=extractItemQuantity(u,'ammo',999980).unit;assert.equal(inventoryUsage(reduced).overloaded,false);assert.equal(reduced.ammo,20);
});
test('placement validators reject duplicates and corrupt coordinates',()=>{
 const entry={slotId:'large-1',item:'ammo',index:0};for(const value of [null,{},[entry,entry],[{...entry,index:-1}],[{...entry,slotId:'unknown'}],[{...entry,item:'<script>'}]])assert.throws(()=>validatePocketOrder(value));
 assert.doesNotThrow(()=>validatePocketOrder([entry]));const b=field();b.units[0].pocketOrder=[entry,entry];assert.throws(()=>validateBattleSnapshot(b));
});
test('physical pocket choices survive an actual campaign return, save and redeployment',()=>{
 let c=dispatchCampaign(initialCampaign(),{type:'visitSector'});assert.equal(c.lastError,null);let b=enterSector(c.pendingBattle);const u=b.units[0],source=inventoryUsage(u).slots.find(p=>p.entry);assert.ok(source);
 b=actBattle(b,{type:'movePocket',unitId:u.id,sourceId:source.id,destinationId:'large-4'});assert.equal(b.lastError,null);const placement=structuredClone(b.units[0].pocketOrder);
 c=dispatchCampaign(c,{type:'leaveSector',battleId:c.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.equal(c.lastError,null);assert.deepEqual(c.operativeState[Number(u.id)].pocketOrder,placement);
 c=decodeSave(encodeSave(c)).campaign;c=dispatchCampaign(c,{type:'visitSector'});b=enterSector(c.pendingBattle,c.sectorStates[c.location]);assert.deepEqual(b.units.find(v=>v.id===u.id).pocketOrder,placement);
 const publicView=playerKnownBattle(b);assert.deepEqual(publicView.units.find(v=>v.id===u.id).pocketOrder,placement);
 const saved=decodeSave(encodeSave(c,b));assert.deepEqual(saved.battle,b);
});
