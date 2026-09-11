import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign as dispatch,rosterFor,restoreCampaign,serializeCampaign,isSupplied} from '../game/campaign.js';
import {advanceMerchants,merchantStatus,resaleQuote} from '../game/equipment.js';
import {enterSector} from '../game/world.js';
import {actBattle,hasFirearm} from '../game/tactical.js';
const order=(s,a)=>{const next=dispatch(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);return next;};
const buy=(s,item,quantity=1)=>order(s,{type:'purchaseEquipment',item,quantity});
const equip=(s,id,item,instanceId)=>order(s,{type:'equip',operativeId:id,itemId:item,slot:'weapon',...(instanceId?{instanceId}:{})});
const sell=(s,instanceId)=>order(s,{type:'sellEquipment',instanceId});
const cashAndStock=s=>({treasury:s.resources.treasury,merchants:s.merchants,armory:s.armory,armoryItems:s.armoryItems});
const reportVisit=(s,b)=>order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});

test('merchant stock is finite and failed quantity or payment leaves cash and objects unchanged',()=>{
 let s=initialCampaign(),before=structuredClone(cashAndStock(s));
 assert.ok(dispatch(s,{type:'purchaseEquipment',item:1803,quantity:4}).lastError);assert.deepEqual(cashAndStock(s),before);
 s.resources.treasury=100;before=structuredClone(cashAndStock(s));const failed=dispatch(s,{type:'purchaseEquipment',item:1803});assert.ok(failed.lastError);assert.deepEqual(cashAndStock(failed),before);
 s=buy(initialCampaign(),1803,3);assert.equal(s.merchants.retiro.stock[1803],0);assert.equal(s.armoryItems.length,3);assert.equal(s.resources.treasury,3200-540);
 const exhausted=dispatch(s,{type:'purchaseEquipment',item:1803});assert.ok(exhausted.lastError);assert.deepEqual(cashAndStock(exhausted),cashAndStock(s));
 s=buy(s,1804,3);assert.equal(s.armoryItems.length,6,'ordinary stock can outfit six soldiers across available models');
});

test('workshop stocks replenish only on real supplied hours and remain separate',()=>{
 let s=buy(initialCampaign(),1803,3);s=order(s,{type:'wait',hours:23});assert.equal(s.merchants.retiro.stock[1803],0);s=order(s,{type:'wait',hours:1});assert.equal(s.merchants.retiro.stock[1803],1);assert.equal(s.merchants.cordoba.stock[1803],3);assert.equal(s.merchants.cordoba.restockHours,0);
 s=order(s,{type:'wait',hours:72});assert.equal(s.merchants.retiro.stock[1803],3);
 const frozen=structuredClone(s.merchants);for(let i=0;i<48;i++)advanceMerchants(s,()=>false);assert.deepEqual(s.merchants,frozen);
 s=order(s,{type:'travel',sector:'ensenada'});assert.equal(merchantStatus(s,{item:1803},isSupplied).available,false);assert.ok(dispatch(s,{type:'purchaseEquipment',item:1803}).lastError);
});

test('finite import orders retain paid lead time and blockade stops deliveries and restocking',()=>{
 let s=buy(initialCampaign(),1802,3);assert.equal(s.merchants.ensenada.stock[1802],0);assert.equal(s.resources.treasury,3200-1260);assert.equal(s.armoryItems.length,0);assert.ok(s.equipmentShipments[0].due>=72&&s.equipmentShipments[0].due<=120);
 assert.ok(dispatch(s,{type:'purchaseEquipment',item:1802}).lastError);s.blockade=true;s=order(s,{type:'wait',hours:120});assert.equal(s.armoryItems.length,0);assert.equal(s.equipmentShipments.length,1);assert.equal(s.merchants.ensenada.stock[1802],0);assert.equal(s.merchants.ensenada.restockHours,0);
 s.blockade=false;s=order(s,{type:'wait',hours:1});assert.equal(s.armoryItems.length,3);assert.equal(s.equipmentShipments.length,0);s=order(s,{type:'wait',hours:23});assert.equal(s.merchants.ensenada.stock[1802],1);assert.equal(s.armoryItems.length,3);
});

