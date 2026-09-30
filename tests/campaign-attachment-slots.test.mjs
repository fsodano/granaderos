import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {equipmentFingerprint,equipmentEndpoint,inventoryUsage,readItemStack} from '../game/tactical-inventory.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {actBattle,carriedWeight} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {validateEquipmentOwnership} from '../game/equipment.js';

const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,next.lastError);return next;};
const personal=(s,id=110)=>sectorInventoryModel(s,'retiro',rosterFor(s),id).personal;
const actor=b=>b.units.find(u=>u.id==='110');
const pocket=(u,item)=>inventoryUsage(u).slots.find(p=>p.entry?.item===item).id;
const save=s=>decodeSave(encodeSave(s)).campaign;
function reject(s,action){
 const before=structuredClone(s),next=dispatchCampaign(s,action);assert.ok(next.lastError);
 assert.deepEqual(s,before);assert.deepEqual({...next,lastError:null},{...s,lastError:null});return next;
}
function unchangedEconomy(before,after){
 for(const key of ['resources','hour','secondOfHour','seed','merchants','contracts','equipmentShipments'])assert.deepEqual(after[key],before[key],key);
}
function fresh(){
 const start=initialCampaign(8);
 let s=order(start,{type:'recruitCivic',id:110,term:'week'});
 assert.ok(s.resources.treasury<start.resources.treasury);assert.deepEqual(s.recruited,[110]);
 const stock=s.merchants.retiro.stock['1811:india_socket'],cash=s.resources.treasury;
 s=order(s,{type:'purchaseEquipment',item:'1811:india_socket'});
 assert.equal(s.merchants.retiro.stock['1811:india_socket'],stock-1);assert.equal(s.resources.treasury,cash-50);
 const purchased=s.armoryItems.find(item=>item.fittingPattern==='india_socket');assert.ok(purchased.instanceId);
 s=order(s,{type:'equip',operativeId:110,itemId:1811,slot:'blade',instanceId:purchased.id});
 assert.equal(s.operativeState[110].bladeInstanceId,purchased.instanceId);
 assert.equal(rosterFor(s).find(u=>u.id===110).weapon,1800);return s;
}
function cursorAction(u,type,options={}){
 return {type,unitId:u.id,expectedSource:equipmentFingerprint(u,type==='pickupEquipment'?options.sourceId:'cursor'),...(options.destinationId?{expectedDestination:equipmentFingerprint(u,options.destinationId)}:{}),...options};
}
function arrange(s,type,options={},id=110){
 const before=s,u=personal(s,id),next=order(s,{...cursorAction(u,type,options),type:'sectorInventory',sector:'retiro',operativeId:id,direction:'arrange',kind:'cursor',cursorAction:type});
 unchangedEconomy(before,next);return next;
}
function attachmentAction(s,operation,hostId='hand:right',id=110){
 const u=personal(s,id);return {type:'sectorInventory',sector:'retiro',operativeId:id,direction:'attachment',hostId,operation,expectedHost:equipmentFingerprint(u,hostId),expectedCursor:equipmentFingerprint(u,'cursor')};
}
function attachment(s,operation,hostId='hand:right',id=110){
 const next=order(s,attachmentAction(s,operation,hostId,id));unchangedEconomy(s,next);return next;
}
function pickBayonet(s){
 const u=personal(s),sourceId=['hand:right','hand:left',...inventoryUsage(u).slots.map(p=>p.id)].find(id=>{
  const endpoint=equipmentEndpoint(u,id);return endpoint.item&&readItemStack(u,endpoint.item,1).fittingPattern==='india_socket';
 });
 assert.ok(sourceId,'the purchased bayonet must occupy one real slot');return arrange(s,'pickupEquipment',{sourceId});
}
const fitted=()=>attachment(pickBayonet(fresh()),'attach');
const visit=s=>{s=order(s,{type:'visitSector'});return {s,b:enterSector(s.pendingBattle,s.sectorStates.retiro)};};
const leave=(s,b)=>order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
const act=(b,a)=>{const next=actBattle(b,a);assert.equal(next.lastError,null,next.lastError);return next;};

