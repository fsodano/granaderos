import {equipmentFingerprint} from '../game/tactical-inventory.js';
import {refreshMilitaryCondition} from '../game/actor-condition.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {personalPockets,supplyRoom,inventoryRoom,pocketItems} from '../game/personal-pockets.js';
import {actBattle,createBattle,weaponTransferPreview,supplyTransferPreview} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {dispatchCampaign,deploymentCost} from '../game/campaign.js';
import {supplyCareField} from './supply-transfer-fixture.mjs';
import {saved,tactical,leave,visit} from './local-contract-fixture.mjs';
const empty={ammo:0,rations:0,torches:0,medkits:0,boleadoras:0};
const rifle={weapon:1800,count:1,weight:4,loaded:1,condition:63,jammed:true};
const knife={weapon:1813,count:1,weight:1.3,loaded:0,condition:71};
function field(){return createBattle([{id:'a',x:1,y:1,weapon:1800,blade:1813,...empty},{id:'b',x:2,y:1,weapon:1800,blade:0,...empty}],{width:8,height:8,enemies:[{id:'e',x:7,y:7,patrol:false}]});}
const order=(b,a)=>actBattle(b,{unitId:'a',...a});
function full(u){u.inventory=Object.fromEntries([...Array.from({length:4},(_,i)=>[`long-${i}`,structuredClone(rifle)]),...Array.from({length:7},(_,i)=>[`small-${i}`,structuredClone(knife)])]);}
const physical=b=>({units:b.units,ground:b.groundItems,drops:b.droppedWeapons,seconds:b.elapsedSeconds,seed:b.seed});

