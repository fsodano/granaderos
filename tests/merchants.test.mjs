import {ammunitionByType} from '../game/ammunition-types.js';
import {inventoryUsage} from '../game/tactical-inventory.js';
import {stockAmmo,stockAndCarriedAmmo} from './ammunition-balance.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign as dispatch,rosterFor,restoreCampaign,serializeCampaign,isSupplied} from '../game/campaign.js';
import {resaleQuote} from '../game/equipment.js';
import {withStoredGear,assertTradeRejected} from './commerce-gear-fixture.mjs';
import {enterSector} from '../game/world.js';
import {actBattle,hasFirearm} from '../game/tactical.js';
const order=(s,a)=>{const next=dispatch(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);return next;};
const stored=withStoredGear;
const equip=(s,id,item,instanceId)=>order(s,{type:'equip',operativeId:id,itemId:item,slot:'weapon',...(instanceId?{instanceId}:{})});
const cashAndStock=s=>({treasury:s.resources.treasury,merchants:s.merchants,armory:s.armory,armoryItems:s.armoryItems});
const reportVisit=(s,b)=>order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});

test('new equipment orders reject atomically regardless of stock, quantity or payment',()=>{
 const state=initialCampaign();for(const action of [{type:'purchaseEquipment',item:1803,quantity:1},{type:'purchaseEquipment',item:1803,quantity:4},{type:'purchaseEquipment',item:1802,quantity:3},{type:'purchaseEquipment',item:'bronze4'}])assertTradeRejected(state,action);
 state.resources.treasury=0;assertTradeRejected(state,{type:'purchaseEquipment',item:1803});
});

test('ordinary elapsed time does not manufacture workshop weapons or cash',()=>{
 let state=initialCampaign();state.merchants.retiro.stock[1803]=0;state.merchants.retiro.cash=0;const merchants=structuredClone(state.merchants);
 state=order(state,{type:'wait',hours:96});assert.deepEqual(state.merchants,merchants);assert.deepEqual(state.armoryItems,[]);assertTradeRejected(state,{type:'purchaseEquipment',item:1803});
});

test('new import orders never charge money, consume stock or create shipments',()=>{
 const state=initialCampaign();for(const blockade of [false,true]){state.blockade=blockade;assertTradeRejected(state,{type:'purchaseEquipment',item:1802,quantity:3});assert.deepEqual(state.equipmentShipments,[]);}
});

test('exact weapon swaps preserve individual condition and ignition failure without free repairs or rounds',()=>{
 let s=initialCampaign();s.operativeState[4].condition=37;s.operativeState[4].jammed=true;const cartridges=stockAndCarriedAmmo(s);
 s=equip(stored(s,1803),4,1803);const worn=s.armoryItems.find(i=>i.item===1808);assert.equal(worn.condition,37);assert.equal(worn.jammed,true);assert.equal(s.operativeState[4].condition,100);assert.equal(s.operativeState[4].jammed,false);
 s=equip(s,4,1808,worn.id);assert.equal(s.operativeState[4].condition,37);assert.equal(s.operativeState[4].jammed,true);assert.equal(stockAndCarriedAmmo(s),cartridges);assert.equal(s.armoryItems.find(i=>i.item===1803).condition,100);
 s=stored(s,1808);const fresh=s.armoryItems.find(i=>i.item===1808);s=equip(s,4,1808,fresh.id);assert.equal(s.operativeState[4].condition,100);assert.equal(s.armoryItems.find(i=>i.item===1808).condition,37);
 const unchanged=dispatch(s,{type:'equip',operativeId:4,slot:'weapon',itemId:1808,instanceId:fresh.id});assert.ok(unchanged.lastError);assert.deepEqual(cashAndStock(unchanged),cashAndStock(s));
});