test('a paid recruit mounts one purchased cursor bayonet, detaches it and selects its exact pocket without campaign charges',()=>{
 let s=fresh();const original=personal(s),identity=original.bladeInstanceId,weight=carriedWeight(original),stock=s.merchants.retiro.stock['1811:india_socket'];
 s=pickBayonet(s);assert.equal(personal(s).blade,0);assert.equal(personal(s).equipmentCursor.stack.instanceId,identity);assert.equal(carriedWeight(personal(s)),weight);
 s=attachment(save(s),'attach');assert.equal(personal(s).equipmentCursor,undefined);assert.equal(personal(s).weaponFittings.bayonet.instanceId,identity);assert.equal(carriedWeight(personal(s)),weight);
 const assembly=structuredClone(personal(s).weaponFittings.bayonet);
 s=attachment(save(s),'detach');assert.deepEqual(personal(s).weaponFittings,{});assert.equal(personal(s).equipmentCursor.sourceId,'attachment:hand:right');
 assert.equal(personal(s).equipmentCursor.stack.instanceId,identity);assert.equal(personal(s).equipmentCursor.stack.condition,assembly.condition);
 s=arrange(save(s),'placeEquipment',{destinationId:'large-4'});
 const placed=equipmentEndpoint(personal(s),'large-4'),item=readItemStack(personal(s),placed.item,1);
 assert.equal(item.instanceId,identity);assert.equal(placed.count,1);assert.equal(personal(s).equipmentCursor,undefined);assert.equal(carriedWeight(personal(s)),weight);
 assert.equal(s.merchants.retiro.stock['1811:india_socket'],stock);assert.deepEqual(save(s),s);
});

test('a stored Brown Bess accepts and releases its fitting without replacing the active hand',()=>{
 let s=fresh();s=arrange(s,'pickupEquipment',{sourceId:'hand:right'});s=arrange(s,'placeEquipment',{destinationId:'large-2'});
 const emptyHand=structuredClone(equipmentEndpoint(personal(s),'hand:right')),host=readItemStack(personal(s),equipmentEndpoint(personal(s),'large-2').item,1),before=structuredClone(personal(s));
 s=pickBayonet(s);const identity=personal(s).equipmentCursor.stack.instanceId;
 s=attachment(s,'attach','large-2');assert.deepEqual(equipmentEndpoint(personal(s),'hand:right'),emptyHand);assert.equal(personal(s).weaponDropped,true);assert.equal(personal(s).activeSlot,before.activeSlot);
 const stored=readItemStack(personal(s),equipmentEndpoint(personal(s),'large-2').item,1);assert.deepEqual({...stored,fittings:undefined},{...host,fittings:undefined});assert.equal(stored.fittings.bayonet.instanceId,identity);
 s=attachment(save(s),'detach','large-2');assert.equal(personal(s).equipmentCursor.sourceId,'attachment:large-2');assert.equal(personal(s).equipmentCursor.stack.instanceId,identity);assert.deepEqual(equipmentEndpoint(personal(s),'hand:right'),emptyHand);
 assert.equal(readItemStack(personal(s),equipmentEndpoint(personal(s),'large-2').item,1).fittings?.bayonet,undefined);assert.deepEqual(save(s),s);
});