test('supplies, recovered weapons and the unused loadout weapon share exactly four large and eight small pockets',()=>{
 const b=field(),u=b.units[0];full(u);const layout=personalPockets(u);
 assert.equal(layout.slots.length,12);assert.equal(layout.slots.filter(p=>p.size==='large'&&p.entry.weapon===1800).length,4);assert.equal(layout.slots.filter(p=>p.size==='small'&&p.entry).length,8);assert.deepEqual(layout.overflow,[]);
 assert.equal(supplyRoom(u,'medkits',1),0);assert.equal(inventoryRoom(u,'extra',rifle),0);assert.equal(pocketItems(u).filter(i=>i.item==='blade').length,1);
 const n=order(b,{type:'weapon',slot:'unarmed'});assert.match(n.lastError,/bolsillo|espacio/);assert.deepEqual(physical(n),physical(b));
});
test('a blade switch refuses to hide the rifle when all large pockets are occupied; dropping one permits it',()=>{
 let b=field();full(b.units[0]);assert.match(order(b,{type:'weapon',slot:'blade'}).lastError,/bolsillo|espacio/);
 b=order(b,{type:'drop',inventoryKey:'long-0'});assert.equal(b.lastError,null);b=order(b,{type:'weapon',slot:'blade'});assert.equal(b.lastError,null);
 assert.equal(personalPockets(b.units[0]).slots.find(p=>p.entry?.item==='primary').size,'large');assert.equal(b.units[0].activeSlot,'blade');
});
test('full recipient previews and actual transfers reject without changing ownership, AP, loads or time',()=>{
 const b=field();b.units[0].medkits=1;b.units[1].blade=1813;full(b.units[1]);
 assert.match(supplyTransferPreview(b,b.units[0],b.units[1],'medkits',1).reason,/bolsillo|espacio/);assert.match(weaponTransferPreview(b,b.units[0],b.units[1],undefined,'primary').reason,/bolsillo|espacio/);
 for(const a of [{type:'transferSupply',targetId:'b',item:'medkits',count:1},{type:'transfer',targetId:'b',slot:'primary'}]){const n=order(b,a);assert.match(n.lastError,/bolsillo|espacio/);assert.deepEqual(physical(n),physical(b));}
});
test('whole ground pickup takes only the remaining stack space; explicit excess and insufficient AP are atomic',()=>{
 const b=field();full(b.units[0]);delete b.units[0].inventory['small-0'];b.units[0].medkits=4;b.groundItems=[{id:'bundle',type:'medkits',count:5,x:1,y:2}];
 const refused=order(b,{type:'loot',groundId:'bundle',count:2});assert.match(refused.lastError,/bolsillo|espacio/);assert.deepEqual(physical(refused),physical(b));
 const n=order(b,{type:'loot',groundId:'bundle'});assert.equal(n.lastError,null);assert.equal(n.units[0].medkits,5);assert.equal(n.groundItems[0].count,4);assert.equal(n.units[0].ap,b.units[0].ap-8);
 const tired=structuredClone(b);tired.units[0].ap=7;const rejected=order(tired,{type:'loot',groundId:'bundle'});assert.match(rejected.lastError,/8 PA/);assert.deepEqual(physical(rejected),physical(tired));
});
test('collect all leaves an unfittable rifle and finite supply remainder on the body instead of losing them',()=>{
 const b=field();full(b.units[0]);delete b.units[0].inventory['small-0'];b.units[0].medkits=4;
 const corpse=b.units[2];Object.assign(corpse,{hp:0,x:1,y:2,...empty,medkits:8,blade:0,inventory:{},weapon:1800,loaded:1});
 refreshMilitaryCondition(corpse);const n=order(b,{type:'loot',targetId:corpse.id});assert.equal(n.lastError,null);assert.equal(n.units[0].medkits,5);assert.equal(n.units[2].medkits,7);assert.equal(n.units[2].weaponDropped,undefined);assert.equal(n.units[2].loaded,1);assert.equal(personalPockets(n.units[0]).overflow.length,0);
});
test('oversized legacy saves preserve every item, permit removal, and cannot collect more into their excess',()=>{
 const b=field();b.units[0].medkits=1000000;const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));assert.equal(restored.units[0].medkits,1000000);const layout=personalPockets(restored.units[0]);assert.equal(layout.slots.reduce((n,p)=>n+(p.entry?.item==='medkits'?p.entry.count:0),0)+layout.overflow.find(i=>i.item==='medkits').count,1000000);
 const n=order(restored,{type:'dropSupply',item:'medkits',count:999995});assert.equal(n.lastError,null);assert.equal(n.units[0].medkits,5);assert.equal(n.groundItems.at(-1).count,999995);assert.equal(personalPockets(n.units[0]).overflow.length,0);
});
test('pocket placement and active hand persist through save, campaign return and re-entry',()=>{
 let p=supplyCareField();const u=p.battle.units.find(u=>u.id==='110'),source=personalPockets(u).slots.find(p=>p.entry?.item==='medkits').id;
 p=tactical(p,{type:'dragEquipment',unitId:'110',sourceId:source,destinationId:'large-4',expectedSource:equipmentFingerprint(u,source),expectedDestination:equipmentFingerprint(u,'large-4')});p=tactical(p,{type:'weapon',unitId:'110',slot:'unarmed'});
 p=saved(p);assert.equal(personalPockets(p.battle.units.find(u=>u.id==='110')).slots.find(p=>p.id==='large-4').entry.item,'medkits');
 p=visit(saved({campaign:leave(p)}).campaign);const after=p.battle.units.find(u=>u.id==='110');assert.equal(after.activeSlot,'unarmed');assert.equal(personalPockets(after).slots.find(p=>p.id==='large-4').entry.item,'medkits');
 const bad=structuredClone(p);bad.battle.units[0].pocketOrder=[{slotId:'small-99',item:'ammo',index:0}];assert.throws(()=>saved(bad));
});
test('campaign medical purchases cannot bypass pockets or charge a rejected purchase, and legacy full packs can enter to unload',()=>{
 let p=supplyCareField(),s=leave(p);const id=110;s.operativeState[id].medkits=100;
 const rejected=dispatchCampaign(s,{type:'purchaseMedicalSupplies',id,quantity:1});assert.match(rejected.lastError,/bolsillo|espacio/);assert.deepEqual(rejected.resources,s.resources);assert.deepEqual(rejected.operativeState,s.operativeState);
 s.operativeState[id].medkits=1000000;const cost=deploymentCost(s),entered=dispatchCampaign(s,{type:'visitSector'});assert.equal(entered.lastError,null);const unit=entered.pendingBattle.squad.find(u=>u.id===id);assert.equal(unit.ammo,s.operativeState[id].ammo);assert.equal(unit.medkits,1000000);assert.equal(s.resources.treasury-entered.resources.treasury,cost);
});

test('an empty body reports no equipment without claiming that the collectors pockets are full',()=>{
 const b=field(),corpse=b.units[2];Object.assign(corpse,{hp:0,ap:0,maxAP:0,overwatch:false,x:1,y:2,...empty,weapon:0,blade:0,inventory:{},loaded:0});
 const n=order(b,{type:'loot',targetId:corpse.id});assert.equal(n.lastError,'No queda equipo que recoger.');assert.deepEqual(physical(n),physical(b));
});