test('stored exact worn and pristine peers cannot be sold or replayed for money',()=>{
 let state=initialCampaign();state.operativeState[4].condition=37;state=equip(stored(state,1803),4,1803);state=stored(state,1808);
 const worn=state.armoryItems.find(item=>item.item===1808&&item.condition===37),pristine=state.armoryItems.find(item=>item.item===1808&&item.condition===100);
 assert.equal(resaleQuote(worn),32,'the unused pricing model remains deterministic');assert.ok(pristine);
 for(let count=0;count<2;count++)assertTradeRejected(state,{type:'sellEquipment',instanceId:worn.id});assertTradeRejected(state,{type:'sellEquipment',item:1803});
});

test('closed resale preserves exact weapons even with affordable or worthless catalog quotes',()=>{
 let state=stored(initialCampaign(),1803);state.merchants.retiro.cash=0;assertTradeRejected(state,{type:'sellEquipment',instanceId:state.armoryItems[0].id});
 state=stored(state,1804);const item=state.armoryItems.at(-1);item.condition=0;assert.equal(resaleQuote(item),0);assertTradeRejected(state,{type:'sellEquipment',instanceId:item.id});
});

test('remote and deployed personnel cannot swap, repair or sell campaign equipment',()=>{
 let s=stored(initialCampaign(),1803);s=order(s,{type:'createSquad',name:'Lejanos',ids:[4]});s=order(s,{type:'travel',sector:'ensenada'});s=order(s,{type:'selectSquad',id:'squad-1'});
 assert.ok(dispatch(s,{type:'equip',operativeId:4,slot:'weapon',itemId:1803}).lastError);s.operativeState[4].condition=30;assert.ok(dispatch(s,{type:'repairWeapon',operativeId:4}).lastError);
 s=order(s,{type:'visitSector'});for(const action of [{type:'equip',operativeId:3,slot:'weapon',itemId:1803},{type:'sellEquipment',instanceId:s.armoryItems[0].id},{type:'purchaseEquipment',item:1804}])assert.ok(dispatch(s,action).lastError);
});

test('actual tactical loot equip returns its exact weapon condition and leaves the previous gun in the backpack',()=>{
 let s=initialCampaign();s.operativeState[4].inventory={...s.operativeState[4].inventory,recovered:{count:1,weapon:1801,weight:4,loaded:0,condition:33,jammed:true}};s=order(s,{type:'visitSector'});let b=enterSector(s.pendingBattle);b=actBattle(b,{type:'equipLoot',unitId:'4',inventoryKey:'recovered'});assert.equal(b.lastError,null);s=reportVisit(s,b);
 assert.equal(rosterFor(s).find(o=>o.id===4).weapon,1801);assert.equal(s.operativeState[4].condition,33);assert.equal(s.operativeState[4].jammed,true);assert.equal(s.armoryItems.length,0);assert.ok(Object.values(s.operativeState[4].inventory).some(i=>i.weapon===1808&&i.count===1));
 s=order(restoreCampaign(serializeCampaign(s)),{type:'visitSector'});b=enterSector(s.pendingBattle);const unit=b.units.find(u=>u.id==='4');assert.equal(unit.weapon,1801);assert.equal(unit.condition,33);assert.equal(unit.jammed,true);
});

test('reported absent weapons and empty hands persist while their loose ammunition stays with the owner',()=>{
 let s=order(initialCampaign(),{type:'visitSector'}),b=enterSector(s.pendingBattle),unit=b.units.find(u=>u.id==='4');const reserve=ammunitionByType(unit);Object.assign(unit,{weapon:0,blade:0,bladeCondition:28,loaded:0,ammo:0,weaponDropped:true,activeSlot:'unarmed'});s=reportVisit(s,b);
 assert.equal(s.operativeState[4].weaponDropped,true);assert.equal(s.operativeState[4].bladeCondition,28);assert.equal(s.armoryItems.length,0);s=restoreCampaign(serializeCampaign(s));s=order(s,{type:'visitSector'});unit=enterSector(s.pendingBattle).units.find(u=>u.id==='4');assert.equal(unit.weapon,0);assert.equal(unit.loaded,0);assert.equal(unit.ammo,0);assert.deepEqual(ammunitionByType(unit),reserve);assert.equal(unit.activeSlot,'unarmed');assert.equal(hasFirearm(unit),false);
 s=reportVisit(s,enterSector(s.pendingBattle));s=equip(stored(s,1803),4,1803);assert.equal(s.operativeState[4].weaponDropped,false);assert.equal(s.operativeState[4].activeSlot,'primary');assert.equal(s.armoryItems.length,0,'an absent outgoing gun cannot appear in storage');
});