test('exact weapon swaps preserve individual condition and ignition failure without free repairs or rounds',()=>{
 let s=initialCampaign();s.operativeState[4].condition=37;s.operativeState[4].jammed=true;const cartridges=s.resources.cartridges;
 s=equip(buy(s,1803),4,1803);const worn=s.armoryItems.find(i=>i.item===1808);assert.equal(worn.condition,37);assert.equal(worn.jammed,true);assert.equal(s.operativeState[4].condition,100);assert.equal(s.operativeState[4].jammed,false);
 s=equip(s,4,1808,worn.id);assert.equal(s.operativeState[4].condition,37);assert.equal(s.operativeState[4].jammed,true);assert.equal(s.resources.cartridges,cartridges);assert.equal(s.armoryItems.find(i=>i.item===1803).condition,100);
 s=buy(s,1808);const fresh=s.armoryItems.find(i=>i.item===1808);s=equip(s,4,1808,fresh.id);assert.equal(s.operativeState[4].condition,100);assert.equal(s.armoryItems.find(i=>i.item===1808).condition,37);
 const unchanged=dispatch(s,{type:'equip',operativeId:4,slot:'weapon',itemId:1808,instanceId:fresh.id});assert.ok(unchanged.lastError);assert.deepEqual(cashAndStock(unchanged),cashAndStock(s));
});

test('resale uses the exact unequipped object, preserves its peers and cannot replay a sale',()=>{
 let s=initialCampaign();s.operativeState[4].condition=37;s=equip(buy(s,1803),4,1803);s=buy(s,1808);const worn=s.armoryItems.find(i=>i.item===1808&&i.condition===37),pristine=s.armoryItems.find(i=>i.item===1808&&i.condition===100);
 const price=resaleQuote(worn),cash=s.resources.treasury,fund=s.merchants.retiro.cash;assert.equal(price,32);
 s=sell(s,worn.id);assert.equal(s.resources.treasury,cash+32);assert.equal(s.merchants.retiro.cash,fund-32);assert.ok(s.armoryItems.some(i=>i.id===pristine.id));assert.equal(s.armory[1808],1);
 const repeated=dispatch(s,{type:'sellEquipment',instanceId:worn.id});assert.ok(repeated.lastError);assert.deepEqual(cashAndStock(repeated),cashAndStock(s));assert.ok(dispatch(s,{type:'sellEquipment',item:1803}).lastError,'equipped and aggregate model IDs are not saleable items');
});

test('merchants cannot pay beyond their cash and damaged worthless weapons are not sold',()=>{
 let s=buy(initialCampaign(),1803),item=s.armoryItems[0];s.merchants.retiro.cash=0;const before=structuredClone(cashAndStock(s));const failed=dispatch(s,{type:'sellEquipment',instanceId:item.id});assert.ok(failed.lastError);assert.deepEqual(cashAndStock(failed),before);
 s=order(s,{type:'wait',hours:24});assert.equal(s.merchants.retiro.cash,300);s=sell(s,item.id);assert.equal(s.merchants.retiro.cash,300-72);
 s=buy(s,1804);item=s.armoryItems[0];item.condition=0;assert.equal(resaleQuote(item),0);assert.ok(dispatch(s,{type:'sellEquipment',instanceId:item.id}).lastError);
});

test('remote and deployed personnel cannot swap, repair or sell campaign equipment',()=>{
 let s=buy(initialCampaign(),1803);s=order(s,{type:'createSquad',name:'Lejanos',ids:[4]});s=order(s,{type:'travel',sector:'ensenada'});s=order(s,{type:'selectSquad',id:'squad-1'});
 assert.ok(dispatch(s,{type:'equip',operativeId:4,slot:'weapon',itemId:1803}).lastError);s.operativeState[4].condition=30;assert.ok(dispatch(s,{type:'repairWeapon',operativeId:4}).lastError);
 s=order(s,{type:'visitSector'});for(const action of [{type:'equip',operativeId:3,slot:'weapon',itemId:1803},{type:'sellEquipment',instanceId:s.armoryItems[0].id},{type:'purchaseEquipment',item:1804}])assert.ok(dispatch(s,action).lastError);
});

