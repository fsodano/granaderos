import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign as dispatch,serializeCampaign,restoreCampaign,rosterFor,isSupplied} from '../game/campaign.js';
import {usedEquipmentOffers,usedEquipmentBreakdown,resaleQuote,advanceMerchants,USED_EQUIPMENT_LIMIT,validateEquipmentOwnership} from '../game/equipment.js';
import {enterSector} from '../game/world.js';
const order=(s,a)=>{const n=dispatch(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const buy=(s,item)=>order(s,{type:'purchaseEquipment',item});
const sell=(s,id)=>order(s,{type:'sellEquipment',instanceId:id});
const purchase=(s,id,sector=s.location)=>order(s,{type:'purchaseUsedEquipment',instanceId:id,sector});
const restore=s=>restoreCampaign(serializeCampaign(s));
const physical=s=>({...s,lastError:null});
function stock(){
 let s=buy(initialCampaign(),1803);Object.assign(s.armoryItems[0],{condition:37,jammed:true,instanceId:'worn-carbine'});return s;
}

test('sale transfers one exact worn gun to local stock; buying restores it without repairs, cartridges or identity changes',()=>{
 let s=stock();const item=structuredClone(s.armoryItems[0]),money=s.resources.treasury,cartridges=s.resources.cartridges,stockCount=s.merchants.retiro.stock[1803],sequence=s.nextArmoryItemId;
 const sold=sell(s,item.id);assert.deepEqual(sold.merchants.retiro.usedItems,[item]);assert.equal(sold.armoryItems.length,0);assert.equal(sold.armory[1803],0);assert.equal(sold.resources.treasury,money+resaleQuote(item));assert.deepEqual(s.armoryItems,[item]);
 const quote=usedEquipmentBreakdown(item);assert.equal(quote.total,53);s=purchase(sold,item.id);assert.deepEqual(s.armoryItems,[item]);assert.deepEqual(s.merchants.retiro.usedItems,[]);assert.equal(s.armory[1803],1);assert.equal(s.resources.cartridges,cartridges);assert.equal(s.merchants.retiro.stock[1803],stockCount);assert.equal(s.nextArmoryItemId,sequence);assert.equal(s.resources.treasury,money+resaleQuote(item)-quote.total);assert.ok(s.resources.treasury<money);assert.deepEqual(restore(s),s);
});
test('fitted weapons retain both component identities and independently priced conditions',()=>{
 let s=stock();const item=s.armoryItems[0];item.item=1800;item.instanceId='worn-musket';item.condition=50;item.fittings={bayonet:{weapon:1811,condition:25,instanceId:'worn-socket',fittingPattern:'india_socket'}};s.armory[1803]=0;s.armory[1800]=1;
 const exact=structuredClone(item),quote=usedEquipmentBreakdown(item);assert.equal(quote.total,106);assert.deepEqual(quote.items.map(i=>i.price),[96,10]);
 s=restore(sell(s,item.id));assert.deepEqual(s.merchants.retiro.usedItems,[exact]);s=purchase(s,item.id);assert.deepEqual(s.armoryItems,[exact]);assert.equal(s.equipmentShipments.length,0,'a used local musket is already here and does not become an import order');
 s=order(s,{type:'equip',operativeId:4,slot:'weapon',itemId:1800,instanceId:item.id});assert.equal(s.operativeState[4].condition,50);assert.equal(s.operativeState[4].jammed,true);assert.equal(s.operativeState[4].weaponFittings.bayonet.instanceId,'worn-socket');
 s=order(restore(s),{type:'visitSector'});const battle=enterSector(s.pendingBattle),u=battle.units.find(u=>u.id==='4');assert.equal(u.weaponInstanceId,'worn-musket');assert.equal(u.condition,50);assert.equal(u.jammed,true);assert.equal(u.weaponFittings.bayonet.condition,25);assert.equal(u.weaponFittings.bayonet.instanceId,'worn-socket');
});
test('duplicate purchase or sale requests cannot replay money or ownership changes',()=>{
 let s=stock();const id=s.armoryItems[0].id;s=sell(s,id);
 let n=dispatch(s,{type:'sellEquipment',instanceId:id});assert.ok(n.lastError);assert.deepEqual(physical(n),physical(s));s=purchase(s,id);
 n=dispatch(s,{type:'purchaseUsedEquipment',instanceId:id,sector:s.location});assert.ok(n.lastError);assert.deepEqual(physical(n),physical(s));
});
test('local ownership survives time, supply loss and save loading without replenishing used items',()=>{
 let s=stock();const id=s.armoryItems[0].id;s=sell(s,id);const exact=structuredClone(s.merchants.retiro.usedItems);
 for(let i=0;i<72;i++)advanceMerchants(s,()=>true);assert.deepEqual(s.merchants.retiro.usedItems,exact);assert.deepEqual(s.merchants.cordoba.usedItems,[]);assert.deepEqual(s.merchants.mendoza.usedItems,[]);
 const loaded=restore(s);assert.deepEqual(loaded.merchants.retiro.usedItems,exact);s=purchase(loaded,id);for(let i=0;i<24;i++)advanceMerchants(s,()=>true);assert.deepEqual(s.merchants.retiro.usedItems,[]);
});
test('unaffordable, remote, hostile and deployed purchases preserve money and stock',()=>{
 let base=stock();const id=base.armoryItems[0].id;base=sell(base,id);
 for(const change of [s=>s.resources.treasury=0,s=>s.sectors.retiro.owner='royalist',s=>s.location='ensenada',s=>s.pendingBattle={id:'busy'}]){
  const s=structuredClone(base);change(s);const action={type:'purchaseUsedEquipment',sector:'retiro',instanceId:id};const n=dispatch(s,action);assert.ok(n.lastError);assert.deepEqual(physical(n),physical(s));
 }
 const n=dispatch(base,{type:'purchaseUsedEquipment',sector:'cordoba',instanceId:id});assert.ok(n.lastError);assert.deepEqual(physical(n),physical(base));
});
test('save validation rejects duplicate stock records and item identities across all custodians',()=>{
 let s=stock();const id=s.armoryItems[0].id;s=sell(s,id);
 for(const edit of [s=>s.merchants.retiro.usedItems=null,s=>s.merchants.retiro.usedItems[0].condition=101,s=>s.merchants.retiro.usedItems[0].jammed='yes',s=>s.merchants.retiro.usedItems.push(structuredClone(s.merchants.retiro.usedItems[0])),s=>s.merchants.cordoba.usedItems.push({...s.merchants.retiro.usedItems[0]}),s=>{s.armoryItems.push({...s.merchants.retiro.usedItems[0]});s.armory[1803]=1;},s=>s.operativeState[4].weaponInstanceId='worn-carbine']){
  const bad=structuredClone(s);edit(bad);assert.throws(()=>restore(bad));
 }
 const bad=structuredClone(s);bad.operativeState[4].weaponInstanceId='worn-carbine';assert.throws(()=>validateEquipmentOwnership(bad,rosterFor(bad)));
});
test('full merchant storage rejects a sale before payment and a full armory rejects a purchase',()=>{
 let s=stock(),id=s.armoryItems[0].id;
 s.merchants.retiro.usedItems=Array.from({length:USED_EQUIPMENT_LIMIT},(_,i)=>({id:`armory-${i+2}`,item:1803,condition:100,jammed:false}));s.nextArmoryItemId=USED_EQUIPMENT_LIMIT+2;
 let n=dispatch(s,{type:'sellEquipment',instanceId:id});assert.match(n.lastError,/guardar más/);assert.deepEqual(physical(n),physical(s));
 s=stock();id=s.armoryItems[0].id;s=sell(s,id);s.armoryItems=Array.from({length:10000},(_,i)=>({id:`armory-${i+2}`,item:1803,condition:100,jammed:false}));s.nextArmoryItemId=10002;s.armory[1803]=10000;
 n=dispatch(s,{type:'purchaseUsedEquipment',sector:s.location,instanceId:id});assert.match(n.lastError,/llena/);assert.deepEqual(physical(n),physical(s));
});
test('older absent used-stock fields stay empty without inventing previously sold weapons',()=>{
 const s=initialCampaign();for(const merchant of Object.values(s.merchants))delete merchant.usedItems;
 const loaded=restore(s);assert.deepEqual(usedEquipmentOffers(loaded,isSupplied),[]);const stocked=buy(loaded,1803),id=stocked.armoryItems[0].id;assert.equal(sell(stocked,id).merchants.retiro.usedItems.length,1);
});