test('exchanging two separately purchased fittings leaves the removed exact item on the cursor',()=>{
 let s=fitted();const previous=structuredClone(personal(s).weaponFittings.bayonet),stock=s.merchants.retiro.stock['1811:india_socket'];
 s=order(s,{type:'purchaseEquipment',item:'1811:india_socket'});
 assert.equal(s.merchants.retiro.stock['1811:india_socket'],stock-1);
 const purchase=s.armoryItems.find(item=>item.fittingPattern==='india_socket');assert.notEqual(purchase.instanceId,previous.instanceId);
 s=order(s,{type:'equip',operativeId:110,itemId:1811,slot:'blade',instanceId:purchase.id});s=pickBayonet(s);
 const before=structuredClone(personal(s)),sourceId=before.equipmentCursor.sourceId,weight=carriedWeight(before);
 s=attachment(save(s),'attach');const u=personal(s);
 assert.equal(u.weaponFittings.bayonet.instanceId,purchase.instanceId);assert.equal(u.equipmentCursor.stack.instanceId,previous.instanceId);assert.equal(u.equipmentCursor.stack.condition,previous.condition);assert.equal(u.equipmentCursor.sourceId,sourceId);
 assert.equal(carriedWeight(u),weight);assert.equal(u.loaded,before.loaded);assert.equal(u.condition,before.condition);
 s=arrange(save(s),'placeEquipment',{destinationId:'large-3'});
 assert.equal(readItemStack(personal(s),equipmentEndpoint(personal(s),'large-3').item,1).instanceId,previous.instanceId);assert.equal(personal(s).weaponFittings.bayonet.instanceId,purchase.instanceId);assert.deepEqual(save(s),s);
});

test('a full pack retains the detached bayonet on the saved cursor and rejects a second item pickup',()=>{
 let s=fitted();const u=personal(s),layout=inventoryUsage(u),identity=u.weaponFittings.bayonet.instanceId;
 // These identified ballast objects only fill the existing empty pockets.
 // The gun, paid bayonet, supplies, and already occupied pockets remain intact.
 const r=s.operativeState[110];r.inventory??={};
 for(const slot of layout.slots.filter(slot=>!slot.entry))r.inventory[`ballast-${slot.id}`]={name:`Lastre ${slot.id}`,instanceId:`ballast-${slot.id}`,count:1,weight:slot.size==='large'?3:.1};
 assert.equal(inventoryUsage(personal(s)).free,0);assert.equal(inventoryUsage(personal(s)).overloaded,false);
 const before=structuredClone(s),weight=carriedWeight(personal(s));s=attachment(s,'detach');
 assert.equal(inventoryUsage(personal(s)).free,0);assert.equal(carriedWeight(personal(s)),weight);assert.equal(personal(s).equipmentCursor.stack.instanceId,identity);
 assert.deepEqual(s.operativeState[110].inventory,before.operativeState[110].inventory);assert.deepEqual(save(s),s);
 const sourceId=pocket(personal(s),'rations');reject(s,{...cursorAction(personal(s),'pickupEquipment',{sourceId}),type:'sectorInventory',sector:'retiro',operativeId:110,direction:'arrange',kind:'cursor',cursorAction:'pickupEquipment'});
 // Before the sector is surveyed there is no legal ground fallback. Cancelling
 // cannot discard the finite item or quietly restore it to the gun.
 reject(s,{...cursorAction(personal(s),'returnEquipmentCursor'),type:'sectorInventory',sector:'retiro',operativeId:110,direction:'arrange',kind:'cursor',cursorAction:'returnEquipmentCursor'});
 assert.deepEqual(personal(s).weaponFittings,{});assert.equal(personal(s).equipmentCursor.stack.instanceId,identity);
});