test('merchant clocks and exact stored items migrate and round-trip without stock renewal',()=>{
 // A pre-merchant save also predates the grenade-supply version marker.
 const old=initialCampaign();delete old.grenadeSupplyVersion;delete old.clothingSupplyVersion;delete old.equipmentStorageVersion;delete old.equipmentMerchantsVersion;delete old.merchants;delete old.armoryItems;delete old.nextArmoryItemId;old.armory={1803:2};const migrated=restoreCampaign(serializeCampaign(old));assert.equal(migrated.armoryItems.length,2);assert.equal(migrated.armoryItems[0].condition,100);assert.deepEqual(migrated.artilleryDepots,old.artilleryDepots);assert.deepEqual(restoreCampaign(serializeCampaign(migrated)),migrated);
 let s=order(stored(initialCampaign(),1803,3),{type:'wait',hours:23});const loaded=restoreCampaign(serializeCampaign(s));assert.deepEqual(loaded,s);assert.deepEqual(order(loaded,{type:'wait',hours:24}),order(s,{type:'wait',hours:24}));
 for(const edit of [s=>s.merchants.retiro.stock[1803]=4,s=>s.merchants.retiro.cash=-1,s=>s.merchants.retiro.restockHours=24,s=>s.armoryItems[0].condition=101,s=>s.armoryItems.push({...s.armoryItems[0]}),s=>s.armory[1803]=0,s=>s.nextArmoryItemId=1,s=>s.operativeState[4].weaponDropped=1,s=>s.operativeState[4].bladeCondition=101]){const bad=stored(initialCampaign(),1803);edit(bad);assert.throws(()=>restoreCampaign(serializeCampaign(bad)));}
});

test('secondary blade condition and optional identities survive swaps, reports and real drops without reappearing',()=>{
 let s=initialCampaign();const original=rosterFor(s).find(o=>o.id===4).blade,other=original===1809?1810:1809;s.operativeState[4].bladeCondition=23;s=stored(s,other);s=order(s,{type:'equip',operativeId:4,itemId:other,slot:'blade'});const oldBlade=s.armoryItems.find(i=>i.item===original);assert.equal(oldBlade.condition,23);
 s=order(s,{type:'equip',operativeId:4,itemId:original,slot:'blade',instanceId:oldBlade.id});assert.equal(s.operativeState[4].bladeCondition,23);s.operativeState[4].bladeInstanceId='captured-blade';s.operativeState[4].weaponInstanceId='captured-gun';s=order(s,{type:'visitSector'});let b=enterSector(s.pendingBattle);s=reportVisit(s,b);assert.equal(s.operativeState[4].bladeInstanceId,'captured-blade');assert.equal(s.operativeState[4].weaponInstanceId,'captured-gun');
 s=order(restoreCampaign(serializeCampaign(s)),{type:'visitSector'});b=enterSector(s.pendingBattle);assert.equal(b.units.find(u=>u.id==='4').bladeCondition,23);b=actBattle(b,{type:'drop',unitId:'4',item:'blade',count:1});assert.equal(b.lastError,null);assert.equal(b.units.find(u=>u.id==='4').blade,undefined);s=reportVisit(s,b);assert.equal(rosterFor(s).find(o=>o.id===4).blade,0);assert.equal(s.operativeState[4].bladeInstanceId,undefined);assert.equal(s.operativeState[4].weaponInstanceId,'captured-gun');
 s=order(restoreCampaign(serializeCampaign(s)),{type:'visitSector'});const again=enterSector(s.pendingBattle).units.find(u=>u.id==='4');assert.equal(again.blade,0);assert.equal(again.bladeInstanceId,undefined);
});