test('actual tactical loot equip returns its exact weapon condition and leaves the previous gun in the backpack',()=>{
 let s=initialCampaign();s.operativeState[4].inventory={recovered:{count:1,weapon:1801,weight:4,loaded:0,condition:33,jammed:true}};s=order(s,{type:'visitSector'});let b=enterSector(s.pendingBattle);b=actBattle(b,{type:'equipLoot',unitId:'4',inventoryKey:'recovered'});assert.equal(b.lastError,null);s=reportVisit(s,b);
 assert.equal(rosterFor(s).find(o=>o.id===4).weapon,1801);assert.equal(s.operativeState[4].condition,33);assert.equal(s.operativeState[4].jammed,true);assert.equal(s.armoryItems.length,0);assert.ok(Object.values(s.operativeState[4].inventory).some(i=>i.weapon===1808&&i.count===1));
 s=order(restoreCampaign(serializeCampaign(s)),{type:'visitSector'});b=enterSector(s.pendingBattle);const unit=b.units.find(u=>u.id==='4');assert.equal(unit.weapon,1801);assert.equal(unit.condition,33);assert.equal(unit.jammed,true);
});

test('reported dropped weapons and empty hands persist without ammunition or a replacement gun',()=>{
 let s=order(initialCampaign(),{type:'visitSector'}),b=enterSector(s.pendingBattle),unit=b.units.find(u=>u.id==='4');Object.assign(unit,{weapon:0,blade:0,bladeCondition:28,loaded:0,ammo:0,weaponDropped:true,activeSlot:'unarmed'});s=reportVisit(s,b);
 assert.equal(s.operativeState[4].weaponDropped,true);assert.equal(s.operativeState[4].bladeCondition,28);assert.equal(s.armoryItems.length,0);s=restoreCampaign(serializeCampaign(s));s=order(s,{type:'visitSector'});unit=enterSector(s.pendingBattle).units.find(u=>u.id==='4');assert.equal(unit.weapon,0);assert.equal(unit.loaded,0);assert.equal(unit.ammo,0);assert.equal(unit.activeSlot,'unarmed');assert.equal(hasFirearm(unit),false);
 s=reportVisit(s,enterSector(s.pendingBattle));s=equip(buy(s,1803),4,1803);assert.equal(s.operativeState[4].weaponDropped,false);assert.equal(s.operativeState[4].activeSlot,'primary');assert.equal(s.armoryItems.length,0,'an absent outgoing gun cannot appear in storage');
});

test('merchant clocks and exact stored items migrate and round-trip without stock renewal',()=>{
 const old=initialCampaign();delete old.merchants;delete old.armoryItems;delete old.nextArmoryItemId;old.armory={1803:2,field8:1};const migrated=restoreCampaign(serializeCampaign(old));assert.equal(migrated.armoryItems.length,2);assert.equal(migrated.armoryItems[0].condition,100);assert.equal(migrated.armory.field8,1);
 let s=order(buy(initialCampaign(),1803,3),{type:'wait',hours:23});const loaded=restoreCampaign(serializeCampaign(s));assert.deepEqual(loaded,s);assert.deepEqual(order(loaded,{type:'wait',hours:24}),order(s,{type:'wait',hours:24}));
 for(const edit of [s=>s.merchants.retiro.stock[1803]=4,s=>s.merchants.retiro.cash=-1,s=>s.merchants.retiro.restockHours=24,s=>s.armoryItems[0].condition=101,s=>s.armoryItems.push({...s.armoryItems[0]}),s=>s.armory[1803]=0,s=>s.nextArmoryItemId=1,s=>s.operativeState[4].weaponDropped=1,s=>s.operativeState[4].bladeCondition=101]){const bad=buy(initialCampaign(),1803);edit(bad);assert.throws(()=>restoreCampaign(serializeCampaign(bad)));}
});

test('secondary blade condition and optional identities survive swaps, reports and real drops without reappearing',()=>{
 let s=initialCampaign();const original=rosterFor(s).find(o=>o.id===4).blade,other=original===1809?1810:1809;s.operativeState[4].bladeCondition=23;s=buy(s,other);s=order(s,{type:'equip',operativeId:4,itemId:other,slot:'blade'});const stored=s.armoryItems.find(i=>i.item===original);assert.equal(stored.condition,23);
 s=order(s,{type:'equip',operativeId:4,itemId:original,slot:'blade',instanceId:stored.id});assert.equal(s.operativeState[4].bladeCondition,23);s.operativeState[4].bladeInstanceId='captured-blade';s.operativeState[4].weaponInstanceId='captured-gun';s=order(s,{type:'visitSector'});let b=enterSector(s.pendingBattle);s=reportVisit(s,b);assert.equal(s.operativeState[4].bladeInstanceId,'captured-blade');assert.equal(s.operativeState[4].weaponInstanceId,'captured-gun');
 s=order(restoreCampaign(serializeCampaign(s)),{type:'visitSector'});b=enterSector(s.pendingBattle);assert.equal(b.units.find(u=>u.id==='4').bladeCondition,23);b=actBattle(b,{type:'drop',unitId:'4',item:'blade',count:1});assert.equal(b.lastError,null);assert.equal(b.units.find(u=>u.id==='4').blade,undefined);s=reportVisit(s,b);assert.equal(rosterFor(s).find(o=>o.id===4).blade,0);assert.equal(s.operativeState[4].bladeInstanceId,undefined);assert.equal(s.operativeState[4].weaponInstanceId,'captured-gun');
 s=order(restoreCampaign(serializeCampaign(s)),{type:'visitSector'});const again=enterSector(s.pendingBattle).units.find(u=>u.id==='4');assert.equal(again.blade,0);assert.equal(again.bladeInstanceId,undefined);
});