test('custom fitting and detached cursor survive live deployment, exact reports, campaign saves and sector reentry',()=>{
 let s=fresh();
 // Authored provenance on the already purchased item is custody data, not a
 // new object, charge, condition grant, or campaign resource.
 s.operativeState[110].bladeMetadata={name:'Bayoneta Acosta',proof:{mark:'BA-110',history:['compra en Retiro']}};
 s=attachment(pickBayonet(s),'attach');const fitting=structuredClone(personal(s).weaponFittings.bayonet);let b;
 ({s,b}=visit(save(s)));assert.deepEqual(actor(b).weaponFittings.bayonet,fitting);
 let loaded=decodeSave(encodeSave(s,b));s=leave(loaded.campaign,loaded.battle);assert.deepEqual(personal(s).weaponFittings.bayonet,fitting);
 s=attachment(save(s),'detach');const exact=structuredClone(personal(s).equipmentCursor),cartridges=s.resources.cartridges;
 ({s,b}=visit(save(s)));assert.deepEqual(actor(b).equipmentCursor,exact);assert.deepEqual(actor(b).weaponFittings,{});
 loaded=decodeSave(encodeSave(s,b));b=act(loaded.battle,cursorAction(actor(loaded.battle),'placeEquipment',{destinationId:'large-4'}));
 s=leave(loaded.campaign,b);assert.equal(personal(s).equipmentCursor,undefined);assert.deepEqual(personal(s).weaponFittings,{});
 const stored=readItemStack(personal(s),equipmentEndpoint(personal(s),'large-4').item,1);
 assert.equal(stored.instanceId,fitting.instanceId);assert.deepEqual(stored.proof,fitting.metadata.proof);assert.equal(stored.name,fitting.metadata.name);assert.equal(s.resources.cartridges,cartridges);
 ({s,b}=visit(save(s)));assert.equal(actor(b).equipmentCursor,undefined);assert.equal(readItemStack(actor(b),equipmentEndpoint(actor(b),'large-4').item,1).instanceId,fitting.instanceId);
 assert.doesNotThrow(()=>decodeSave(encodeSave(s,b)));
});

test('stale fingerprints, missing hosts and absent attachment items reject without clock or ownership changes',()=>{
 const s=pickBayonet(fresh()),action=attachmentAction(s,'attach');
 for(const patch of [{expectedHost:'stale'},{expectedCursor:'stale'},{hostId:'large-4',expectedHost:equipmentFingerprint(personal(s),'large-4')},{hostId:'outfit',expectedHost:equipmentFingerprint(personal(s),'outfit')},{operation:'replace'},{count:2},{operativeId:999}])reject(s,{...action,...patch});
 const noCursor=fresh();reject(noCursor,attachmentAction(noCursor,'attach'));reject(noCursor,attachmentAction(noCursor,'detach'));
 const moved=arrange(s,'placeEquipment',{destinationId:'large-4'});reject(moved,action);
 const detached=attachment(attachment(s,'attach'),'detach');reject(detached,attachmentAction(detached,'detach'));
});

test('unavailable actors, unsafe regions and pending tactical encounters cannot use campaign attachment controls',()=>{
 const base=pickBayonet(fresh()),action=attachmentAction(base,'attach');
 for(const change of [
  s=>s.operativeState[110].hp=14,
  s=>s.operativeState[110].asleep=true,
  s=>s.operativeState[110].energy=0,
  s=>s.operativeState[110].captured=true,
  s=>s.operativeState[110].alive=false,
  s=>{s.squads[0].members=[];s.operativeState[110].location='ensenada';},
  s=>s.sectors.retiro.owner='royalist',
 ]){const changed=structuredClone(base);change(changed);reject(changed,action);}
 const pending=order(base,{type:'visitSector'});assert.ok(pending.pendingBattle);reject(pending,action);
});

test('another active cursor blocks detachment and duplicate bayonet ownership cannot enter campaign saves',()=>{
 let s=fitted();s=order(s,{type:'recruitCivic',id:114,term:'week'});s=arrange(s,'pickupEquipment',{sourceId:'hand:right'},114);
 const other=structuredClone(s.operativeState[114].equipmentCursor);reject(s,attachmentAction(s,'detach'));assert.deepEqual(s.operativeState[114].equipmentCursor,other);
 s=arrange(s,'returnEquipmentCursor',{},114);s=attachment(s,'detach');assert.deepEqual(save(s),s);
 const bad=structuredClone(s);bad.operativeState[114].equipmentCursor={sourceId:'attachment:hand:right',stack:structuredClone(personal(s).equipmentCursor.stack)};
 assert.throws(()=>validateEquipmentOwnership(bad,rosterFor(bad)),/identidad/);assert.throws(()=>save(bad));
});