test('an actually dropped primary keeps its old model only as an absent gun in visit and attack requests',()=>{
 let s=order(initialCampaign(),{type:'visitSector'}),b=enterSector(s.pendingBattle);const reserve=ammunitionByType(b.units.find(u=>u.id==='4'));b=actBattle(b,{type:'drop',unitId:'4',item:'primary',count:1});assert.equal(b.lastError,null);s=reportVisit(s,b);assert.equal(rosterFor(s).find(o=>o.id===4).weapon,1808);assert.equal(s.operativeState[4].weaponDropped,true);
 s=order(s,{type:'visitSector'});let issued=s.pendingBattle.squad.find(u=>u.id===4);assert.equal(issued.loaded,0);assert.deepEqual(ammunitionByType(issued),reserve);s=reportVisit(s,enterSector(s.pendingBattle));s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'attack',sector:'san_nicolas'});issued=s.pendingBattle.squad.find(u=>u.id===4);assert.equal(issued.loaded,0);assert.deepEqual(ammunitionByType(issued),reserve);assert.equal(hasFirearm(enterSector(s.pendingBattle).units.find(u=>u.id==='4')),false);
});

test('closed medical and provision shops preserve finite pockets, possessions and money',()=>{
 let s=initialCampaign();s.operativeState[4].inventory={...s.operativeState[4].inventory,cargo:{count:36,weight:1}};const cash=s.resources.treasury,kits=s.operativeState[4].medkits;const failed=dispatch(s,{type:'purchaseMedicalSupplies',operativeId:4,quantity:20});assert.ok(failed.lastError);assert.equal(failed.resources.treasury,cash);assert.equal(failed.operativeState[4].medkits,kits);
 s.operativeState[4].inventory={...s.operativeState[4].inventory,cargo:{count:48,weight:1}};s.operativeState[4].medkits=0;s.operativeState[4].rations=0;s.operativeState[4].torches=0;const refill=dispatch(s,{type:'resupply',operativeId:4});assert.ok(refill.lastError);assert.equal(refill.resources.treasury,cash);assert.equal(refill.operativeState[4].rations,0);assert.equal(refill.operativeState[4].torches,0);assert.equal(refill.operativeState[4].medkits,0);
 const restored=restoreCampaign(serializeCampaign(s));assert.deepEqual(restored.operativeState[4].inventory,s.operativeState[4].inventory,'old oversized inventories remain loadable');
});

test('full or legacy overfull packs retain their finite cartridges through visits and departures without automatic buying',()=>{
 let state=initialCampaign();state.operativeState[4].inventory={...state.operativeState[4].inventory,cargo:{count:36,weight:1}};const cash=state.resources.treasury,total=stockAndCarriedAmmo(state),carried=ammunitionByType(state.operativeState[4]);
 state=order(state,{type:'visitSector'});let unit=state.pendingBattle.squad.find(unit=>unit.id===4);assert.equal(unit.loaded,1);assert.deepEqual(ammunitionByType(unit),carried);assert.equal(stockAmmo(state),0);assert.equal(stockAndCarriedAmmo(state),total);
 state=reportVisit(state,enterSector(state.pendingBattle));assert.equal(state.resources.treasury,cash);assert.equal(stockAndCarriedAmmo(state),total);
 state.operativeState[4].inventory.cargo.count=48;const cargo=structuredClone(state.operativeState[4].inventory);state=order(state,{type:'travel',sector:'buenos_aires'});state=order(state,{type:'attack',sector:'san_nicolas'});unit=state.pendingBattle.squad.find(unit=>unit.id===4);
 assert.deepEqual(unit.inventory,cargo);assert.equal(inventoryUsage(unit).overloaded,true);assert.deepEqual(ammunitionByType(unit),carried);assert.equal(stockAndCarriedAmmo(state),total);assert.equal(state.resources.treasury,cash);
});
