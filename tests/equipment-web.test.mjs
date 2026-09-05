import {marchToFront} from './campaign-test-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign as dispatch,rosterFor,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {EQUIPMENT_CATALOG,refillCost,firearmRepairCost} from '../game/equipment.js';
const order=(s,a)=>{const n=dispatch(marchToFront(s,a),a);assert.equal(n.lastError,null,n.lastError);return n;};
test('all9 firearms and5blades are purchasable canonical equipment',()=>{
 assert.equal(EQUIPMENT_CATALOG.filter(i=>i.category==='firearm').length,9);assert.equal(EQUIPMENT_CATALOG.filter(i=>i.category==='blade').length,5);
 for(const item of EQUIPMENT_CATALOG.filter(i=>i.category!=='artillery')){let s=order(initialCampaign(),{type:'purchaseEquipment',item:item.item});assert.equal(s.armory[item.item],1);assert.equal(s.resources.treasury,3200-item.price);s=order(s,{type:'equip',operativeId:item.category==='blade'&&item.id===1811?4:3,slot:item.category==='blade'?'blade':'weapon',itemId:item.id});assert.equal(s.armory[item.item],0);assert.equal(rosterFor(s).find(o=>o.id===(item.category==='blade'&&item.id===1811?4:3))[item.category==='blade'?'blade':'weapon'],item.id);}
});
test('equipping swaps finite stock without changing historical attributes',()=>{
 let s=order(initialCampaign(),{type:'purchaseEquipment',item:1802});s=order(s,{type:'equip',operativeId:3,slot:'weapon',itemId:1802});assert.equal(s.armory[1809],1);assert.equal(rosterFor(s).find(o=>o.id===3).marksmanship,68);assert.ok(dispatch(s,{type:'equip',operativeId:4,slot:'weapon',itemId:1802}).lastError);s=order(s,{type:'attack',sector:'san_nicolas'});assert.equal(s.pendingBattle.squad.find(o=>o.id===3).weapon,1802);
});
test('all3 artillery can be bought, selected and sent into a real request',()=>{
 for(const type of ['bronze4','field8','swivel']){let s=order(initialCampaign(),{type:'purchaseEquipment',item:type});s=order(s,{type:'configureArtillery',types:[type]});s=order(s,{type:'attack',sector:'san_nicolas'});assert.equal(s.pendingBattle.artillery.length,1);assert.equal(s.pendingBattle.artillery[0].type,type);}
 const s=initialCampaign();assert.ok(dispatch(s,{type:'configureArtillery',types:['field8']}).lastError);
});
test('paid camp replenishment and repair alter the next tactical loadout',()=>{
 let s=initialCampaign();Object.assign(s.operativeState[3],{priming:0,flints:0,rations:0,condition:40});const refill=refillCost(s.operativeState[3]),repair=firearmRepairCost(s.operativeState[3]);s=order(s,{type:'resupply',operativeId:3});s=order(s,{type:'repairWeapon',operativeId:3});assert.equal(s.resources.treasury,3200-refill-repair);assert.ok(dispatch(s,{type:'resupply',operativeId:3}).lastError);s=order(s,{type:'attack',sector:'san_nicolas'});const op=s.pendingBattle.squad.find(o=>o.id===3);assert.equal(op.priming,50);assert.equal(op.flints,4);assert.equal(op.rations,2);assert.equal(op.condition,100);
});
test('armory saves round-trip, legacy migrates and forged slot rejected',()=>{
 let s=order(initialCampaign(),{type:'purchaseEquipment',item:1802});s=order(s,{type:'equip',operativeId:3,slot:'weapon',itemId:1802});assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);const old=initialCampaign();delete old.armory;delete old.loadouts;delete old.artillerySelection;assert.deepEqual(restoreCampaign(JSON.stringify(old)).armory,{});s.loadouts[3].marksmanship=99;assert.throws(()=>restoreCampaign(JSON.stringify(s)));
});
