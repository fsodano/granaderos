import {equipmentKey} from '../game/equipment-catalog.js';
import {marchToFront} from './campaign-test-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign as dispatch,rosterFor,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {EQUIPMENT_CATALOG} from '../game/equipment.js';
import {withStoredGear,assertTradeRejected} from './commerce-gear-fixture.mjs';
const order=(s,a)=>{const n=dispatch(marchToFront(s,a),a);assert.equal(n.lastError,null,n.lastError);return n;};
test('all9 firearms and5blade models plus the matched bayonet variant equip from declared finite owned stock',()=>{
 assert.equal(EQUIPMENT_CATALOG.filter(i=>i.category==='firearm').length,9);assert.equal(new Set(EQUIPMENT_CATALOG.filter(i=>i.category==='blade').map(i=>i.item)).size,5);assert.equal(EQUIPMENT_CATALOG.filter(i=>i.fittingPattern==='india_socket').length,1);
 for(const item of EQUIPMENT_CATALOG.filter(i=>i.category!=='artillery')){let s=withStoredGear(initialCampaign(),item.stockKey??item.item);const key=String(item.stockKey??item.item),instance=s.armoryItems.find(i=>String(equipmentKey(i))===key);assert.equal(s.armory[key],1);assert.ok(instance);s=order(s,{type:'equip',operativeId:item.category==='blade'&&item.id===1811?4:3,slot:item.category==='blade'?'blade':'weapon',itemId:key,instanceId:instance.id});assert.equal(s.armory[key],0);assert.equal(rosterFor(s).find(o=>o.id===(item.category==='blade'&&item.id===1811?4:3))[item.category==='blade'?'blade':'weapon'],item.id);}
});
test('equipping swaps finite stock without changing historical attributes',()=>{
 let s=withStoredGear(initialCampaign(),1802);s=order(s,{type:'equip',operativeId:3,slot:'weapon',itemId:1802});assert.equal(s.armory[1809],1);assert.equal(rosterFor(s).find(o=>o.id===3).marksmanship,68);assert.ok(dispatch(s,{type:'equip',operativeId:4,slot:'weapon',itemId:1802}).lastError);s=order(s,{type:'attack',sector:'san_nicolas'});assert.equal(s.pendingBattle.squad.find(o=>o.id===3).weapon,1802);
});
test('all3 owned artillery can be selected and sent into a real request without a purchase',()=>{
 for(const type of ['bronze4','field8','swivel']){let s=withStoredGear(initialCampaign(),type);s=order(s,{type:'configureArtillery',types:[type]});s=order(s,{type:'attack',sector:'san_nicolas'});assert.equal(s.pendingBattle.artillery.length,1);assert.equal(s.pendingBattle.artillery[0].type,type);}
 const s=initialCampaign();assert.ok(dispatch(s,{type:'configureArtillery',types:['field8']}).lastError);
});
test('paid replenishment and instant weapon repair reject without changing finite carried equipment',()=>{
 let state=initialCampaign();Object.assign(state.operativeState[3],{rations:0,medkits:0,toolkits:2,condition:40});
 for(const action of [{type:'resupply',operativeId:3},{type:'repairWeapon',operativeId:3},{type:'purchaseMedicalSupplies',operativeId:3,quantity:1},{type:'purchaseToolkits',operativeId:3,quantity:1}])assertTradeRejected(state,action);
 state=order(state,{type:'attack',sector:'san_nicolas'});const unit=state.pendingBattle.squad.find(unit=>unit.id===3);assert.equal(unit.rations,0);assert.equal(unit.medkits,0);assert.equal(unit.toolkits,2);assert.equal(unit.condition,40);
});

test('armory saves round-trip, legacy migrates and forged slot rejected',()=>{
 let s=withStoredGear(initialCampaign(),1802);s=order(s,{type:'equip',operativeId:3,slot:'weapon',itemId:1802});assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);const old=initialCampaign();delete old.armory;delete old.loadouts;delete old.artillerySelection;assert.deepEqual(restoreCampaign(JSON.stringify(old)).armory,{});s.loadouts[3].marksmanship=99;assert.throws(()=>restoreCampaign(JSON.stringify(s)));
});
