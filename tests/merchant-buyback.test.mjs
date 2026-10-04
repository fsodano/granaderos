import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign as dispatch,serializeCampaign,restoreCampaign,rosterFor,isSupplied} from '../game/campaign.js';
import {usedEquipmentOffers,usedEquipmentBreakdown,resaleQuote,USED_EQUIPMENT_LIMIT,validateEquipmentOwnership} from '../game/equipment.js';
import {enterSector} from '../game/world.js';
import {withStoredGear,asLegacyMerchantGear,assertTradeRejected} from './commerce-gear-fixture.mjs';
const order=(s,a)=>{const n=dispatch(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const stored=withStoredGear;
const restore=s=>restoreCampaign(serializeCampaign(s));
const physical=s=>({...s,lastError:null});
function stock(){
 let s=stored(initialCampaign(),1803);Object.assign(s.armoryItems[0],{condition:37,jammed:true,instanceId:'worn-carbine'});return s;
}

test('buyback and resale remain closed for exact worn guns without changing money or custody',()=>{
 const state=stock(),item=state.armoryItems[0];assert.equal(usedEquipmentBreakdown(item).total,53);assert.ok(resaleQuote(item)>0);
 assertTradeRejected(state,{type:'sellEquipment',instanceId:item.id});
 const legacy=asLegacyMerchantGear(state,item.id);assert.deepEqual(restore(legacy),legacy);for(let repeat=0;repeat<2;repeat++)assertTradeRejected(legacy,{type:'purchaseUsedEquipment',instanceId:item.id,sector:'retiro'});
});

test('owned fitted weapons retain both component identities and exact conditions through equipping and a real scene',()=>{
 let state=stock();const item=state.armoryItems[0];item.item=1800;item.instanceId='worn-musket';item.condition=50;item.fittings={bayonet:{weapon:1811,condition:25,instanceId:'worn-socket',fittingPattern:'india_socket'}};state.armory[1803]=0;state.armory[1800]=1;
 const exact=structuredClone(item),quote=usedEquipmentBreakdown(item);assert.equal(quote.total,106);assert.deepEqual(quote.items.map(part=>part.price),[96,10]);assertTradeRejected(state,{type:'sellEquipment',instanceId:item.id});
 state=order(restore(state),{type:'equip',operativeId:4,slot:'weapon',itemId:1800,instanceId:item.id});assert.equal(state.operativeState[4].condition,50);assert.equal(state.operativeState[4].jammed,true);assert.equal(state.operativeState[4].weaponFittings.bayonet.instanceId,'worn-socket');
 state=order(restore(state),{type:'visitSector'});const unit=enterSector(state.pendingBattle).units.find(unit=>unit.id==='4');assert.equal(unit.weaponInstanceId,exact.instanceId);assert.equal(unit.condition,50);assert.equal(unit.jammed,true);assert.equal(unit.weaponFittings.bayonet.condition,25);assert.equal(unit.weaponFittings.bayonet.instanceId,'worn-socket');
});

test('duplicate purchase and sale requests cannot replay money or ownership changes',()=>{
 const state=stock(),id=state.armoryItems[0].id;for(let repeat=0;repeat<2;repeat++){assertTradeRejected(state,{type:'sellEquipment',instanceId:id});assertTradeRejected(state,{type:'purchaseUsedEquipment',instanceId:id,sector:state.location});}
});

test('legacy merchant custody survives ordinary time and save loading without restocking or reopening purchases',()=>{
 let state=stock();state=asLegacyMerchantGear(state,state.armoryItems[0].id);const exact=structuredClone(state.merchants);
 state=order(state,{type:'wait',hours:72});assert.deepEqual(state.merchants,exact);assert.deepEqual(restore(state),state);assertTradeRejected(state,{type:'purchaseUsedEquipment',instanceId:state.merchants.retiro.usedItems[0].id,sector:'retiro'});
});

test('unaffordable, remote, hostile and deployed purchases preserve money and stock',()=>{
 let base=stock();const id=base.armoryItems[0].id;base=asLegacyMerchantGear(base,id);
 for(const change of [s=>s.resources.treasury=0,s=>s.sectors.retiro.owner='royalist',s=>s.location='ensenada',s=>s.pendingBattle={id:'busy'}]){
  const s=structuredClone(base);change(s);const action={type:'purchaseUsedEquipment',sector:'retiro',instanceId:id};const n=dispatch(s,action);assert.ok(n.lastError);assert.deepEqual(physical(n),physical(s));
 }
 const n=dispatch(base,{type:'purchaseUsedEquipment',sector:'cordoba',instanceId:id});assert.ok(n.lastError);assert.deepEqual(physical(n),physical(base));
});
test('save validation rejects duplicate stock records and item identities across all custodians',()=>{
 let s=stock();const id=s.armoryItems[0].id;s=asLegacyMerchantGear(s,id);
 for(const edit of [s=>s.merchants.retiro.usedItems=null,s=>s.merchants.retiro.usedItems[0].condition=101,s=>s.merchants.retiro.usedItems[0].jammed='yes',s=>s.merchants.retiro.usedItems.push(structuredClone(s.merchants.retiro.usedItems[0])),s=>s.merchants.cordoba.usedItems.push({...s.merchants.retiro.usedItems[0]}),s=>{s.armoryItems.push({...s.merchants.retiro.usedItems[0]});s.armory[1803]=1;},s=>s.operativeState[4].weaponInstanceId='worn-carbine']){
  const bad=structuredClone(s);edit(bad);assert.throws(()=>restore(bad));
 }
 const bad=structuredClone(s);bad.operativeState[4].weaponInstanceId='worn-carbine';assert.throws(()=>validateEquipmentOwnership(bad,rosterFor(bad)));
});
test('closed trades preserve both full merchant custody and a full player armory',()=>{
 let state=stock();const id=state.armoryItems[0].id;state.merchants.retiro.usedItems=Array.from({length:USED_EQUIPMENT_LIMIT},(_,index)=>({id:`armory-${index+2}`,item:1803,condition:100,jammed:false}));state.nextArmoryItemId=USED_EQUIPMENT_LIMIT+2;
 assertTradeRejected(state,{type:'sellEquipment',instanceId:id});
 state=stock();state=asLegacyMerchantGear(state,state.armoryItems[0].id);state.armoryItems=Array.from({length:10000},(_,index)=>({id:`armory-${index+2}`,item:1803,condition:100,jammed:false}));state.nextArmoryItemId=10002;state.armory[1803]=10000;
 assertTradeRejected(state,{type:'purchaseUsedEquipment',sector:'retiro',instanceId:state.merchants.retiro.usedItems[0].id});
});

test('older absent used-stock fields stay empty without inventing previously sold weapons',()=>{
 const state=initialCampaign();for(const merchant of Object.values(state.merchants))delete merchant.usedItems;
 const restored=restore(state);assert.deepEqual(usedEquipmentOffers(restored,isSupplied),[]);assert.deepEqual(restore(restored),restored);assertTradeRejected(restored,{type:'purchaseUsedEquipment',sector:'retiro',instanceId:'armory-1'});
});