test('an actually dropped primary keeps its old model only as an absent gun in visit and attack requests',()=>{
 let s=order(initialCampaign(),{type:'visitSector'}),b=enterSector(s.pendingBattle);b=actBattle(b,{type:'drop',unitId:'4',item:'primary',count:1});assert.equal(b.lastError,null);s=reportVisit(s,b);assert.equal(rosterFor(s).find(o=>o.id===4).weapon,1808);assert.equal(s.operativeState[4].weaponDropped,true);
 s=order(s,{type:'visitSector'});let issued=s.pendingBattle.squad.find(u=>u.id===4);assert.equal(issued.loaded+issued.ammo,0);s=reportVisit(s,enterSector(s.pendingBattle));s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'attack',sector:'san_nicolas'});issued=s.pendingBattle.squad.find(u=>u.id===4);assert.equal(issued.loaded+issued.ammo,0);assert.equal(hasFirearm(enterSector(s.pendingBattle).units.find(u=>u.id==='4')),false);
});

test('medical purchases and provision refills respect finite pockets and roll back payment',()=>{
 let s=initialCampaign();s.operativeState[4].inventory={cargo:{count:20,weight:1}};const cash=s.resources.treasury,kits=s.operativeState[4].medkits;const failed=dispatch(s,{type:'purchaseMedicalSupplies',operativeId:4,quantity:20});assert.ok(failed.lastError);assert.equal(failed.resources.treasury,cash);assert.equal(failed.operativeState[4].medkits,kits);
 s.operativeState[4].inventory={cargo:{count:36,weight:1}};s.operativeState[4].priming=0;s.operativeState[4].flints=0;s.operativeState[4].rations=0;s.operativeState[4].torches=0;const refill=dispatch(s,{type:'resupply',operativeId:4});assert.ok(refill.lastError);assert.equal(refill.resources.treasury,cash);assert.equal(refill.operativeState[4].priming,0);
 const restored=restoreCampaign(serializeCampaign(s));assert.deepEqual(restored.operativeState[4].inventory,s.operativeState[4].inventory,'old oversized inventories remain loadable');
});

test('automatic cartridge issue respects a full or legacy overfull pack in both deployment paths',()=>{
 let s=initialCampaign();s.operativeState[4].inventory={cargo:{count:24,weight:1}};let stock=s.resources.cartridges;s=order(s,{type:'visitSector'});let unit=s.pendingBattle.squad.find(u=>u.id===4);assert.equal(unit.loaded,2);assert.equal(unit.ammo,0);assert.equal(s.resources.cartridges,stock-s.pendingBattle.issuedCartridges);assert.equal(s.pendingBattle.issuedCartridges,s.pendingBattle.squad.reduce((sum,u)=>sum+u.loaded+u.ammo,0));
 s=reportVisit(s,enterSector(s.pendingBattle));assert.equal(s.resources.cartridges,stock);s.operativeState[4].inventory.cargo.count=40;const cargo=structuredClone(s.operativeState[4].inventory);s=order(s,{type:'travel',sector:'buenos_aires'});stock=s.resources.cartridges;s=order(s,{type:'attack',sector:'san_nicolas'});unit=s.pendingBattle.squad.find(u=>u.id===4);assert.equal(unit.loaded,2);assert.equal(unit.ammo,0);assert.deepEqual(unit.inventory,cargo);assert.equal(s.resources.cartridges,stock-s.pendingBattle.issuedCartridges);
});
