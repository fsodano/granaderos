import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {rosterFor,serializeCampaign,restoreCampaign} from '../game/campaign.js';
import {repairRate} from '../game/assignments.js';
import {repairMaterialPoints} from '../game/repair-materials.js';
import {spendRepairMaterials} from '../game/equipment-repair.js';
import {applyItemQuantity,inventoryUsage} from '../game/tactical-inventory.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {order,saved} from './local-contract-fixture.mjs';

const kit=points=>({item:'inventory:repair-kit:fixture',kind:'repair-kit',name:'Juego de herramientas',count:1,weight:2,repairPoints:points,instanceId:'finite-repair-kit'});
const worker=s=>s.operativeState[10];

test('actual repair consumes a finite large-pocket toolkit, saves its remainder and stops when it is empty',()=>{
 let s=initialCampaign();s.operativeState[4].condition=80;
 // This isolated repair scenario owns one partially used physical kit.
 Object.assign(worker(s),applyItemQuantity(worker(s),kit(10)));
 const rate=repairRate(rosterFor(s).find(op=>op.id===10)),cash=s.resources.treasury,usage=inventoryUsage(worker(s)).used;
 s=order(s,{type:'assignWork',operativeId:10,assignment:'repair',targetId:4});
 s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[4].condition,80+rate);assert.equal(repairMaterialPoints(worker(s)),10-rate);assert.equal(inventoryUsage(worker(s)).used,usage);
 s=saved({campaign:s}).campaign;assert.equal(repairMaterialPoints(worker(s)),10-rate);
 const resumed=order(s,{type:'wait',hours:8}),replayed=order(restoreCampaign(serializeCampaign(s)),{type:'wait',hours:8});assert.deepEqual(resumed,replayed);s=resumed;
 assert.equal(s.hour,2);assert.equal(s.operativeState[4].condition,90);assert.equal(repairMaterialPoints(worker(s)),0);assert.equal(inventoryUsage(worker(s)).used,usage-1);
 assert.equal(s.assignmentAttention.notice.events[0].code,'no_tools');assert.equal(s.resources.treasury,cash);
 const records=structuredClone(s.operativeState);s=order(s,{type:'wait',hours:1});assert.deepEqual(s.operativeState,records);
 assert.ok(rosterFor(s).find(op=>op.id===10));
});

test('a real body transfers the same toolkit once and finite spending clears depleted held references',()=>{
 let b=createBattle([{id:'p',x:1,y:1}],{width:8,height:8,enemies:[{id:'body',x:2,y:1,hp:0,inventory:{kit:kit(17)}},{id:'guard',x:7,y:7,patrol:false}]});
 b=actBattle(b,{type:'loot',unitId:'p',targetId:'body',item:'inventory:kit',count:1});assert.equal(b.lastError,null);
 const actor=b.units.find(u=>u.id==='p'),body=b.units.find(u=>u.id==='body');assert.equal(repairMaterialPoints(actor),17);assert.equal(repairMaterialPoints(body),0);
 b=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));const before=structuredClone(b),bad=actBattle(b,{type:'loot',unitId:'p',targetId:'body',item:'inventory:kit',count:1});assert.ok(bad.lastError);assert.deepEqual(bad.units,before.units);
 const record=b.units.find(u=>u.id==='p'),key=Object.keys(record.inventory).find(key=>record.inventory[key].kind==='repair-kit');record.leftHandItem=`inventory:${key}`;record.toolkitPoints=3;
 spendRepairMaterials(record,4);assert.equal(record.toolkitPoints,0);assert.equal(record.inventory[key].repairPoints,16);
 const untouched=structuredClone(record);assert.throws(()=>spendRepairMaterials(record,17));assert.deepEqual(record,untouched);
 spendRepairMaterials(record,16);assert.equal(repairMaterialPoints(record),0);assert.ok(!record.leftHandItem);assert.ok(!record.inventory[key]);assert.doesNotThrow(()=>validateBattleSnapshot(b));
});

test('saved carried toolkits reject duplicated units, excessive points and disguised non-toolkit reserves',()=>{
 const s=initialCampaign();Object.assign(worker(s),applyItemQuantity(worker(s),kit(17)));assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
 const key=Object.keys(worker(s).inventory).find(key=>worker(s).inventory[key].kind==='repair-kit');
 for(const patch of [{repairPoints:101},{repairPoints:0},{repairPoints:1.5},{count:2},{weight:0},{kind:'inventory'}]){
  const bad=structuredClone(s);Object.assign(worker(bad).inventory[key],patch);assert.throws(()=>restoreCampaign(serializeCampaign(bad)),JSON.stringify(patch));
 }
});

test('a physical toolkit cannot be disguised as light medical or other scalar supplies during transfer',()=>{
 const actor=createBattle([{id:'carrier'}],{exploration:true,enemies:[]}).units[0];
 for(const item of ['medkits','ammo','rations','torches']){const forged={...kit(17),item};delete forged.instanceId;const before=structuredClone(actor);assert.throws(()=>applyItemQuantity(actor,forged),/herramientas|munición/);assert.deepEqual(actor,before);}
});
